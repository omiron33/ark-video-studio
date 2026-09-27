import path from 'node:path';
import { fileHash, resolveSource } from './project.mjs';

export const SCENE_PHOTO_STYLES = Object.freeze(['verse', 'impact', 'orbit', 'story', 'submerge']);
const photoStyles = new Set(SCENE_PHOTO_STYLES);
const reusableRoles = new Set(['texture', 'shared-texture', 'procedural']);
const isArtwork = asset => asset?.type === 'image' && !reusableRoles.has(asset.artworkRole ?? asset.role);
const sourceKey = asset => typeof asset?.src === 'string' ? path.normalize(asset.src) : undefined;

/** Match the renderer's primary-photo selection, not every cache dependency.
 * Terrain/rise draw their own graphics; a terrain portal borrows its successor's
 * image and is part of that image's introduction, not a second scene assignment.
 * Explicit shared textures/procedural layers are not story artwork. */
export function sceneArtworkId(project, section) {
  if (!photoStyles.has(section.style)) return undefined;
  if (section.direction?.photo) return section.direction.photo;
  if (section.style === 'submerge' || section.style === 'story' && section.direction?.water) return section.assetIds?.[0];
  return section.assetIds?.find(id => project.assets?.[id]?.type === 'image');
}

function requestFor(project, section, reason, stylePrompt = project.creation?.stylePrompt ?? '') {
  const ids = new Set(section.wordIds ?? []);
  const lyrics = (project.words ?? []).filter(word => ids.has(word.id)).map(word => word.text).join(' ');
  return {
    sectionId: section.id, status: 'pending', kind: 'unique-scene-artwork',
    provider: 'gpt-image', reason, lyrics, start: section.start, end: section.end,
    request: `${stylePrompt}\nCreate a distinct scene image for ${section.id}${lyrics ? `, illustrating: ${lyrics}` : ` in ${project.title ?? 'this film'}`}. Compose it behind readable lyric typography. Do not reuse or merely crop another scene's artwork.`,
    agentAction: 'Use the built-in GPT Image tool to create original artwork for this scene, record its prompt/provenance, copy it into this portable project, assign direction.photo and assetIds for this section, then rerun the artwork audit. This is agent work, not a user handoff.',
  };
}

/** Allocate only unassigned scene artwork. Authored choices are authoritative:
 * repeated authored images remain unchanged and fail the separate byte audit.
 * This function never mutates its input, generates images, or reads file bytes. */
export function allocateSceneArtwork(project, { requirePhotos = false, requiredSectionIds = [], stylePrompt = project.creation?.stylePrompt ?? '' } = {}) {
  const result = structuredClone(project), assets = result.assets ?? {}, sections = result.sections ?? [];
  const required = new Set(requiredSectionIds), reservedIds = new Set(), reservedSources = new Set();
  const assignments = [], assetRequests = [], issues = [];
  for (const id of required) if (!sections.some(section => section.id === id)) throw new Error(`Required artwork references unknown section ${id}`);
  // Reserve all authored choices before allocating earlier unassigned scenes.
  // A future scene's explicit choice must not be stolen by an earlier scene.
  for (const section of sections) {
    const id = sceneArtworkId(result, section);
    if (id) { reservedIds.add(id); const source = sourceKey(assets[id]); if (source) reservedSources.add(source); }
    if (section.direction?.photoRequired || requirePhotos && photoStyles.has(section.style)) required.add(section.id);
  }
  const semanticIds = new Set(sections.flatMap(section => section.direction?.wave ? [section.direction.wave] : section.style === 'submerge' && assets.wave ? ['wave'] : []));
  const candidates = Object.keys(assets).filter(id => isArtwork(assets[id]) && !semanticIds.has(id));
  for (const section of sections) {
    section.direction ??= {};
    if (required.has(section.id)) section.direction.photoRequired = true;
    const existing = sceneArtworkId(result, section);
    if (existing) {
      if (assets[existing]?.type === 'image' && !isArtwork(assets[existing]) && !required.has(section.id)) continue;
      // Make a legacy renderer fallback explicit without touching semantic roles
      // or dropping other dependencies such as a foreground wave or successor.
      section.direction.photo ??= existing;
      section.assetIds = [...new Set([...(section.assetIds ?? []), existing])];
      assignments.push({ sectionId: section.id, assetId: existing, source: 'preserved' });
      if (!isArtwork(assets[existing])) {
        const reason = `Scene ${section.id} selects ${existing}, which is not available scene artwork`;
        issues.push(reason); assetRequests.push(requestFor(result, section, reason, stylePrompt));
      }
      continue;
    }
    if (!required.has(section.id)) continue;
    if (!photoStyles.has(section.style)) {
      const reason = `Scene ${section.id} requires artwork but ${section.style} renders procedural graphics, not its own photo`;
      issues.push(reason); assetRequests.push(requestFor(result, section, reason, stylePrompt)); continue;
    }
    const available = candidates.find(id => !reservedIds.has(id) && !reservedSources.has(sourceKey(assets[id])));
    if (available) {
      section.direction.photo = available;
      section.assetIds = [...new Set([...(section.assetIds ?? []), available])];
      reservedIds.add(available); const source = sourceKey(assets[available]); if (source) reservedSources.add(source);
      assignments.push({ sectionId: section.id, assetId: available, source: 'allocated' });
    } else {
      const reason = `Scene ${section.id} needs its own artwork; no unused scene image remains`;
      assetRequests.push(requestFor(result, section, reason, stylePrompt));
    }
  }
  return {
    project: result, assetRequests,
    evidence: { policy: 'unique-scene-artwork-v1', assignments, requiredSectionIds: [...required], issues, pending: assetRequests.length, byteAuditRequired: true },
  };
}

