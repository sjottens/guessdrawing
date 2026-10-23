import * as THREE from "three";

/**
 * A living particle organism that keeps drawing doodles: particles flow out of
 * the cell in stroke order, hold the shape, then dissolve back into it.
 */

export type Focus = "right" | "top";
export type ShapeId = "star" | "heart" | "house" | "fish" | "sun";
export type ShapeEvent = { name: ShapeId; done: boolean };

type Stroke = [number, number][];
interface Shape {
  name: ShapeId;
  strokes: Stroke[];
}

const ring = (n: number, f: (t: number) => [number, number]): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => f((i / n) * Math.PI * 2));

const SHAPES: Shape[] = [
  {
    name: "star",
    strokes: [ring(10, (t) => {
      const r = Math.round((t / (Math.PI * 2)) * 10) % 2 === 0 ? 1 : 0.42;
      const a = t + Math.PI / 2;
      return [Math.cos(a) * r, Math.sin(a) * r];
    })],
  },
  {
    name: "heart",
    strokes: [ring(120, (t) => [
      (16 * Math.sin(t) ** 3) / 17,
      (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + 0.12,
    ])],
  },
  {
    name: "house",
    strokes: [
      [[-0.75, -0.85], [-0.75, 0.1], [0, 0.85], [0.75, 0.1], [0.75, -0.85], [-0.75, -0.85]],
      [[-0.2, -0.85], [-0.2, -0.3], [0.2, -0.3], [0.2, -0.85]],
      [[0.3, 0.05], [0.55, 0.05], [0.55, 0.3], [0.3, 0.3], [0.3, 0.05]],
    ],
  },
  {
    name: "fish",
    strokes: [
      ring(140, (t) => [(Math.cos(t) - Math.sin(t) ** 2 / Math.SQRT2) * 0.95 + 0.2, Math.cos(t) * Math.sin(t) * 1.1]),
      ring(24, (t) => [0.62 + Math.cos(t) * 0.06, 0.12 + Math.sin(t) * 0.06]),
    ],
  },
  {
    name: "sun",
    strokes: [
      ring(80, (t) => [Math.cos(t) * 0.45, Math.sin(t) * 0.45]),
      ...Array.from({ length: 8 }, (_, i): Stroke => {
        const a = (i / 8) * Math.PI * 2;
        return [
          [Math.cos(a) * 0.62, Math.sin(a) * 0.62],
          [Math.cos(a) * 0.95, Math.sin(a) * 0.95],
        ];
      }),
    ],
  },
];

/** Point at fraction u along all strokes together (jumps between strokes are skipped). */
function sampler(shape: Shape) {
  const segs: { a: [number, number]; b: [number, number]; start: number; len: number }[] = [];
  let total = 0;
  for (const s of shape.strokes) {
    for (let i = 1; i < s.length; i++) {
      const p = s[i - 1]!;
      const q = s[i]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      segs.push({ a: p, b: q, start: total, len });
      total += len;
    }
  }
  return (u: number): [number, number] => {
    const d = u * total;
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid]!.start <= d) lo = mid;
      else hi = mid - 1;
    }
    const s = segs[lo]!;
    const k = s.len ? Math.min(1, (d - s.start) / s.len) : 0;
    return [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k];
  };
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT).
const simplexNoise = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
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
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

