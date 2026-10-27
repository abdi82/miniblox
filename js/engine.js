// Spelmotor: scen, kamera i tredje person, fysik mot lådor, tangentbord + pekskärm, HUD och ljud.
import * as THREE from 'three';
import { buildAvatar, buildAnimal, animateAvatar, AVATAR_HEIGHT } from './avatar.js';

export const PLAYER = { hw: 0.45, h: AVATAR_HEIGHT, speed: 9, jump: 12.5, jump2: 11, gravity: 32, maxJumps: 2, flyTime: 10, flyUp: 7, flySink: -2.5 }; // 2 hopp = dubbelhopp, tredje tryck = flyga
export const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

// ---------- Ljud (små pip med WebAudio) ----------
let actx = null;
function tone(freq, dur = 0.12, type = 'square', vol = 0.08, when = 0) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + when + dur);
    o.connect(g).connect(actx.destination); o.start(actx.currentTime + when); o.stop(actx.currentTime + when + dur + 0.02);
  } catch { /* ljud av */ }
}
// iPad/iPhone: ljudet måste låsas upp av en tryckning. Skapa och väck AudioContext vid första pekningen.
function unlockAudio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { /* ljud av */ }
}
addEventListener('pointerdown', unlockAudio, { passive: true }); addEventListener('touchstart', unlockAudio, { passive: true }); addEventListener('keydown', unlockAudio);
export const sfx = {
  coin() { tone(880, 0.08, 'square'); tone(1320, 0.14, 'square', 0.08, 0.07); },
  jump() { tone(300, 0.1, 'triangle', 0.06); },
  die() { tone(200, 0.25, 'sawtooth', 0.08); tone(120, 0.35, 'sawtooth', 0.08, 0.1); },
  check() { tone(523, 0.1, 'triangle'); tone(659, 0.1, 'triangle', 0.08, 0.1); tone(784, 0.2, 'triangle', 0.08, 0.2); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.13)); },
  place() { tone(600, 0.05, 'square', 0.05); },
  fly() { [440, 554, 659, 880, 1109].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, i * 0.06)); },
  remove() { tone(250, 0.07, 'square', 0.05); },
};

// ---------- Input ----------
export class Input {
  constructor(canvas) {
    this.keys = new Set(); this.joy = { x: 0, y: 0 }; this.jumpQueued = false; this.lookDelta = { x: 0, y: 0 };
    this.clicks = []; // {x,y,button,shift} för byggläget
    this._onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') { if (k === ' ' && !this.keys.has(' ')) this.jumpQueued = true; this.keys.add(k); if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault(); }
      else this.keys.delete(k);
    };
    addEventListener('keydown', this._onKey); addEventListener('keyup', this._onKey);

