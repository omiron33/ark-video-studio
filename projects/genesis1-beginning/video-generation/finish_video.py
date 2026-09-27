"""Fetch, finish and decode evidence. This does not grant visual acceptance."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, datetime, hashlib, json, math, subprocess
from h3_jobs import ROOT, PROJECT, HOST, digest

parser = argparse.ArgumentParser()
parser.add_argument('name')
parser.add_argument('--resume-unreviewed', action='store_true')
args = parser.parse_args()
name = args.name
submission = json.loads((ROOT / f'{name}-submission.json').read_text())
history = json.loads((ROOT / f'{name}-history.json').read_text())[submission['prompt_id']]
assert history['status']['completed'] and history['status']['status_str'] == 'success'
result = history['outputs']['15']['images'][0]
raw = ROOT / f'{name}-raw.mp4'
source = 'C:/AI/ComfyUI-Music3/output/' + result['subfolder'] + '/' + result['filename']
subprocess.run(['scp', '-o', 'HostKeyAlias=omipc', HOST + ':' + source, str(raw)], check=True, timeout=60, capture_output=True)
asset = PROJECT / 'assets' / f'{name}-motion.mp4'
if asset.exists() and (not args.resume_unreviewed or (ROOT / f'{name}-provenance.json').exists()):
    raise SystemExit('Finished asset already exists; do not overwrite an inspected or integrated file.')
if not asset.exists():
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(raw), '-vf', 'crop=960:540:0:2', '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(asset)], check=True)
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(asset)]))
stream = probe['streams'][0]
frames = int(stream['nb_frames'])
assert len(probe['streams']) == 1 and stream['codec_type'] == 'video'
raw_probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(raw)]))
raw_stream = raw_probe['streams'][0]
assert stream['avg_frame_rate'] == raw_stream['avg_frame_rate'] == '24/1'
assert frames == int(raw_stream['nb_frames']), 'Finishing must retain every native source frame.'
assert stream['width'] == 960 and stream['height'] == 540
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(asset), '-f', 'null', '-'], check=True)
posters = {}
for label, index in [('first', 0), ('last', frames - 1)]:
    path = PROJECT / 'assets' / f'{name}-{label}.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(asset), '-vf', f'select=eq(n\\,{index})', '-vsync', '0', '-frames:v', '1', str(path)], check=True)
    posters[label] = {'path': str(path), 'sha256': digest(path)}
frame_dir = ROOT / f'{name}-review-frames'
frame_dir.mkdir(exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(asset), '-vf', 'fps=6,scale=480:270', '-q:v', '2', str(frame_dir / '%04d.jpg')], check=True)
files = sorted(frame_dir.glob('*.jpg'))
sheets = []
for start in range(0, len(files), 24):
    batch = files[start:start + 24]
    sheet = Image.new('RGB', (1920, math.ceil(len(batch) / 4) * 300), (8, 9, 9))
    draw = ImageDraw.Draw(sheet)
    for n, path in enumerate(batch):
        x, y = n % 4 * 480, n // 4 * 300
        with Image.open(path) as im:
            sheet.paste(im, (x, y))
        draw.text((x + 8, y + 276), f'{(start + n) / 6:.3f}s nominal', fill='white')
    sheet_path = ROOT / f'{name}-review-{start // 24:02}.jpg'
    sheet.save(sheet_path, quality=90)
    sheets.append(str(sheet_path))
messages = history['status']['messages']
beg = next(value['timestamp'] for key, value in messages if key == 'execution_start')
end = next(value['timestamp'] for key, value in messages if key == 'execution_success')
record = {'shot': name, 'provider': 'local OmiPC ComfyUI', 'model': 'MiniMax H3 FL2VA int8 convrot', 'checkpoint': 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', 'turboLora': 'minimax_h3_turbo_v4_step600_ema_pruned_comfyui.safetensors', 'steps': 4, 'sampler': 'MiniMaxH3TurboSampler', 'submission': submission, 'promptId': submission['prompt_id'], 'renderRuntimeSeconds': (end - beg) / 1000, 'rawOutput': str(raw), 'rawSha256': digest(raw), 'output': str(asset), 'sha256': digest(asset), 'nativeFrames': frames, 'nativeFps': 24, 'durationSeconds': frames / 24, 'width': 960, 'height': 540, 'audio': False, 'processing': 'Centered crop of4px height to960x540; H264 CRF17. No retiming, interpolation, reversal or upscale.', 'review': {'status': 'pending_actual_visual_inspection', 'fullDecode': 'pass', 'sampleRate': 6, 'frames': len(files), 'sheets': sheets, 'limitations': 'Chronological6fps samples are not proof of every native frame or full-speed quality.'}, 'posters': posters, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'compositionRequirement': 'Active foreground lyrics or meaningful authored graphic strokes with matching palette, masks and continuous transitions. Standalone asset acceptance does not certify composite quality.'}
record['requestedVsActualFrames'] = {'requested': submission['framesRequested'], 'actualNative': frames, 'difference': frames - submission['framesRequested'], 'disposition': 'Actual native output preserved; no retiming or duplicated frames to force the requested duration.'}
path = ROOT / f'{name}-provenance.json'
path.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'provenance': str(path), 'asset': str(asset), 'sha256': record['sha256'], 'frames': frames, 'durationSeconds': frames / 24, 'runtimeSeconds': record['renderRuntimeSeconds'], 'sheets': sheets, 'posters': posters}, indent=2))
