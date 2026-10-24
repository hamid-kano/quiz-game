// ============================================================
//  الرسم ثلاثي الأبعاد: تحميل النماذج، بناء الحلبة والمناظر، السيارات،
//  الدخان وآثار الإطارات والنيترو والشرارات، الكاميرا، وصالة العرض في القوائم.
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "../lib/loaders/GLTFLoader.js";
import { mergeGeometries } from "../lib/utils/BufferGeometryUtils.js";
import { CELL, HALF_ROAD } from "./tracks.js";
import { VEHICLES } from "./sim.js";

const MODELS = ["track-straight", "track-corner", "track-finish", "track-bump", "track-tents", "decoration-empty", "decoration-forest", "decoration-tents",
  "vehicle-truck-red", "vehicle-truck-green", "vehicle-truck-yellow", "vehicle-truck-purple", "vehicle-motorcycle"];

export async function loadAssets(onProgress = () => {}) {
  const loader = new GLTFLoader();
  const models = {};
  let done = 0;
  await Promise.all(MODELS.map(async (n) => {
    const g = await loader.loadAsync(`models/${n}.glb`);
    models[n] = g.scene;
    onProgress(++done / (MODELS.length + 1));
  }));
  const smoke = await new THREE.TextureLoader().loadAsync("img/smoke.png");
  onProgress(1);
  // مادة واحدة مشتركة لكل النماذج (كلها تستخدم نفس لوحة الألوان)
  let shared = null;
  for (const n of MODELS) models[n].traverse((o) => { if (o.isMesh && !shared) shared = o.material; });
  return { models, smoke, material: shared };
}

// ---------- الأجواء ----------
export const THEMES = {
  day: { name: "نهار", top: "#4f8fe8", bottom: "#cfe6ff", fog: "#cfe2f7", sun: "#fff4e0", sunI: 2.6, hemiSky: "#cfe6ff", hemiGround: "#5b8a52", hemiI: 1.25, sunPos: [30, 55, 20], ground: "#47ad6e", exposure: 1.0 },
  sunset: { name: "غروب", top: "#3b2d6b", bottom: "#ff9a5c", fog: "#f2a77a", sun: "#ffb27a", sunI: 2.4, hemiSky: "#ffc9a3", hemiGround: "#4a5a3a", hemiI: 1.0, sunPos: [-55, 22, 30], ground: "#4c9c62", exposure: 1.0 },
  night: { name: "ليل", top: "#070d22", bottom: "#24365e", fog: "#1d2b4d", sun: "#a9c4ff", sunI: 1.3, hemiSky: "#5a78b8", hemiGround: "#1b2a24", hemiI: 0.75, sunPos: [20, 50, -30], ground: "#2f6e4b", exposure: 1.15, lights: true }
};

function skyTexture(th) {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, th.top); gr.addColorStop(0.62, th.bottom); gr.addColorStop(1, th.fog);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  if (th.lights) { g.fillStyle = "rgba(255,255,255,.8)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 4, Math.random() * 120, 0.4, 0.6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRenderer(canvas, quality) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", powerPreference: "high-performance" });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = quality !== "low";
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
export function resize(r, camera, quality) {
  const w = r.domElement.clientWidth, h = r.domElement.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : quality === "low" ? 1 : 1.5);
  r.setPixelRatio(dpr); r.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---------- دمج المجسّمات الثابتة في مجسّم واحد (أداء ممتاز على الجوال) ----------
function collect(obj, matrix, out) {
  obj.updateWorldMatrix(true, true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    const m = o.material.map;
    if (m) { m.updateMatrix(); const uv = g.attributes.uv; const v = new THREE.Vector2(); for (let i = 0; i < uv.count; i++) { v.fromBufferAttribute(uv, i).applyMatrix3(m.matrix); uv.setXY(i, v.x, v.y); } }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrix, o.matrixWorld));
    out.push(g);
  });
}
function placed(model, x, z, rot, y = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
}

