// GLSL for the entity. Colors are authored in display (sRGB) space and written out as-is.

// 3D simplex noise by Ashima Arts / Stefan Gustavson (MIT).
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const bodyVertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uEnergy;
uniform float uSpike;
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vObjNormal;
varying float vDisp;
${SIMPLEX}

float displacementAt(vec3 p) {
  // Keep the face (+z) calm so the eyes stay readable.
  float face = smoothstep(0.55, 0.95, p.z);
  float n = snoise(p * uFreq + vec3(0.0, 0.0, uTime * 0.22));
  n += 0.35 * snoise(p * uFreq * 2.4 + vec3(uTime * 0.35));
  float talk = 0.5 + 0.5 * sin(p.y * 9.0 - uTime * 14.0);
  float amp = uAmp * (1.0 - 0.78 * face) + uEnergy * 0.07 * talk * (1.0 - 0.7 * face);
  return n * amp + uSpike * 0.16 * snoise(p * 3.5 + uTime * 2.0);
}

void main() {
  vec3 p = normalize(position);
  float d = displacementAt(p);
  vec3 displaced = p * (1.0 + d);

  // Rebuild the normal from two neighbouring samples.
  vec3 helper = abs(p.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t = normalize(cross(p, helper));
  vec3 b = normalize(cross(p, t));
  float e = 0.012;
  vec3 p1 = normalize(p + t * e);
  vec3 p2 = normalize(p + b * e);
  vec3 d1 = p1 * (1.0 + displacementAt(p1));
  vec3 d2 = p2 * (1.0 + displacementAt(p2));
  vec3 n = normalize(cross(d1 - displaced, d2 - displaced));
  if (dot(n, p) < 0.0) n = -n;

  vObjNormal = n;
  vNormal = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vViewPos = mv.xyz;
  vDisp = d;
  gl_Position = projectionMatrix * mv;
}
`;

export const bodyFragment = /* glsl */ `
uniform float uTime;
uniform float uThink;
uniform float uGlow;
uniform vec3 uDeep;
uniform vec3 uBlue;
uniform vec3 uCyan;
uniform vec3 uGold;
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vObjNormal;
varying float vDisp;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.8);

  // Iridescent rim: Aegean blue -> cyan, with sun-gold veins (more gold while thinking).
  float t = 0.5 + 0.5 * sin(vObjNormal.y * 2.3 + vObjNormal.x * 1.4 + uTime * 0.35 + fres * 3.2);
  vec3 irid = mix(uBlue, uCyan, t);
  float veins = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(vObjNormal.x * 3.1 - uTime * 0.28 + vDisp * 14.0));
  irid = mix(irid, uGold, veins * (0.32 + 0.55 * uThink));

  vec3 base = uDeep * (0.45 + 0.5 * ndv);

  vec3 L = normalize(vec3(-0.45, 0.75, 0.6));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 120.0);
  vec3 L2 = normalize(vec3(0.8, -0.35, 0.5));
  float spec2 = pow(max(dot(N, normalize(L2 + V)), 0.0), 18.0);

  float bands = smoothstep(0.93, 1.0, sin((vObjNormal.y + vDisp * 3.0) * 16.0 + uTime * 0.6)) * (1.0 - fres);

  vec3 col = base;
  col += irid * (fres * 1.6 + 0.04);
  col += vec3(1.0, 0.97, 0.9) * spec * 0.7;
  col += uCyan * spec2 * 0.18;
  col += irid * bands * 0.07;
  col += irid * uGlow * 0.22;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const pointsVertex = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uProj;
uniform float uScale;
uniform float uEnergy;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.8 + aSeed * 6.2831) * 0.025;
  p *= 1.0 + uEnergy * 0.06 * sin(uTime * 9.0 + aSeed * 20.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uScale * uProj / -mv.z);
  vColor = aColor;
  vTwinkle = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.2) + aSeed * 40.0));
}
`;

export const pointsFragment = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  a *= a * vTwinkle * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(smoothstep(1.0, 0.0, d), 2.2) * uOpacity;
  gl_FragColor = vec4(mix(uColor, uColor2, smoothstep(0.0, 0.8, d)), a);
}
`;
