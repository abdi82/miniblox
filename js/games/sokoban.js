// Lådknuffaren: Sokoban i 3D. Knuffa alla lådor till målrutorna. Svep, piltangenter eller WASD flyttar ett steg i taget.
import * as THREE from 'three';
import { Engine, hud, sfx } from '../engine.js';
import { buildAvatar, animateAvatar } from '../avatar.js';
import { LEVELS } from './sokoban-levels.js';

const CELL = 2, STEP = 0.16; // ruta i världen, sekunder per steg
const PALETTES = [[0x7986cb, 0xe8eaf6], [0x4db6ac, 0xe0f2f1], [0xff8a65, 0xfbe9e7], [0xba68c8, 0xf3e5f5], [0x9ccc65, 0xf1f8e9], [0x4fc3f7, 0xe1f5fe]];
const CSS = `
.sok-pad { position:absolute; left:max(14px,env(safe-area-inset-left)); bottom:max(14px,env(safe-area-inset-bottom)); display:grid; grid-template-columns:repeat(3,60px); grid-template-rows:repeat(3,60px); gap:4px; pointer-events:auto; }
.sok-pad button { border:0; border-radius:12px; background:rgba(255,255,255,.28); color:#fff; font-size:26px; font-weight:800; touch-action:none; text-shadow:none; }
.sok-pad button:active { background:rgba(255,255,255,.55); }
.sok-levels { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0 4px; }
.sok-levels button { border:0; border-radius:10px; padding:10px 0; font-size:17px; font-weight:800; background:#e8eaed; color:var(--text); min-height:46px; }
.sok-levels button.done { background:#c8f1dc; }
.sok-levels button.cur { outline:3px solid var(--blue); }
.hud-tools.sok-tools .hud-btn { font-size:16px; padding:12px 16px; min-width:120px; }`;