    // Pekare: drag = rotera kameran; kort klick rapporteras som klick
    this.canvas = canvas; const pointers = new Map(); let dragging = null;
    this._down = (e) => {
      if (e.target !== canvas) return;
      canvas.setPointerCapture?.(e.pointerId);
      const left = isTouch && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.4;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, joy: left, t: performance.now(), button: e.button, shift: e.shiftKey });
      if (left) { this.joyOrigin = { x: e.clientX, y: e.clientY }; this._showJoy(e.clientX, e.clientY); }
    };
    this._move = (e) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (p.joy) {
        const vx = (e.clientX - p.sx) / 50, vy = (e.clientY - p.sy) / 50; const l = Math.hypot(vx, vy) || 1; const c = Math.min(1, l);
        this.joy = { x: vx / l * c, y: vy / l * c }; this._moveJoy(this.joy);
      } else { this.lookDelta.x += dx; this.lookDelta.y += dy; }
    };
    this._up = (e) => {
      const p = pointers.get(e.pointerId); if (!p) return; pointers.delete(e.pointerId);
      if (p.joy) { this.joy = { x: 0, y: 0 }; this._moveJoy(this.joy); this._hideJoy(); }
      else if (p.moved < 6 && performance.now() - p.t < 600) this.clicks.push({ x: e.clientX, y: e.clientY, button: p.button, shift: p.shift || e.shiftKey });
    };
    canvas.addEventListener('pointerdown', this._down); addEventListener('pointermove', this._move);
    addEventListener('pointerup', this._up); addEventListener('pointercancel', this._up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pekskärm: hoppknapp
    this.touchEl = document.getElementById('touch'); this.joyEl = document.getElementById('joystick'); this.knobEl = document.getElementById('joystick-knob');
    this.touchEl.hidden = !isTouch;
    const jump = document.getElementById('btn-jump');
    this._jumpDown = (e) => { e.preventDefault(); this.jumpQueued = true; this.jumpHeld = true; };
    this._jumpUp = () => { this.jumpHeld = false; };
    jump.addEventListener('pointerdown', this._jumpDown); jump.addEventListener('pointerup', this._jumpUp); jump.addEventListener('pointercancel', this._jumpUp);
  }
  _showJoy(x, y) { this.joyEl.style.left = (x - 65) + 'px'; this.joyEl.style.top = (y - 65) + 'px'; this.joyEl.style.bottom = 'auto'; this.joyEl.style.opacity = 1; }
  _hideJoy() { this.joyEl.style.left = '30px'; this.joyEl.style.top = 'auto'; this.joyEl.style.bottom = '40px'; }
  _moveJoy(j) { this.knobEl.style.transform = `translate(${j.x * 40}px, ${j.y * 40}px)`; }
  get move() {
    const k = this.keys; let x = 0, y = 0;
    if (k.has('w') || k.has('arrowup')) y -= 1; if (k.has('s') || k.has('arrowdown')) y += 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1; if (k.has('d') || k.has('arrowright')) x += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    return this.joy;
  }
  get jumpHeldNow() { return this.keys.has(' ') || this.jumpHeld; }
  takeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }
  takeLook() { const d = this.lookDelta; this.lookDelta = { x: 0, y: 0 }; return d; }
  takeClicks() { const c = this.clicks; this.clicks = []; return c; }
  dispose() {
    removeEventListener('keydown', this._onKey); removeEventListener('keyup', this._onKey);
    this.canvas.removeEventListener('pointerdown', this._down); removeEventListener('pointermove', this._move);
    removeEventListener('pointerup', this._up); removeEventListener('pointercancel', this._up);
    const jump = document.getElementById('btn-jump'); jump.removeEventListener('pointerdown', this._jumpDown); jump.removeEventListener('pointerup', this._jumpUp);
    this.touchEl.hidden = true;
  }
}

// ---------- HUD ----------
export const hud = {
  el: (id) => document.getElementById(id),
  title(t) { this.el('hud-title').textContent = t; },
  right(html) { this.el('hud-right').innerHTML = html; },
  center(html, ms) {
    const c = this.el('hud-center'); c.innerHTML = html; clearTimeout(this._ct);
    if (ms) this._ct = setTimeout(() => { if (c.innerHTML === html) c.innerHTML = ''; }, ms);
  },
  bottom(t) {
    const b = this.el('hud-bottom'); b.textContent = t; b.style.opacity = '';
    clearTimeout(this._bt); if (isTouch && t) this._bt = setTimeout(() => { b.style.opacity = 0; }, 6000); // dölj tipset så det inte ligger över joysticken
  },
  panel(html) { const p = this.el('hud-panel'); if (html == null) { p.hidden = true; p.innerHTML = ''; } else { p.hidden = false; p.innerHTML = html; } return p; },
  tools(html) {
    let t = document.querySelector('.hud-tools');
    if (!t) { t = document.createElement('div'); t.className = 'hud-tools'; this.el('hud').appendChild(t); }
    if (html == null) t.remove(); else t.innerHTML = html; return t;
  },
  reset() { this.title(''); this.right(''); this.center(''); this.bottom(''); this.panel(null); this.tools(null); },
};

