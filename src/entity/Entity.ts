import * as THREE from 'three';
import { bodyFragment, bodyVertex, glowFragment, glowVertex, pointsFragment, pointsVertex } from './shaders';

export type Mood = 'idle' | 'listening' | 'thinking' | 'talking';
/** 'full' fits orb + particle ring inside the anchor; 'body' fits just the orb. */
export type Fit = 'full' | 'body';

type Placement = { x: number; y: number; s: number };

const FOV = 30;
const CAMERA_Z = 10;
const RING_OUTER = 1.75;
const BODY_RADIUS = 1.12;
const TAU = Math.PI * 2;

// Display-space palette (matches the CSS tokens).
const hex = (h: number) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
const DEEP = hex(0x0a1430);
const BLUE = hex(0x3d7bff);
const CYAN = hex(0x5cd6ff);
const GOLD = hex(0xf4c76b);

const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * "Thanos", the AI twin: an iridescent orb with blinking eyes, a particle ring
 * and a little voice-bar mouth. It renders on a fixed full-screen canvas and
 * glides between DOM "anchors" (hero, corner dock, chat header).
 */
export class Entity {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  private readonly root = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly ringTilt = new THREE.Group();
  private readonly ringSpin = new THREE.Group();
  private readonly dustSpin = new THREE.Group();
  private readonly bodyMat: THREE.ShaderMaterial;
  private readonly ringMat: THREE.ShaderMaterial;
  private readonly dustMat: THREE.ShaderMaterial;
  private readonly haloMat: THREE.ShaderMaterial;
  private readonly eyes: THREE.Group[] = [];
  private readonly mouth: THREE.Mesh[] = [];
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private anchor: HTMLElement | null = null;
  private fit: Fit = 'full';
  private placement: Placement | null = null;
  private flight: { from: Placement; t: number } | null = null;
  private mood: Mood = 'idle';
  private energy = 0;
  private hover = false;
  private happyUntil = 0;
  private lookEl: HTMLElement | null = null;
  private pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, moved: -10 };
  private blink = { next: 2.2, start: -1, double: false };
  private snapStart = -1;
  private time = 0;
  private born = 0;
  private lastFrame = performance.now();
  private headRot = { x: 0, y: 0 };
  private eyeOffset = { x: 0, y: 0 };
  private uni = { amp: 0.036, think: 0, glow: 0, ringSpeed: 0.12, eyeScale: 1, squint: 0 };
  private width = 0;
  private height = 0;
  private running = true;

  static create(canvas: HTMLCanvasElement): Entity | null {
    try {
      return new Entity(canvas);
    } catch (error) {
      console.warn('WebGL unavailable, showing the CSS orb instead.', error);
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, CAMERA_Z);

    const small = Math.min(window.innerWidth, window.innerHeight) < 700;

    // Halo
    this.haloMat = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: { uColor: { value: BLUE.clone() }, uColor2: { value: CYAN.clone() }, uOpacity: { value: 0.42 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), this.haloMat);
    halo.position.z = -1.4;
    this.root.add(halo);

    // Body
    this.bodyMat = new THREE.ShaderMaterial({
      vertexShader: bodyVertex,
      fragmentShader: bodyFragment,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0.06 },
        uFreq: { value: 1.15 },
        uEnergy: { value: 0 },
        uSpike: { value: 0 },
        uThink: { value: 0 },
        uGlow: { value: 0 },
        uDeep: { value: DEEP },
        uBlue: { value: BLUE },
        uCyan: { value: CYAN },
        uGold: { value: GOLD },
      },
    });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, small ? 28 : 40), this.bodyMat);
    this.head.add(body);

    // Eyes (capsules with a soft glow behind each)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xeaf8ff });
    const eyeGeo = new THREE.CapsuleGeometry(0.068, 0.15, 6, 14);
    const glowGeo = new THREE.PlaneGeometry(0.75, 0.75);
    const eyeGlowMat = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: { uColor: { value: CYAN.clone() }, uColor2: { value: BLUE.clone() }, uOpacity: { value: 0.9 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const dir = new THREE.Vector3(side * 0.23, 0.11, 0).setZ(Math.sqrt(1 - 0.23 ** 2 - 0.11 ** 2));
      pivot.position.copy(dir.clone().multiplyScalar(1.04));
      pivot.lookAt(dir.clone().multiplyScalar(3));
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.scale.z = 0.55;
      const glow = new THREE.Mesh(glowGeo, eyeGlowMat);
      glow.position.z = -0.02;
      pivot.add(glow, eye);
      this.head.add(pivot);
      this.eyes.push(pivot);
    }

    // Mouth: five tiny voice bars, only visible while talking
    const barGeo = new THREE.CapsuleGeometry(0.017, 0.05, 4, 8);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.058;
      const y = -0.17;
      const dir = new THREE.Vector3(x, y, Math.sqrt(1 - x * x - y * y));
      const bar = new THREE.Mesh(barGeo, eyeMat);
      bar.position.copy(dir.multiplyScalar(1.03));
      bar.lookAt(bar.position.clone().multiplyScalar(3));
      bar.visible = false;
      this.head.add(bar);
      this.mouth.push(bar);
    }
    this.root.add(this.head);

    // Particle ring
    this.ringMat = this.makePointsMaterial(0.9);
    const ring = new THREE.Points(this.makeRing(small ? 900 : 1600), this.ringMat);
    this.ringSpin.add(ring);
    this.ringTilt.add(this.ringSpin);
    this.ringTilt.rotation.set(1.18, 0, -0.32);
    this.root.add(this.ringTilt);

    // Dust shell
    this.dustMat = this.makePointsMaterial(0.5);
    this.dustSpin.add(new THREE.Points(this.makeDust(small ? 220 : 420), this.dustMat));
    this.root.add(this.dustSpin);

    this.root.scale.setScalar(0.001);
    this.scene.add(this.root);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener(
      'pointermove',
      (e) => {
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.pointer.moved = this.time;
      },
      { passive: true },
    );
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.running = false;
      document.documentElement.classList.add('no-webgl');
    });

    this.born = 0;
    requestAnimationFrame(this.frame);
  }

  // ---------- Public API ----------

  setAnchor(el: HTMLElement | null, fit: Fit = 'full'): void {
    if (el === this.anchor && fit === this.fit) return;
    this.anchor = el;
    this.fit = fit;
    if (this.placement && !this.reduced) this.flight = { from: { ...this.placement }, t: 0 };
  }

  setMood(mood: Mood): void {
    if (mood === 'idle' && this.mood === 'talking') this.happyUntil = this.time + 1.1;
    this.mood = mood;
  }

  /** Call for every streamed chunk of text: makes the orb "speak". */
  pulse(strength = 1): void {
    this.energy = Math.min(1, this.energy + 0.22 * strength);
  }

  setHover(on: boolean): void {
    this.hover = on;
  }

  /** Eyes follow this element (e.g. the chat input) instead of the pointer. */
  lookAtElement(el: HTMLElement | null): void {
    this.lookEl = el;
  }

  snap(): void {
    this.snapStart = this.time;
  }

  // ---------- Internals ----------

  private makePointsMaterial(opacity: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      uniforms: {
        uTime: { value: 0 },
        uProj: { value: 1 },
        uScale: { value: 1 },
        uEnergy: { value: 0 },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  private makeRing(count: number): THREE.BufferGeometry {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = 1.32 + Math.pow(Math.random(), 1.7) * (RING_OUTER - 1.32 + 0.25);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.06 * r;
      pos[i * 3 + 2] = Math.sin(a) * r;
      const c = Math.random() < 0.26 ? GOLD : BLUE.clone().lerp(CYAN, Math.random());
      col.set([c.x, c.y, c.z], i * 3);
      size[i] = 0.012 + Math.random() * Math.random() * 0.05;
      seed[i] = Math.random();
    }
    return this.pointsGeometry(pos, col, size, seed);
  }

  private makeDust(count: number): THREE.BufferGeometry {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(1.3 + Math.pow(Math.random(), 0.8) * 1.9);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = Math.random() < 0.2 ? GOLD : CYAN;
      col.set([c.x, c.y, c.z], i * 3);
      size[i] = 0.01 + Math.random() * 0.025;
      seed[i] = Math.random();
    }
    return this.pointsGeometry(pos, col, size, seed);
  }

  private pointsGeometry(pos: Float32Array, col: Float32Array, size: Float32Array, seed: Float32Array) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }

  private resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    const proj = (this.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.ringMat.uniforms.uProj.value = proj;
    this.dustMat.uniforms.uProj.value = proj;
  }

  private unitsPerPixel(): number {
    return (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z) / this.height;
  }

  /** Where the current anchor wants the orb, in world units. */
  private targetPlacement(): Placement | null {
    const el = this.anchor;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const upp = this.unitsPerPixel();
    const half = (Math.min(r.width, r.height) / 2) * upp;
    return {
      x: (r.left + r.width / 2 - this.width / 2) * upp,
      y: (this.height / 2 - (r.top + r.height / 2)) * upp,
      s: half / (this.fit === 'full' ? RING_OUTER : BODY_RADIUS),
    };
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const realDt = Math.min(0.25, (now - this.lastFrame) / 1000);
    const dt = Math.min(0.05, realDt);
    this.lastFrame = now;
    this.time += this.reduced ? dt * 0.4 : dt;
    this.born += dt;
    const t = this.time;

    // ----- Placement & flight -----
    const target = this.targetPlacement();
    if (target) {
      if (!this.placement) this.placement = { ...target };
      if (this.flight) {
        // Real elapsed time, so the flight lands on time even on slow devices.
        this.flight.t = Math.min(1, this.flight.t + realDt / 1.05);
        const e = easeInOutCubic(this.flight.t);
        const f = this.flight.from;
        const arc = Math.sin(Math.PI * this.flight.t) * 0.9 * Math.min(1, Math.abs(target.x - f.x) / 4);
        this.placement = {
          x: f.x + (target.x - f.x) * e,
          y: f.y + (target.y - f.y) * e + arc,
          s: f.s + (target.s - f.s) * e,
        };
        this.root.rotation.z = Math.sin(Math.PI * this.flight.t) * 0.35 * Math.sign(target.x - f.x);
        if (this.flight.t >= 1) this.flight = null;
      } else {
        this.placement = { ...target };
        this.root.rotation.z = damp(this.root.rotation.z, 0, 6, dt);
      }
    }
    const p = this.placement;
    if (!p) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const intro = this.reduced ? 1 : easeOutBack(clamp(this.born / 1.3, 0, 1));
    const hoverBoost = this.hover ? 1.045 : 1;
    const snapK = this.snapStart >= 0 ? clamp((t - this.snapStart) / 1.5, 0, 1) : 1;
    const snapWave = snapK < 1 ? Math.sin(Math.PI * snapK) : 0;
    if (snapK >= 1) this.snapStart = -1;
    const breathe = 1 + Math.sin(t * 1.6) * 0.012;
    this.root.position.set(p.x, p.y, 0);
    this.root.scale.setScalar(Math.max(0.001, p.s * intro * hoverBoost * breathe));

    // ----- Mood targets -----
    const m = this.mood;
    const thinking = m === 'thinking' ? 1 : 0;
    this.uni.amp = damp(this.uni.amp, m === 'thinking' ? 0.075 : m === 'talking' ? 0.05 : 0.036, 3, dt);
    this.uni.think = damp(this.uni.think, thinking, 3, dt);
    this.uni.ringSpeed = damp(this.uni.ringSpeed, m === 'thinking' ? 1.1 : m === 'talking' ? 0.35 : 0.12, 2.5, dt);
    this.uni.glow = damp(this.uni.glow, (this.hover ? 0.6 : 0) + thinking * 0.5 + this.energy * 0.6, 4, dt);
    this.energy = damp(this.energy, 0, m === 'talking' ? 2.2 : 5, dt);
    const happy = t < this.happyUntil || snapWave > 0.05;
    this.uni.squint = damp(this.uni.squint, happy ? 1 : 0, 10, dt);
    this.uni.eyeScale = damp(
      this.uni.eyeScale,
      m === 'listening' ? 1.14 : m === 'thinking' ? 0.86 : this.hover ? 1.1 : 1,
      8,
      dt,
    );

    const bu = this.bodyMat.uniforms;
    bu.uTime.value = t;
    bu.uAmp.value = this.uni.amp;
    bu.uEnergy.value = this.energy;
    bu.uThink.value = this.uni.think;
    bu.uGlow.value = this.uni.glow;
    bu.uSpike.value = this.reduced ? 0 : snapWave;

    // ----- Gaze -----
    const upp = this.unitsPerPixel();
    const cx = this.width / 2 + p.x / upp;
    const cy = this.height / 2 - p.y / upp;
    let lookX: number;
    let lookY: number;
    if (m === 'thinking') {
      lookX = 0.32 + Math.sin(t * 1.3) * 0.08;
      lookY = -0.34;
    } else if (this.lookEl) {
      const r = this.lookEl.getBoundingClientRect();
      lookX = clamp(((r.left + r.width / 2 - cx) / this.width) * 1.6, -0.5, 0.5);
      lookY = clamp(((r.top + r.height / 2 - cy) / this.height) * 1.6, -0.4, 0.45);
    } else if (t - this.pointer.moved < 4.5) {
      lookX = clamp(((this.pointer.x - cx) / this.width) * 1.5, -0.6, 0.6);
      lookY = clamp(((this.pointer.y - cy) / this.height) * 1.5, -0.45, 0.45);
    } else {
      // Idle wandering
      lookX = Math.sin(t * 0.37) * 0.28 + Math.sin(t * 0.91) * 0.08;
      lookY = Math.sin(t * 0.29 + 1.2) * 0.14;
    }
    this.headRot.y = damp(this.headRot.y, lookX, 5, dt);
    this.headRot.x = damp(this.headRot.x, lookY, 5, dt);
    this.head.rotation.set(this.headRot.x, this.headRot.y + (snapWave > 0 ? snapWave * TAU * 0.5 : 0), 0);
    this.eyeOffset.x = damp(this.eyeOffset.x, lookX * 0.06, 8, dt);
    this.eyeOffset.y = damp(this.eyeOffset.y, -lookY * 0.05, 8, dt);

    // ----- Blinks -----
    let lid = 1;
    if (this.born < 0.95) lid = 0.06; // wakes up with eyes closed
    else {
      if (this.blink.start < 0 && t > this.blink.next) {
        this.blink.start = t;
        this.blink.double = Math.random() < 0.18;
      }
      if (this.blink.start >= 0) {
        const k = (t - this.blink.start) / 0.16;
        if (k >= (this.blink.double ? 2.2 : 1)) {
          this.blink.start = -1;
          this.blink.next = t + 2.2 + Math.random() * 4;
        } else {
          const phase = k % 1.1;
          lid = phase < 1 ? 1 - Math.sin(Math.PI * Math.min(phase, 1)) * 0.94 : 1;
        }
      }
    }
    const squint = this.uni.squint;
    this.eyes.forEach((pivot, i) => {
      const side = i === 0 ? -1 : 1;
      const eye = pivot.children[1] as THREE.Mesh;
      eye.scale.x = this.uni.eyeScale * (1 + squint * 0.12);
      eye.scale.y = Math.max(0.05, this.uni.eyeScale * lid * (1 - squint * 0.62));
      eye.position.set(this.eyeOffset.x, this.eyeOffset.y + squint * 0.03, 0);
      eye.rotation.z = squint * 0.25 * -side;
    });

    // ----- Mouth -----
    const talkVisible = this.energy > 0.04;
    this.mouth.forEach((bar, i) => {
      bar.visible = talkVisible;
      if (!talkVisible) return;
      const wobble = 0.35 + 0.65 * Math.abs(Math.sin(t * (11 + i * 2.3) + i * 1.7));
      bar.scale.set(1, 0.3 + this.energy * wobble * 2.4, 0.6);
    });

    // ----- Particles -----
    const pxRadius = (p.s * BODY_RADIUS) / upp;
    const smallFade = clamp((pxRadius - 24) / 90, 0.22, 1);
    for (const mat of [this.ringMat, this.dustMat]) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uScale.value = p.s * intro;
      mat.uniforms.uEnergy.value = this.energy + snapWave;
    }
    this.ringMat.uniforms.uOpacity.value = 0.9 * smallFade;
    this.dustMat.uniforms.uOpacity.value = 0.5 * smallFade;
    this.haloMat.uniforms.uOpacity.value = (0.36 + this.uni.glow * 0.25) * clamp(smallFade + 0.25, 0, 1);
    this.ringSpin.rotation.y += dt * this.uni.ringSpeed;
    this.ringTilt.rotation.x = 1.18 + Math.sin(t * 0.21) * 0.06;
    this.ringSpin.scale.setScalar(1 + snapWave * 0.7 + this.energy * 0.03);
    this.dustSpin.rotation.y -= dt * 0.04;
    this.dustSpin.rotation.x += dt * 0.015;
    this.dustSpin.scale.setScalar(1 + snapWave * 0.9);

    this.renderer.render(this.scene, this.camera);
  };
}
