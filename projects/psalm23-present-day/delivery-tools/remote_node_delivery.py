"""Node-over-SSH transport for the opt-in Psalm 23 fallback publisher.

Importing this module performs no remote work. Callers must authorize mutation
before calling ensure_directory, promote_upload, post_ingest or register_workflow.
"""
from __future__ import annotations

import base64
import json
import subprocess

from remote_node_readonly import HOST, NODE


SCRIPTS = {
    "ensure_directory": r"""
const fs = require('node:fs/promises');
if (payload.path !== 'C:/Users/sjfis/Videos/Psalm23')
  throw new Error('Unexpected delivery directory');
await fs.mkdir(payload.path, {recursive: true});
return {createdOrPresent: true};
""",
    "promote_upload": r"""
const fs = require('node:fs/promises');
const nativeFs = require('node:fs');
const crypto = require('node:crypto');
if (!payload.destination.startsWith('C:/Users/sjfis/Videos/Psalm23/held-in-ordinary-') ||
    !payload.stage.startsWith(payload.destination + '.uploading-'))
  throw new Error('Unexpected upload paths');
// Both paths are in the same directory/volume. Hard-linking is atomic and never
// overwrites an existing destination; the complete verified bytes appear at once.
let reused = false;
try {
  await fs.link(payload.stage, payload.destination);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const hash = crypto.createHash('sha256');
  for await (const chunk of nativeFs.createReadStream(payload.destination)) hash.update(chunk);
  if (hash.digest('hex') !== payload.sha256)
    throw new Error('Destination appeared with different bytes; preserving upload');
  reused = true;
}
await fs.unlink(payload.stage);
return {promoted: true, reused};
""",
    "post_ingest": r"""
const fs = require('node:fs/promises');
const metadata = JSON.parse(await fs.readFile(payload.path, 'utf8'));
if (metadata.status !== 'pending_review' || Object.hasOwn(metadata, 'supersedes'))
  throw new Error('Only pending-review ingest without superseding is allowed');
if (metadata.project !== 'Psalm 23 (LXX 22) lyric film')
  throw new Error('Unexpected video project');
const response = await fetch('http://127.0.0.1:4317/api/admin/videos/ingest', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(metadata), signal: AbortSignal.timeout(90000),
});
const text = await response.text();
if (!response.ok) throw new Error(`Ingest HTTP ${response.status}: ${text}`);
return JSON.parse(text);
""",
    "register_workflow": r"""
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const repo = 'C:/Users/sjfis/Documents/Codex/orthodox-songbook';
const p = JSON.parse(fs.readFileSync(payload.path, 'utf8'));
const {listWorkflows, saveWorkflow} = await import(pathToFileURL(repo + '/api/suno-workflows.mjs'));
const before = listWorkflows();
const w = before.workflows.find(x => x.id === p.workflowId);
if (!w || w.lyricsSha256 !== p.lyricsSha256 ||
    !w.takes.some(t => t.songUrls.includes('https://suno.com/song/' + p.songId)))
  throw new Error('Workflow identity changed');
const count = w.notes.split(p.marker).length - 1;
if (count > 1) throw new Error('Workflow marker already appears more than once');
if (count === 1) {
  const entry = w.notes.slice(w.notes.indexOf(p.marker)).split(/\n\s*\n/)[0];
  if (!entry.includes(p.candidateId) || !entry.includes(p.watchUrl))
    throw new Error('Existing workflow marker has a different candidate association');
  return {changed: false, workflow: w};
}
const notes = w.notes + '\n\n' + p.note;
if (notes.length > 4000)
  throw new Error('Workflow notes would exceed4000characters; preserving existing notes');
const updated = saveWorkflow(w.id, {...w, notes});
const after = listWorkflows();
for (const old of before.workflows) {
  if (old.id !== w.id && JSON.stringify(old) !==
      JSON.stringify(after.workflows.find(x => x.id === old.id)))
    throw new Error('Unrelated workflow changed');
}
for (const key of Object.keys(w)) {
  if (!['notes', 'updatedAt'].includes(key) &&
      JSON.stringify(w[key]) !== JSON.stringify(updated[key]))
    throw new Error('Unexpected workflow field changed:' + key);
}
if (updated.notes.split(p.marker).length - 1 !== 1)
  throw new Error('Workflow marker was not appended exactly once');
return {changed: true, workflow: updated};
""",
}


def node_source(operation: str, payload: dict) -> str:
    """Keep paths and metadata inside encoded JavaScript, never shell arguments."""
    return (
        "const payload = " + json.dumps(payload) + ";\n(async () => {\n"
        + SCRIPTS[operation]
        + "\n})().then(value => console.log(JSON.stringify(value))).catch(error => {"
        "console.error(JSON.stringify({error: error.message, code: error.code || null}));"
        "process.exitCode = 1;});\n"
    )


def run(operation: str, payload: dict, timeout: float = 120) -> dict:
    encoded = base64.b64encode(node_source(operation, payload).encode()).decode("ascii")
    command = f'{NODE} -e "eval(Buffer.from(\'{encoded}\',\'base64\').toString(\'utf8\'))"'
    result = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, command],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    value = json.loads(result.stdout.strip().lstrip("\ufeff"))
    if not isinstance(value, dict):
        raise RuntimeError("Unexpected remote Node result")
    return value


def copy(source, destination: str, timeout: float = 600) -> None:
    """SCP transport only; no PowerShell process is launched."""
    subprocess.run(
        ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", str(source), HOST + ":" + destination],
        check=True, capture_output=True, text=True, timeout=timeout,
    )