function rng(seed) { let s = seed % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- لوحة منصّة الدفع ----------
function padTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#ff8a00"; g.fillRect(0, 0, 64, 128);
  g.fillStyle = "#fff36b";
  for (let y = -32; y < 160; y += 42) { g.beginPath(); g.moveTo(6, y + 26); g.lineTo(32, y); g.lineTo(58, y + 26); g.lineTo(58, y + 40); g.lineTo(32, y + 14); g.lineTo(6, y + 40); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function labelTexture(text, color) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = color; g.beginPath(); g.arc(64, 54, 44, 0, 7); g.fill();
  g.beginPath(); g.moveTo(44, 90); g.lineTo(84, 90); g.lineTo(64, 122); g.closePath(); g.fill();
  g.fillStyle = "#fff"; g.font = "900 58px Cairo, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 64, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- جسيمات (دخان، شرارات، قصاصات) بمادة نقاط بسيطة ----------
function createParticles(tex, max, additive = false) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), tint = new Float32Array(max * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 500 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 tint; uniform float scale; varying float vA; varying vec3 vT;
      void main(){ vA=alpha; vT=tint; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vT;
      void main(){ vec4 t=texture2D(map, gl_PointCoord); if(t.a*vA<0.01) discard; gl_FragColor=vec4(vT, t.a*vA); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const P = [];
  for (let i = 0; i < max; i++) P.push({ life: 0, t: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2, a0: 1, r: 1, g: 1, b: 1, grav: 0 });
  let next = 0;
  return {
    obj: pts, mat,
    emit(o) { const p = P[next]; next = (next + 1) % max; Object.assign(p, { t: 0, grav: 0, s1: o.s0 * 2, a0: 0.6, r: 1, g: 1, b: 1, vx: 0, vy: 0, vz: 0 }, o); },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (p.t >= p.life) { alpha[i] = 0; continue; }
        p.t += dt; const k = Math.min(1, p.t / p.life);
        p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        size[i] = p.s0 + (p.s1 - p.s0) * k; alpha[i] = p.a0 * (1 - k) * (k < 0.1 ? k * 10 : 1);
        tint[i * 3] = p.r; tint[i * 3 + 1] = p.g; tint[i * 3 + 2] = p.b;
      }
      geo.attributes.position.needsUpdate = geo.attributes.size.needsUpdate = geo.attributes.alpha.needsUpdate = geo.attributes.tint.needsUpdate = true;
    }
  };
}
function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.8)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function squareTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 16;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(3, 5, 10, 6);
  return new THREE.CanvasTexture(c);
}

