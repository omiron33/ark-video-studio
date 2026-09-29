// Shared GLSL: noise, SDF helpers and camera rays. Every clip shader is prefixed with this.
export const COMMON = /* glsl */ `
precision highp float;
precision highp int;
#define PI 3.14159265359
uniform vec2 uRes;
uniform vec2 uJitter;
uniform float uTime;      // song seconds
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform float uCamRoll;
uniform float uFov;       // vertical, degrees
uniform sampler2D uText;
uniform sampler2D uTextShade;   // blurred copy of the text
uniform vec3 uTxC, uTxX, uTxY; // text plane centre and axes
uniform vec2 uTxHS;           // text plane half size
uniform float uFrame;     // integer frame index, constant over the shutter

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat(vec3 x) { return clamp(x, 0.0, 1.0); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

// value noise with analytic smoothness, range 0..1
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
// value noise with derivatives (for erosion-style terrain): returns (value, d/dx, d/dy)
vec3 vnoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
const mat2 M2 = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct) { float s = 0.0, a = 0.5; for (int i = 0; i < 12; i++) { if (i >= oct) break; s += a * vnoise(p); p = M2 * p * 2.03; a *= 0.5; } return s; }
float fbm(vec3 p, int oct) { float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * vnoise(p); p = p * 2.02 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }

// Voronoi: x = distance to border, y = cell id
vec2 voronoiEdge(vec2 x) {
  vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), o = hash22(n + g), r = g + o - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(i, j), o = hash22(n + g), r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec2(md, hash12(n + mg));
}

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - r; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba), z = y - l2; vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }

// Lay the lyric over a colour. Within a soft surround of the letters, the background is pushed away
// from the ink's own brightness (darkened under light words, lifted under dark ones) so every word
// reads, whatever is behind it. The text texture is premultiplied.
vec3 inkOver(vec3 c, vec2 uv) {
  vec4 tx = texture(uText, uv);
  // a broad, soft region around each line (no tight halo round the letters)
  vec4 blur = texture(uTextShade, uv);
  float sur = sat(blur.a * 4.5);
  if (sur < 0.001 && tx.a < 0.001) return c;
  vec3 ink = tx.a > 0.01 ? tx.rgb / tx.a : blur.rgb / max(blur.a, 1e-3);
  float il = dot(ink, vec3(0.2126, 0.7152, 0.0722));
  float bl = dot(c / (1.0 + c), vec3(0.2126, 0.7152, 0.0722));
  if (il > 0.4) c *= mix(1.0, 0.2, sur * smoothstep(0.08, 0.45, bl));
  else c = mix(c, vec3(1.2), sur * 0.45 * smoothstep(0.5, 0.15, bl));
  vec3 lin = pow(max(ink, 0.0), vec3(2.2)) * tx.a;   // canvas colours are sRGB
  return c * (1.0 - tx.a) + lin * 1.35;
}

vec3 camRay(vec2 fragCoord, out vec3 ro) {
  vec2 p = (2.0 * (fragCoord + uJitter) - uRes) / uRes.y;
  ro = uCamPos;
  vec3 ww = normalize(uCamTarget - uCamPos);
  vec3 up = vec3(sin(uCamRoll), cos(uCamRoll), 0.0);
  vec3 uu = normalize(cross(ww, up)), vv = cross(uu, ww);
  float f = 1.0 / tan(radians(uFov) * 0.5);
  return normalize(p.x * uu + p.y * vv + f * ww);
}

// Ray against a text plane: centre c, unit axes ax (text right) and ay (text up), half size hs (world units).
// Returns (u, v, t) with uv in 0..1 when inside, t < 0 when missed.
vec3 planeUV(vec3 ro, vec3 rd, vec3 c, vec3 ax, vec3 ay, vec2 hs) {
  vec3 n = normalize(cross(ax, ay));
  float dn = dot(rd, n); if (abs(dn) < 1e-5) return vec3(0, 0, -1);
  float t = dot(c - ro, n) / dn; if (t < 0.0) return vec3(0, 0, -1);
  vec3 q = ro + rd * t - c;
  vec2 uv = vec2(dot(q, ax) / hs.x, dot(q, ay) / hs.y) * 0.5 + 0.5;
  return vec3(uv, t);
}
`;
