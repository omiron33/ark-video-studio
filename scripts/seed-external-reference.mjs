// Re-extract portable frame evidence from the public X reference's exact MP4.
// Usage: node scripts/seed-external-reference.mjs [path/to/source.mp4]
// Download the source outside this repo with yt-dlp -f http-2176; do not commit it.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(import.meta.dirname, '../references/motion');
const source = JSON.parse(fs.readFileSync(path.join(root, 'sources/ptrubey-2104062055712260161.json'), 'utf8'));
const video = process.argv[2] ?? source.localPath;
if (!fs.existsSync(video)) throw new Error(`Source cache missing: ${video}. Re-download ${source.url}; reference images remain portable.`);
const sha = createHash('sha256').update(fs.readFileSync(video)).digest('hex');
if (sha !== source.videoSha256) throw new Error('Source checksum differs; re-review the new source before replacing evidence.');
const cards = fs.readdirSync(path.join(root, 'cards'))
  .filter(name => name.startsWith('external-') && name.endsWith('.json'))
  .map(name => JSON.parse(fs.readFileSync(path.join(root, 'cards', name), 'utf8')))
  .filter(card => card.source.videoSha256 === sha);
for (const card of cards) {
  const dir = path.join(root, 'images', card.id);
  fs.mkdirSync(dir, { recursive: true });
  const canvas = createCanvas(1280, 1144);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121618'; ctx.fillRect(0, 0, 1280, 1144);
  ctx.fillStyle = '#ecedeb'; ctx.font = '20px sans-serif'; ctx.fillText(card.title, 16, 28);
  for (const [i, frame] of card.frames.entries()) {
    const file = path.join(root, frame.path);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(frame.timeSeconds), '-i', video,
      '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', '-y', file]);
    const x = (i % 2) * 640, y = 40 + Math.floor(i / 2) * 368;
    ctx.drawImage(await loadImage(file), x, y, 640, 360);
    ctx.fillStyle = '#121618'; ctx.fillRect(x, y + 331, 150, 29);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    const t = frame.timeSeconds;
    ctx.fillText(`${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}  #${i + 1}`, x + 10, y + 352);
  }
  fs.writeFileSync(path.join(root, card.contactSheet), canvas.toBuffer('image/jpeg', 88));
  console.log(card.id);
}
