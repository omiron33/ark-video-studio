"""Camera path: inward dolly, small drift and roll, slam shake that decays."""

import math

from arkpipe.camera import camera_poses, frame_index_for_time

PULSES = (187.6, 188.0, 188.25, 188.8, 189.08, 189.36, 191.57)


def test_dolly_drift_roll_and_slam_shake():
    poses = camera_poses(
        n_frames=120,
        fps=24,
        t0=187.0,
        flash_time=187.153,
        slam_time=190.473,
        pulse_times=list(PULSES),
    )
    assert len(poses) == 120
    dolly = [p.dolly for p in poses]
    assert dolly[-1] > dolly[0] + 0.02
    assert all(b >= a - 1e-9 for a, b in zip(dolly, dolly[1:]))

    drift = [math.hypot(p.drift_x, p.drift_y) for p in poses]
    assert 1.0 < max(drift) < 24.0
    roll = [abs(p.roll) for p in poses]
    assert 0.02 < max(roll) < 1.0

    mags = [p.shake_mag for p in poses]
    slam_i = frame_index_for_time(190.473, 187.0, 24)
    assert max(range(120), key=lambda i: mags[i]) == slam_i
    pulse_i = frame_index_for_time(188.25, 187.0, 24)
    assert mags[slam_i] > mags[pulse_i] * 3
    assert mags[slam_i] > mags[slam_i + 1] > mags[slam_i + 3] > mags[slam_i + 6]
    assert mags[slam_i + 10] < mags[slam_i] * 0.25
