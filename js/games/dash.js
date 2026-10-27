// Kubdash: en kub som springer själv. Tryck för att hoppa. Spikar och blockkanter dödar, då börjar man om.
import { hud, sfx, isTouch } from '../engine.js';
import { faceTexture } from '../avatar.js';
import { LEVELS } from './dash-levels.js';

const H = 10, SPEED = 10.4, G = 90, JUMP = 21, PAD = 30, SHIP_ACC = 75, SHIP_MAX = 12;

// ---------- Banformat → objekt ----------
function parseLevel(map) {
  const cols = [];
  for (const tok of map.trim().split(/\s+/)) {
    let n = 1, t = tok; const m = /^(\d+)\*(.+)$/.exec(tok); if (m) { n = +m[1]; t = m[2]; }
    const items = [];
    for (const part of t.split('+')) {
      const a = /^(.)@(\d+)(?:-(\d+))?$/.exec(part);
      if (a) { const y0 = +a[2], y1 = a[3] ? +a[3] : y0; for (let y = y0; y <= y1; y++) items.push({ ch: a[1], y }); }
      else [...part].forEach((ch, y) => { if (ch !== '.') items.push({ ch, y }); });
    }
    for (let i = 0; i < n; i++) cols.push(items);
  }
  const L = { length: cols.length + 4, blocks: new Map(), spikes: [], orbs: [], pads: [], portals: [], coins: [] };
  cols.forEach((items, x) => items.forEach(({ ch, y }) => {
    if (ch === '#') L.blocks.set(`${x},${y}`, { x, y });
    else if (ch === '^') L.spikes.push({ x, y, dir: 1 });
    else if (ch === 'v') L.spikes.push({ x, y, dir: -1 });
    else if (ch === 'o') L.orbs.push({ x, y });
    else if (ch === '_') L.pads.push({ x, y });
    else if (ch === '$') L.coins.push({ x, y });
    else if ('gsc'.includes(ch)) L.portals.push({ x, y, kind: ch });
  }));
  return L;
}

