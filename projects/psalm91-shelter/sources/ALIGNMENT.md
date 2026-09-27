# Psalm91 timing preparation

The current composition input is `words.json`: 396 measured word intervals in56phrases, covering the original389written words plus one7word repeat actually present in the recording. No canonical spelling was replaced by ASR, no word interval was evenly spread across a subtitle interval, and no audio was edited.

The repeated “I will trust you through the fight.” at116.54–120.48s is `p91-l021-r01`. The provider's written occurrence stays `p91-l021` at123.516–125.98s. Base, small and medium Whisper checkpoints independently recognized the two performances; medium recognized the literal word “fight” in both. `lyrics.txt` and `canonical-lyrics.txt` preserve the supplied text. `performance-lyrics.txt` adds only this independently supported repeated line and is the exact396token text corresponding to `words.json`.

Timing was prepared with two local wav2vec2 checkpoints and three local Whisper checkpoints. Grouped forced-alignment was followed by one bounded complete-phrase retry. A number of music-backed CTC windows misplaced words by seconds; these remain in the raw diagnostics. Final selection uses actual measured CTC/ASR intervals and an ordered-onset path, retaining evidence for every alternative. First-word onsets prefer corroborated acoustic boundaries where attention alignment absorbed a preceding pause. No raw interval was clipped or interpolated to eliminate disagreements. Neighboring token ends can overlap by up to117ms because independently measured boundaries are not identical; onsets remain ordered.

Only86/396selected intervals currently satisfy the preparatory paired-CTC source-support rules. The other310 remain explicit machine estimates. This is not a passed strict synchronization gate and is not an assertion of subjective listening. Speech-trained CTC models are weak on this recording's sustained or distorted vocal consonants;256selected intervals instead use measured independent recognition. Final encoded PCM/AAC and lyric review still must run against the actual rendered file, preserving unresolved strict failures.

Use `intake.originalLyrics: "sources/performance-lyrics.txt"` in the final composition manifest so the396words match the performance. Retain `canonical-lyrics.txt` as supplied source provenance. Run the existing `reviewAudio`/gauntlet on the encoded result; do not relabel this source preparation as encoded acceptance and do not automatically replace reviewed timings with unsupported CTC candidates.

Artifacts:

- `phrase-outline.json`: measured boundaries and long gaps for choreography.
- `measured-audio-events.json`: actual20ms energy attacks,10ms hop; not a metrical/BPM grid.
- `measured-energy.json`: actual0.5s mono PCM RMS/peak measurements.
- `phrases-provider.json`: original55line subtitle proposals, explicitly unverified.
- `../../../output/psalm91-production/alignment/performance-selection.json`: final selected raw candidates and alternatives.
- `../../../output/psalm91-production/alignment/validation.json`: exact canonical preservation, unique IDs, engine timing-import acceptance and original source SHA verification.
- `../../../output/psalm91-production/alignment/`: all individual source model passes, execution timings, retry windows and scripts. Failed/partial recognition files were retained.

Exact song source SHA256: `b444350b68359bc06f17a90ace1b6d7bba9255a0358b308acec9cdccf3103420`. Source duration327.6s; offset0. The song's entire original interval remains the intended film audio.
