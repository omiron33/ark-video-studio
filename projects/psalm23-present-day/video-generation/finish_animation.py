"""Add deliberate, seek-independent authored motion to local H3 texture footage.

The H3 model gives the filaments tactile life but moves them only subtly. This
pass makes the actual semantic action visible: repair and ordered travel.
"""

from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT, FPS, FRAMES = 960, 540, 24, 124
TAU = math.tau


def smooth(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3.0 - 2.0 * x)


def soul_path(theta: float, offset: float = 0.0) -> tuple[float, float]:
    rx = 305 + offset + 6 * math.sin(3 * theta + offset * .04)
    ry = 204 + offset * .54 + 4 * math.sin(5 * theta)
    return 480 + rx * math.cos(theta), 268 + ry * math.sin(theta)


def life_path(theta: float, offset: float = 0.0) -> tuple[float, float]:
    return (480 + 356 * math.sin(theta) + offset * math.cos(theta),
            366 + 91 * math.sin(2 * theta) + offset * .4 * math.sin(2 * theta))


def draw_points(draw: ImageDraw.ImageDraw, points, fill: int, width: int = 1):
    if len(points) >= 2:
        draw.line(points, fill=fill, width=width, joint="curve")


def soul_layer(frame: int) -> Image.Image:
    t = frame / FPS
    p = t / (FRAMES / FPS)
    layer = Image.new("L", (WIDTH, HEIGHT), 0)
    d = ImageDraw.Draw(layer)
    # A repaired arc grows deliberately into the gap of the photographic ring.
    for strand in range(23):
        delay = .08 + strand * .011
        reveal = smooth((p - delay) / (.43 + .009 * (strand % 5)))
        if reveal <= 0:
            continue
        theta0 = -2.49 + .075 * math.sin(strand * 2.31) + strand * .001
        theta1 = -.66 + .09 * math.sin(strand * 1.77)
        count = max(2, int(150 * reveal))
        offset = (strand - 11) * 1.05 + 5.5 * math.sin(strand * .83)
        pts = []
        for k in range(count):
            theta = theta0 + (theta1-theta0) * reveal * k/(count-1)
            x,y = soul_path(theta,offset)
            x += 2.8 * math.sin(theta*5.2+strand*.76)
            y += 2.0 * math.sin(theta*7.1+strand*.47)
            pts.append((x,y))
        fill = 48 + (strand % 5) * 13
        draw_points(d, pts, fill, 1)
        if strand % 4 == 0:
            x,y = pts[-1]
            d.ellipse((x-1.8,y-1.8,x+1.8,y+1.8), fill=176)
    # Additional repairing sutures appear around the lower contour.
    for j in range(13):
        start = .17 + .035*j
        amt = smooth((p-start)/.28)
        if amt <= 0:
            continue
        a = .30 + j * .196
        x0,y0 = soul_path(a,-24)
        x1,y1 = soul_path(a+ .09*amt,13)
        d.line([(x0,y0),(x1,y1)],fill=62+(j%3)*16,width=1)
    # Small moving bright packets let the viewer read continuous change.
    for j in range(21):
        theta = -2.45 + j * .42 + t * (.55 + .07*(j%3))
        offset = ((j*17)%37)-18
        head = soul_path(theta,offset)
        tail = [soul_path(theta - k*.009,offset) for k in range(13)]
        draw_points(d, tail, 48 + 5*(j%4), 1)
        x,y=head
        radius=1.5+(j%4)*.35
        d.ellipse((x-radius,y-radius,x+radius,y+radius),fill=153+(j%4)*15)
    return layer


