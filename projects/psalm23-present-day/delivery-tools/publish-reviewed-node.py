#!/usr/bin/env python3
"""PowerShell-free reviewed candidate delivery; default is strictly read-only."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.request
import uuid

import remote_node_delivery as transport
from remote_node_readonly import archived_audio, remote_hash

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("original_reviewed_publisher", HERE / "publish-reviewed.py")
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
# Reuse the existing exact evidence validator; never call its PowerShell helpers.
HOST, WORKFLOW, SONG = original.HOST, original.WORKFLOW, original.SONG
AUDIO_SHA, LYRICS_SHA = original.AUDIO_SHA, original.LYRICS_SHA
PROJECT = HERE.parent
PROJECT_LABEL = "Psalm 23 (LXX 22) lyric film"
DESTINATION = "C:/Users/sjfis/Videos/Psalm23"
digest, api, summary = original.digest, original.api, original.summary


def require(condition, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def snapshot() -> dict:
    health = api("/api/health")
    require(health.get("ok") is True, "App health failed")
    workflow = api("/api/admin/suno/workflows/" + WORKFLOW)
    workflow = workflow.get("workflow", workflow)
    require(workflow["id"] == WORKFLOW and workflow["lyricsSha256"] == LYRICS_SHA,
            "Workflow identity/lyrics changed")
    require(any("https://suno.com/song/" + SONG in t.get("songUrls", [])
                for t in workflow.get("takes", [])), "Selected song missing from workflow")
    require(workflow["lyrics"].strip() == (PROJECT / "sources/canonical-lyrics.txt").read_text().strip(),
            "Canonical lyrics differ")
    source = archived_audio(timeout=60)
    videos = api("/api/admin/videos")["videos"]
    return {"health": health, "workflow": workflow, "source": source, "videos": videos}


def ensure_copy(source: Path, destination: str, expected: str) -> dict:
    require(digest(source) == expected, "Local file changed from its reviewed bytes: " + str(source))
    state = remote_hash(destination, timeout=120)
    if state["exists"]:
        require(state["sha256"] == expected, "Refusing to overwrite different remote bytes: " + destination)
        return {"sha256": expected, "reused": True}
    stage = destination + ".uploading-" + uuid.uuid4().hex
    transport.copy(source, stage)
    require(remote_hash(stage, timeout=120).get("sha256") == expected, "Remote upload hash mismatch")
    promotion = transport.run("promote_upload", {"stage": stage, "destination": destination, "sha256": expected})
    require(remote_hash(destination, timeout=120).get("sha256") == expected,
            "Final remote file hash mismatch")
    return {"sha256": expected, "reused": promotion["reused"]}


def recheck_local_bindings(bindings: dict[Path, str]) -> None:
    for path, expected in bindings.items():
        require(digest(path) == expected, "Reviewed input changed: " + str(path))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")


def main() -> None:
    require(__debug__, "Run without Python -O: the existing evidence validator requires assertions")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-readiness", action="store_true")
    parser.add_argument("--video", type=Path)
    parser.add_argument("--poster", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--version", help="Explicit reviewed version label; required for delivery/dry run")
    parser.add_argument("--execute", action="store_true", help="Perform authorized publication; absent means read-only")
    args = parser.parse_args()
    if args.check_readiness:
        require(not args.execute, "Readiness mode never mutates")
        print(json.dumps({"transport": "SSH Node24, no PowerShell", **summary(snapshot())}, indent=2))
        return
    if not all([args.video, args.poster, args.report, args.version]):
        parser.error("--video, --poster, --report and --version are required")
    video, poster, report_path = args.video.resolve(), args.poster.resolve(), args.report.resolve()
    report_bytes = report_path.read_bytes()
    frozen_report = json.loads(report_bytes)
    report_sha = hashlib.sha256(report_bytes).hexdigest()
    report, sha, psha, evidence, probe = original.validate_report(report_path, video, poster)
    require(report == frozen_report, "Review disposition changed during validation")
    # Supplement the shared validator with single-read hash/parse evidence checks.
    bindings = {video: sha, poster: psha, report_path: report_sha}
    for item in evidence:
        evidence_path = Path(item["path"])
        evidence_bytes = evidence_path.read_bytes()
        evidence_sha = hashlib.sha256(evidence_bytes).hexdigest()
        require(evidence_sha == item["sha256"] == frozen_report[item["kind"]]["reportSha256"],
                "Evidence changed during validation: " + item["kind"])
        require(original.contains(json.loads(evidence_bytes), sha),
                "Evidence does not bind this movie: " + item["kind"])
        bindings[evidence_path] = item["sha256"]
    recheck_local_bindings(bindings)
    state = snapshot()
    matches = [v for v in state["videos"] if v.get("sha256") == sha]
    if matches:
        require(len(matches) == 1 and matches[0].get("project") == PROJECT_LABEL,
                "Same movie belongs to another project; preserve and inspect")
        require(matches[0].get("status") == "pending_review",
                "Existing identical candidate is no longer pending_review; preserve its review status")
    prefix = DESTINATION + "/held-in-ordinary-" + sha[:16]
    remote_video = prefix + ".mp4"
    remote_poster = prefix + poster.suffix.lower()
    remote_report = prefix + "-review-" + report_sha[:12] + ".json"
    notes = ("Psalm 23 (LXX 22) The Lord Is My Shepherd. Full 219.96-second source, selected Suno take "
             + SONG + ". Shane chose theme 1, Held in the Ordinary: contemporary protection and lyric-led animation. "
             + report["auditNote"].strip() + " Pending Shane review; not user approved. Video SHA256 "
             + sha + ". Review report SHA256 " + report_sha + ".")
    if report["audio"]["status"] == "documented_exception":
        notes += " Audio exception: " + report["audio"]["exception"]
    require(len(notes) <= 5000, "Combined notes exceed app limit")
    marker = "[Ark Psalm23 candidate " + sha + "]"
    current_notes = state["workflow"]["notes"]
    require(current_notes.count(marker) <= 1, "Workflow marker already duplicated; preserve and inspect")
    # Candidate IDs currently have 21 characters. Use a larger placeholder for a conservative preflight.
    def workflow_note(candidate_id: str) -> str:
        return (marker + " Theme 1 chosen by Shane: Held in the Ordinary. Reviewed candidate " + candidate_id
                + "; awaiting Shane review. " + HOST + "/api/admin/videos/" + candidate_id
                + "/media . SHA256 " + sha + ". Review report: " + remote_report + ".")
    if marker not in current_notes:
        require(len(current_notes + "\n\n" + workflow_note("x" * 64)) <= 4000,
                "Workflow note would exceed safe budget; existing notes preserved")
    plan = {
        "mode": "execute" if args.execute else "read_only_dry_run", "publisher": Path(__file__).name,
        "transport": "SSH Node24, no PowerShell", "video": str(video), "sha256": sha,
        "posterSha256": psha, "remoteVideo": remote_video, "remotePoster": remote_poster,
        "remoteReport": remote_report, "existingCandidateId": matches[0]["id"] if matches else None,
        "statusOnIngest": "pending_review", "workflow": WORKFLOW, "version": args.version,
        "noSuperseding": True, "evidence": evidence, "app": summary(state),
    }
    if not args.execute:
        print(json.dumps(plan, indent=2))
        return

    # No local delivery receipt, remote directory, SCP or mutation call exists above this gate.
    recheck_local_bindings(bindings)
    run = HERE / "runs" / sha
    run.mkdir(parents=True, exist_ok=True)
    write_json(run / "plan.json", plan)
    write_json(run / "workflow-before.json", state["workflow"])
    write_json(run / "videos-before.json", state["videos"])
    transport.run("ensure_directory", {"path": DESTINATION}, timeout=30)
    copies = {"video": ensure_copy(video, remote_video, sha), "poster": ensure_copy(poster, remote_poster, psha),
              "report": ensure_copy(report_path, remote_report, report_sha)}
    metadata = {
        "path": remote_video.replace("/", "\\"), "thumbnail": remote_poster.replace("/", "\\"),
        "project": PROJECT_LABEL, "title": "Psalm 23 — Held in the Ordinary", "version": args.version,
        "sourceAgent": "Codex", "sourceMachine": "Mac mini / OmiPC", "sourcePath": str(video),
        "notes": notes, "status": "pending_review", "expectedMd5": digest(video, "md5"),
    }
    metadata_file = run / "ingest-metadata.json"
    write_json(metadata_file, metadata)
    remote_metadata = prefix + "-metadata-" + digest(metadata_file)[:12] + ".json"
    recheck_local_bindings(bindings)
    require(remote_hash(remote_video, timeout=120).get("sha256") == sha,
            "Remote reviewed movie changed before ingestion")
    require(remote_hash(remote_poster, timeout=60).get("sha256") == psha,
            "Remote reviewed poster changed before ingestion")
    if matches:
        # An identical existing candidate is immutable here: do not POST ingest
        # again, even though the endpoint also has duplicate detection.
        result = {"video": matches[0], "duplicate": True, "reusedWithoutIngest": True}
    else:
        ensure_copy(metadata_file, remote_metadata, digest(metadata_file))
        result = transport.run("post_ingest", {"path": remote_metadata}, timeout=120)
    write_json(run / "ingest-result.json", result)
    candidate = result["video"]
    require(candidate["sha256"] == sha, "Registered bytes differ")
    require(candidate["status"] == "pending_review", "Registered candidate is not pending_review")
    vid = candidate["id"]
    watch = HOST + "/api/admin/videos/" + vid + "/media"
    download = watch + "?download=1&master=1"
    h, count = hashlib.sha256(), 0
    with urllib.request.urlopen(download, timeout=120) as response:
        http_status, ctype = response.status, response.headers.get("Content-Type")
        for chunk in iter(lambda: response.read(8 * 1024 * 1024), b""):
            h.update(chunk)
            count += len(chunk)
    require(h.hexdigest() == sha and count == video.stat().st_size, "App master download differs")
    request = urllib.request.Request(watch, headers={"Range": "bytes=0-1023"})
    with urllib.request.urlopen(request, timeout=30) as response:
        range_status, crange, chunk = response.status, response.headers.get("Content-Range"), response.read()
    require(range_status == 206 and len(chunk) == 1024, "Range playback failed")
    with urllib.request.urlopen(HOST + "/api/admin/videos/" + vid + "/thumbnail", timeout=30) as response:
        thumbnail_data = response.read()
    require(hashlib.sha256(thumbnail_data).hexdigest() == psha, "App thumbnail differs")
    registration = {"workflowId": WORKFLOW, "songId": SONG, "lyricsSha256": LYRICS_SHA,
                    "marker": marker, "note": workflow_note(vid), "candidateId": vid, "watchUrl": watch}
    payload_file = run / "workflow-registration.json"
    write_json(payload_file, registration)
    remote_payload = prefix + "-workflow-" + digest(payload_file)[:12] + ".json"
    ensure_copy(payload_file, remote_payload, digest(payload_file))
    workflow_result = transport.run("register_workflow", {"path": remote_payload}, timeout=60)
    write_json(run / "workflow-registration-result.json", workflow_result)
    require(workflow_result["workflow"]["notes"].count(marker) == 1,
            "Workflow note is not registered exactly once")
    after = api("/api/admin/videos")["videos"]
    by_id = {v["id"]: v for v in after}
    final_candidate = by_id.get(vid)
    require(final_candidate is not None and final_candidate.get("sha256") == sha
            and final_candidate.get("status") == "pending_review"
            and final_candidate.get("project") == PROJECT_LABEL,
            "Final registered candidate identity/status changed before verification completed")
    for old in state["videos"]:
        require(old["id"] in by_id, "Existing video disappeared")
        require(old == by_id[old["id"]], "Existing candidate changed during delivery: " + old["id"])
    record = {
        "status": "verified_review_candidate_delivery", "publisher": Path(__file__).name,
        "transport": "SSH Node24, no PowerShell", "candidateId": vid,
        "candidateStatus": candidate["status"], "duplicate": result.get("duplicate"),
        "sha256": sha, "remoteDownloadSha256": h.hexdigest(), "posterSha256": psha,
        "copies": copies, "bytes": count, "httpStatus": http_status, "contentType": ctype,
        "rangeStatus": range_status, "contentRange": crange, "watchUrl": watch, "downloadUrl": download,
        "reviewUrl": HOST + "/studio#videos", "workflowUrl": HOST + "/studio#workflows",
        "workflowRegistered": True, "workflowChanged": workflow_result["changed"],
        "priorCandidatesPreserved": len(state["videos"]), "reviewReport": str(report_path),
        "reviewReportSha256": report_sha, "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    write_json(run / "app-delivery.json", record)
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