/** Audit the referenced files themselves. Claimed asset hashes/provenance cannot
 * certify uniqueness, and renaming an identical image cannot evade this gate. */
export async function auditSceneArtwork(project, manifestPath, { requiredSectionIds = [] } = {}) {
  const sections = project.sections ?? [], assets = project.assets ?? {}, required = new Set(requiredSectionIds);
  const uses = [], missing = [], duplicates = [], issues = [], assetRequests = [], hashes = new Map();
  const addMissing = (section, reason, assetId) => {
    missing.push({ sectionId: section.id, ...(assetId ? { assetId } : {}), reason });
    issues.push(reason); assetRequests.push(requestFor(project, section, reason));
  };
  for (const id of required) if (!sections.some(section => section.id === id)) issues.push(`Required artwork references unknown section ${id}`);
  for (const section of sections) {
    const photoRequired = required.has(section.id) || section.direction?.photoRequired === true;
    const assetId = sceneArtworkId(project, section), asset = assets[assetId];
    if (!assetId) {
      if (photoRequired || section.direction?.photo) addMissing(section, `Scene ${section.id} ${photoStyles.has(section.style) ? 'has no required photograph' : `cannot display its required photograph with procedural style ${section.style}`}`, section.direction?.photo);
      continue;
    }
    if (!isArtwork(asset)) {
      // Shared textures may legitimately support several backgrounds, but cannot
      // satisfy a scene's requested photographic storytelling requirement.
      if (photoRequired || asset?.type !== 'image') addMissing(section, `Scene ${section.id} selects ${assetId}, which is not a scene photograph`, assetId);
      continue;
    }
    if (typeof asset.src !== 'string' || !asset.src) { addMissing(section, `Scene ${section.id} image ${assetId} has no source file`, assetId); continue; }
    const source = resolveSource(manifestPath, asset.src);
    try {
      if (!hashes.has(source)) hashes.set(source, fileHash(source));
      const sha256 = await hashes.get(source);
      uses.push({ sectionId: section.id, assetId, src: asset.src, sha256 });
    } catch (error) {
      addMissing(section, `Scene ${section.id} image ${assetId} cannot be read (${error.code ?? error.message})`, assetId);
    }
  }
  const byHash = new Map();
  for (const use of uses) { if (!byHash.has(use.sha256)) byHash.set(use.sha256, []); byHash.get(use.sha256).push(use); }
  for (const [sha256, repeated] of byHash) {
    if (repeated.length < 2) continue;
    const sectionIds = repeated.map(use => use.sectionId);
    duplicates.push({ sha256, sectionIds, assetIds: [...new Set(repeated.map(use => use.assetId))], sources: [...new Set(repeated.map(use => use.src))] });
    issues.push(`Scene artwork is reused by ${sectionIds.join(', ')} (identical SHA-256 ${sha256})`);
    for (const use of repeated.slice(1)) assetRequests.push(requestFor(project, sections.find(section => section.id === use.sectionId), `Replace reused image ${use.assetId} with original artwork for this scene`));
  }
  const passed = issues.length === 0;
  return {
    policy: 'unique-scene-artwork-v1', passed, status: passed ? 'passed' : missing.length ? 'required_assets_pending' : 'reused_scene_artwork',
    issues, missing, duplicates, uses, assetRequests,
    limitations: ['SHA-256 detects byte-identical reuse, including renamed/copied files; re-encoded, cropped, or visually similar derivatives still require independent visual review. Fonts, explicitly marked textures/procedural assets, and transition-only dependencies are excluded from scene-artwork reuse counting.'],
  };
}