// ---------- Motor ----------
export class Engine {
  constructor(container, { sky = 0x87ceeb, fog = true, shadows = true } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(sky);
    if (fog) this.scene.fog = new THREE.Fog(sky, 60, 160);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.cam = { yaw: 0, pitch: 0.35, dist: 9 };
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(30, 60, 20); sun.castShadow = shadows;
    sun.shadow.mapSize.set(2048, 2048); const s = 60; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 200 });
    this.sun = sun; this.scene.add(sun, sun.target);
    this.boxes = []; this.triggers = []; this.movers = []; this.coins = [];
    this.input = new Input(this.renderer.domElement);
    this.clock = new THREE.Clock(); this.time = 0; this.running = false;
    this.events = {}; this.freeze = false;
    this._resize = () => { const w = container.clientWidth, h = container.clientHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
    addEventListener('resize', this._resize); this._resize();
  }
  on(ev, fn) { this.events[ev] = fn; return this; }
  emit(ev, ...a) { this.events[ev]?.(...a); }

  // En låda: solid mark, lava, kontrollpunkt, mål eller rörlig plattform.
  addBox({ x, y, z, w = 4, h = 1, d = 4, color = 0x8ab4f8, type = 'solid', motion = null, name = '' }) {
    const geo = new THREE.BoxGeometry(w, h, d);
    let m;
    if (type === 'lava') m = new THREE.MeshLambertMaterial({ color: 0xff4d1a, emissive: 0xff2a00, emissiveIntensity: 0.6 });
    else if (type === 'finish') m = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0xffa000, emissiveIntensity: 0.3 });
    else if (type === 'checkpoint') m = new THREE.MeshLambertMaterial({ color: 0x4caf50, emissive: 0x1b5e20, emissiveIntensity: 0.2 });
    else m = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = type !== 'lava'; mesh.receiveShadow = true;
    this.scene.add(mesh);
    const box = { mesh, x, y, z, w, h, d, type, name, min: new THREE.Vector3(), max: new THREE.Vector3(), motion, base: new THREE.Vector3(x, y, z), lastPos: new THREE.Vector3(x, y, z) };
    this._bounds(box);
    this.boxes.push(box);
    if (motion) this.movers.push(box);
    if (type === 'checkpoint') this._flag(x, y + h / 2, z, 0x4caf50);
    if (type === 'finish') this._flag(x, y + h / 2, z, 0xffd54f);
    return box;
  }
  _flag(x, y, z, color) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    pole.position.set(x + 1.2, y + 2, z + 1.2); this.scene.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.06), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    flag.position.set(x + 1.2 + 0.7, y + 3.5, z + 1.2); this.scene.add(flag);
  }
  _bounds(b) { b.min.set(b.x - b.w / 2, b.y - b.h / 2, b.z - b.d / 2); b.max.set(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2); }
  removeBox(b) {
    this.scene.remove(b.mesh); b.mesh.geometry.dispose();
    this.boxes = this.boxes.filter(x => x !== b); this.movers = this.movers.filter(x => x !== b);
  }
  addCoin(x, y, z) {
    if (!this._coinGeo) { this._coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 20); this._coinGeo.rotateX(Math.PI / 2); this._coinMat = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.6, roughness: 0.3, emissive: 0x664400, emissiveIntensity: 0.3 }); }
    const mesh = new THREE.Mesh(this._coinGeo, this._coinMat); mesh.position.set(x, y, z); mesh.castShadow = true; this.scene.add(mesh);
    const c = { mesh, x, y, z, taken: false }; this.coins.push(c); return c;
  }
  ground(size = 200, y = -0.5, color = 0x7cb342) {
    return this.addBox({ x: 0, y, z: 0, w: size, h: 1, d: size, color, type: 'solid', name: 'ground' });
  }
  lavaSea(y = -12, size = 600) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0xff5722 })); m.rotation.x = -Math.PI / 2; m.position.y = y; this.scene.add(m);
    this.scene.background = new THREE.Color(0xffb74d); if (this.scene.fog) this.scene.fog.color.set(0xffb74d);
    this.deathY = y + 0.5;
  }

  spawnPlayer(avatarCfg, pos, animal = 'human', stats = {}) {
    if (this.player) this.scene.remove(this.player.mesh);
    const mesh = buildAnimal(animal, avatarCfg); this.scene.add(mesh);
    // Egenskaper per figur (djurens superkrafter): multiplikatorer på speed/jump, eller egna värden
    const st = { speed: PLAYER.speed * (stats.speed || 1), jump: PLAYER.jump * (stats.jump || 1), jump2: PLAYER.jump2 * (stats.jump || 1), maxJumps: stats.maxJumps || PLAYER.maxJumps, flyTime: stats.flyTime || PLAYER.flyTime, lavaImmune: !!stats.lavaImmune, glide: !!stats.glide };
    this.player = { mesh, pos: new THREE.Vector3().copy(pos), vel: new THREE.Vector3(), grounded: false, standOn: null, facing: Math.PI, spawn: pos.clone(), dead: false, st };
    this.cam.yaw = 0; this.cam.pitch = 0.35;
    this._syncPlayer(); return this.player;
  }
  respawn() {
    const p = this.player; p.pos.copy(p.spawn); p.vel.set(0, 0, 0); p.dead = false; p.flying = 0; p.jumps = 0; this._flyHud(null); p.mesh.visible = true; this._syncPlayer();
  }
  die(cause) {
    const p = this.player; if (p.dead) return;
    if (cause === 'lava' && p.st?.lavaImmune) return; // sköldpaddan tål lava
    p.dead = true; sfx.die(); p.mesh.visible = false;
    this.emit('die');
    setTimeout(() => { if (this.running) this.respawn(); }, 700);
  }
  _syncPlayer() { const p = this.player; p.mesh.position.copy(p.pos); p.mesh.rotation.y = p.facing; }
  _flyHud(left) { const el = document.getElementById('hud-fly'); if (left == null) el.hidden = true; else { el.hidden = false; el.textContent = `✈️ ${Math.ceil(left)} s`; } }
  // Liten vit ring under fötterna vid dubbelhopp
  _puff(pos) {
    if (!this._puffGeo) { this._puffGeo = new THREE.RingGeometry(0.3, 0.7, 20); this._puffGeo.rotateX(-Math.PI / 2); }
    const m = new THREE.Mesh(this._puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    m.position.set(pos.x, pos.y + 0.05, pos.z); this.scene.add(m); (this.puffs ||= []).push({ m, t: 0 });
  }

  start(update) {
    this.running = true; this.clock.start(); this._update = update;
    const loop = () => { if (!this.running) return; this._frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }
  dispose() {
    this.stop(); removeEventListener('resize', this._resize); this.input.dispose();
    this.scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.map?.dispose?.() || m.dispose()); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  _frame() {
    const dt = Math.min(0.05, this.clock.getDelta()); this.time += dt;
    this._moveMovers(dt);
    if (this.player && !this.freeze && !this.player.dead) this._physics(dt);
    if (this.puffs) for (const q of this.puffs) { q.t += dt; q.m.scale.setScalar(1 + q.t * 4); q.m.material.opacity = 0.8 * (1 - q.t / 0.35); if (q.t > 0.35) { this.scene.remove(q.m); q.m.material.dispose(); } }
    if (this.puffs) this.puffs = this.puffs.filter(q => q.t <= 0.35);
    for (const c of this.coins) if (!c.taken) { c.mesh.rotation.y += dt * 3; c.mesh.position.y = c.y + Math.sin(this.time * 3 + c.x) * 0.15; }
    this._update?.(dt);
    this._camera(dt);
    this.renderer.render(this.scene, this.camera);
  }
  _moveMovers(dt) {
    for (const b of this.movers) {
      const m = b.motion; const t = (Math.sin(this.time * m.speed + (m.phase || 0)) + 1) / 2; // 0..1
      const nx = b.base.x + (m.dx || 0) * t, ny = b.base.y + (m.dy || 0) * t, nz = b.base.z + (m.dz || 0) * t;
      b.lastPos.set(b.x, b.y, b.z); b.x = nx; b.y = ny; b.z = nz; b.mesh.position.set(nx, ny, nz); this._bounds(b);
      if (this.player?.standOn === b) { this.player.pos.x += nx - b.lastPos.x; this.player.pos.y += ny - b.lastPos.y; this.player.pos.z += nz - b.lastPos.z; }
    }
  }
  _overlap(b, pos, pad = 0) {
    const { hw, h } = PLAYER;
    return pos.x + hw > b.min.x - pad && pos.x - hw < b.max.x + pad && pos.y + h > b.min.y - pad && pos.y < b.max.y + pad && pos.z + hw > b.min.z - pad && pos.z - hw < b.max.z + pad;
  }
  _physics(dt) {
    const p = this.player, inp = this.input, { hw, h } = PLAYER;
    const mv = inp.move; const yaw = this.cam.yaw;
    // Rörelse relativt kameran
    const fwd = -mv.y; // framåt = bort från kameran
    let dx = -fwd * Math.sin(yaw) + mv.x * Math.cos(yaw), dz = -fwd * Math.cos(yaw) - mv.x * Math.sin(yaw);
    const moving = Math.hypot(dx, dz) > 0.01;
    if (moving) { const l = Math.hypot(dx, dz); dx /= l; dz /= l; const str = Math.min(1, Math.hypot(mv.x, mv.y)); dx *= str; dz *= str; p.facing = Math.atan2(dx, dz); }
    const speed = p.st.speed;
    p.vel.x = dx * speed; p.vel.z = dz * speed;
    if (!(p.flying > 0)) p.vel.y -= PLAYER.gravity * dt;
    if (p.grounded) { p.jumps = 0; p.flewThisAir = false; }
    const pressed = inp.takeJump();
    if (p.flying > 0) {
      // Flygläge: håll hoppa för att stiga, släpp för att sjunka sakta. Rörelsen går lite fortare.
      p.flying -= dt; p.vel.y = inp.jumpHeldNow ? PLAYER.flyUp : PLAYER.flySink; p.vel.x *= 1.3; p.vel.z *= 1.3;
      this._flyHud(p.flying);
      if (p.flying <= 0) { p.flying = 0; this._flyHud(null); hud.center('<div class="small">Flygtiden är slut!</div>', 1200); }
    } else if (pressed && (p.grounded || (p.jumps ?? 0) < p.st.maxJumps)) {
      if (!p.grounded && !p.jumps) p.jumps = 1; // ramlade av kanten utan att hoppa: räkna som ett använt hopp
      p.vel.y = p.jumps ? p.st.jump2 : p.st.jump; p.jumps = (p.jumps || 0) + 1; p.grounded = false; p.standOn = null; sfx.jump();
      if (p.jumps > 1) this._puff(p.pos);
    } else if (pressed && !p.grounded && !p.flewThisAir) {
      // Nästa tryck i luften: flyg (10 s, örnen 20 s)
      p.flying = p.st.flyTime; p.flewThisAir = true; p.vel.y = PLAYER.flyUp; sfx.fly(); this._puff(p.pos);
      hud.center('<div>✈️ Du flyger!</div><div class="small">Håll hoppa för att stiga</div>', 1500);
    } else if (p.st.glide && !p.grounded && inp.jumpHeldNow && p.vel.y < -3) {
      p.vel.y = -3; // örnen svävar
    }
    // X
    p.pos.x += p.vel.x * dt;
    for (const b of this.boxes) if (b.type !== 'coin' && this._overlap(b, p.pos)) { p.pos.x = p.vel.x > 0 ? b.min.x - hw - 0.001 : b.max.x + hw + 0.001; if (b.type === 'lava' && !p.st.lavaImmune) return this.die('lava'); }
    // Z
    p.pos.z += p.vel.z * dt;
    for (const b of this.boxes) if (this._overlap(b, p.pos)) { p.pos.z = p.vel.z > 0 ? b.min.z - hw - 0.001 : b.max.z + hw + 0.001; if (b.type === 'lava' && !p.st.lavaImmune) return this.die('lava'); }
    // Y
    p.pos.y += p.vel.y * dt; p.grounded = false; let stand = null;
    for (const b of this.boxes) if (this._overlap(b, p.pos)) {
      if (p.vel.y <= 0) { p.pos.y = b.max.y; p.vel.y = 0; p.grounded = true; stand = b; }
      else { p.pos.y = b.min.y - h; p.vel.y = 0; }
      if (b.type === 'lava' && !p.st.lavaImmune) return this.die('lava');
    }
    p.standOn = stand;
    if (stand && stand.type === 'checkpoint' && p.lastCheckpoint !== stand) { p.lastCheckpoint = stand; p.spawn.set(stand.x, stand.max.y, stand.z); sfx.check(); this.emit('checkpoint', stand); }
    if (stand && stand.type === 'finish') this.emit('finish', stand);
    for (const b of this.triggers) if (this._overlap(b, p.pos)) this.emit('trigger', b);
    // Mynt
    for (const c of this.coins) if (!c.taken && Math.abs(c.x - p.pos.x) < 1 && Math.abs(c.z - p.pos.z) < 1 && c.y > p.pos.y - 0.5 && c.y < p.pos.y + h + 0.5) {
      c.taken = true; this.scene.remove(c.mesh); sfx.coin(); this.emit('coin', c);
    }
    if (this.deathY != null && p.pos.y < this.deathY) return this.die();
    if (p.pos.y < -60) return this.die();
    this._syncPlayer();
    animateAvatar(p.mesh, this.time, moving, !p.grounded, p.flying > 0);
  }
  _camera(dt) {
    const look = this.input.takeLook();
    this.cam.yaw -= look.x * 0.005; this.cam.pitch = Math.max(-0.3, Math.min(1.2, this.cam.pitch + look.y * 0.005));
    const t = this.camTarget || (this.player ? this.player.pos : new THREE.Vector3());
    const target = new THREE.Vector3(t.x, t.y + 1.8, t.z);
    const { yaw, pitch, dist } = this.cam;
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    const desired = target.clone().add(off);
    if (!this._camInit) { this.camera.position.copy(desired); this._camInit = true; }
    else this.camera.position.lerp(desired, Math.min(1, dt * 12));
    this.camera.lookAt(target);
    if (this.sun && this.player) { this.sun.position.set(t.x + 30, t.y + 60, t.z + 20); this.sun.target.position.copy(t); }
  }
}

export function fmtTime(s) { const m = Math.floor(s / 60), r = (s % 60).toFixed(1); return m ? `${m}:${r.padStart(4, '0')}` : `${r}s`; }