// ---------- آثار الإطارات ----------
function createSkids(max = 900) {
  const pos = new Float32Array(max * 18), al = new Float32Array(max * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("alpha", new THREE.BufferAttribute(al, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: "attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying float vA; void main(){ gl_FragColor=vec4(0.08,0.08,0.09,vA); }",
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  let n = 0;
  return {
    obj: mesh,
    add(a0, a1, b0, b1, alpha) {
      const i = n % max; n++;
      const v = [a0, a1, b0, a1, b1, b0];
      for (let k = 0; k < 6; k++) { pos[i * 18 + k * 3] = v[k].x; pos[i * 18 + k * 3 + 1] = 0.035; pos[i * 18 + k * 3 + 2] = v[k].z; al[i * 6 + k] = alpha; }
      geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
    }
  };
}

// ---------- مجسّم السيارة ----------
export function makeCar(assets, vid) {
  const V = VEHICLES[vid];
  const root = new THREE.Group();
  const model = assets.models[V.model].clone(true);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const find = (n) => model.getObjectByName(n);
  root.add(model);
  const car = {
    root, model, moto: vid === "moto",
    body: find("body"),
    wheels: ["wheel-front-left", "wheel-front-right", "wheel-back-left", "wheel-back-right", "wheel-front", "wheel-back"].map(find).filter(Boolean),
    front: ["wheel-front-left", "wheel-front-right", "wheel-front"].map(find).filter(Boolean),
    fork: find("fork"),
    spin: 0, lean: 0, pitch: 0
  };
  // لهب النيترو: توهّج عند العادم (يبدو جيداً من خلف السيارة)
  const glow = dotTexture();
  car.flames = new THREE.Group();
  for (const sx of car.moto ? [0] : [-0.32, 0.32]) {
    const outer = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff7a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    outer.scale.set(1.1, 1.1, 1); outer.position.set(sx, 0.45, -1.6);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x9fdcff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    core.scale.set(0.5, 0.5, 1); core.position.set(sx, 0.45, -1.5);
    car.flames.add(outer, core);
  }
  car.flames.visible = false;
  root.add(car.flames);
  return car;
}

// ---------- مشهد السباق ----------
export function createRaceView(renderer, assets, track, race, opts) {
  const th = THEMES[track.def.theme] || THEMES.day;
  const scene = new THREE.Scene();
  scene.background = skyTexture(th);
  scene.fog = new THREE.Fog(th.fog, 60, 190);
  renderer.toneMappingExposure = th.exposure;
  const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, th.sunI);
  sun.castShadow = renderer.shadowMap.enabled;
  const SH = 34;
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 160 });
  sun.shadow.mapSize.set(opts.quality === "high" ? 2048 : 1024, opts.quality === "high" ? 2048 : 1024);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // الأرض
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; ground.receiveShadow = true;
  scene.add(ground);

  // الحلبة والمناظر: كل شيء ثابت يُدمج في مجسّم واحد
  const geos = [];
  const M = assets.models;
  for (const t of track.tiles) {
    const name = t.kind === "finish" ? "track-finish" : t.kind === "corner" ? "track-corner" : "track-straight";
    collect(M[name], placed(M[name], t.x, t.z, (t.rot * Math.PI) / 2), geos);
  }
  const R = rng(track.def.id.length * 977 + track.tiles.length * 31);
  const b = track.bounds, pad = 4;
  const fin = track.tiles[0];
  const finSides = fin.rot ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
  const tentCells = new Set(finSides.map(([dx, dz]) => `${fin.x / CELL + dx},${fin.z / CELL + dz}`));
  for (let cx = Math.round(b.minX / CELL) - pad + 1; cx <= Math.round(b.maxX / CELL) + pad - 1; cx++) {
    for (let cz = Math.round(b.minZ / CELL) - pad + 1; cz <= Math.round(b.maxZ / CELL) + pad - 1; cz++) {
      if (track.occupied.has(`${cx},${cz}`)) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => track.occupied.has(`${cx + dx},${cz + dz}`));
      let name;
      if (tentCells.has(`${cx},${cz}`)) name = "track-tents";
      else name = R() < (near ? 0.42 : 0.7) ? "decoration-forest" : R() < 0.08 ? "decoration-tents" : "decoration-empty";
      const rot = tentCells.has(`${cx},${cz}`) ? (fin.rot ? 0 : Math.PI / 2) : Math.floor(R() * 4) * Math.PI / 2;
      collect(M[name], placed(M[name], cx * CELL, cz * CELL, rot), geos);
    }
  }
  for (const bp of race.bumps) collect(M["track-bump"], placed(M["track-bump"], bp.x, bp.z, 0), geos);
  const mat = assets.material.clone();
  if (mat.map) { mat.map = mat.map.clone(); mat.map.offset.set(0, 0); mat.map.repeat.set(1, 1); mat.map.rotation = 0; mat.map.needsUpdate = true; }
  const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
  geos.forEach((g) => g.dispose());
  merged.castShadow = true; merged.receiveShadow = true;
  scene.add(merged);

  // منصّات الدفع
  const padTex = padTexture();
  const padMat = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const p of race.pads) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), padMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(p.tx, p.tz) + Math.PI;
    m.position.set(p.x, 0.04, p.z);
    scene.add(m);
  }

  // السيارات
  const COLORS = ["#ff5a4f", "#36c46b", "#ffc93c", "#a066ff", "#3aa0ff", "#ff7bd0"];
  const cars = race.cars.map((c) => {
    const cv = makeCar(assets, c.vid);
    scene.add(cv.root);
    if (c.id !== race.player) {
      cv.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(String(c.place), COLORS[c.id % COLORS.length]), depthTest: false, transparent: true }));
      cv.tag.scale.set(0.9, 0.9, 1); cv.tag.renderOrder = 10; cv.tagPlace = c.place;
      scene.add(cv.tag);
    }
    if (th.lights) {
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true), beamMat);
      beam.rotation.x = Math.PI / 2; beam.position.set(0, 0.5, 4.6);
      cv.root.add(beam);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6 });
      for (const sx of cv.moto ? [0] : [-0.45, 0.45]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat); l.position.set(sx, 0.62, 1.42); cv.root.add(l); }
      if (c.id === race.player) {
        const sp = new THREE.SpotLight(0xfff2d0, 60, 40, 0.55, 0.5, 1.5);
        sp.position.set(0, 1.2, 1); sp.target.position.set(0, 0, 12);
        cv.root.add(sp, sp.target);
      }
    }
    return cv;
  });

  // المؤثرات
  const smoke = createParticles(assets.smoke, 260);
  const sparks = createParticles(dotTexture(), 160, true);
  const confetti = createParticles(squareTexture(), 220);
  const skids = createSkids();
  scene.add(smoke.obj, sparks.obj, confetti.obj, skids.obj);
  const lastSkid = race.cars.map(() => [null, null]);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 420);
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, intro: 1 };
  const me = race.cars[race.player];
  {
    const f = [Math.sin(me.h), Math.cos(me.h)];
    cam.pos.set(me.x + f[0] * 9 + 6, 4, me.z + f[1] * 9 + 6);
    cam.look.set(me.x, 0.8, me.z);
  }

  const v3 = new THREE.Vector3();
  function update(now, alpha, dt) {
    const portrait = camera.aspect < 1;
    // السيارات
    race.cars.forEach((c, k) => {
      const cv = cars[k];
      const x = (c.px ?? c.x) + (c.x - (c.px ?? c.x)) * alpha, z = (c.pz ?? c.z) + (c.z - (c.pz ?? c.z)) * alpha;
      let h = c.ph ?? c.h, dh = c.h - h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; h += dh * alpha;
      cv.root.position.set(x, c.y, z);
      cv.root.rotation.y = h;
      // ميلان الهيكل مع الالتفاف والتسارع
      const leanT = (cv.moto ? 0.5 : 0.11) * c.steer * Math.min(1, Math.abs(c.fs) / 12) * (c.drifting ? 1.6 : 1);
      cv.lean += (leanT - cv.lean) * Math.min(1, dt * 8);
      const pitchT = c.air ? -0.12 : -Math.max(-0.06, Math.min(0.06, c.input.throttle * 0.05 * (c.fs < 6 ? 1 : 0.3)));
      cv.pitch += (pitchT - cv.pitch) * Math.min(1, dt * 6);
      if (cv.moto) cv.model.rotation.z = cv.lean; else if (cv.body) { cv.body.rotation.z = cv.lean; cv.body.rotation.x = cv.pitch; }
      cv.spin += (c.fs * dt) / 0.3;
      for (const w of cv.wheels) w.rotation.x = cv.spin;
      for (const w of cv.front) w.rotation.y = -c.steer * 0.45;
      if (cv.fork) cv.fork.rotation.y = -c.steer * 0.35;
      cv.flames.visible = c.nitroOn;
      if (c.nitroOn) cv.flames.children.forEach((f, i) => { const b = i % 2 ? 0.5 : 1.1; const k = 0.75 + Math.random() * 0.5; f.scale.set(b * k, b * k, 1); });
      if (cv.tag) {
        cv.tag.position.set(x, c.y + 2.3, z);
        if (cv.tagPlace !== c.place) { cv.tagPlace = c.place; cv.tag.material.map.dispose(); cv.tag.material.map = labelTexture(String(c.place), COLORS[c.id % COLORS.length]); }
      }
      // دخان وآثار الإطارات
      const slip = Math.abs(c.ls);
      const sk = !c.air && (c.drifting || slip > 3.2 || (c.input.throttle < 0 && c.fs > 6));
      const f = [Math.sin(h), Math.cos(h)], r = [-Math.cos(h), Math.sin(h)];
      const rear = cv.moto ? [[0, -0.66]] : [[-0.55, -0.66], [0.55, -0.66]];
      rear.forEach(([sx, sz], wi) => {
        const wx = x + r[0] * -sx + f[0] * sz, wz = z + r[1] * -sx + f[1] * sz;
        if (sk) {
          const L0 = { x: wx - r[0] * 0.13, z: wz - r[1] * 0.13 }, L1 = { x: wx + r[0] * 0.13, z: wz + r[1] * 0.13 };
          const prev = lastSkid[k][wi];
          if (prev && Math.hypot(prev[0].x - L0.x, prev[0].z - L0.z) > 0.25) { skids.add(prev[0], prev[1], L0, L1, 0.42); lastSkid[k][wi] = [L0, L1]; }
          else if (!prev) lastSkid[k][wi] = [L0, L1];
          if (Math.random() < (c.drifting ? 0.6 : 0.35)) smoke.emit({ x: wx, y: 0.25, z: wz, vx: -c.vx * 0.15 + (Math.random() - 0.5), vy: 0.6 + Math.random() * 0.6, vz: -c.vz * 0.15 + (Math.random() - 0.5), life: 0.9 + Math.random() * 0.5, s0: 0.7, s1: 2.6, a0: 0.5, r: 0.92, g: 0.92, b: 0.92 });
        } else lastSkid[k][wi] = null;
      });
      // دخان العادم مع النيترو + شرارات الدرفت الطويل
      if (c.nitroOn && Math.random() < 0.7) sparks.emit({ x: x - f[0] * 1.8, y: 0.45 + c.y, z: z - f[1] * 1.8, vx: -f[0] * 4 + (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: -f[1] * 4 + (Math.random() - 0.5) * 2, life: 0.3, s0: 0.5, s1: 0.1, a0: 1, r: 1, g: 0.6 + Math.random() * 0.3, b: 0.2 });
      if (c.drifting && c.driftT > 1.1 && Math.random() < 0.5) sparks.emit({ x: x - f[0] * 1.2, y: 0.15, z: z - f[1] * 1.2, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 0.35, s0: 0.35, s1: 0.1, a0: 1, grav: 9, r: 0.4, g: 0.8, b: 1 });
    });
    smoke.update(dt); sparks.update(dt); confetti.update(dt);
    padTex.offset.y = (now / 600) % 1;
    const scale = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    smoke.mat.uniforms.scale.value = sparks.mat.uniforms.scale.value = confetti.mat.uniforms.scale.value = scale * 0.5;

    // الكاميرا: خلف سيارتك، تبتعد وتتسع مع السرعة
    const cv = cars[race.player];
    const x = cv.root.position.x, z = cv.root.position.z, h = cv.root.rotation.y;
    const f = [Math.sin(h), Math.cos(h)];
    const spd = Math.max(0, me.fs) / me.st.speed;
    const back = (portrait ? 8.6 : 6.4) + spd * 1.6, up = (portrait ? 4.4 : 3.0) + spd * 0.4;
    let tx = x - f[0] * back, tz = z - f[1] * back, ty = up + me.y * 0.6;
    if (race.phase === "countdown") {
      // لقطة افتتاحية: من الأعلى والأمام تنزل إلى خلف السيارة
      const k = Math.max(0, Math.min(1, (race.countdown - 0.6) / 2.6));
      tx = x - f[0] * (back + k * 7); tz = z - f[1] * (back + k * 7); ty = up + k * 10;
    }
    const follow = cam.snap ? 1 : 1 - Math.exp(-dt * (race.phase === "countdown" ? 3 : 6));
    cam.pos.x += (tx - cam.pos.x) * follow; cam.pos.y += (ty - cam.pos.y) * follow; cam.pos.z += (tz - cam.pos.z) * follow;
    // لا تدخل الكاميرا في الأشجار: تبقى ضمن مسافة معقولة من الطريق
    cam.look.lerp(v3.set(x + f[0] * 3, 0.9 + me.y, z + f[1] * 3), cam.snap ? 1 : 1 - Math.exp(-dt * 10));
    cam.snap = false;
    cam.shake = Math.max(0, cam.shake - dt * 3);
    camera.position.copy(cam.pos);
    if (cam.shake > 0) camera.position.add(v3.set((Math.random() - 0.5) * cam.shake, (Math.random() - 0.5) * cam.shake, (Math.random() - 0.5) * cam.shake));
    camera.lookAt(cam.look);
    if (api.topDown) { const bb = track.bounds; camera.position.set((bb.minX + bb.maxX) / 2, 150, (bb.minZ + bb.maxZ) / 2 + 1); camera.lookAt((bb.minX + bb.maxX) / 2, 0, (bb.minZ + bb.maxZ) / 2); }
    const fovT = (portrait ? 70 : 60) + spd * 9 + (me.nitroOn ? 9 : 0);
    camera.fov += (fovT - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
    // الشمس والظل يتبعان السيارة
    sun.position.set(x + th.sunPos[0], th.sunPos[1], z + th.sunPos[2]);
    sun.target.position.set(x + f[0] * 10, 0, z + f[1] * 10);
    renderer.render(scene, camera);
  }

  function onEvent(e) {
    const c = e.id != null ? race.cars[e.id] : null;
    if (e.type === "wall" && e.v > 3) {
      for (let i = 0; i < Math.min(14, e.v * 1.5); i++) sparks.emit({ x: e.x, y: 0.5, z: e.z, vx: (Math.random() - 0.5) * 8, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 8, life: 0.4 + Math.random() * 0.3, s0: 0.35, s1: 0.05, a0: 1, grav: 12, r: 1, g: 0.75, b: 0.3 });
      if (e.id === race.player) cam.shake = Math.min(0.6, e.v * 0.06);
    }
    if (e.type === "bump") { if (e.a === race.player || e.b === race.player) cam.shake = Math.min(0.5, e.v * 0.06); for (let i = 0; i < 8; i++) sparks.emit({ x: e.x, y: 0.6, z: e.z, vx: (Math.random() - 0.5) * 6, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 6, life: 0.35, s0: 0.3, s1: 0.05, a0: 1, grav: 10, r: 1, g: 0.85, b: 0.4 }); }
    if (e.type === "land" && c) for (let i = 0; i < 10; i++) smoke.emit({ x: c.x + (Math.random() - 0.5) * 2, y: 0.2, z: c.z + (Math.random() - 0.5) * 2, vx: (Math.random() - 0.5) * 3, vy: 0.5, vz: (Math.random() - 0.5) * 3, life: 0.8, s0: 1, s1: 3, a0: 0.45, r: 0.85, g: 0.8, b: 0.7 });
    if (e.type === "land" && e.id === race.player) cam.shake = 0.35;
    if (e.type === "playerFinish" && e.place <= 3) celebrate();
  }
  function celebrate() {
    const cols = [[1, 0.3, 0.3], [1, 0.85, 0.2], [0.3, 0.8, 1], [0.4, 1, 0.5], [1, 0.5, 1]];
    for (let i = 0; i < 200; i++) {
      const c = cols[i % cols.length];
      confetti.emit({ x: me.x + (Math.random() - 0.5) * 14, y: 7 + Math.random() * 6, z: me.z + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 3 + Math.random() * 1.5, s0: 0.45, s1: 0.45, a0: 1, grav: 2.5, r: c[0], g: c[1], b: c[2] });
    }
  }
  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && m.map !== assets.material.map) m.map.dispose(); m.dispose(); }); } });
    scene.background?.dispose?.();
  }
  const api = { scene, camera, update, onEvent, dispose, topDown: false, snap() { cam.snap = true; } };
  return api;
}