const vertexShader = /* glsl */ `
  ${simplexNoise}
  uniform float uTime;
  uniform float uDraw;
  uniform float uHold;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  uniform vec3 uCenter;
  uniform float uScale;
  uniform float uBlob;
  uniform float uFocus;
  attribute vec3 aTarget;
  attribute float aDraw;
  attribute float aU;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Organism: a cell whose membrane and nucleus breathe and ripple with noise.
    vec3 dir = position;
    float n = snoise(dir * 1.3 + vec3(0.0, uTime * 0.16, uTime * 0.11));
    float n2 = snoise(dir * 3.2 - vec3(uTime * 0.22));
    float breathe = 1.0 + 0.04 * sin(uTime * 0.9);
    vec3 p = dir * (1.0 + n * 0.3 + n2 * 0.07) * breathe * uBlob;
    float ry = uTime * 0.07;
    p.xz = mat2(cos(ry), -sin(ry), sin(ry), cos(ry)) * p.xz;
    float rx = 0.35 + 0.1 * sin(uTime * 0.13);
    p.yz = mat2(cos(rx), -sin(rx), sin(rx), cos(rx)) * p.yz;
    p += uCenter;

    // Drawing: some particles leave the cell in stroke order; the rest stay behind.
    vec3 t = uCenter + aTarget * uScale;
    t += vec3(sin(uTime * 1.3 + aSeed * 40.0), cos(uTime * 1.1 + aSeed * 23.0), 0.0) * 0.025 * uScale;
    float k = smoothstep(aU - 0.08, aU, uDraw) * uHold * aDraw;
    k = k * k * (3.0 - 2.0 * k);
    vec3 pos = mix(p, t, k);

    // Particles shy away from the pointer.
    vec2 d = pos.xy - uPointer;
    float dist2 = dot(d, d);
    // Small, subtle repel: push 0.36, falloff 10 (half of the previous 0.72 and 2.5 / 0.5²).
    pos.xy += normalize(d + 1e-4) * 0.36 * exp(-dist2 * 10.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.45 + aSeed) * mix(1.0, 1.35, k);
    gl_PointSize = size * uPixelRatio / -mv.z;

    // Ridges of the membrane glow brighter.
    vec3 bio = aColor * (0.7 + 0.6 * smoothstep(-0.4, 0.6, n));
    vColor = mix(bio, mix(aColor, vec3(1.0), 0.55) * 0.9, k);
    float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aSeed * 60.0);
    // The cell dims while a doodle is on show, so the drawing reads clearly.
    float cell = 0.5 * twinkle * mix(1.0, 0.5, uFocus);
    vAlpha = mix(cell, 0.85, k);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a * a * vAlpha);
  }
`;

const DRAW_S = 2.8;
const HOLD_S = 2.6;
const FADE_S = 1.4;
const PAUSE_S = 0.5;

