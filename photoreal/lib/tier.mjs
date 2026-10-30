// Render tier and sampling are separate: keep Ultra's finishing/review defaults,
// but use Dove's 8-sample baseline (16 when a scene requests it) for new films.
// Existing cached films retain their tier and historical sampling unless overridden.
import fs from 'node:fs';
import path from 'node:path';

export const TIERS = ['fast', 'standard', 'premium', 'ultra'];
export const DEFAULT_TIER = 'ultra';
export const DEFAULT_SAMPLES = 8;
export const SAMPLE_PRESETS = ['dove', 'ultra'];
export const DEFAULT_SAMPLE_PRESET = 'dove';

export function samplesForTier(tier, base = DEFAULT_SAMPLES, preset = DEFAULT_SAMPLE_PRESET) {
  if (!TIERS.includes(tier)) throw Error(`tier must be one of ${TIERS.join(', ')}`);
  if (!SAMPLE_PRESETS.includes(preset)) throw Error(`sample preset must be one of ${SAMPLE_PRESETS.join(', ')}`);
  return tier === 'fast' ? 2 : tier === 'premium' ? Math.max(16, base * 2) : tier === 'ultra' && preset === 'ultra' ? Math.max(64, base * 4) : base;
}

export function samplesForScene(tier, base, { samples, draft = false, premiumScene = false } = {}) {
  if (draft) return base;
  const own = samples == null ? base : tier === 'premium' || tier === 'ultra' ? Math.max(+samples, base) : tier === 'fast' ? Math.min(+samples, base) : +samples;
  return tier === 'premium' && premiumScene ? Math.max(32, own) : own;
}

const hasSegments = (dir) => { try { return fs.readdirSync(dir).some((f) => f.endsWith('.mp4')); } catch { return false; } };

const cachedTier = (song) => ['standard', 'ultra', 'premium', 'fast'].find((tier) =>
  hasSegments(path.join(song, 'out', tier === 'standard' ? 'segments' : `segments-${tier}`)));

export function resolveSamplePreset(song, film, cli) {
  const pick = (preset, why) => {
    if (!SAMPLE_PRESETS.includes(preset)) throw Error(`sample preset must be one of ${SAMPLE_PRESETS.join(', ')}`);
    return { preset, why };
  };
  if (cli) return pick(cli, '--sample-preset');
  if (film?.samplePreset) return pick(film.samplePreset, 'film.json');
  if (cachedTier(song)) return pick('ultra', 'existing render; preserving previous tier sampling');
  return pick(DEFAULT_SAMPLE_PRESET, 'default');
}

// -> { tier, why }
export function resolveTier(song, film, cli) {
  const pick = (tier, why) => {
    if (!TIERS.includes(tier)) throw Error(`tier must be one of ${TIERS.join(', ')}`);
    return { tier, why };
  };
  if (cli) return pick(cli, '--tier');
  if (film?.tier) return pick(film.tier, 'film.json');
  // Keep the historical standard-cache precedence when more than one tier was tried.
  const cached = cachedTier(song);
  if (cached) return pick(cached, `already rendered at ${cached}; set "tier" in film.json to change it`);
  return pick(DEFAULT_TIER, 'default');
}