// ---------- Musik (egen synth, loopar i takt) ----------
class Music {
  constructor(bpm) { this.bpm = bpm; this.on = localStorage.getItem('miniblox.music') !== 'off'; this.step = 0; }
  start() {
    try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.25 : 0; this.master.connect(this.ctx.destination);
    this.next = this.ctx.currentTime + 0.1; this.timer = setInterval(() => this._tick(), 60);
  }
  _tick() {
    const spb = 60 / this.bpm / 4; // en sextondel
    while (this.next < this.ctx.currentTime + 0.25) { this._play(this.step % 32, this.next); this.step++; this.next += spb; }
  }
  _tone(freq, t, dur, type = 'square', vol = 0.3, slide) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  _play(s, t) {
    if (s % 4 === 0) this._tone(150, t, 0.18, 'sine', 0.9, 40); // bastrumma
    if (s % 4 === 2) { const b = this.ctx.createBuffer(1, 2000, this.ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const n = this.ctx.createBufferSource(); n.buffer = b; const g = this.ctx.createGain(); g.gain.value = 0.12; n.connect(g).connect(this.master); n.start(t); } // hihat
    const bass = [55, 55, 65.4, 73.4][Math.floor(s / 8)]; if (s % 2 === 0) this._tone(bass, t, 0.12, 'sawtooth', 0.25);
    const arp = [220, 261.6, 329.6, 392, 440, 392, 329.6, 261.6]; this._tone(arp[s % 8] * (s >= 16 ? 1.5 : 1), t, 0.1, 'square', 0.08);
  }
  toggle() { this.on = !this.on; localStorage.setItem('miniblox.music', this.on ? 'on' : 'off'); if (this.master) this.master.gain.value = this.on ? 0.25 : 0; }
  stop() { clearInterval(this.timer); try { this.master?.disconnect(); } catch { /* ok */ } }
}

// ---------- Spelet ----------
export function start(ctx) {
  const container = ctx.container;
  const canvas = document.createElement('canvas'); container.appendChild(canvas); const g2 = canvas.getContext('2d');
  const avatar = ctx.player.avatar; const face = faceTexture(avatar.face, avatar.skin).image;
  const rec = () => { const r = ctx.store.current.records; r.dash = r.dash || {}; return r.dash; };
  let level = null, L = null, music = null, practice = false, running = true, raf = 0;
  const P = { x: 0, y: 0, vy: 0, grav: 1, mode: 'cube', ground: true, rot: 0, dead: 0, attempts: 0, cp: null, coins: [], finished: false, shipTilt: 0 };
  const input = { held: false, pressed: false };
  const parts = []; let shake = 0, flash = 0, time = 0, last = performance.now(), acc = 0;
  const W = () => canvas.width / devicePixelRatio, Hpx = () => canvas.height / devicePixelRatio;
  const resize = () => { const dpr = Math.min(devicePixelRatio, 2); canvas.width = container.clientWidth * dpr; canvas.height = container.clientHeight * dpr; canvas.style.width = '100%'; canvas.style.height = '100%'; g2.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener('resize', resize);

  // Input: tryck var som helst på skärmen, eller mellanslag / pil upp / W
  const down = (e) => { if (e.target !== canvas) return; e.preventDefault(); input.held = true; input.pressed = true; };
  const up = () => { input.held = false; };
  const key = (e) => { if (![' ', 'arrowup', 'w'].includes(e.key.toLowerCase())) return; e.preventDefault(); if (e.type === 'keydown') { if (!input.held) input.pressed = true; input.held = true; } else input.held = false; };
  canvas.addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('keydown', key); addEventListener('keyup', key);

  // ---------- Banval ----------
  function showLevels() {
    hud.title('Kubdash'); hud.right(''); hud.center(''); hud.bottom(''); hud.tools(null);
    hud.panel(`<h3>🟦 Kubdash</h3><div class="sub" style="font-weight:600;margin-bottom:6px">Välj bana</div>
      ${LEVELS.map(l => { const r = rec()[l.id] || {}; return `<button class="btn ghost" data-level="${l.id}" style="display:flex;width:100%;align-items:center;gap:12px;margin:6px 0;text-align:left">
        <span style="width:14px;height:40px;border-radius:6px;background:${l.color};display:inline-block"></span>
        <span style="flex:1"><b>${l.name}</b><br><span class="sub" style="font-size:12px">${l.difficulty} · Bäst ${r.best || 0} % · ${r.attempts || 0} försök · ${(r.coins || []).length}/${parseLevel(l.map).coins.length} 🪙</span></span>
        <span style="color:${r.wins ? 'var(--green)' : 'var(--muted)'}">${r.wins ? '✔' : '▶'}</span></button>`; }).join('')}
      <p class="sub" style="font-size:12px;margin:10px 0 0">${isTouch ? 'Tryck på skärmen för att hoppa. Håll inne för att hoppa igen direkt.' : 'Mellanslag eller klick = hoppa. Håll inne för att hoppa igen direkt.'}</p>`);
    document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => startLevel(LEVELS.find(l => l.id === b.dataset.level)));
  }
  function startLevel(l) {
    level = l; L = parseLevel(l.map); practice = false; P.attempts = 0; P.cp = null;
    hud.panel(null); hud.title(l.name);
    music?.stop(); music = new Music(l.bpm); music.start();
    renderTools(); respawn(true);
    hud.center(`<div>${l.name}</div><div class="small">${l.difficulty}</div>`, 1500);
  }
  function renderTools() {
    const t = hud.tools(`<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
      <button class="hud-btn" id="d-levels">Banor</button>
      <button class="hud-btn" id="d-practice" style="${practice ? 'background:#00b06f' : ''}">${practice ? '✔ Övningsläge' : 'Övningsläge'}</button>
      <button class="hud-btn" id="d-music">${music?.on ? '🔊' : '🔇'}</button></div>`);
    t.querySelector('#d-levels').onclick = () => { music?.stop(); music = null; level = null; showLevels(); };
    t.querySelector('#d-practice').onclick = () => { practice = !practice; P.cp = null; renderTools(); hud.center(practice ? '<div class="small">Övningsläge: du börjar om från senaste gröna flaggan</div>' : '<div class="small">Vanligt läge: från början!</div>', 1800); };
    t.querySelector('#d-music').onclick = () => { music?.toggle(); renderTools(); };
  }
  function respawn(first) {
    if (!first) P.attempts++;
    ctx.store.update(p => { const r = p.records.dash = p.records.dash || {}; const e = r[level.id] = r[level.id] || {}; if (!first) e.attempts = (e.attempts || 0) + 1; });
    const cp = practice && P.cp;
    Object.assign(P, { x: cp ? cp.x : -2, y: cp ? cp.y : 0, vy: 0, grav: cp ? cp.grav : 1, mode: cp ? cp.mode : 'cube', ground: true, rot: 0, dead: 0, finished: false, coins: [] });
    for (const o of L.orbs) o.used = false; for (const p of L.portals) p.used = false; for (const c of L.coins) c.taken = false;
    input.pressed = false; refreshHud();
  }
  function refreshHud() { const r = rec()[level.id] || {}; hud.right(`🪙 ${P.coins.length} &nbsp; Försök ${P.attempts + 1}${r.best ? ` <span style="opacity:.7">· Bäst ${r.best} %</span>` : ''}`); }
  function die() {
    if (P.dead) return; P.dead = 0.8; sfx.die(); shake = 0.5;
    for (let i = 0; i < 30; i++) parts.push({ x: P.x + 0.5, y: P.y + 0.5, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.3) * 20, life: 0.8, c: Math.random() < 0.5 ? avatar.shirt : avatar.pants });
    const pct = progress(); ctx.store.update(p => { const e = p.records.dash[level.id]; if (!practice && pct > (e.best || 0)) e.best = pct; });
  }
  function progress() { return Math.max(0, Math.min(100, Math.round(P.x / (L.length - 4) * 100))); }
  function win() {
    P.finished = true; sfx.win(); flash = 1;
    const r = rec()[level.id] || {}; const first = !r.wins;
    let reward = 0, newCoins = 0;
    if (!practice) {
      reward = first ? level.reward : 15;
      ctx.store.update(p => { const e = p.records.dash[level.id]; e.wins = (e.wins || 0) + 1; e.best = 100; e.coins = e.coins || []; for (const c of P.coins) if (!e.coins.includes(c)) { e.coins.push(c); newCoins++; } });
      reward += newCoins * 10; ctx.store.addCoins(reward);
    }
    hud.panel(`<h3>🏁 Du klarade ${level.name}!</h3>
      <div>${practice ? 'I övningsläge. Klara den utan för att få mynt!' : `Du fick <b>+${reward}</b> mynt${first ? ' (första gången!)' : ''}${newCoins ? ` · ${newCoins} nya hemliga mynt` : ''}`}</div>
      <div class="sub" style="font-size:13px;margin-top:4px">${P.attempts + 1} försök</div>
      <div class="row"><button class="btn green" id="again">Igen</button><button class="btn ghost" id="levels">Banor</button><button class="btn ghost" id="lobby">Lobbyn</button></div>`);
    document.getElementById('again').onclick = () => { hud.panel(null); P.attempts = -1; respawn(false); };
    document.getElementById('levels').onclick = () => { music?.stop(); music = null; level = null; showLevels(); };
    document.getElementById('lobby').onclick = () => ctx.exit();
  }