def life_layer(frame: int) -> Image.Image:
    t=frame/FPS
    p=t/(FRAMES/FPS)
    layer=Image.new("L",(WIDTH,HEIGHT),0)
    d=ImageDraw.Draw(layer)
    # Many lifelines travel on related but separate courses. Their varied
    # velocity and phases prevent a single mechanical stock infinity loop.
    for j in range(39):
        theta0=(j*2.399963229728653)+t*(.75+.05*(j%7))
        offset=((j*37)%49)-24
        pts=[]
        for k in range(35):
            theta=theta0-k*.013
            x,y=life_path(theta,offset + 2.0*math.sin(theta*3+j*.6))
            pts.append((x,y))
        draw_points(d,pts,40+(j%6)*11,1)
        if j%2==0:
            x,y=pts[0];rad=1.0+(j%4)*.47
            d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=130+(j%5)*17)
    # Four phrase-length pulses make successive days visibly ignite from left
    # to right instead of only shimmering in place.
    for wave in range(4):
        u=(p*1.2-wave*.27)
        if not 0<=u<=1:
            continue
        x=-80 + u*1120
        y=365 + 40*math.sin(u*TAU)
        for k in range(11):
            dx=k*8
            yy=y+math.sin((x-dx)*.025+wave)*12
            r=max(.4,2.6-k*.19)
            d.ellipse((x-dx-r,yy-r,x-dx+r,yy+r),fill=max(0,180-k*13))
    # Fine independent drifting seed lights add quiet motion above the path.
    for j in range(51):
        x=(j*109.7+t*(9+j%5*3))%WIDTH
        y=206+((j*47)%226)+9*math.sin(t*.7+j)
        if j%5==0:
            d.ellipse((x,y,x+1.5,y+1.5),fill=38)
    return layer


def compose(source: Path, output: Path, mode: str) -> None:
    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH].astype(np.float32)
    if mode == "soul":
        theta = np.arctan2((yy-268)/204, (xx-480)/305)
        irregularity = .12*np.sin(xx/37+yy/61)+.055*np.sin(xx/17-yy/29)
        phase = np.mod(theta-2.4+irregularity, TAU)/TAU
        radial = np.sqrt(((xx-480)/305)**2 + ((yy-268)/204)**2)
        contour = np.exp(-((radial-1)/.19)**2)
    else:
        # The front drifts along a slightly irregular contour; this avoids a
        # visible rectangular wipe through the organic infinity fibers.
        phase = xx/WIDTH + .026*np.sin(yy/49+xx/93)
        contour = np.ones_like(phase)
    decode = subprocess.Popen([
        "ffmpeg", "-v", "error", "-i", str(source), "-f", "rawvideo",
        "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    encode = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-", "-an",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium",
        "-movflags", "+faststart", str(output)], stdin=subprocess.PIPE)
    try:
        for frame in range(FRAMES):
            buf=decode.stdout.read(WIDTH*HEIGHT*3)
            if len(buf)!=WIDTH*HEIGHT*3:
                raise RuntimeError(f"source ended at frame {frame}")
            base=np.frombuffer(buf,dtype=np.uint8).reshape(HEIGHT,WIDTH,3).astype(np.float32)
            mask=(soul_layer(frame) if mode=="soul" else life_layer(frame))
            glow=mask.filter(ImageFilter.GaussianBlur(11))
            g=np.asarray(glow,dtype=np.float32)/255.0
            m=np.asarray(mask,dtype=np.float32)/255.0
            p=frame/(FRAMES-1)
            front=-.025+1.115*smooth(p/.76)
            width=.145 if mode=="soul" else .090
            unveil=np.clip((front-phase)/width+.5,0,1)
            unveil=unveil*unveil*(3-2*unveil)
            # Suppress the model's nearly still dark field. Only bright
            # generated fibers participate, and they are revealed in a
            # meaningful order as the singer completes the phrase.
            luma=base[...,0]*.22+base[...,1]*.60+base[...,2]*.18
            fiber=np.clip((luma-24)/31,0,1)[...,None]
            src=base*fiber
            broad=g[...,None]*np.array([184,113,37],dtype=np.float32)
            core=m[...,None]*np.array([255,223,151],dtype=np.float32)
            # A luminous tracer runs at the active repair/drawing edge. It
            # lights the fibers themselves rather than drawing a wipe line.
            crest=np.exp(-((phase-front)/(.031 if mode=="soul" else .039))**2)
            crest*=contour
            tracer=crest[...,None]*src*.95
            floor=.13 if mode=="soul" else .035
            gain=floor+(1-floor)*unveil
            light=(src+broad+core)*gain[...,None]+tracer
            encode.stdin.write(np.uint8(np.clip(light,0,255)).tobytes())
    finally:
        decode.stdout.close()
        encode.stdin.close()
    if decode.wait()!=0 or encode.wait()!=0:
        raise RuntimeError("ffmpeg source decode or animation encode failed")


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("mode", choices=["soul","life"])
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    a=parser.parse_args()
    compose(a.source,a.output,a.mode)
