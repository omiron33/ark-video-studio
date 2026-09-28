#!/usr/bin/env python3
"""Read remote file hashes through installed Node, without PowerShell or writes."""
from __future__ import annotations

import argparse
import base64
import json
import subprocess

HOST = "sjfis@omipc.taild60b4e.ts.net"
NODE = "C:/Users/sjfis/AppData/Local/Programs/node-v24.19.0-win-x64/node.exe"
ARCHIVE = (
    "C:/Users/sjfis/Documents/Codex/orthodox-songbook/media/suno/workflows/"
    "psalm-23-lxx-22-shepherd/32885123-f4b6-42e6-a546-f4acba404829.m4a"
)
EXPECTED_AUDIO_SHA256 = "3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f"


def remote_hash(path: str, timeout: float = 30) -> dict:
    """Return exists/path and, for a stable regular file, SHA-256 and byte size.

    The path travels inside base64-encoded JavaScript, never as shell code.
    Only stat, read-only open/read and close operations run on OmiPC.
    """
    if not isinstance(path, str) or not path or "\0" in path:
        raise ValueError("A nonempty remote file path without NUL is required")
    source = "const target = " + json.dumps(path) + ";\n" + r"""
const fs = require('node:fs');
const crypto = require('node:crypto');
(async () => {
  let handle;
  try {
    handle = await fs.promises.open(target, 'r');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(JSON.stringify({exists: false, path: target}));
      return;
    }
    throw error;
  }
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error('Path is not a regular file');
    const hash = crypto.createHash('sha256');
    const stream = handle.createReadStream({autoClose: false});
    for await (const chunk of stream) hash.update(chunk);
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      throw new Error('File changed while hashing; retry the read');
    console.log(JSON.stringify({exists: true, path: target,
      sha256: hash.digest('hex'), bytes: after.size}));
  } finally {
    await handle.close();
  }
})().catch(error => {
  console.error(JSON.stringify({error: error.message, code: error.code || null}));
  process.exitCode = 1;
});
"""
    encoded = base64.b64encode(source.encode("utf-8")).decode("ascii")
    # Fixed, space-free executable path; all variable file-path data is encoded.
    command = f'{NODE} -e "eval(Buffer.from(\'{encoded}\',\'base64\').toString(\'utf8\'))"'
    completed = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, command],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=timeout, check=False,
    )
    if completed.returncode:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    value = json.loads(completed.stdout.strip().lstrip("\ufeff"))
    if not isinstance(value, dict) or not isinstance(value.get("exists"), bool):
        raise RuntimeError("Remote response did not contain a file-hash result")
    return value


def archived_audio(timeout: float = 30) -> dict:
    """Read and verify the preserved Psalm 23 source identity."""
    value = remote_hash(ARCHIVE, timeout)
    if not value["exists"]:
        raise RuntimeError("Preserved source audio is missing")
    if value["sha256"] != EXPECTED_AUDIO_SHA256:
        raise RuntimeError("Preserved source audio SHA-256 differs")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument("--archive-audio", action="store_true")
    operation.add_argument("--file", help="Remote file path to hash read-only")
    parser.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    result = archived_audio(args.timeout) if args.archive_audio else remote_hash(args.file, args.timeout)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