export function mountNebula(
  host: HTMLElement,
  { focus = "right", onShape }: { focus?: Focus; onShape?: (e: ShapeEvent) => void } = {},
): () => void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = window.innerWidth < 700 ? 12000 : 24000;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 12;

  // Organism layout (unit scale): membrane, nucleus and drifting spores.
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const u = new Float32Array(count);
  const draws = new Float32Array(count);
  const target = new Float32Array(count * 3);
  const membrane = ["#3ee0a1", "#2bc4c9", "#6d8bff"].map((h) => new THREE.Color(h));
  const nucleus = ["#8b5cff", "#c4a6ff"].map((h) => new THREE.Color(h));
  const spark = new THREE.Color("#ff6b3d");
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    v.randomDirection();
    let c: THREE.Color;
    if (roll < 0.66) {
      v.multiplyScalar(1 + gauss() * 0.025);
      c = membrane[Math.floor(Math.random() * membrane.length)]!;
    } else if (roll < 0.9) {
      v.multiplyScalar(0.18 + Math.pow(Math.random(), 0.5) * 0.3);
      c = nucleus[Math.floor(Math.random() * nucleus.length)]!;
    } else {
      v.multiplyScalar(1.25 + Math.random() * 1.3);
      c = Math.random() < 0.25 ? spark : membrane[2]!;
    }
    v.toArray(pos, i * 3);
    c.toArray(col, i * 3);
    seed[i] = Math.random();
    u[i] = Math.random();
    draws[i] = Math.random() < 0.4 ? 1 : 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  geo.setAttribute("aDraw", new THREE.BufferAttribute(draws, 1));
  const targetAttr = new THREE.BufferAttribute(target, 3);
  geo.setAttribute("aTarget", targetAttr);

  const uniforms = {
    uTime: { value: 0 },
    uDraw: { value: 0 },
    uHold: { value: 1 },
    uSize: { value: 70 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uPointer: { value: new THREE.Vector2(99, 99) },
    uCenter: { value: new THREE.Vector3() },
    uScale: { value: 2 },
    uBlob: { value: 2 },
    uFocus: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let shapeIndex = 0;
  function setShape(i: number) {
    shapeIndex = i % SHAPES.length;
    const at = sampler(SHAPES[shapeIndex]!);
    for (let j = 0; j < count; j++) {
      const [x, y] = at(u[j]!);
      target[j * 3] = x + gauss() * 0.03;
      target[j * 3 + 1] = y + gauss() * 0.03;
      target[j * 3 + 2] = gauss() * 0.12;
    }
    targetAttr.needsUpdate = true;
    onShape?.({ name: SHAPES[shapeIndex]!.name, done: false });
  }

  function layout() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(20)) * camera.position.z;
    const visW = visH * camera.aspect;
    // Matches Tailwind's lg breakpoint, where the page switches to two columns.
    const wide = focus === "right" && w >= 1024;
    uniforms.uCenter.value.set(wide ? visW * 0.24 : 0, wide ? 0 : visH * 0.27, 0);
    uniforms.uScale.value = wide ? Math.min(visW * 0.15, visH * 0.24) : Math.min(visW * 0.26, visH * 0.12);
    uniforms.uBlob.value = uniforms.uScale.value * 1.25;
    uniforms.uSize.value = camera.aspect < 0.8 ? 50 : 62;
  }

  const pointerNdc = new THREE.Vector2(9, 9);
  const onPointer = (e: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointerNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  };
  const onLeave = () => pointerNdc.set(9, 9);
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  const ray = new THREE.Vector3();
  const pointerWorld = new THREE.Vector2(99, 99);

  const clock = new THREE.Clock();
  let frame = 0;
  let phaseStart = 0;
  let announced = false;

  function render() {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    // Draw → hold → dissolve → next doodle.
    const e = t - phaseStart;
    if (e < DRAW_S) {
      uniforms.uDraw.value = (e / DRAW_S) * 1.1;
      uniforms.uHold.value = 1;
    } else if (e < DRAW_S + HOLD_S) {
      uniforms.uDraw.value = 1.1;
      if (!announced) {
        announced = true;
        onShape?.({ name: SHAPES[shapeIndex]!.name, done: true });
      }
    } else if (e < DRAW_S + HOLD_S + FADE_S) {
      uniforms.uHold.value = 1 - (e - DRAW_S - HOLD_S) / FADE_S;
    } else if (e >= DRAW_S + HOLD_S + FADE_S + PAUSE_S) {
      phaseStart = t;
      announced = false;
      uniforms.uDraw.value = 0;
      uniforms.uHold.value = 1;
      setShape(shapeIndex + 1);
    }

    // Pointer on the z=0 plane, smoothed.
    if (pointerNdc.x > 2) pointerWorld.set(99, 99);
    else {
      ray.set(pointerNdc.x, pointerNdc.y, 0.5).unproject(camera).sub(camera.position).normalize();
      const k = -camera.position.z / ray.z;
      const x = camera.position.x + ray.x * k;
      const y = camera.position.y + ray.y * k;
      if (pointerWorld.x > 50) pointerWorld.set(x, y);
      else pointerWorld.lerp(new THREE.Vector2(x, y), 0.12);
    }
    uniforms.uPointer.value.copy(pointerWorld);
    uniforms.uFocus.value = THREE.MathUtils.smoothstep(uniforms.uDraw.value, 0.2, 1) * uniforms.uHold.value;

    renderer.render(scene, camera);
  }

  function loop() {
    render();
    frame = requestAnimationFrame(loop);
  }

  setShape(0);
  const resize = new ResizeObserver(() => {
    layout();
    if (reduceMotion) renderer.render(scene, camera);
  });
  resize.observe(host);
  layout();

  if (reduceMotion) {
    // One still frame: the finished doodle in front of a calm cell.
    uniforms.uDraw.value = 1.1;
    uniforms.uFocus.value = 1;
    renderer.render(scene, camera);
    onShape?.({ name: SHAPES[0]!.name, done: true });
  } else loop();

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("pointerleave", onLeave);
    geo.dispose();
    mat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
