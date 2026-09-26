"""Frame compositor: parallax, rain, fog, lightning, door, grade.

Rain and grain are seeded so two renders of the same shot match.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from arkpipe.camera import CameraPose

# Far sky moves least. Differentials stay small so the ark face does not split.
PARALLAX = (0.10, 0.40, 0.70, 1.0)


def layer_affine(
    pose: CameraPose,
    parallax: float,
    plate_w: int,
    plate_h: int,
    out_w: int,
    out_h: int,
) -> np.ndarray:
    """Map plate pixels into the output frame. Scale above 1 is a dolly in."""
    scale = 1.0 + pose.dolly * (0.88 + 0.12 * parallax)
    tx = pose.drift_x * (0.62 + 0.38 * parallax) + pose.shake_x
    ty = pose.drift_y * (0.62 + 0.38 * parallax) + pose.shake_y
    roll = pose.roll + pose.shake_roll
    rad = math.radians(roll)
    c = math.cos(rad)
    s = math.sin(rad)
    m00 = scale * c
    m01 = scale * (-s)
    m10 = scale * s
    m11 = scale * c
    cx = plate_w * 0.5
    cy = plate_h * 0.5
    m02 = (out_w * 0.5 - tx) - (m00 * cx + m01 * cy)
    m12 = (out_h * 0.5 - ty) - (m10 * cx + m11 * cy)
    return np.array([[m00, m01, m02], [m10, m11, m12]], dtype=np.float32)


def sample_corners_inside(matrix: np.ndarray, plate_w: int, plate_h: int, out_w: int, out_h: int) -> bool:
    inverse = cv2.invertAffineTransform(matrix)
    for x, y in ((0, 0), (out_w - 1, 0), (0, out_h - 1), (out_w - 1, out_h - 1)):
        px = float(inverse[0, 0] * x + inverse[0, 1] * y + inverse[0, 2])
        py = float(inverse[1, 0] * x + inverse[1, 1] * y + inverse[1, 2])
        if not (1.0 <= px <= plate_w - 2 and 1.0 <= py <= plate_h - 2):
            return False
    return True


def _warp_rgb(rgb: np.ndarray, matrix: np.ndarray, out_w: int, out_h: int, replicate: bool) -> np.ndarray:
    border = cv2.BORDER_REPLICATE if replicate else cv2.BORDER_CONSTANT
    return cv2.warpAffine(rgb, matrix, (out_w, out_h), flags=cv2.INTER_LINEAR, borderMode=border, borderValue=0)


def _warp_gray(gray: np.ndarray, matrix: np.ndarray, out_w: int, out_h: int) -> np.ndarray:
    return cv2.warpAffine(
        gray.astype(np.float32),
        matrix,
        (out_w, out_h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )


class RainField:
    """Sheets of rain, not a grid of dashes.

    Far drops are fine and faint. Near drops are long, motion-blurred, and sparse.
    Gust noise opens gaps so the field is not uniform.
    """

    def __init__(self, h: int, w: int, seed: int):
        self.h = h
        self.w = w
        rng = np.random.default_rng(seed)
        self.far_drops = self._drops(rng, 720, (260, 480), (5, 13), (0.03, 0.16), (0.035, 0.11), gusts=9)
        self.mid_drops = self._drops(rng, 160, (520, 880), (22, 48), (0.05, 0.26), (0.05, 0.16), gusts=6)
        self.near_drops = self._drops(rng, 64, (1200, 1900), (70, 150), (0.08, 0.36), (0.14, 0.38), gusts=5)
        self.splash_x = rng.uniform(0, w, 50)
        self.splash_y = rng.uniform(h * 0.82, h * 0.98, 50)
        self.splash_phase = rng.uniform(0, 1, 50)
        self.splash_len = rng.uniform(3, 11, 50)
        self.splash_amp = rng.uniform(0.12, 0.38, 50)
        gust = rng.random((h // 10, w // 10), dtype=np.float32)
        self.gust = cv2.GaussianBlur(gust, (0, 0), 2.4)

    @staticmethod
    def _drops(rng, n, speed, length, slant, alpha, gusts: int):
        centers = rng.uniform(-0.02, 1.02, gusts).astype(np.float32)
        assign = rng.integers(0, gusts, n)
        x = centers[assign] + rng.normal(0, 0.07, n).astype(np.float32)
        return {
            "x": x.astype(np.float32),
            "y": rng.uniform(0, 1, n).astype(np.float32),
            "speed": rng.uniform(*speed, n).astype(np.float32),
            "length": rng.uniform(*length, n).astype(np.float32),
            "slant": rng.uniform(*slant, n).astype(np.float32),
            "alpha": rng.uniform(*alpha, n).astype(np.float32),
            "jitter": rng.uniform(0, 1000, n).astype(np.float32),
        }

    def _gust_mask(self, t: float) -> np.ndarray:
        shift = np.array([[1, 0, t * 6.0], [0, 1, t * 1.5]], dtype=np.float32)
        moved = cv2.warpAffine(
            self.gust,
            shift,
            (self.gust.shape[1], self.gust.shape[0]),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_WRAP,
        )
        full = cv2.resize(moved, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        return np.clip((full - 0.30) / 0.50, 0.0, 1.0)

    def _streaks(self, drops: dict, t: float, blur: float, trail: bool) -> np.ndarray:
        h, w = self.h, self.w
        img = np.zeros((h, w), np.uint8)
        travel = drops["speed"] * t
        y = np.mod(drops["y"] * h + travel, h + drops["length"]) - drops["length"] * 0.2
        x = np.mod(drops["x"] * w + drops["slant"] * travel * 0.25 + drops["jitter"], w + 120.0) - 60.0
        for i in range(len(y)):
            slant = float(drops["slant"][i])
            length = float(drops["length"][i])
            x1 = int(x[i])
            y1 = int(y[i])
            x2 = int(x[i] + slant * length)
            y2 = int(y[i] + length)
            if y2 < 0 or y1 >= h or x1 >= w + 20 or x2 < -20:
                continue
            color = int(np.clip(drops["alpha"][i] * 255.0, 0, 255))
            cv2.line(img, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
            if trail:
                back = 0.45
                cv2.line(
                    img,
                    (int(x1 - slant * length * back), int(y1 - length * back)),
                    (x1, y1),
                    max(1, color // 3),
                    1,
                    cv2.LINE_AA,
                )
        out = img.astype(np.float32) / 255.0
        if blur > 0.05:
            out = cv2.GaussianBlur(out, (0, 0), blur)
        return out

    def far(self, t: float) -> np.ndarray:
        gust = self._gust_mask(t)
        fine = self._streaks(self.far_drops, t, 0.35, trail=False)
        mid = self._streaks(self.mid_drops, t, 0.7, trail=False)
        return np.clip((fine * 0.7 + mid) * (0.25 + 0.75 * gust), 0.0, 1.0)

    def near(self, t: float) -> np.ndarray:
        # Foreground streaks stay visible in the gaps. A light gust only.
        gust = 0.55 + 0.45 * self._gust_mask(t * 0.7)
        return self._streaks(self.near_drops, t, 1.15, trail=True) * gust

    def splashes(self, t: float) -> np.ndarray:
        h, w = self.h, self.w
        img = np.zeros((h, w), np.uint8)
        cycle = 0.62
        for i in range(len(self.splash_x)):
            phase = (t * 1.4 + float(self.splash_phase[i])) % cycle
            life = phase / 0.14
            if life >= 1.0:
                continue
            fade = (1.0 - life) * float(self.splash_amp[i])
            cx = int(self.splash_x[i])
            cy = int(self.splash_y[i])
            half = max(2, int(self.splash_len[i] * (0.35 + 0.65 * life)))
            tone = int(fade * 255)
            cv2.line(img, (cx - half, cy), (cx + half, cy), tone, 1, cv2.LINE_AA)
            if life < 0.4:
                cv2.line(img, (cx, cy), (cx - half // 2, cy - 3), tone // 2, 1, cv2.LINE_AA)
                cv2.line(img, (cx, cy), (cx + half // 2, cy - 3), tone // 2, 1, cv2.LINE_AA)
        return img.astype(np.float32) / 255.0


class FogField:
    def __init__(self, h: int, w: int, seed: int):
        rng = np.random.default_rng(seed + 17)
        base = rng.random((h // 8, w // 8), dtype=np.float32)
        self.base = cv2.GaussianBlur(base, (0, 0), 2.8)
        self.h = h
        self.w = w

    def at(self, t: float, drift: float) -> np.ndarray:
        shift_x = t * 14.0 * drift
        shift_y = t * 4.0 * drift
        matrix = np.array([[1, 0, shift_x], [0, 1, shift_y]], dtype=np.float32)
        moved = cv2.warpAffine(
            self.base,
            matrix,
            (self.base.shape[1], self.base.shape[0]),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_WRAP,
        )
        fog = cv2.resize(moved, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        vert = np.linspace(0.35, 1.0, self.h, dtype=np.float32)[:, None]
        return np.clip(fog * vert, 0.0, 1.0)


def _hit_env(t: float, center: float, decay: float, lead: float = 0.0) -> float:
    dt = t - center
    if dt < -lead or dt > decay * 5:
        return 0.0
    if dt < 0.0:
        return 1.0
    return math.exp(-dt / decay)


def door_openness(t: float, slam_t: float) -> float:
    """1 while the door is open. Collapses on the slam frame and stays shut."""
    dt = t - slam_t
    if dt < -1.0 / 48.0:
        return 1.0
    if dt < 1.0 / 24.0:
        return 0.05
    return 0.035


def close_slit(mask: np.ndarray, openness: float) -> tuple[np.ndarray, np.ndarray]:
    """Return the remaining glow and the mask of door light to replace with wood.

    An open door keeps the photograph. A shut door becomes one clean blade of light,
    not a ragged column of the original pixels.
    """
    if openness > 0.98:
        return mask, np.zeros_like(mask)
    col = mask.mean(axis=0)
    row = mask.max(axis=1)
    xs = np.nonzero(col > 0.008)[0]
    ys = np.nonzero(row > 0.05)[0]
    if xs.size < 2 or ys.size < 2:
        kill = np.clip(mask * (1.0 - openness), 0.0, 1.0)
        return mask * openness, kill
    cx = float(np.average(np.arange(mask.shape[1]), weights=col + 1e-6))
    sigma = 1.15
    column = np.exp(-0.5 * ((np.arange(mask.shape[1], dtype=np.float32) - cx) / sigma) ** 2)
    vert = cv2.GaussianBlur(row.reshape(-1, 1), (0, 0), 2.0).ravel()
    vert = np.clip(vert / max(float(vert.max()), 1e-6), 0.0, 1.0)
    # Keep the blade inside the doorway, not as a line across the whole frame.
    span = np.zeros(mask.shape[0], np.float32)
    span[int(ys[0]) : int(ys[-1]) + 1] = 1.0
    span = cv2.GaussianBlur(span.reshape(-1, 1), (0, 0), 2.0).ravel()
    line = (vert * span)[:, None] * column[None, :]
    # Follow the glow shape. A filled rectangle reads as a flat patch on the bricks.
    cover = cv2.GaussianBlur(np.clip(mask * 3.0, 0.0, 1.0), (0, 0), 2.4)
    kill = np.clip(cover * (1.0 - line), 0.0, 1.0)
    return line.astype(np.float32), kill.astype(np.float32)


def grade_teal_amber(rgb: np.ndarray) -> np.ndarray:
    """Crushed blacks, teal shadows, amber highlights. rgb is 0 to 1."""
    x = np.clip((rgb - 0.035) * 1.06, 0.0, 1.0)
    luma = 0.2126 * x[:, :, 0] + 0.7152 * x[:, :, 1] + 0.0722 * x[:, :, 2]
    shadow = np.clip(1.0 - luma * 2.4, 0.0, 1.0)[..., None]
    high = np.clip((luma - 0.50) / 0.50, 0.0, 1.0)[..., None]
    x = x + shadow * np.array([-0.025, 0.008, 0.030], dtype=np.float32)
    x = x + high * np.array([0.045, 0.008, -0.040], dtype=np.float32)
    return np.clip(x, 0.0, 1.0)


def _vignette(h: int, w: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - w * 0.5) / (w * 0.5)
    ny = (yy - h * 0.5) / (h * 0.5)
    radius = np.sqrt(nx * nx + ny * ny).astype(np.float32)
    return 1.0 - 0.40 * np.clip((radius - 0.55) / 0.95, 0.0, 1.0) ** 1.55


def _chromatic(rgb: np.ndarray) -> np.ndarray:
    out = rgb.copy()
    out[:, 1:, 0] = rgb[:, :-1, 0]
    out[:, :-1, 2] = rgb[:, 1:, 2]
    return out


def _grain(rgb: np.ndarray, seed: int, frame: int) -> np.ndarray:
    rng = np.random.default_rng(seed + frame * 17)
    h, w = rgb.shape[:2]
    noise = rng.standard_normal((h, w)).astype(np.float32)
    noise = cv2.GaussianBlur(noise, (0, 0), 0.55)
    luma = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    strength = 0.010 + 0.020 * (1.0 - luma)
    return np.clip(rgb + noise[..., None] * strength[..., None], 0.0, 1.0)


def _add_mono(rgb: np.ndarray, mono: np.ndarray, color: np.ndarray, gain: float) -> np.ndarray:
    return np.clip(rgb + mono[..., None] * color * gain, 0.0, 1.0)


def render_frame(
    prep: dict,
    pose: CameraPose,
    rain: RainField,
    fog: FogField,
    *,
    out_w: int,
    out_h: int,
    seed: int,
    flash_time: float,
    slam_time: float,
    pulse_times: list[float],
    vignette: np.ndarray,
) -> np.ndarray:
    """Return one RGB uint8 frame."""
    plate_w, plate_h = prep["plate_size"]
    n_layers = len(prep["masks"])
    parallax = PARALLAX[:n_layers] if n_layers == 4 else tuple(np.linspace(0.08, 1.0, n_layers))
    matrices = [
        layer_affine(pose, float(parallax[i]), plate_w, plate_h, out_w, out_h) for i in range(n_layers)
    ]
    for matrix in matrices:
        if not sample_corners_inside(matrix, plate_w, plate_h, out_w, out_h):
            raise RuntimeError("camera move reached the plate edge. Increase overscan.")

    local_t = pose.time - 187.0
    far_rain = rain.far(local_t)
    near_rain = rain.near(local_t)
    splash = rain.splashes(local_t)
    fog_back = fog.at(local_t, 0.6)
    fog_mid = fog.at(local_t + 3.0, 1.0)

    acc = None
    for i in range(n_layers):
        warped = _warp_rgb(prep["plates"][i], matrices[i], out_w, out_h, replicate=(i == 0))
        warped = warped.astype(np.float32) / 255.0
        if i == 0:
            acc = warped
            acc = _blend_fog(acc, fog_back, 0.11)
            acc = _add_mono(acc, far_rain, np.array([0.62, 0.70, 0.78], np.float32), 0.42)
        else:
            alpha = _warp_gray(prep["masks"][i], matrices[i], out_w, out_h)[..., None]
            if i == min(2, n_layers - 1):
                acc = _blend_fog(acc, fog_mid, 0.09)
            acc = warped * alpha + acc * (1.0 - alpha)

    acc = _add_mono(acc, near_rain, np.array([0.70, 0.76, 0.82], np.float32), 0.55)
    acc = _add_mono(acc, splash, np.array([0.78, 0.82, 0.84], np.float32), 0.40)

    door_i = int(np.clip(prep["door_layer"], 0, n_layers - 1))
    slit = _warp_gray(prep["door_slit"], matrices[door_i], out_w, out_h)
    ground = _warp_gray(prep["ground_glow"], matrices[door_i], out_w, out_h)
    openness = door_openness(pose.time, slam_time)
    slit_left, kill = close_slit(slit, openness)
    kill = np.maximum(kill, ground * (1.0 - openness))
    # Crush the glow in place so the planks stay. Do not paste a flat color.
    acc = acc * (1.0 - kill[..., None] * 0.94)
    if openness <= 0.98:
        core = np.clip(slit_left, 0.0, 1.0)[..., None]
        blade = np.array([1.0, 0.58, 0.14], dtype=np.float32)
        acc = np.clip(acc * (1.0 - core * 0.75) + blade * core, 0.0, 1.0)

    flick = 0.90 + 0.10 * math.sin(pose.time * 21.0)
    flick *= 0.94 + 0.06 * math.sin(pose.time * 9.0 + 1.3)
    bloom = cv2.GaussianBlur(slit_left, (0, 0), 13) * 0.85 + cv2.GaussianBlur(slit_left, (0, 0), 34) * 0.40
    bloom = bloom + cv2.GaussianBlur(ground, (0, 0), 19) * openness * 0.65
    amber = np.array([1.05, 0.48, 0.08], dtype=np.float32)
    acc = np.clip(acc + bloom[..., None] * amber * flick, 0.0, 1.0)

    ndotl = _warp_gray(prep["ndotl"], matrices[min(1, n_layers - 1)], out_w, out_h)
    xs = np.linspace(1.0, 0.12, out_w, dtype=np.float32)
    left = xs[None, :]
    flash = _hit_env(pose.time, flash_time, 0.042)
    pulse = 0.0
    for pt in pulse_times:
        if pt >= slam_time - 0.05:
            continue
        pulse = max(pulse, _hit_env(pose.time, pt, 0.035) * 0.45)
    relight = (0.055 + 0.62 * flash) * left * (0.30 + 0.70 * ndotl)
    relight = relight + pulse * 0.08
    cool = np.array([0.62, 0.78, 1.0], dtype=np.float32)
    acc = np.clip(acc + relight[..., None] * cool, 0.0, 1.0)
    # A touch of warm pulse on the door before it shuts, separate from the slam.
    if pulse > 0.0:
        acc = np.clip(acc + slit_left[..., None] * amber * pulse * 0.25, 0.0, 1.0)

    acc = grade_teal_amber(acc)
    acc *= vignette[..., None]
    acc = _chromatic(acc)
    acc = _grain(acc, seed, pose.frame)
    return np.clip(acc * 255.0 + 0.5, 0, 255).astype(np.uint8)


def _blend_fog(rgb: np.ndarray, fog: np.ndarray, amount: float) -> np.ndarray:
    color = np.array([0.10, 0.13, 0.15], dtype=np.float32)
    alpha = np.clip(fog * amount, 0.0, 0.35)[..., None]
    return rgb * (1.0 - alpha) + color * alpha
