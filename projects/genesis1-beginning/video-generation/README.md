# Genesis 1 local video jobs

Owned by the local-video agent. Composition, lyric timing and scene placement belong to the parent/composition agents. Inputs must be root-supplied GPT Image artwork or specifically approved existing sources. Do not use a paid API, install models, interrupt another GPU job, or reuse Psalm 91 shot artwork except the explicitly reserved Adam clip.

The root reports theme 3, Breath & Earth, chosen with charcoal, bone, rust and amber. The job helper additionally requires `../theme-choice.json` to record `status: chosen` before it can submit. The code-character style is occasional; it is not the entire film vocabulary. Regular photographic motion and the reserved Adam shot are explicit current exceptions to the default organic line-art preference.

## Proven runtime

- OmiPC: `sjfis@omipc.taild60b4e.ts.net`; SSH uses `HostKeyAlias=omipc` and encoded PowerShell.
- Existing ComfyUI: `C:\AI\ComfyUI-Music3`, HTTP loopback 8188. This folder is the already installed runtime, not a new model-storage decision.
- MiniMax H3 FL2VA int8 convrot checkpoint, H3 turbo LoRA, Qwen3VL32B encoder, MiniMaxH3TurboSampler, four steps. See `runtime-readiness.json` and the exact workflow template.
- Native requested frames: 124 / 24 = 5.166667 seconds; 172 / 24 = 7.166667 seconds; 226 / 24 = 9.416667 seconds. Final delivery must report decoded actual counts, not assume that a request equals its output.
- Raw 960×544 at 24 fps. Normal finishing crops two pixels from top and bottom to 960×540, encodes silent H264, and creates decoded first/last posters. No slow motion, speed change, interpolated frames, or claimed native upscale.

## Workflow

1. Inspect the supplied start/end images and their actual palette, clear word space and subject anatomy. Save the exact shot prompt in this folder. Never bake canonical lyrics into generated imagery without strict readable-text verification.
2. Confirm theme choice and empty GPU queue. `h3_jobs.py submit <unique-shot> --first <png> [--last <png>] --prompt-file <txt> --frames 124 --seed <integer>` submits only one explicit job. Do not reuse an attempt name.
3. Poll `h3_jobs.py status <shot>` at reasonable intervals; historical local runtimes were about 90–100 seconds for 124 frames and 219–223 seconds for 226 frames. New glyph preservation is unproven and may fail review.
4. Pull only the successful job's declared output. Preserve raw output, prompt, workflow, receipts/history and source/output hashes. Full-decode the finished asset and inspect all 6fps chronological sheets plus first/last frames. Check extra limbs/eyes, anatomy continuity, frame-edge seams, glyph melting, flashes, abrupt completion and unsuitable held poses.
5. Use one bounded corrective attempt for a concrete defect; report an unresolved shot rather than trapping the film in an open-ended generation loop. No automatic pass based on a model's success status.
6. Send parent the exact asset filename, decoded native duration/count, first/last posters, accepted review notes and honest limitations. Parent owns active foreground words/meaningful coded lines, masks and transitions. Never treat a standalone attractive clip as proof of its final composite quality.

The existing Adam asset is an exact copy with no additional grade or re-encode. Its warm, muted palette already fits; see `adam-formation-provenance.json`.

Generated clips should contribute organic movement difficult to code. Match stroke weight, palette, texture, contrast and motion with the authored foreground. Keep opaque shapes away from necessary words until after their reading hold. Instrumental passages still need active meaningful graphics. No visible rectangular video islands or unattended cutaways.
