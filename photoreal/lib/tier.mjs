// Which render tier a film uses: --tier, then "tier" in film.json, then the default, premium (the
// ultra realistic render: 60 fps, many sub-frames, CRF 16, every gate) since 2026-10-07.
//
// A film rendered at standard before premium became the default (segments in out/segments/, which
// only the standard tier writes) keeps standard, so an existing film is never silently re-rendered
// at another tier. Give it "tier": "premium" to move it up.
import fs from 'node:fs';
import path from 'node:path';

export const TIERS = ['fast', 'standard', 'premium'];
export const DEFAULT_TIER = 'premium';

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
    return pick('standard', 'already rendered at standard before premium became the default; set "tier" in film.json to change it');
  }
  return pick(DEFAULT_TIER, 'default');
}
