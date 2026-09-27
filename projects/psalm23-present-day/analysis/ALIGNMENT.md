# Psalm 23 acoustic timing

Timing intake is complete as machine evidence, with final encoded-audio acceptance still pending.

- Source: `sources/32885123-f4b6-42e6-a546-f4acba404829.m4a`, exactly 219.960 seconds.
- Source SHA-256: `3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f`.
- Final timing SHA-256: `d1409b6bee20be8f08897fead6d694241692dba9a9bfb45df4844f0a93e78bf9`.
- 210 canonical sung words in 39 phrases, with stable `p23-l001`–`p23-l039` phrase IDs and `p23-l001-w01` style word IDs.
- All source word intervals are finite, ordered, nonoverlapping, and selected intact from actual acoustic passes. No endpoints are averaged, interpolated, snapped to musical attacks, or copied from the provider SRT.
- First measured vocal start 15.193455s; last measured vocal end 202.909313s.
- 166 words satisfy source-only paired CTC / corroborating ASR criteria. 44 remain explicitly unsupported under those criteria. No listening score was assigned; no claim of hearing the song is made.

## Consumer files

`sources/words.json` follows engine import format with flat `words` and `phrases[].wordIds`; each phrase also embeds a convenience `words` array. `sources/phrases.json` is the same phrase schedule alone. Times are absolute source seconds.

`sources/canonical-lyrics.txt` preserves the original exact lyrics including structural headers. `sources/performance-lyrics.txt` removes only blank lines and bracketed structural headers; all 210 sung words, case and punctuation remain literal. Use the performance file as `--lyrics` / `reviewAudio({lyricsPath: ...})` because the current engine reviewer tokenizes whitespace and does not remove header labels. Keep the canonical archive alongside it.

At 30fps, standard engine import rounds the source duration down to 6598 frames / 219.933333 seconds. This does not clip the sung outro. Custom composition must still keep decoded audio within the documented duration/lag tolerance.

## Method and raw evidence

The installed local Python ran unchanged `engine/align.py` through the resident `engine/audio-worker.py`, four threads, no downloads or paid inference. Passes include base and large TorchAudio wav2vec2 CTC checkpoints plus original-mix Whisper base.en, small.en, and medium.en.

Eight broad source windows establish phrase locations; 39 complete-phrase acoustic retries remove adjacent-phrase contamination; one final bounded retry targets unsupported lines using the engine's `officialPhraseRetryWindow` helper. 28 final windows came from complete contiguous exact ASR phrases; three retained explicit authored phrase bounds. No further inference loops were run.

`analysis/alignment/source-review-passes.json` retains checkpoint identities, canonical IDs for acoustic passes, observed ASR words and raw artifact paths. `source-word-evidence.json` retains every candidate, selected interval and transparent source-only evidence. All raw passes remain in `analysis/alignment/`. `sources/words.initial-source-pass.json` preserves the earlier two-context draft.

The final assembly chooses one actual source acoustic interval per word. Candidate ranking favors paired-checkpoint agreement and both-endpoint ASR support, retains raw posterior scores, penalizes uncorroborated long intervals, and selects compatible intervals with dynamic programming to avoid overlap. These source-only selection rules cannot approve AAC codec stability or the finished film.

## Verification and remaining gate

`node analysis/validate-timing.mjs` passed engine timing normalization, exact canonical coverage, ID uniqueness, valid intervals, nonoverlap, source hash, and proof that every selected interval occurs intact in its declared raw artifact.

After encoding the actual film, run `reviewAudio` against that exact file and source revision. The current source support count is not a substitute for the encoded audio comparison, duration, lag, phrase and word-sync gate. Preserve any unresolved failures. Engine review may produce supported refinements requiring a rerender; do not relabel the 44 source-unsupported cues as verified merely because the typography renders.
