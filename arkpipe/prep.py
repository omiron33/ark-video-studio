"""Upscale, Depth Anything V2 on MPS, feathered layers, inpaint, cache.

The second launch of the same shot must hit this cache and skip the model.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import cv2
import numpy as np

from arkpipe.layers import inpaint_layer_backfill, split_depth_layers

MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"
PREP_VERSION = "1"


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cache_key(source: Path, settings: dict) -> str:
    blob = json.dumps({"source": _sha256_file(source), "settings": settings, "v": PREP_VERSION}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:20]


def upscale_plate(rgb: np.ndarray, plate_w: int, plate_h: int) -> np.ndarray:
    return cv2.resize(rgb, (plate_w, plate_h), interpolation=cv2.INTER_LANCZOS4)


def orient_closeness(depth: np.ndarray) -> tuple[np.ndarray, bool]:
    """Return a map where larger values are closer. Flip if the sky reads nearer than the ground."""
    d = depth.astype(np.float32)
    h = d.shape[0]
    sky = float(d[: max(1, int(h * 0.18))].mean())
    ground = float(d[int(h * 0.72) :].mean())
    flipped = ground < sky
    if flipped:
        d = d.max() - d
    d -= d.min()
    peak = float(d.max())
    if peak > 0:
        d /= peak
    return d, flipped


def depth_normals_ndotl(closeness: np.ndarray) -> np.ndarray:
    """Light from the upper left, shaped by depth gradients."""
    d = closeness.astype(np.float32)
    gx = cv2.Sobel(d, cv2.CV_32F, 1, 0, ksize=5)
    gy = cv2.Sobel(d, cv2.CV_32F, 0, 1, ksize=5)
    nx = -gx
    ny = -gy
    nz = np.full_like(d, 0.40)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    light = np.array([-0.84, -0.20, 0.50], dtype=np.float32)
    light /= np.linalg.norm(light)
    ndotl = (nx / norm) * light[0] + (ny / norm) * light[1] + (nz / norm) * light[2]
    return np.clip(ndotl, 0.0, 1.0).astype(np.float32)


def detect_amber(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Door slit, ground reflection, and a dark wood color sampled beside the slit."""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    amber = (r > 120) & (r > g + 15) & (g > b + 10) & (r > b + 35)
    h, w = amber.shape
    door = np.zeros((h, w), np.float32)
    door_roi = amber.copy()
    door_roi[:, : int(w * 0.45)] = False
    door_roi[:, int(w * 0.80) :] = False
    door_roi[: int(h * 0.20), :] = False
    door_roi[int(h * 0.74) :, :] = False
    door[door_roi] = 1.0
    if int(door_roi.sum()) > 30:
        door = cv2.GaussianBlur(door, (0, 0), 1.2)

    ground = np.zeros((h, w), np.float32)
    grow = amber.copy()
    grow[: int(h * 0.70), :] = False
    ground[grow] = 1.0
    if int(grow.sum()) > 10:
        ground = cv2.GaussianBlur(ground, (0, 0), 1.6)

    wood = np.array([18, 16, 14], dtype=np.float32) / 255.0
    ys, xs = np.nonzero(door_roi)
    if len(xs) > 30:
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        pad = 18
        y_a, y_b = max(0, y0 - pad), min(h, y1 + pad)
        x_a, x_b = max(0, x0 - pad), min(w, x1 + pad)
        region = rgb[y_a:y_b, x_a:x_b]
        local = door_roi[y_a:y_b, x_a:x_b]
        samples = region[~local]
        if len(samples) > 50:
            dark = samples[samples.mean(axis=1) < 70]
            use = dark if len(dark) > 30 else samples
            wood = np.median(use, axis=0).astype(np.float32) / 255.0
    return door, ground, wood


def infer_depth_mps(rgb: np.ndarray) -> np.ndarray:
    """Relative Depth Anything V2. Refuses CPU and metric checkpoints."""
    import torch
    from PIL import Image
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    if not torch.backends.mps.is_available():
        raise RuntimeError("MPS is not available. Refusing to run depth on another device.")
    device = torch.device("mps")
    print("Depth Anything V2 on mps", flush=True)
    print(f"model: {MODEL_ID}", flush=True)
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID)
    kind = getattr(model.config, "depth_estimation_type", None)
    if kind != "relative":
        raise RuntimeError(f"refusing depth_estimation_type={kind}. Relative Depth Anything V2 is required.")
    if "metric" in MODEL_ID.lower():
        raise RuntimeError("refusing a metric depth checkpoint")
    if model.config.max_depth is None:
        model.config.max_depth = 1.0
        model.head.max_depth = 1.0
    model.to(device)
    model.eval()

    h, w = rgb.shape[:2]
    max_side = 1024
    scale = min(1.0, max_side / max(h, w))
    pil = Image.fromarray(rgb)
    if scale < 1.0:
        pil = pil.resize((int(round(w * scale)), int(round(h * scale))), Image.Resampling.LANCZOS)
    inputs = processor(images=pil, return_tensors="pt")
    tensor_inputs = {k: v.to(device) for k, v in inputs.items() if hasattr(v, "to")}
    with torch.no_grad():
        predicted = model(**tensor_inputs).predicted_depth
    pred = predicted[0].detach().float().cpu().numpy()
    del predicted, tensor_inputs, inputs, model
    torch.mps.empty_cache()
    return cv2.resize(pred, (w, h), interpolation=cv2.INTER_LINEAR)


