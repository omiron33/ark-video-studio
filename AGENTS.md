# Ark Lyric Studio agent contract

The new engine is `engine/`; old Python renderers and original v1–v3 outputs are historical source and must not be overwritten as a side effect of new work.

The user directs edits in natural language. Convert those requests into project/section changes, do the work, preview the affected interval against the original song, then assemble the full result from cached sections. Keep word IDs and source timing/provenance. Never replace uncertain timings with unexplained guesses. Beat accents and vocal onsets are different inputs.

Lyrics lead the composition. Use motion to express the words; photographs, line art, geometry and camera movement support them. Do not settle for repetitive title cards, arbitrary shake, decorative flashes, or a static slideshow. GPT Image is the default for generated imagery; local/home tools are allowed, paid video services are excluded.

Read docs/ENGINE.md and docs/SONG_INTAKE.md for the operation in question. Scene edits live in project JSON. Do not regenerate the manifest over authored changes. Keep scene asset dependencies complete and preserve cache invalidation tests when changing transition behavior. Render frame evaluation must be deterministic and random-access safe.

Before claiming a great output, run the gauntlet on the actual encoded MP4 and obtain independent visual review. Fix concrete failures and repeat. Never substitute tests, a screenshot, or self-assigned scores for visual acceptance. The engine owns sync review: run local speech recognition, forced alignment, decoded-audio comparison and the bounded repair loop. An agent unable to hear must not invent a listening score or hand routine sync review back to the user. Use the measured machine audio gate and local vision judge; report unresolved gate failures honestly. Reviews bind to the exact rendered artifact and source revision.

The normal entry point is a song plus a style prompt. Run the create workflow in docs/CREATE.md, including automatic local alignment, direction, render, audio and visual review, and bounded repairs. If the brief requires new pictures, the orchestrating agent uses built-in GPT Image, records each prompt and image provenance, supplies a direction file, and continues automatically. Do not silently substitute an image-free treatment for a requested photographic story or imply that unavailable artwork exists. Never use paid video services.