// ---------- صالة العرض في القوائم: سيارتك على منصّة دوّارة ----------
export function createShowroom(renderer, assets) {
  const th = THEMES.sunset;
  const scene = new THREE.Scene();
  scene.background = skyTexture({ ...th, top: "#1b2a55", bottom: "#ff9a62", fog: "#f5a37a" });
  scene.fog = new THREE.Fog("#f5a37a", 30, 90);
  scene.add(new THREE.HemisphereLight("#ffd9bd", "#3d4a3a", 1.2));
  const sun = new THREE.DirectionalLight("#ffd2a8", 2.6);
  sun.position.set(-8, 12, 6); sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  scene.add(sun);
  const geos = [];
  const M = assets.models;
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    const name = x === 0 && z === 0 ? "track-tents" : z === 0 || x === 0 ? "track-straight" : (x * 7 + z * 3) % 3 ? "decoration-forest" : "decoration-empty";
    if (name === "track-straight" && x === 0) collect(M[name], placed(M[name], x * CELL, z * CELL, 0), geos);
    else if (name === "track-straight") collect(M[name], placed(M[name], x * CELL, z * CELL, Math.PI / 2), geos);
    else if (name !== "track-tents") collect(M[name], placed(M[name], x * CELL, z * CELL, ((x + z) & 3) * Math.PI / 2), geos);
  }
  const mat = assets.material.clone();
  const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
  merged.receiveShadow = true; scene.add(merged);
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#4c9c62", roughness: 1 }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.3; gnd.receiveShadow = true; scene.add(gnd);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.25, 48), new THREE.MeshStandardMaterial({ color: "#d8dde6", metalness: 0.3, roughness: 0.4 }));
  plat.position.y = 0.12; plat.receiveShadow = true; scene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color: "#ffb35a" }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; scene.add(ring);
  const turn = new THREE.Group(); turn.position.y = 0.25; scene.add(turn);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  let car = null, vid = null, ang = 0.6;
  return {
    camera,
    setCar(id) {
      if (id === vid) return;
      vid = id;
      if (car) turn.remove(car.root);
      car = makeCar(assets, id);
      car.root.scale.setScalar(1.25);
      turn.add(car.root);
    },
    render(dt, now, offsetY = 0, shiftX = 0) {
      ang += dt * 0.45;
      turn.rotation.y = ang;
      if (car) for (const w of car.wheels) w.rotation.x = 0;
      const portrait = camera.aspect < 1;
      const d = portrait ? 11.5 : 8.5;
      camera.position.set(Math.sin(0.5) * d, portrait ? 3.6 : 2.8, Math.cos(0.5) * d);
      camera.lookAt(0, (portrait ? -0.4 : 0.6) + offsetY, 0);
      const W = renderer.domElement.width, H = renderer.domElement.height;
      if (shiftX) camera.setViewOffset(W, H, W * shiftX, 0, W, H); else camera.clearViewOffset();
      renderer.toneMappingExposure = 1;
      renderer.render(scene, camera);
    }
  };
}
