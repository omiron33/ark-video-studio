"""Submit and finish the two Psalm 23 Jesus shots through a local ComfyUI SSH tunnel.

The normal project helper calls PowerShell on OmiPC. On this run PowerShell hung,
while the ComfyUI HTTP API remained healthy through an SSH tunnel. This script
keeps the same frozen H3 workflow and refuses to submit into an occupied queue.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import mimetypes
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request
import uuid

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
ASSETS = PROJECT / "assets" / "video"
SHOTS = {"jesus-pov-rescue", "jesus-pov-rescue-v2", "jesus-with-people", "jesus-with-people-v2"}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def request_json(base: str, route: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base + route, data=data, headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def upload(base: str, path: Path) -> str:
    boundary = "----codex-" + uuid.uuid4().hex
    name = path.name
    contents = path.read_bytes()
    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + contents + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(base + "/upload/image", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=90) as response:
        result = json.load(response)
    return result["name"]


def submit(base: str, shot: str, frames: int, seed: int):
    out = ROOT / shot
    receipt_path = out / "submission.json"
    if receipt_path.exists():
        raise SystemExit(f"Already submitted: {receipt_path}")
    queue = request_json(base, "/queue")
    if queue.get("queue_running") or queue.get("queue_pending"):
        raise SystemExit("ComfyUI queue occupied; preserve the other work and try later.")
    first, last = out / "first.png", out / "last.png"
    prompt_path = out / "motion-prompt.txt"
    prompt = prompt_path.read_text().strip()
    workflow = json.loads((ROOT / "h3-workflow-template.json").read_text())
    first_name = upload(base, first)
    last_name = upload(base, last)
    workflow["16"]["inputs"]["image"] = first_name
    workflow["18"] = {"class_type": "LoadImage", "inputs": {"image": last_name}}
    workflow["6"]["inputs"].update({"prompt": prompt, "length": frames, "first_frame": ["16", 0], "last_frame": ["18", 0]})
    workflow["8"]["inputs"]["noise_seed"] = seed
    workflow["15"]["inputs"]["filename_prefix"] = f"psalm23-production/{shot}"
    workflow_path = out / "workflow.json"
    workflow_path.write_text(json.dumps(workflow, indent=2) + "\n")
    result = request_json(base, "/prompt", {"prompt": workflow, "client_id": "psalm23-jesus-agent"})
    receipt = {
        "promptId": result["prompt_id"], "number": result.get("number"), "nodeErrors": result.get("node_errors"),
        "shot": shot, "submittedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model": "MiniMax H3 FL2VA int8 convrot with four-step turbo LoRA", "provider": "local OmiPC ComfyUI over SSH tunnel",
        "cost": "local GPU; no paid service", "conditioning": "first_frame+last_frame",
        "firstImage": str(first), "firstSha256": sha(first), "firstUploadedName": first_name,
        "lastImage": str(last), "lastSha256": sha(last), "lastUploadedName": last_name,
        "promptFile": str(prompt_path), "promptSha256": sha(prompt_path),
        "workflow": str(workflow_path), "workflowSha256": sha(workflow_path),
        "framesRequested": frames, "fpsRequested": 24, "seed": seed,
    }
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt, indent=2))


def status(base: str, shot: str):
    out = ROOT / shot
    receipt = json.loads((out / "submission.json").read_text())
    history = request_json(base, "/history/" + receipt["promptId"])
    (out / "history.json").write_text(json.dumps(history, indent=2) + "\n")
    job = history.get(receipt["promptId"], {})
    print(json.dumps({"shot": shot, "status": job.get("status"), "outputs": job.get("outputs"), "queue": request_json(base, "/queue")}, indent=2))


def run(command):
    return subprocess.run(command, check=True, capture_output=True, text=True).stdout


def finish(base: str, shot: str):
    out = ROOT / shot
    receipt = json.loads((out / "submission.json").read_text())
    history = request_json(base, "/history/" + receipt["promptId"])
    job = history.get(receipt["promptId"], {})
    if not job.get("status", {}).get("completed") or job["status"].get("status_str") != "success":
        raise SystemExit(f"Generation has not completed successfully: {job.get('status')}")
    (out / "history.json").write_text(json.dumps(history, indent=2) + "\n")
    item = job["outputs"]["15"]["images"][0]
    if item.get("type") != "output":
        raise SystemExit("Unexpected output type")
    query = urllib.parse.urlencode({"filename": item["filename"], "subfolder": item["subfolder"], "type": "output"})
    raw = out / "raw.mp4"
    with urllib.request.urlopen(base + "/view?" + query, timeout=180) as response:
        raw.write_bytes(response.read())
    ASSETS.mkdir(parents=True, exist_ok=True)
    finished = ASSETS / f"{shot}.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-vf", "crop=960:540:0:2", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(finished)])
    run(["ffmpeg", "-v", "error", "-i", str(finished), "-f", "null", "-"])
    probe = json.loads(run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(finished)]))
    (out / "probe.json").write_text(json.dumps(probe, indent=2) + "\n")
    stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
    count = int(stream["nb_read_frames"])
    if abs(count - receipt["framesRequested"]) > 3:
        raise SystemExit(f"Unexpected frame count: {count} vs {receipt['framesRequested']}")
    first_poster = ASSETS / f"{shot}-first.png"
    last_poster = ASSETS / f"{shot}-last.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(finished), "-frames:v", "1", str(first_poster)])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(finished), "-vf", f"select=eq(n\\,{count-1})", "-vsync", "0", "-frames:v", "1", str(last_poster)])
    review_frames = out / "review-frames"
    review_frames.mkdir(exist_ok=True)
    run(["ffmpeg", "-v", "error", "-y", "-i", str(finished), "-vf", "fps=6,scale=320:180", str(review_frames / "frame-%03d.jpg")])
    paths = sorted(review_frames.glob("frame-*.jpg"))
    columns = 6
    rows = (len(paths) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 320, rows * 205), (12, 18, 14))
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        x, y = index % columns * 320, index // columns * 205
        sheet.paste(Image.open(path), (x, y))
        draw.text((x + 8, y + 183), f"{index/6:.3f}s", fill=(241, 230, 203))
    sheet_path = out / "review-6fps.jpg"
    sheet.save(sheet_path, quality=92)
    record = {
        "shot": shot, "provider": "local OmiPC ComfyUI", "model": "MiniMax H3 FL2VA int8 convrot with four-step turbo LoRA",
        "promptId": receipt["promptId"], "firstImageSha256": receipt["firstSha256"], "lastImageSha256": receipt["lastSha256"],
        "conditioning": receipt["conditioning"], "seed": receipt["seed"],
        "raw": str(raw), "rawSha256": sha(raw), "finished": str(finished), "finishedSha256": sha(finished),
        "video": {"width": 960, "height": 540, "fps": 24, "frames": count, "requestedFrames": receipt["framesRequested"], "durationSeconds": count / 24, "audio": False},
        "processing": "Crop 2px top/bottom, silent H264 CRF17, no interpolation, retiming or upscale",
        "fullDecode": "pass", "reviewContactSheet": str(sheet_path), "reviewContactSheetSha256": sha(sheet_path),
        "firstPoster": str(first_poster), "firstPosterSha256": sha(first_poster),
        "lastPoster": str(last_poster), "lastPosterSha256": sha(last_poster),
        "reviewStatus": "awaiting_visual_inspection", "finishedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    (out / "provenance.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["submit", "status", "finish"])
    parser.add_argument("shot", choices=sorted(SHOTS))
    parser.add_argument("--base", default="http://127.0.0.1:18189")
    parser.add_argument("--frames", type=int, choices=[124, 172, 226], default=172)
    parser.add_argument("--seed", type=int)
    args = parser.parse_args()
    if args.operation == "submit":
        if args.seed is None:
            parser.error("--seed required for submit")
        submit(args.base, args.shot, args.frames, args.seed)
    elif args.operation == "status":
        status(args.base, args.shot)
    else:
        finish(args.base, args.shot)