  // ---------- Fysik ----------
  const box = () => ({ x0: P.x + 0.1, x1: P.x + 0.9, y0: P.y + 0.1, y1: P.y + 0.9 });
  const hit = (b, x0, y0, x1, y1) => b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0;
  function step(dt) {
    if (P.dead || P.finished || !level) return;
    const prevY0 = P.y, prevY1 = P.y + 1;
    P.x += SPEED * dt; P.ground = false;
    if (P.mode === 'cube') {
      P.vy -= G * P.grav * dt;
    } else {
      P.vy += (input.held ? SHIP_ACC : -SHIP_ACC) * P.grav * dt; P.vy = Math.max(-SHIP_MAX, Math.min(SHIP_MAX, P.vy));
    }
    P.y += P.vy * dt;
    // golv och tak
    if (P.y <= 0) { P.y = 0; if (P.grav === 1) { P.vy = 0; P.ground = true; } else P.vy = 0; }
    if (P.y >= H - 1) { P.y = H - 1; if (P.grav === -1) { P.vy = 0; P.ground = true; } else P.vy = 0; }
    // block
    const b = box();
    for (let cx = Math.floor(b.x0); cx <= Math.floor(b.x1); cx++) for (let cy = Math.floor(b.y0); cy <= Math.floor(b.y1); cy++) {
      const blk = L.blocks.get(`${cx},${cy}`); if (!blk) continue;
      if (!hit(b, cx, cy, cx + 1, cy + 1)) continue;
      const falling = P.grav === 1 ? P.vy <= 0 : P.vy >= 0;
      if (P.grav === 1 && P.vy <= 0 && prevY0 >= cy + 1 - 0.2) { P.y = cy + 1; P.vy = 0; P.ground = true; }
      else if (P.grav === -1 && P.vy >= 0 && prevY1 <= cy + 0.2) { P.y = cy - 1; P.vy = 0; P.ground = true; }
      else if (P.mode === 'ship' && P.vy > 0 && prevY1 <= cy + 0.2) { P.y = cy - 1; P.vy = 0; }
      else if (P.mode === 'ship' && P.vy < 0 && prevY0 >= cy + 1 - 0.2) { P.y = cy + 1; P.vy = 0; }
      else { void falling; return die(); }
    }
    const b2 = box();
    for (const s of L.spikes) { const sy = s.dir === 1 ? s.y + 0.15 : s.y + 0.35; if (hit(b2, s.x + 0.3, sy, s.x + 0.7, sy + 0.5)) return die(); }
    for (const p of L.pads) if (!p.used && hit(b2, p.x, p.y, p.x + 1, p.y + 0.3)) { p.used = true; P.vy = PAD * P.grav; P.ground = false; sfx.jump(); }
    for (const o of L.orbs) if (!o.used && input.held && hit(b2, o.x - 0.3, o.y - 0.3, o.x + 1.3, o.y + 1.3)) { o.used = true; P.vy = JUMP * P.grav; P.ground = false; sfx.jump(); }
    for (const p of L.portals) if (!p.used && hit(b2, p.x, p.y - 1, p.x + 1, p.y + 2)) {
      p.used = true; sfx.check();
      if (p.kind === 'g') { P.grav *= -1; P.vy = 0; } else if (p.kind === 's') { P.mode = 'ship'; P.vy = 0; } else if (p.kind === 'c') { P.mode = 'cube'; P.vy = 0; }
    }
    for (const c of L.coins) if (!c.taken && hit(b2, c.x + 0.2, c.y + 0.2, c.x + 0.8, c.y + 0.8)) { c.taken = true; P.coins.push(`${c.x},${c.y}`); sfx.coin(); refreshHud(); }
    // hopp
    if (P.mode === 'cube') {
      if (P.ground && (input.held || input.pressed)) { P.vy = JUMP * P.grav; P.ground = false; sfx.jump(); }
      P.rot = P.ground ? Math.round(P.rot / (Math.PI / 2)) * (Math.PI / 2) : P.rot + 8 * dt * P.grav;
    }
    input.pressed = false;
    // övningsläge: spara en flagga var 8:e ruta när man står stadigt
    if (practice && P.ground && P.mode === 'cube' && P.x > 2 && (!P.cp || P.x - P.cp.x >= 8)) P.cp = { x: P.x, y: P.y, grav: P.grav, mode: P.mode };
    if (P.x >= L.length - 4) win();
  }

