#!/usr/bin/env python3
"""Optional offline word-timestamp helper. Never downloads a model or fabricates alignment."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--audio", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--model", type=Path, help="Existing faster-whisper/CTranslate2 directory or OpenAI Whisper .pt checkpoint; never a remote model name")
    p.add_argument("--backend", choices=["auto", "faster-whisper", "openai-whisper", "torchaudio-ctc"], default="auto")
    p.add_argument("--task", choices=["transcribe", "force-align"], default="transcribe", help="force-align uses supplied --lyrics and local Whisper attention/DTW")
    p.add_argument("--offset", type=float, default=0.0)
    p.add_argument("--duration", type=float)
    p.add_argument("--language", default="en")
    p.add_argument("--lyrics", type=Path, help="Optional exact official lyrics as UTF-8 text; mismatches remain unresolved for agent review")
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--relaxed-speech", action="store_true", help="Bounded short-context retry: decode music-backed speech instead of dropping the window on no-speech probability")
    return p


def local_model(requested: Path | None, backend: str = "auto") -> tuple[Path, str]:
    """Look only at local files. Auto can use an installed backend without downloading a model."""
    if requested:
        candidates = [requested.expanduser()]
    elif os.environ.get("ARK_WHISPER_MODEL"):
        candidates = [Path(os.environ["ARK_WHISPER_MODEL"]).expanduser()]
    else:
        root = Path("/Volumes/DATA/AI")
        candidates = [root / "Models/Whisper/small.en.pt", root / "Models/Whisper/base.en.pt"]
        if backend == "torchaudio-ctc":
            candidates.insert(0, root / "Models/TorchAudio/wav2vec2_fairseq_base_ls960_asr_ls960.pth")
        for folder in [root / "Models/faster-whisper", root / "Models/Whisper"]:
            candidates.extend([folder, *sorted(folder.glob("*"))])
        hub = root / "Cache/HuggingFace/hub"
        candidates.extend(sorted(hub.glob("models--*faster-whisper*/snapshots/*")))
    available = []
    for candidate in candidates:
        kind = None
        if candidate.is_dir() and (candidate / "model.bin").is_file() and (candidate / "config.json").is_file():
            kind = "faster-whisper"
        elif candidate.is_file() and candidate.suffix == ".pt":
            kind = "openai-whisper"
        elif candidate.is_file() and candidate.name in {"wav2vec2_fairseq_base_ls960_asr_ls960.pth", "wav2vec2_fairseq_large_lv60k_asr_ls960.pth"}:
            kind = "torchaudio-ctc"
        if kind and backend in ["auto", kind]:
            available.append((candidate.resolve(), kind))
    if backend == "auto" and not requested and not os.environ.get("ARK_WHISPER_MODEL"):
        for candidate, kind in available:
            module = "whisper" if kind == "openai-whisper" else "faster_whisper"
            if importlib.util.find_spec(module) is not None:
                return candidate, kind
    if available:
        return available[0]
    raise RuntimeError("No compatible local model found. Supply --model /Volumes/DATA/AI/Models/Whisper/small.en.pt with --backend openai-whisper, or a local CTranslate2 directory containing model.bin and config.json with --backend faster-whisper. Nothing was downloaded.")


def transcribe_local(model_path: Path, backend: str, clip: Path, args: argparse.Namespace) -> tuple[list[dict], str]:
    """Normalize both local backends to the same segment contract."""
    if backend == "torchaudio-ctc":
        return ctc_align(model_path, clip, args), args.language
    if backend == "openai-whisper":
        try:
            import torch
            import whisper
        except ImportError as error:
            raise RuntimeError("OpenAI Whisper is not installed in this Python environment. Select its existing interpreter with CLI --python, or install openai-whisper in a dedicated venv. No model was downloaded.") from error
        torch.set_num_threads(args.threads)
        # An existing absolute checkpoint path takes whisper's local-file branch, never its download branch.
        model = whisper.load_model(str(model_path), device="cpu")
        # Preserve the bundled model's curated alignment heads when the standard filename identifies it.
        heads = getattr(whisper, "_ALIGNMENT_HEADS", {}).get(model_path.stem)
        if heads is not None:
            model.set_alignment_heads(heads)
        if args.task == "force-align":
            if not args.lyrics:
                raise ValueError("force-align requires exact --lyrics text")
            text = args.lyrics.read_text(encoding="utf-8").strip()
            if not text:
                raise ValueError("force-align requires non-empty lyrics")
            waveform = whisper.load_audio(str(clip))
            if len(waveform) > whisper.audio.N_SAMPLES:
                raise ValueError("Forced alignment windows must be at most 30 seconds; review splits longer songs into phrase windows")
            mel = whisper.log_mel_spectrogram(whisper.pad_or_trim(waveform), n_mels=model.dims.n_mels).to(model.device)
            tokenizer = whisper.tokenizer.get_tokenizer(model.is_multilingual, num_languages=model.num_languages, language=args.language, task="transcribe")
            alignment = whisper.timing.find_alignment(model, tokenizer, tokenizer.encode(" " + text), mel, max(1, len(waveform) // whisper.audio.HOP_LENGTH))
            whisper.timing.merge_punctuations(alignment, "\"'“¿([{-", "\"'.。,，!！?？:：”)]}、")
            words = [{"text": word.word, "start": float(word.start), "end": float(word.end), "probability": float(word.probability)} for word in alignment if word.word.strip()]
            return [{"text": text, "words": words}], args.language
        result = model.transcribe(str(clip), language=args.language, word_timestamps=True, fp16=False, verbose=False, no_speech_threshold=None if args.relaxed_speech else .6, condition_on_previous_text=not args.relaxed_speech)
        segments = [{"text": segment["text"], "words": [{"text": w["word"], "start": w["start"], "end": w["end"], "probability": w.get("probability")} for w in segment.get("words", [])]} for segment in result["segments"]]
        return segments, result.get("language", args.language)
    if args.task == "force-align":
        raise ValueError("force-align currently requires --backend openai-whisper and an existing .pt checkpoint")
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError("faster-whisper is not installed in this Python environment. Select its interpreter with CLI --python, or install it in a dedicated venv. No model was downloaded.") from error
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=args.threads, local_files_only=True)
    segments, info = model.transcribe(str(clip), language=args.language, word_timestamps=True, vad_filter=False, beam_size=5)
    result = [{"text": segment.text, "words": [{"text": w.word, "start": w.start, "end": w.end, "probability": w.probability} for w in segment.words or []]} for segment in segments]
    return result, info.language


def ctc_align(model_path: Path, clip: Path, args: argparse.Namespace) -> list[dict]:
    """Acoustic CTC Viterbi alignment with explicit blank states for instrumental pauses.

    Uses the official TorchAudio base-960h model architecture and an existing checkpoint.
    The state recurrence follows the standard CTC path (stay, advance, nonrepeated skip).
    """
    if args.language != "en" or not args.lyrics:
        raise ValueError("torchaudio-ctc requires English --lyrics for forced alignment")
    import numpy as np
    import torch
    local_packages = Path("/Volumes/DATA/AI/Tools/ark-audio-review/python")
    if local_packages.is_dir() and str(local_packages) not in sys.path:
        sys.path.insert(0, str(local_packages))
    try:
        import torchaudio
    except ImportError as error:
        raise RuntimeError("TorchAudio is not available; add its installed local package directory to PYTHONPATH. No model was downloaded.") from error
    torch.set_num_threads(args.threads)
    bundle = (torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H
              if model_path.name == "wav2vec2_fairseq_large_lv60k_asr_ls960.pth"
              else torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H)
    model = torchaudio.models.wav2vec2_model(**bundle._params)
    state_dict = torch.load(str(model_path), map_location="cpu", weights_only=True)
    # Official bundle removes Fairseq's unused dictionary symbols from the auxiliary head.
    keep = [i for i in range(state_dict["aux.weight"].shape[0]) if i not in bundle._remove_aux_axis]
    state_dict["aux.weight"] = state_dict["aux.weight"][keep]
    state_dict["aux.bias"] = state_dict["aux.bias"][keep]
    model.load_state_dict(state_dict)
    model.eval()
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(clip), "-ar", "16000", "-ac", "1", "-f", "f32le", "-"])
    samples = np.frombuffer(raw, dtype=np.float32).copy()
    with torch.inference_mode():
        waveform = torch.from_numpy(samples).unsqueeze(0)
        if bundle._normalize_waveform:
            waveform = torch.nn.functional.layer_norm(waveform, waveform.shape)
        logits, _ = model(waveform)
        emissions = torch.log_softmax(logits[0], dim=-1).numpy()
    labels = bundle.get_labels()
    dictionary = {letter: index for index, letter in enumerate(labels)}
    exact = args.lyrics.read_text(encoding="utf-8").strip()
    lexical_words = exact.split()
    normalized = [re.sub(r"[^A-Z']", "", word.upper().replace("’", "'")) for word in lexical_words]
    if any(not word for word in normalized):
        raise ValueError("CTC alignment cannot map a lyric token without English letters; keep original lyrics and use another evidence pass")
    transcript = "|".join(normalized)
    tokens = [dictionary[c] for c in transcript]
    states = np.zeros(len(tokens) * 2 + 1, dtype=np.int64)
    states[1::2] = tokens
    length = len(states)
    previous = np.full(length, -np.inf, dtype=np.float64)
    previous[0] = 0
    choices = np.zeros((len(emissions), length), dtype=np.int8)
    can_skip = np.zeros(length, dtype=bool)
    can_skip[2:] = (states[2:] != 0) & (states[2:] != states[:-2])
    for frame, emission in enumerate(emissions):
        advance = np.concatenate(([-np.inf], previous[:-1]))
        skip = np.concatenate(([-np.inf, -np.inf], previous[:-2]))
        skip[~can_skip] = -np.inf
        candidates = np.stack((previous, advance, skip))
        choices[frame] = np.argmax(candidates, axis=0)
        previous = np.max(candidates, axis=0) + emission[states]
    state = length - 1 if previous[-1] >= previous[-2] else length - 2
    if not np.isfinite(previous[state]):
        raise RuntimeError("No acoustic alignment path supports these lyrics in this audio window")
    frames_by_token = [[] for _ in tokens]
    for frame in range(len(emissions) - 1, -1, -1):
        if state % 2:
            frames_by_token[(state - 1) // 2].append(frame)
        state -= int(choices[frame, state])
    seconds_per_frame = len(samples) / 16000 / len(emissions)
    words, cursor = [], 0
    for exact_word, normalized_word in zip(lexical_words, normalized):
        positions = list(range(cursor, cursor + len(normalized_word)))
        frames = [frame for position in positions for frame in frames_by_token[position]]
        if not frames:
            raise RuntimeError(f"No acoustic frames support word {exact_word}")
        log_scores = [float(emissions[frame, tokens[position]]) for position in positions for frame in frames_by_token[position]]
        words.append({"text": exact_word, "start": min(frames) * seconds_per_frame, "end": (max(frames) + 1) * seconds_per_frame, "probability": float(np.exp(np.mean(log_scores)))})
        cursor += len(normalized_word) + 1
    return [{"text": exact, "words": words}]


def audio_duration(audio: Path) -> float:
    result = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration:format=duration", "-of", "json", str(audio)], check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    if not data.get("streams"):
        raise ValueError("Input has no audio stream")
    duration = float(data["streams"][0].get("duration", data.get("format", {}).get("duration", 0)))
    if duration <= 0:
        raise ValueError("Audio duration must be positive")
    return duration


def word_id(text: str, start: float, end: float) -> str:
    return "w_" + hashlib.sha256(json.dumps([text, start, end], ensure_ascii=False).encode()).hexdigest()[:16]


def write_new(path: Path, document: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation protects an existing timing document and its agent edits.
    with path.open("x", encoding="utf-8") as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def align(args: argparse.Namespace) -> dict:
    if not args.audio.is_file():
        raise ValueError(f"Audio does not exist: {args.audio}")
    if not (args.offset >= 0) or args.threads < 1 or (args.duration is not None and not args.duration > 0):
        raise ValueError("offset must be non-negative, duration positive, and threads at least one")
    # Keep native BLAS and Whisper's Numba alignment kernels within the same
    # requested budget. Unbounded nested pools can make short songs much slower.
    for variable in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMBA_NUM_THREADS"):
        os.environ[variable] = str(args.threads)
    duration = audio_duration(args.audio)
    span = min(args.duration if args.duration is not None else duration - args.offset, duration - args.offset)
    if span <= 0:
        raise ValueError("Source offset lies beyond the audio")
    model_path, backend = local_model(args.model, args.backend)
    # Enforce offline operation even when a library would otherwise try a hub request.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    approved = args.lyrics.read_text(encoding="utf-8") if args.lyrics else None
    with tempfile.TemporaryDirectory(prefix="ark-align-") as temporary:
        clip = Path(temporary) / "clip.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(args.audio.resolve()), "-ss", str(args.offset), "-t", str(span), "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(clip)], check=True)
        segments, language = transcribe_local(model_path, backend, clip, args)
        words, phrases, transcript = [], [], []
        for index, segment in enumerate(segments):
            phrase_id = f"phrase-{index + 1:04d}"
            segment_words = []
            transcript.append(segment["text"].strip())
            for word in segment["words"]:
                start, end = round(args.offset + word["start"], 6), round(args.offset + word["end"], 6)
                text = word["text"].strip()
                if not text or not start < end:
                    raise RuntimeError("Local ASR returned an invalid word interval; no guessed timing was substituted")
                row = {"id": word_id(text, start, end), "text": text, "start": start, "end": end, "phraseId": phrase_id, "confidence": "machine_estimate", "provenance": {"method": f"local-{backend}", "model": model_path.name, "tokenProbability": word["probability"], "timingVerified": False, "note": "Token probability is not timestamp accuracy; review sung-word boundaries."}}
                words.append(row)
                segment_words.append(row)
            if segment_words:
                phrases.append({"id": phrase_id, "text": segment["text"].strip(), "wordIds": [w["id"] for w in segment_words]})
    text = " ".join(transcript)
    status = "machine_estimate" if words else "unresolved"
    warnings = ["Local ASR proposes words and times; singing, instrumental gaps, and echoes can produce wrong or early timestamps. Review before final export."]
    if approved is not None:
        # Case and punctuation are lyric content; ignore only whitespace for this comparison.
        if re.sub(r"\s+", " ", approved).strip() != re.sub(r"\s+", " ", text).strip():
            status = "needs_lyric_review"
            warnings.append("ASR differs from supplied official lyrics. Official text is preserved verbatim; the helper did not substitute words or invent times for missing words.")
    return {"version": 1, "timebase": "source", "status": status, "task": args.task, "method": f"local-{backend}-{args.task}; machine estimates", "source": {"audio": args.audio.name, "offset": args.offset, "duration": span, "audioDuration": duration, "model": str(model_path), "backend": backend, "language": language}, "transcript": text, **({"approvedLyrics": approved} if approved is not None else {}), "words": words, "phrases": phrases, "warnings": warnings}


def main() -> int:
    args = parser().parse_args()
    if args.output.exists():
        print(f"Refusing to overwrite existing timing: {args.output}", file=sys.stderr)
        return 2
    try:
        result = align(args)
    except Exception as error:
        result = {"version": 1, "timebase": "source", "status": "unresolved", "source": {"audio": args.audio.name, "offset": args.offset}, "words": [], "phrases": [], "reason": str(error), "warnings": ["No timing was invented and no model was downloaded."]}
    try:
        write_new(args.output, result)
    except OSError as error:
        print(f"Could not create output: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"output": str(args.output.resolve()), "status": result["status"], "words": len(result["words"]), "reason": result.get("reason")}, ensure_ascii=False))
    return 2 if result["status"] == "unresolved" else 0


if __name__ == "__main__":
    raise SystemExit(main())
