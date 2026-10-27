// Bygg: placera block på en platta, byt färg, ta bort, och gå runt i din egen värld.
import * as THREE from 'three';
import { Engine, hud, sfx } from '../engine.js';

const PALETTE = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#ffffff', '#424242', '#26c6da'];
const CELL = 2, HALF = 8; // 16x16 rutor, 2 enheter var

export function start(ctx) {
  const e = new Engine(ctx.container, { sky: 0xbbdefb });
  const base = e.addBox({ x: 0, y: -0.5, z: 0, w: HALF * 2 * CELL, h: 1, d: HALF * 2 * CELL, color: 0x9ccc65, name: 'base' });
  const grid = new THREE.GridHelper(HALF * 2 * CELL, HALF * 2, 0x33691e, 0x7cb342); grid.position.y = 0.01; e.scene.add(grid);
  e.ground(400, -1.5, 0x8bc34a).mesh.visible = true; e.boxes.pop(); // bara dekor, ingen kollision
  const walls = [[HALF * CELL + 0.5, 0, 1, 40], [-HALF * CELL - 0.5, 0, 1, 40], [0, HALF * CELL + 0.5, 40, 1], [0, -HALF * CELL - 0.5, 40, 1]];
  walls.forEach(([x, z, w, d]) => { e.addBox({ x, y: 10, z, w, h: 20, d }).mesh.visible = false; });

  const world = ctx.store.current.world || {}; const blocks = new Map(); // key -> box
  const key = (x, y, z) => `${x},${y},${z}`;
  function place(x, y, z, color, silent) {
    if (x < -HALF || x >= HALF || z < -HALF || z >= HALF || y < 0 || y > 24) return;
    const k = key(x, y, z); if (blocks.has(k)) return;
    const b = e.addBox({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2, z: z * CELL + CELL / 2, w: CELL, h: CELL, d: CELL, color: new THREE.Color(color) });
    b.cell = [x, y, z]; blocks.set(k, b); world[k] = color;
    if (!silent) { sfx.place(); save(); }
  }
  function remove(b) { const k = key(...b.cell); blocks.delete(k); delete world[k]; e.removeBox(b); sfx.remove(); save(); }
  function save() { ctx.store.update(p => { p.world = world; }); hud.right(`🧱 ${blocks.size}`); }
  for (const [k, c] of Object.entries(world)) { const [x, y, z] = k.split(',').map(Number); place(x, y, z, c, true); }

  let color = PALETTE[4], tool = 'place', mode = 'build';
  const player = e.spawnPlayer(ctx.player.avatar, new THREE.Vector3(0, 0, HALF * CELL - 2));
  const camT = new THREE.Vector3(0, 2, 0); const ray = new THREE.Raycaster();

  function setMode(m) {
    mode = m;
    if (m === 'build') { e.freeze = true; player.mesh.visible = false; e.camTarget = camT; e.cam.dist = 26; e.cam.pitch = 0.7; hud.bottom(ctx.touch ? 'Tryck: bygg/ta bort · Dra: snurra · Vänster: flytta' : 'Klick: bygg · Högerklick/Shift: ta bort · Dra: snurra · WASD: flytta'); }
    else { e.freeze = false; player.mesh.visible = true; e.camTarget = null; e.cam.dist = 9; e.cam.pitch = 0.35; // spawna högst upp om det finns block i mitten
      let top = 0; for (const b of blocks.values()) if (Math.abs(b.cell[0]) <= 1 && Math.abs(b.cell[2]) <= 1) top = Math.max(top, (b.cell[1] + 1) * CELL);
      player.pos.set(0, top, 0); player.spawn.copy(player.pos); player.vel.set(0, 0, 0); hud.bottom(ctx.touch ? 'Vänster: gå · Höger: titta · Hoppa-knappen' : 'WASD: gå · Mellanslag: hoppa'); }
    renderTools();
  }
  function renderTools() {
    const t = hud.tools(`
      <div style="display:flex;gap:6px">
        <button class="hud-btn" id="t-mode" style="background:${mode === 'play' ? '#00b06f' : '#335fff'}">${mode === 'build' ? '▶ Spela i världen' : '🧱 Bygg vidare'}</button>
      </div>
      ${mode === 'build' ? `
      <div style="display:flex;gap:6px">
        <button class="hud-btn" id="t-place" style="${tool === 'place' ? 'outline:3px solid #fff' : ''}">➕ Bygg</button>
        <button class="hud-btn" id="t-remove" style="${tool === 'remove' ? 'outline:3px solid #fff' : ''}">🗑 Ta bort</button>
      </div>
      <div class="palette">${PALETTE.map(c => `<button class="swatch ${c === color ? 'active' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <button class="hud-btn" id="t-clear" style="opacity:.8">Rensa allt</button>` : ''}`);
    t.querySelector('#t-mode').onclick = () => setMode(mode === 'build' ? 'play' : 'build');
    t.querySelector('#t-place') && (t.querySelector('#t-place').onclick = () => { tool = 'place'; renderTools(); });
    t.querySelector('#t-remove') && (t.querySelector('#t-remove').onclick = () => { tool = 'remove'; renderTools(); });
    t.querySelectorAll('.swatch').forEach(s => s.onclick = () => { color = s.dataset.c; tool = 'place'; renderTools(); });
    const clr = t.querySelector('#t-clear');
    if (clr) clr.onclick = () => {
      if (clr.dataset.armed) { for (const b of [...blocks.values()]) { blocks.delete(key(...b.cell)); e.removeBox(b); } for (const k in world) delete world[k]; save(); renderTools(); }
      else { clr.dataset.armed = '1'; clr.textContent = 'Säker? Tryck igen'; clr.style.background = '#e2231a'; clr.style.opacity = 1; setTimeout(() => { delete clr.dataset.armed; clr.textContent = 'Rensa allt'; clr.style.background = ''; clr.style.opacity = .8; }, 2500); }
    };
  }
  hud.title('Bygg din värld'); hud.right(`🧱 ${blocks.size}`);
  hud.center('<div>Bygg vad du vill!</div><div class="small">Tryck på plattan för att sätta ett block</div>', 2500);
  setMode('build');

  e.start((dt) => {
    if (mode === 'build') {
      const mv = e.input.move; const yaw = e.cam.yaw; const sp = 14 * dt;
      const fwd = -mv.y; camT.x += (-fwd * Math.sin(yaw) + mv.x * Math.cos(yaw)) * sp; camT.z += (-fwd * Math.cos(yaw) - mv.x * Math.sin(yaw)) * sp;
      camT.x = Math.max(-HALF * CELL, Math.min(HALF * CELL, camT.x)); camT.z = Math.max(-HALF * CELL, Math.min(HALF * CELL, camT.z));
      for (const c of e.input.takeClicks()) {
        const r = e.renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((c.x - r.left) / r.width) * 2 - 1, -((c.y - r.top) / r.height) * 2 + 1), e.camera);
        const meshes = [base.mesh, ...[...blocks.values()].map(b => b.mesh)];
        const hit = ray.intersectObjects(meshes)[0]; if (!hit) continue;
        const hitBlock = [...blocks.values()].find(b => b.mesh === hit.object);
        const removing = tool === 'remove' || c.button === 2 || c.shift;
        if (removing) { if (hitBlock) remove(hitBlock); continue; }
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        const p = hit.point.clone().add(n.multiplyScalar(0.5));
        place(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL), color);
      }
    } else e.input.takeClicks();
  });
  return e;
}