  // ---------- Rendering ----------
  function draw() {
    const w = W(), h = Hpx(); const u = h / 11.5; const camX = P.x - (w / u) * 0.32; const oy = h - u * 0.75; // oy = skärm-y för världens y=0
    const sx = (x) => (x - camX) * u + (shake ? (Math.random() - 0.5) * shake * 20 : 0), sy = (y) => oy - y * u;
    const col = level ? level.color : '#2bd4ff';
    const grad = g2.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#0b0b2b'); grad.addColorStop(1, '#1a0b3a'); g2.fillStyle = grad; g2.fillRect(0, 0, w, h);
    // bakgrund: stora rutor som rör sig långsamt
    g2.strokeStyle = 'rgba(255,255,255,.06)'; g2.lineWidth = 2;
    for (let i = -1; i < 8; i++) { const bx = ((i * 6 - camX * 0.3) % 36 + 36) % 36 * u - 3 * u; g2.strokeRect(bx, h * 0.15 + (i % 3) * u * 1.5, u * 3, u * 3); }
    if (!level) return;
    // tak och golv
    g2.fillStyle = '#11103a'; g2.fillRect(0, sy(H) - h, w, h); g2.fillRect(0, sy(0), w, h);
    g2.fillStyle = col; g2.shadowColor = col; g2.shadowBlur = 16; g2.fillRect(0, sy(0), w, 3); g2.fillRect(0, sy(H) - 3, w, 3); g2.shadowBlur = 0;
    const x0 = Math.floor(camX) - 1, x1 = Math.ceil(camX + w / u) + 1;
    // block
    for (let x = x0; x <= x1; x++) for (let y = 0; y < H; y++) if (L.blocks.has(`${x},${y}`)) {
      g2.fillStyle = '#1d1c4a'; g2.fillRect(sx(x), sy(y + 1), u + 0.5, u + 0.5); g2.strokeStyle = col; g2.lineWidth = 2; g2.strokeRect(sx(x) + 1, sy(y + 1) + 1, u - 2, u - 2);
    }
    // spikar
    g2.fillStyle = '#ffffff'; g2.strokeStyle = col; g2.lineWidth = 2;
    for (const s of L.spikes) { if (s.x < x0 || s.x > x1) continue; g2.beginPath();
      if (s.dir === 1) { g2.moveTo(sx(s.x), sy(s.y)); g2.lineTo(sx(s.x + 0.5), sy(s.y + 1)); g2.lineTo(sx(s.x + 1), sy(s.y)); }
      else { g2.moveTo(sx(s.x), sy(s.y + 1)); g2.lineTo(sx(s.x + 0.5), sy(s.y)); g2.lineTo(sx(s.x + 1), sy(s.y + 1)); }
      g2.closePath(); g2.fill(); g2.stroke(); }
    // plattor, orbs, portaler, mynt
    for (const p of L.pads) { g2.fillStyle = '#ffd400'; g2.shadowColor = '#ffd400'; g2.shadowBlur = 12; g2.beginPath(); g2.ellipse(sx(p.x + 0.5), sy(p.y) - 3, u * 0.45, u * 0.12, 0, 0, Math.PI * 2); g2.fill(); g2.shadowBlur = 0; }
    for (const o of L.orbs) { if (o.x < x0 || o.x > x1) continue; const r = u * (0.32 + Math.sin(time * 6) * 0.03); g2.fillStyle = o.used ? 'rgba(255,212,0,.25)' : '#ffd400'; g2.shadowColor = '#ffd400'; g2.shadowBlur = o.used ? 0 : 18; g2.beginPath(); g2.arc(sx(o.x + 0.5), sy(o.y + 0.5), r, 0, Math.PI * 2); g2.fill(); g2.shadowBlur = 0; g2.strokeStyle = '#fff'; g2.lineWidth = 2; g2.beginPath(); g2.arc(sx(o.x + 0.5), sy(o.y + 0.5), r * 0.55, 0, Math.PI * 2); g2.stroke(); }
    for (const p of L.portals) { if (p.x < x0 || p.x > x1) continue; const c = p.kind === 'g' ? (p.used ? '#ffe066' : '#4da3ff') : p.kind === 's' ? '#ff5fd2' : '#5bff7a'; g2.fillStyle = c; g2.shadowColor = c; g2.shadowBlur = 20; g2.globalAlpha = 0.85; g2.beginPath(); g2.roundRect(sx(p.x + 0.2), sy(p.y + 2), u * 0.6, u * 3, u * 0.3); g2.fill(); g2.globalAlpha = 1; g2.shadowBlur = 0;
      g2.fillStyle = '#fff'; g2.font = `bold ${u * 0.5}px sans-serif`; g2.textAlign = 'center'; g2.fillText(p.kind === 'g' ? '⇅' : p.kind === 's' ? '✈' : '■', sx(p.x + 0.5), sy(p.y + 0.3)); }
    for (const c of L.coins) { if (c.taken || c.x < x0 || c.x > x1) continue; g2.fillStyle = '#ffc107'; g2.shadowColor = '#ffc107'; g2.shadowBlur = 14; g2.beginPath(); g2.ellipse(sx(c.x + 0.5), sy(c.y + 0.5), u * 0.3 * Math.abs(Math.cos(time * 4)), u * 0.3, 0, 0, Math.PI * 2); g2.fill(); g2.shadowBlur = 0; }
    // övningsflagga
    if (practice && P.cp) { g2.fillStyle = '#5bff7a'; g2.fillRect(sx(P.cp.x + 0.45), sy(P.cp.y + 2), 3, u * 2); g2.fillRect(sx(P.cp.x + 0.45), sy(P.cp.y + 2), u * 0.7, u * 0.5); }
    // mållinje
    g2.fillStyle = '#fff'; g2.shadowColor = '#fff'; g2.shadowBlur = 20; g2.fillRect(sx(L.length - 4), sy(H), 4, u * H); g2.shadowBlur = 0;
    // spelaren
    if (!P.dead) {
      const cx = sx(P.x + 0.5), cy = sy(P.y + 0.5); g2.save(); g2.translate(cx, cy);
      if (P.mode === 'ship') {
        P.shipTilt += ((-P.vy / SHIP_MAX) * 0.6 * P.grav - P.shipTilt) * 0.2; g2.rotate(P.shipTilt); g2.scale(1, P.grav);
        g2.fillStyle = avatar.pants; g2.beginPath(); g2.moveTo(-u * 0.6, u * 0.1); g2.lineTo(u * 0.7, u * 0.35); g2.lineTo(-u * 0.6, u * 0.5); g2.closePath(); g2.fill();
        g2.fillStyle = avatar.shirt; g2.fillRect(-u * 0.3, -u * 0.35, u * 0.5, u * 0.5); g2.drawImage(face, -u * 0.3, -u * 0.35, u * 0.5, u * 0.5);
      } else {
        g2.rotate(-P.rot); g2.scale(1, P.grav);
        g2.fillStyle = avatar.shirt; g2.shadowColor = avatar.shirt; g2.shadowBlur = 12; g2.fillRect(-u * 0.45, -u * 0.45, u * 0.9, u * 0.9); g2.shadowBlur = 0;
        g2.fillStyle = avatar.pants; g2.fillRect(-u * 0.3, -u * 0.3, u * 0.6, u * 0.6); g2.drawImage(face, -u * 0.25, -u * 0.25, u * 0.5, u * 0.5);
      }
      g2.restore();
    }
    // partiklar
    for (const p of parts) { g2.globalAlpha = Math.max(0, p.life); g2.fillStyle = p.c; g2.fillRect(sx(p.x), sy(p.y), u * 0.25, u * 0.25); } g2.globalAlpha = 1;
    // procentmätare
    const pw = Math.min(w * 0.45, 320), px = (w - pw) / 2, py = h - 34;
    g2.fillStyle = 'rgba(0,0,0,.5)'; g2.beginPath(); g2.roundRect(px, py, pw, 18, 9); g2.fill(); g2.fillStyle = col; g2.beginPath(); g2.roundRect(px, py, Math.max(18, pw * progress() / 100), 18, 9); g2.fill();
    g2.fillStyle = '#fff'; g2.font = 'bold 12px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(progress() + ' %', w / 2, py + 9); g2.textBaseline = 'alphabetic';
    if (flash > 0) { g2.fillStyle = `rgba(255,255,255,${flash * 0.6})`; g2.fillRect(0, 0, w, h); }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    acc += dt; while (acc > 1 / 240) { step(1 / 240); acc -= 1 / 240; }
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 40 * dt; p.life -= dt; } for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    shake = Math.max(0, shake - dt * 2); flash = Math.max(0, flash - dt * 1.5);
    if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { P.dead = 0; respawn(false); } }
    draw(); raf = requestAnimationFrame(frame);
  }
  hud.bottom(''); showLevels(); raf = requestAnimationFrame(frame);
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.__dash = { P, L: () => L, startLevel, input, LEVELS };

  return {
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() {
      this.stop(); music?.stop(); removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', down); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      removeEventListener('keydown', key); removeEventListener('keyup', key); canvas.remove();
    },
  };
}
