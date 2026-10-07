// Which render tier a film uses: --tier, then "tier" in film.json, then the default, ultra (the
// ultra realistic render: at least 64 sub-frames, CRF 12, every gate, 1920x1080 unless film.json
// gives "resolution") since 2026-10-07.
//
// A film rendered at standard before ultra became the default (segments in out/segments/, which
// only the standard tier writes) keeps standard, so an existing film is never silently re-rendered
// at another tier. Give it "tier": "ultra" to move it up.
import fs from 'node:fs';
import path from 'node:path';

export const TIERS = ['fast', 'standard', 'premium', 'ultra'];
export const DEFAULT_TIER = 'ultra';

const hasSegments = (dir) => { try { return fs.readdirSync(dir).some((f) => f.endsWith('.mp4')); } catch { return false; } };

// -> { tier, why }
export function resolveTier(song, film, cli) {
  const pick = (tier, why) => {
    if (!TIERS.includes(tier)) throw Error(`tier must be one of ${TIERS.join(', ')}`);
    return { tier, why };
  };
  if (cli) return pick(cli, '--tier');
  if (film?.tier) return pick(film.tier, 'film.json');
  const out = path.join(song, 'out');
  if (hasSegments(path.join(out, 'segments'))) {
    return pick('standard', 'already rendered at standard before ultra became the default; set "tier" in film.json to change it');
  }
  return pick(DEFAULT_TIER, 'default');
}
