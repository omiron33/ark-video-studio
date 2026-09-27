import { allocateSceneArtwork, auditSceneArtwork, sceneArtworkId, SCENE_PHOTO_STYLES } from './artwork.mjs';
import { planPacing, auditPacing } from './pacing.mjs';
import {auditChoreography} from './choreography-policy.mjs';
import {CHOREOGRAPHY_CATALOG} from './story-visual.mjs';

export const CREATIVE_POLICY = Object.freeze({ version: 1, uniqueSceneArtwork: true, expressivePacing: true, immediateOpening: true });

export function pendingArtworkRequests(project, requests, creative) {
  const assigned = section => project.assets[sceneArtworkId(project, section)]?.type === 'image';
  const external = (requests ?? []).filter(request => request.kind !== 'unique-scene-artwork' && request.status !== 'resolved' &&
    !(request.sectionId ? project.sections.some(s => s.id === request.sectionId && assigned(s)) : project.sections.some(assigned)));
  return [...creative.assetRequests, ...external];
}

/** New creation runs opt in. Historical manifests are never silently upgraded. */
export function planCreativePolicy(project, { stylePrompt = project.creation?.stylePrompt ?? '' } = {}) {
  const artwork = allocateSceneArtwork(project, { requirePhotos: project.creation?.interpreted?.photo === true, requiredSectionIds: project.creation?.creativePolicy?.requiredArtworkSections ?? [], stylePrompt });
  artwork.project.creation = { ...artwork.project.creation, creativePolicy: { ...artwork.project.creation?.creativePolicy, ...CREATIVE_POLICY, requiredArtworkSections: artwork.evidence.requiredSectionIds } };
  const pacing = planPacing(artwork.project, { stylePrompt });
  return { project: pacing.project, assetRequests: artwork.assetRequests, evidence: { artwork: artwork.evidence, pacing: pacing.evidence } };
}

/** Factual guardrails, not a numerical certificate of artistic creativity. */
export async function reviewCreativePolicy(project, manifestPath) {
  if (!project.creation?.creativePolicy) return { required: false, passed: true, issues: [], warnings: [], assetRequests: [] };
  const policy = project.creation.creativePolicy;
  const issues = [];
  if (policy.version !== 1 || policy.uniqueSceneArtwork !== true || policy.expressivePacing !== true || policy.immediateOpening !== true) issues.push('Unsupported or incomplete creative policy');
  for (const section of project.sections) if (!section.direction?.pacing) issues.push(`Scene ${section.id} has no required visual pacing plan`);
  const requiredSectionIds = new Set(policy.requiredArtworkSections ?? []);
  if (project.creation.interpreted?.photo === true) for (const section of project.sections) if (SCENE_PHOTO_STYLES.includes(section.style)) requiredSectionIds.add(section.id);
  const artwork = await auditSceneArtwork(project, manifestPath, { requiredSectionIds: [...requiredSectionIds] });
  const pacing = auditPacing(project);
  const choreography = auditChoreography(project,{catalog:CHOREOGRAPHY_CATALOG});
  issues.push(...artwork.issues, ...pacing.errors, ...choreography.issues);
  return { required: true, passed: issues.length === 0 && artwork.passed && pacing.passed, issues, warnings: pacing.warnings, assetRequests: artwork.assetRequests, artwork, pacing,
    choreography, limitations: ['Unique file bytes, distinct choreography IDs and supported timing do not establish originality or compelling rhythm. The encoded film still requires visual and measured audio review.'] };
}
