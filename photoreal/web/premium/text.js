// In-world lyric text: real browser typography (fonts, kerning, ligatures, CSS effects) painted into
// a texture that sits on a surface inside the 3D scene, so it takes the scene's light, focus and
// motion blur. It uses Chrome's HTML-in-canvas (drawElementImage, enabled by render.mjs for premium
// scenes). Where that isn't available it falls back to drawing the same text with Canvas 2D in the
// element's computed font and colour, so a render never fails for lack of it.
//
//   import { htmlText } from '/premium/text.js';
//   const words = await htmlText({ width: 2048, height: 512, css: 'font: 600 140px "EB Garamond"; color: #f3e6c8; text-align: center' });
//   mesh.material.map = words.texture;   // e.g. a plane on the chalice's base
//   // in the scene's prepare(t): await words.set(`<span style="opacity:${a}">poisoned</span> cups`);
import * as THREE from 'three';

export const htmlInCanvas = typeof CanvasRenderingContext2D !== 'undefined' && 'drawElementImage' in CanvasRenderingContext2D.prototype;

export async function htmlText({ width = 2048, height = 512, css = '', html = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  canvas.setAttribute('layoutsubtree', '');
  // the box centres one inner block, so inline content (spaces between words) lays out normally
  const box = document.createElement('div');
  box.style.cssText = `width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;box-sizing:border-box`;
  const el = document.createElement('div');
  el.style.cssText = css;
  box.appendChild(el);
  canvas.appendChild(box);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  let last = null;

  const paint = () => new Promise((resolve) => {
    if (!htmlInCanvas) { fallback(); return resolve(); }
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { fallback(); resolve(); }, 1500);   // never hang a frame on it
    canvas.onpaint = () => {
      try { ctx.clearRect(0, 0, width, height); ctx.drawElementImage(box, 0, 0); } catch { fallback(); }
      done();
    };
    canvas.requestPaint();
  });

  // Canvas 2D in the element's computed style: line breaks at <br>, inline spans keep their own colour
  function fallback() {
    ctx.clearRect(0, 0, width, height);
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = cs.color; ctx.textBaseline = 'middle';
    ctx.textAlign = cs.textAlign === 'left' || cs.textAlign === 'start' ? 'left' : cs.textAlign === 'right' ? 'right' : 'center';
    const lines = el.innerText.split('\n');
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const x = ctx.textAlign === 'left' ? 0 : ctx.textAlign === 'right' ? width : width / 2;   // fallback ignores the flex box
    lines.forEach((l, i) => ctx.fillText(l, x, height / 2 + (i - (lines.length - 1) / 2) * lh));
  }

  async function set(nextHtml, nextCss) {
    if (nextCss != null) el.style.cssText = nextCss;
    const key = `${nextHtml}|${el.style.cssText}`;
    if (key === last) return;                 // unchanged since the last frame: no repaint
    last = key; el.innerHTML = nextHtml;
    await document.fonts.ready;
    await paint();
    texture.needsUpdate = true;
  }
  if (html) await set(html);
  return { texture, canvas, element: el, set, usesHtml: htmlInCanvas };
}
