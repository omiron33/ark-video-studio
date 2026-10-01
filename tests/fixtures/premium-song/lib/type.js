// typography shared by the lyric modules only
export function setWords(ctx, words, t, { size = 190, y = 512, W = 4096 } = {}) {
  ctx.font = `500 ${size}px "EB Garamond"`;
  ctx.textBaseline = 'middle';
  const sp = ctx.measureText(' ').width;
  const widths = words.map((w) => ctx.measureText(w.w).width);
  let x = (W - widths.reduce((a, b) => a + b, 0) - sp * (words.length - 1)) / 2;
  words.forEach((w, i) => {
    const a = Math.min(1, Math.max(0, (t - w.start) / 0.2));
    ctx.fillStyle = `rgba(246,240,228,${a})`;
    ctx.fillText(w.w, x, y);
    x += widths[i] + sp;
  });
}