function parse(map) {
  const rows = map.replace(/^\n/, '').split('\n'); const W = Math.max(...rows.map(r => r.length)); const grid = rows.map(r => r.padEnd(W, ' '));
  const L = { W, H: rows.length, walls: new Set(), goals: new Set(), crates: [], floor: new Set(), player: null };
  grid.forEach((r, y) => [...r].forEach((c, x) => { const k = `${x},${y}`;
    if (c === '#') L.walls.add(k); if (c === '$' || c === '*') L.crates.push([x, y]); if (c === '.' || c === '*' || c === '+') L.goals.add(k); if (c === '@' || c === '+') L.player = [x, y]; }));
  // golv = rutor man kan nå från spelaren (så vi inte ritar golv utanför banan)
  const st = [L.player]; L.floor.add(L.player.join(','));
  while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`; if (nx < 0 || ny < 0 || nx >= W || ny >= L.H || L.walls.has(k) || L.floor.has(k)) continue; L.floor.add(k); st.push([nx, ny]); } }
  return L;
}

export function start(ctx) {
  const e = new Engine(ctx.container, { sky: 0xd7ecff, fog: false });
  e.freeze = true; e.input.touchEl.hidden = true; e.input.takeLook = () => ({ x: 0, y: 0 }); // ingen fysik, fast kamera
  e.cam.yaw = 0; e.cam.pitch = 1.0; e.camTarget = new THREE.Vector3(0, -1.8, 0);
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const rec = () => { const r = ctx.store.current.records; r.sokoban = r.sokoban || {}; r.sokoban.solved = r.sokoban.solved || {}; return r.sokoban; };
  const firstUnsolved = () => { const s = rec().solved; const i = LEVELS.findIndex((_, k) => !s[k]); return i < 0 ? 0 : i; };

  let cur = firstUnsolved(), L = null, world = null, crates = [], px = 0, py = 0, undo = [], anim = null, won = false, moves = 0, pushes = 0;
  const avatar = buildAvatar(ctx.player.avatar); e.scene.add(avatar);
  const wx = (x) => (x - (L.W - 1) / 2) * CELL, wz = (y) => (y - (L.H - 1) / 2) * CELL;
  const crateAt = (x, y) => crates.find(c => c.x === x && c.y === y);
  const onGoal = (c) => L.goals.has(`${c.x},${c.y}`);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xc98a4b }), crateDone = new THREE.MeshLambertMaterial({ color: 0x66bb6a }), edgeMat = new THREE.LineBasicMaterial({ color: 0x5d3a16 });

  function load(i) {
    cur = i; L = parse(LEVELS[i].map); undo = []; anim = null; won = false; moves = 0; pushes = 0;
    if (world) { e.scene.remove(world); world.traverse(o => o.geometry?.dispose?.()); }
    world = new THREE.Group(); e.scene.add(world); crates = [];
    const [wallC, floorC] = PALETTES[i % PALETTES.length];
    const wallGeo = new THREE.BoxGeometry(CELL - 0.06, 1.3, CELL - 0.06), floorGeo = new THREE.BoxGeometry(CELL, 0.3, CELL), goalGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.12, 24);
    const wallMat = new THREE.MeshLambertMaterial({ color: wallC }), f1 = new THREE.MeshLambertMaterial({ color: floorC }), f2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(floorC).multiplyScalar(0.93) }), goalMat = new THREE.MeshLambertMaterial({ color: 0xff7043, emissive: 0x7f2a10, emissiveIntensity: 0.3 });
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const k = `${x},${y}`;
      if (L.floor.has(k)) { const m = new THREE.Mesh(floorGeo, (x + y) % 2 ? f1 : f2); m.position.set(wx(x), -0.15, wz(y)); m.receiveShadow = true; world.add(m); }
      else if (L.walls.has(k)) { // rita bara väggar som gränsar till golvet
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => L.floor.has(`${x + dx},${y + dy}`)); if (!near) continue;
        const m = new THREE.Mesh(wallGeo, wallMat); m.position.set(wx(x), 0.65 - 0.3, wz(y)); m.castShadow = m.receiveShadow = true; world.add(m);
      }
      if (L.goals.has(k)) { const g = new THREE.Mesh(goalGeo, goalMat); g.position.set(wx(x), 0.06, wz(y)); world.add(g); }
    }
    const cGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5), eGeo = new THREE.EdgesGeometry(cGeo);
    for (const [x, y] of L.crates) { const m = new THREE.Mesh(cGeo, crateMat); m.castShadow = true; m.add(new THREE.LineSegments(eGeo, edgeMat)); m.position.set(wx(x), 0.75, wz(y)); world.add(m); crates.push({ x, y, mesh: m }); }
    [px, py] = L.player; avatar.position.set(wx(px), 0, wz(py)); avatar.rotation.y = 0; avatar.visible = true;
    paint(); hud.panel(null); hud.title(`📦 Bana ${i + 1}: ${LEVELS[i].name}`); updateHud();
    hud.center(`<div>Bana ${i + 1}</div><div class="small">${LEVELS[i].name}</div>`, 1400);
    fitCamera();
  }
  function paint() { for (const c of crates) c.mesh.material = onGoal(c) ? crateDone : crateMat; }
  function updateHud() { const s = rec().solved; hud.right(`👣 ${moves} · 📦 ${pushes} · ✅ ${Object.keys(s).length}/${LEVELS.length}`); }
  function fitCamera() {
    const w = ctx.container.clientWidth || 1, h = ctx.container.clientHeight || 1, aspect = w / h;
    const need = Math.max((L.W * CELL + 2) / (1.15 * aspect * 0.92), (L.H * CELL * 0.75 + 4) / (1.15 * 0.7));
    e.cam.dist = Math.max(10, need);
  }

  function tryMove(dx, dy) {
    if (anim || won) return;
    const nx = px + dx, ny = py + dy; const k = `${nx},${ny}`;
    avatar.rotation.y = Math.atan2(dx, dy);
    if (L.walls.has(k) || !L.floor.has(k)) return;
    const c = crateAt(nx, ny); let push = null;
    if (c) { const bx = nx + dx, by = ny + dy; if (L.walls.has(`${bx},${by}`) || crateAt(bx, by)) return; push = { c, fx: c.x, fy: c.y, tx: bx, ty: by }; }
    undo.push({ px, py, push: push && { c: push.c, fx: push.fx, fy: push.fy } }); if (undo.length > 500) undo.shift();
    anim = { t: 0, fx: px, fy: py, tx: nx, ty: ny, push }; px = nx; py = ny; moves++;
    if (push) { push.c.x = push.tx; push.c.y = push.ty; pushes++; sfx.place(); }
    updateHud();
  }
  function doUndo() {
    if (anim || won || !undo.length) return;
    const u = undo.pop(); px = u.px; py = u.py; avatar.position.set(wx(px), 0, wz(py)); moves = Math.max(0, moves - 1);
    if (u.push) { u.push.c.x = u.push.fx; u.push.c.y = u.push.fy; u.push.c.mesh.position.set(wx(u.push.fx), 0.75, wz(u.push.fy)); pushes = Math.max(0, pushes - 1); }
    paint(); sfx.remove(); updateHud();
  }
  function checkWin() {
    if (!crates.every(onGoal)) return;
    won = true; sfx.win(); const r = rec(); const first = !r.solved[cur];
    const coins = first ? 10 : 2; ctx.store.update(p => { p.records.sokoban.solved[cur] = Math.min(pushes, r.solved[cur] || 1e9); }); ctx.store.bump('sokoban', 'wins'); ctx.store.addCoins(coins);
    updateHud();
    setTimeout(() => {
      if (!e.running) return;
      const next = cur + 1 < LEVELS.length ? cur + 1 : null;
      const p = hud.panel(`<h3>🎉 Bana klarad!</h3><div>${moves} steg och ${pushes} knuffar</div><div style="margin-top:6px">+${coins} <span class="coin-icon" style="vertical-align:-3px"></span> ${first ? '' : '<span class="sub" style="font-size:13px">(redan klarad: 2 mynt)</span>'}</div>
        <div class="row">${next != null ? `<button class="btn green" id="s-next">Nästa bana ▶</button>` : `<div style="font-size:14px">Du har klarat alla banor! 🏆</div>`}<button class="btn ghost" id="s-again">Igen</button><button class="btn ghost" id="s-list">Banor</button></div>`);
      p.querySelector('#s-next') && (p.querySelector('#s-next').onclick = () => load(next));
      p.querySelector('#s-again').onclick = () => load(cur); p.querySelector('#s-list').onclick = showLevels;
    }, 600);
  }
  function showLevels() {
    const s = rec().solved;
    const p = hud.panel(`<h3>📦 Lådknuffaren</h3><div class="sub" style="font-weight:600">Välj bana. Gröna är klarade.</div>
      <div class="sok-levels">${LEVELS.map((l, i) => `<button data-i="${i}" class="${s[i] ? 'done' : ''} ${i === cur ? 'cur' : ''}" title="${l.name}">${s[i] ? '✅' : ''}${i + 1}</button>`).join('')}</div>
      <div class="row"><button class="btn ghost" id="s-close">Stäng</button></div>`);
    p.querySelectorAll('[data-i]').forEach(b => b.onclick = () => load(+b.dataset.i));
    p.querySelector('#s-close').onclick = () => { hud.panel(null); if (won) load(cur); };
  }
  function renderTools() {
    const t = hud.tools(`<button class="hud-btn" id="s-undo">↩ Ångra</button><button class="hud-btn" id="s-restart">🔄 Börja om</button><button class="hud-btn" id="s-levels">📋 Banor</button>`);
    t.classList.add('sok-tools');
    t.querySelector('#s-undo').onclick = doUndo; t.querySelector('#s-restart').onclick = () => load(cur); t.querySelector('#s-levels').onclick = showLevels;
  }

  // Styrning: tangentbord, svep på skärmen och en D-pad för pekskärm
  const onKey = (ev) => {
    if (!hud.el('hud-panel').hidden) return;
    const k = ev.key.toLowerCase(); const map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    if (map[k]) { ev.preventDefault(); tryMove(...map[k]); } else if (k === 'z' || k === 'backspace') doUndo(); else if (k === 'r') load(cur);
  };
  addEventListener('keydown', onKey);
  let swipe = null; const canvas = e.renderer.domElement;
  const sDown = (ev) => { swipe = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; };
  const sUp = (ev) => { if (!swipe || swipe.id !== ev.pointerId) return; const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y; swipe = null; if (Math.hypot(dx, dy) < 24) return; if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0); else tryMove(0, Math.sign(dy)); };
  canvas.addEventListener('pointerdown', sDown); addEventListener('pointerup', sUp);
  const pad = document.createElement('div'); pad.className = 'sok-pad'; pad.hidden = !ctx.touch;
  pad.innerHTML = `<span></span><button data-d="0,-1">▲</button><span></span><button data-d="-1,0">◀</button><span></span><button data-d="1,0">▶</button><span></span><button data-d="0,1">▼</button><span></span>`;
  pad.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); tryMove(...b.dataset.d.split(',').map(Number)); }));
  hud.el('hud').appendChild(pad);
  hud.bottom(ctx.touch ? 'Svep eller använd pilarna för att gå. Knuffa lådorna till de orange målen!' : 'Piltangenter/WASD: gå · Z: ångra · R: börja om');

  renderTools(); load(cur);
  e.start((dt) => {
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / STEP); const s = anim.t;
      avatar.position.set(wx(anim.fx) + (wx(anim.tx) - wx(anim.fx)) * s, 0, wz(anim.fy) + (wz(anim.ty) - wz(anim.fy)) * s);
      if (anim.push) anim.push.c.mesh.position.set(wx(anim.push.fx) + (wx(anim.push.tx) - wx(anim.push.fx)) * s, 0.75, wz(anim.push.fy) + (wz(anim.push.ty) - wz(anim.push.fy)) * s);
      animateAvatar(avatar, e.time, true, false);
      if (anim.t >= 1) { anim = null; paint(); checkWin(); }
    } else animateAvatar(avatar, e.time, false, false);
    e.input.takeClicks();
  });
  const onResize = () => fitCamera(); addEventListener('resize', onResize);
  return { dispose() { removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', sDown); removeEventListener('pointerup', sUp); removeEventListener('resize', onResize); pad.remove(); style.remove(); e.dispose(); } };
}