def depth_preview_bgr(closeness: np.ndarray) -> np.ndarray:
    gray = np.clip(closeness * 255.0, 0, 255).astype(np.uint8)
    return cv2.applyColorMap(gray, cv2.COLORMAP_INFERNO)


def _settings(plate_w: int, plate_h: int, n_layers: int, feather_px: float, reveal_px: int) -> dict:
    return {
        "plate": [plate_w, plate_h],
        "model": MODEL_ID,
        "layers": n_layers,
        "feather_px": feather_px,
        "reveal_px": reveal_px,
        "infer_max_side": 1024,
    }


def load_or_build_prep(cfg: dict, root: Path) -> tuple[dict, bool]:
    """Return prep arrays and whether the disk cache satisfied the request."""
    source = (root / cfg["source_image"]).resolve()
    plate_w = int(cfg.get("plate_width", 2304))
    plate_h = int(cfg.get("plate_height", 1296))
    n_layers = int(cfg.get("layers", 4))
    feather_px = float(cfg.get("feather_px", 3.0))
    reveal_px = int(cfg.get("reveal_px", 72))
    settings = _settings(plate_w, plate_h, n_layers, feather_px, reveal_px)
    key = cache_key(source, settings)
    cache_dir = root / "cache" / cfg["id"] / key
    archive = cache_dir / "prep.npz"
    preview_path = Path(cfg.get("depth_preview", "out/depth_preview.png"))
    if not preview_path.is_absolute():
        preview_path = root / preview_path

    if archive.exists():
        print("prep cache hit for depth and layers", flush=True)
        data = np.load(archive, allow_pickle=False)
        prep = {
            "plate": data["plate"],
            "depth": data["depth"],
            "masks": [data[f"mask{i}"] for i in range(n_layers)],
            "plates": [data[f"plate{i}"] for i in range(n_layers)],
            "ndotl": data["ndotl"],
            "door_slit": data["door_slit"],
            "ground_glow": data["ground_glow"],
            "wood": data["wood"],
            "door_layer": int(data["door_layer"]),
            "preview": str(preview_path),
            "plate_size": (plate_w, plate_h),
            "flipped": bool(data["flipped"]),
        }
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        if not preview_path.exists():
            cv2.imwrite(str(preview_path), depth_preview_bgr(prep["depth"]))
        print(f"layers: {n_layers}", flush=True)
        print(f"depth preview: {preview_path}", flush=True)
        return prep, True

    print("prep cache miss", flush=True)
    bgr = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(source)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    plate = upscale_plate(rgb, plate_w, plate_h)
    raw_depth = infer_depth_mps(plate)
    closeness, flipped = orient_closeness(raw_depth)
    print(f"depth oriented flipped={flipped}", flush=True)
    masks = split_depth_layers(closeness, n_layers=n_layers, feather_px=feather_px)
    plates = inpaint_layer_backfill(plate, masks, reveal_px=reveal_px, radius=5)
    ndotl = depth_normals_ndotl(closeness)
    door_slit, ground_glow, wood = detect_amber(plate)
    overlaps = []
    for mask in masks:
        overlaps.append(float((mask * (door_slit > 0.2)).sum()))
    door_layer = int(np.argmax(overlaps))
    print(f"layers: {n_layers}", flush=True)
    print(f"door layer: {door_layer}", flush=True)

    cache_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "plate": plate,
        "depth": closeness.astype(np.float32),
        "ndotl": ndotl,
        "door_slit": door_slit.astype(np.float32),
        "ground_glow": ground_glow.astype(np.float32),
        "wood": wood.astype(np.float32),
        "door_layer": np.int32(door_layer),
        "flipped": np.int32(1 if flipped else 0),
    }
    for i in range(n_layers):
        payload[f"mask{i}"] = masks[i].astype(np.float32)
        payload[f"plate{i}"] = plates[i]
    np.savez_compressed(archive, **payload)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(preview_path), depth_preview_bgr(closeness))
    print(f"depth preview: {preview_path}", flush=True)
    prep = {
        "plate": plate,
        "depth": closeness,
        "masks": masks,
        "plates": plates,
        "ndotl": ndotl,
        "door_slit": door_slit,
        "ground_glow": ground_glow,
        "wood": wood,
        "door_layer": door_layer,
        "preview": str(preview_path),
        "plate_size": (plate_w, plate_h),
        "flipped": flipped,
    }
    return prep, False
