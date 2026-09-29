/** Code-only mode: every frame is drawn by code from the project, fonts and
 * measured audio. No generated or photographic images or video. The quality
 * bar is mexicat/pdoom-video: 1080p60, deterministic seek, sub-frame motion
 * blur, one design system with a distinct idiom per scene. */
export const CODE_ONLY = Object.freeze({
  fps: 60,
  // Same shutter and adaptive sampling as the pdoom renderer.
  motionBlur: Object.freeze({ samples: 'auto', shutter: 0.2, tolerance: 3 }),
  crf: 16,
  preset: 'slow',
});

export const isCodeOnly = project => project?.creation?.mode === 'code-only';

/** Settings a new code-only project starts with. Authored values win. */
export function applyCodeOnly(project) {
  const p = structuredClone(project);
  p.creation = { ...p.creation, mode: 'code-only' };
  p.render = { motionBlur: { ...CODE_ONLY.motionBlur }, crf: CODE_ONLY.crf, preset: CODE_ONLY.preset, ...p.render };
  return p;
}

/** Fonts are the only permitted file assets. Anything else a scene uses is a
 * bitmap or footage that the code did not draw. */
export function auditCodeOnly(project) {
  if (!isCodeOnly(project)) return { required: false, passed: true, issues: [] };
  const issues = [];
  for (const section of project.sections ?? []) {
    for (const id of section.assetIds ?? []) {
      const asset = project.assets?.[id];
      if (asset && asset.type !== 'font') issues.push(`Code-only scene ${section.id} uses ${asset.type ?? 'unknown'} asset ${id}; draw it in code instead`);
    }
    if (section.direction?.photo) issues.push(`Code-only scene ${section.id} selects photo ${section.direction.photo}`);
  }
  if ((project.fps ?? 0) < CODE_ONLY.fps) issues.push(`Code-only projects render at ${CODE_ONLY.fps} fps or more (this one is ${project.fps})`);
  const samples = project.render?.motionBlur?.samples;
  if (!(samples === 'auto' || samples > 1)) issues.push('Code-only projects render with sub-frame motion blur (render.motionBlur.samples "auto" or > 1)');
  return { required: true, passed: issues.length === 0, issues };
}
