"""Dedicated Psalm 23 local-H3 jobs; only submits when called explicitly."""
from pathlib import Path
import argparse, base64, datetime, hashlib, json, subprocess

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
HOST = 'sjfis@omipc.taild60b4e.ts.net'

def remote(script):
    encoded = base64.b64encode(("$ProgressPreference='SilentlyContinue'; " + script).encode('utf-16le')).decode()
    result = subprocess.run(['ssh', '-o', 'HostKeyAlias=omipc', '-o', 'ConnectTimeout=10', HOST, 'powershell', '-NoProfile', '-EncodedCommand', encoded], text=True, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout.strip().lstrip('\ufeff')

def copy(source, destination):
    subprocess.run(['scp', '-o', 'HostKeyAlias=omipc', str(source), HOST + ':' + destination], check=True, capture_output=True, timeout=45)

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def submit(args):
    choice = json.loads((PROJECT / 'concepts/theme-choice.json').read_text())
    if choice.get('status') != 'chosen':
        raise SystemExit('Theme choice must be recorded as chosen before generation.')
    if not args.name.replace('-', '').replace('_', '').isalnum():
        raise SystemExit('Use a simple unique job name.')
    receipt = ROOT / f'{args.name}-submission.json'
    if receipt.exists():
        raise SystemExit('Submission already exists; use status or a new attempt name.')
    queue = json.loads(remote("$q=Invoke-RestMethod http://127.0.0.1:8188/queue; [pscustomobject]@{running=@($q.queue_running).Count;pending=@($q.queue_pending).Count}|ConvertTo-Json"))
    if queue['running'] or queue['pending']:
        raise SystemExit('GPU queue is occupied. Preserve the existing work and retry after it finishes.')
    first = Path(args.first).resolve()
    last = Path(args.last).resolve() if args.last else None
    prompt = Path(args.prompt_file).read_text().strip()
    if not prompt:
        raise SystemExit('A shot-specific prompt is required.')
    workflow = json.loads((ROOT / 'h3-workflow-template.json').read_text())
    workflow['6']['inputs']['prompt'] = prompt
    workflow['6']['inputs']['length'] = args.frames
    workflow['6']['inputs'].pop('last_frame', None)
    prefix = 'psalm23-' + args.name
    first_name = prefix + '-first.png'
    copy(first, 'C:/AI/ComfyUI-Music3/input/' + first_name)
    workflow['16']['inputs']['image'] = first_name
    workflow['6']['inputs'].pop('first_frame', None)
    workflow['6']['inputs']['last_frame' if args.last_only else 'first_frame'] = ['16', 0]
    if last:
        last_name = prefix + '-last.png'
        copy(last, 'C:/AI/ComfyUI-Music3/input/' + last_name)
        workflow['18'] = {'class_type': 'LoadImage', 'inputs': {'image': last_name}}
        workflow['6']['inputs']['last_frame'] = ['18', 0]
    workflow['8']['inputs']['noise_seed'] = args.seed
    workflow['15']['inputs']['filename_prefix'] = 'psalm23-production/' + args.name
    path = ROOT / f'{args.name}-workflow.json'
    path.write_text(json.dumps(workflow, indent=2) + '\n')
    workflow_remote = 'C:/AI/ComfyUI-Music3/input/' + prefix + '-workflow.json'
    copy(path, workflow_remote)
    script = f"$w=Get-Content -Raw '{workflow_remote}'|ConvertFrom-Json; $body=@{{prompt=$w;client_id='psalm23-video-agent'}}|ConvertTo-Json -Depth 30; Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8188/prompt -ContentType 'application/json' -Body $body|ConvertTo-Json -Depth 10"
    response = json.loads(remote(script))
    response.update({'name': args.name, 'submittedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'project': str(PROJECT), 'themeChoiceSha256': digest(PROJECT / 'concepts/theme-choice.json'), 'firstImage': str(first), 'firstImageSha256': digest(first), 'lastImage': str(last) if last else None, 'lastImageSha256': digest(last) if last else None, 'promptFile': str(Path(args.prompt_file).resolve()), 'workflow': str(path), 'workflowSha256': digest(path), 'framesRequested': args.frames, 'fpsRequested': 24, 'seed': args.seed, 'conditioning': 'last_frame_only' if args.last_only else ('first_frame+last_frame' if last else 'first_frame'), 'provider': 'local OmiPC ComfyUI', 'cost': 'local GPU; no paid API'})
    receipt.write_text(json.dumps(response, indent=2) + '\n')
    print(json.dumps(response, indent=2))

def status(name):
    receipt = json.loads((ROOT / f'{name}-submission.json').read_text())
    pid = receipt['prompt_id']
    history = json.loads(remote(f"Invoke-RestMethod http://127.0.0.1:8188/history/{pid}|ConvertTo-Json -Depth 40"))
    (ROOT / f'{name}-history.json').write_text(json.dumps(history, indent=2) + '\n')
    job = history.get(pid, {})
    print(json.dumps({'name': name, 'status': job.get('status'), 'outputs': job.get('outputs')}, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['submit', 'status'])
    parser.add_argument('name')
    parser.add_argument('--first')
    parser.add_argument('--last')
    parser.add_argument('--last-only', action='store_true', help='Treat --first input as final-frame conditioning only')
    parser.add_argument('--prompt-file')
    parser.add_argument('--frames', type=int, choices=[124, 172, 226], default=124)
    parser.add_argument('--seed', type=int)
    args = parser.parse_args()
    if args.operation == 'submit':
        if not args.first or not args.prompt_file or args.seed is None:
            parser.error('submit requires --first, --prompt-file, and --seed')
        submit(args)
    else:
        status(args.name)
