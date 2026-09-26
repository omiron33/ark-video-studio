"""Dolly, drift, roll, and hit shake for one shot.

dolly increases as the camera moves closer. Shake is a damped oscillation
whose magnitude is largest on the slam frame and then falls.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class CameraPose:
    frame: int
    time: float
    dolly: float
    drift_x: float
    drift_y: float
    roll: float
    shake_x: float
    shake_y: float
    shake_roll: float

    @property
    def shake_mag(self) -> float:
        return math.hypot(self.shake_x, self.shake_y)


def frame_index_for_time(t: float, t0: float, fps: int) -> int:
    return int(round((t - t0) * fps))


def _hit(dt: float, amp: float, decay: float, freq: float) -> tuple[float, float, float]:
    """Return dx, dy, droll. Magnitude peaks at dt=0 and then falls."""
    if dt < 0.0:
        return 0.0, 0.0, 0.0
    env = math.exp(-dt / decay)
    wobble = math.cos(2.0 * math.pi * freq * dt)
    sx = amp * env * wobble
    sy = amp * 0.36 * env * math.cos(2.0 * math.pi * freq * dt + 0.7)
    sroll = (amp / 110.0) * env * wobble
    return sx, sy, sroll


def camera_poses(
    n_frames: int = 120,
    fps: int = 24,
    t0: float = 187.0,
    flash_time: float = 187.153,
    slam_time: float = 190.473,
    pulse_times: list[float] | tuple[float, ...] = (),
    slam_amp: float = 34.0,
    pulse_amp: float = 4.0,
) -> list[CameraPose]:
    """One pose per frame. Dolly is monotonic and inward."""
    slam_frame = frame_index_for_time(slam_time, t0, fps)
    pulse_frames = [frame_index_for_time(p, t0, fps) for p in pulse_times]
    # Flash is a light cue. A very small shake keeps it from stealing the slam peak.
    flash_frame = frame_index_for_time(flash_time, t0, fps)
    events = [(slam_frame, slam_amp, 0.145, 8.5)]
    for pf in pulse_frames:
        if pf == slam_frame:
            continue
        events.append((pf, pulse_amp, 0.065, 12.0))
    events.append((flash_frame, 1.2, 0.05, 14.0))

    poses: list[CameraPose] = []
    for i in range(n_frames):
        u = 0.0 if n_frames == 1 else i / (n_frames - 1)
        # Slow push in. The value is extra scale above 1, applied in the compositor.
        dolly = 0.010 + 0.055 * u
        drift_x = 10.5 * math.sin(2.0 * math.pi * u * 0.52)
        drift_y = 4.2 * math.sin(2.0 * math.pi * u * 0.33 + 0.55)
        roll = 0.30 * math.sin(math.pi * u)
        sx = sy = sroll = 0.0
        for ef, amp, decay, freq in events:
            dx, dy, dr = _hit((i - ef) / fps, amp, decay, freq)
            sx += dx
            sy += dy
            sroll += dr
        poses.append(
            CameraPose(
                frame=i,
                time=t0 + i / fps,
                dolly=dolly,
                drift_x=drift_x,
                drift_y=drift_y,
                roll=roll,
                shake_x=sx,
                shake_y=sy,
                shake_roll=sroll,
            )
        )
    return poses
