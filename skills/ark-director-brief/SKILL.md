---
name: ark-director-brief
description: Turn an approved Ark theme and analyzed song into a structured scene-by-scene director brief before any choreography code is written. Use after Shane has chosen a theme for an Ark lyric film, when planning or re-planning scenes. Works for any agent; written for Claude's planning strength.
---

# Ark director brief

Use only after the theme-choice gate in `ark-song-video` has `status: "chosen"`. Read `AGENTS.md`, `docs/AGENTS_AND_MODELS.md` and the project's intake and analysis first.

## Inputs to gather

- The chosen theme and Shane's exact instruction from `theme-choice.json`.
- Canonical words with IDs and measured times, the beat and accent analysis, and the song duration (`node engine/cli.mjs inspect --project <project.json> --json`).
- Reference context for each planned scene (`node engine/cli.mjs reference-context ...`). Open the actual contact-sheet images; captions alone are not inspection.

## Code-only mode

For Claude runs, read `docs/CODE_ONLY.md`. Define the film's design system before the arc: one palette with a single signal colour, three or four type families with roles, the shared grain and post-process, and one running motif that transforms through every scene. Each scene's `<imagery>` must be `none`; its idiom is drawn in code.

## Whole-film arc first

Before any single scene, write the arc in a few lines: where the song opens, where it turns, where it peaks and how it lands. Map these beats to measured time ranges:

1. Hook: meaningful action inside the first second.
2. World: establish the theme's design system.
3. Question or tension from the lyrics.
4. Mechanism: how the story moves.
5. Discovery or turn.
6. Payoff at the strongest measured musical moment.
7. Close or loop back.

Plan pace across the arc: where short bursts of three forceful word hits are justified by measured accents, and where compositions hold and transform slowly.

## One brief per scene

Write each scene as a block like this, then store it in that section's `direction`:

```xml
<scene id="p23-l005" start="30.44" end="36.77">
  <words>p23-l005-w01..w04: exact canonical text</words>
  <purpose>What this moment must make the viewer feel or understand.</purpose>
  <music>Measured accents, phrase shape, held notes in this interval.</music>
  <choreography name="nourishing-bowl">How each word enters, acts on its meaning, and leaves. Name the camera move.</choreography>
  <identity>Palette, type, geometry and texture from the chosen theme. Any recurring figure's locked look.</identity>
  <imagery>None, or the one image this moment needs, with its provider request.</imagery>
  <inspiration ids="..." principle="..." adaptation="..."/>
  <handoff>How it connects to the previous and next scene.</handoff>
</scene>
```

## Rules

- Long songs need at least 30 genuinely distinct choreographies, one or two uses each and never more than three. A new color, font, backdrop or seed is not a new choreography. Keep a running list while writing.
- Use real lyrics only. Instrumental passages may use the real song or chapter title, never invented words.
- Do not reuse scene artwork; cropping or tinting is reuse.
- Mark any treatment the engine cannot yet render as a proposed new capability.
- No shake by default. Plan a shaking frame only for extreme power or a violent, energetic collision (a blow landing, lightning striking close, the ground breaking), at most once or twice in a film, and write the reason in that scene's `<choreography>`; photoreal scenes also carry it as `"shake": "<the violent moment>"` in film.json. Strong words, beats and choruses get light, scale, a cut or stillness instead.
- Record `inspiration` with inspected reference IDs, or record no-match honestly.
- Hand the brief to choreography authoring (HyperFrames/GSAP skills) and keep it in the project so a different agent can continue it.
