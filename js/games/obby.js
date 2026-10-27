// Hinderbanan: en oändlig bana som byggs medan du springer. Svårare ju längre du kommer. Välj djur innan start!
import * as THREE from 'three';
import { Engine, hud, sfx } from '../engine.js';
import { ANIMALS } from '../avatar.js';

const COLORS = [0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xf06292, 0x90a4ae, 0xfff176, 0x80deea];

// Bygger banan bit för bit. "cur" är markören där nästa bit börjar.
function makeBuilder(e) {
  const cur = { x: 0, y: 0, z: 0, i: 0, seg: 0 };
  const col = () => COLORS[cur.i++ % COLORS.length];
  const plat = (w, d, extra = {}) => e.addBox({ x: cur.x, y: cur.y - 0.5, z: cur.z, w, h: 1, d, color: col(), ...extra });
  const step = (dz, dy = 0, dx = 0) => { cur.z -= dz; cur.y += dy; cur.x += dx; };
  const coin = (dy = 1.2) => e.addCoin(cur.x, cur.y + dy, cur.z);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // d = svårighet 0..1
  const SEGMENTS = {
    hopp(d) { const n = 3 + Math.round(d * 3); for (let k = 0; k < n; k++) { const size = 4 - d * 1.5; step(size + 2.5 + d * 2.5, 0, rnd(-1.5, 1.5) * d); plat(size, size); if (Math.random() < 0.4) coin(); } },
    lavaplatta(d) { step(8); const D = 12 + d * 8; plat(6, D); const n = 3 + Math.round(d * 3); for (let k = 0; k < n; k++) e.addBox({ x: cur.x + (k % 2 ? 1.5 : -1.5), y: cur.y + 0.05, z: cur.z + D / 2 - 2 - k * (D - 4) / n, w: 3, h: 0.1, d: 1.6, type: 'lava' }); step(D / 2 + 3); },
    trappa(d) { const n = 4 + Math.round(d * 3); for (let k = 0; k < n; k++) { step(4.5, 1.5 + d * 0.6, 0); plat(4, 4); } coin(); },
    rorlig(d) { step(9 + d * 2); e.addBox({ x: cur.x, y: cur.y - 0.5, z: cur.z, w: 4 - d, h: 1, d: 4 - d, color: 0xffeb3b, motion: { dx: 8 + d * 4, speed: 1.2 + d * 0.6 } }); cur.i++; step(9 + d * 2); plat(4, 4); coin(); },
    rorligZ(d) { step(9); e.addBox({ x: cur.x, y: cur.y - 0.5, z: cur.z, w: 4, h: 1, d: 4, color: 0xffeb3b, motion: { dz: -(7 + d * 5), speed: 1.0 + d * 0.5 } }); cur.i++; step(14 + d * 5); plat(5, 5); },
    bro(d) { step(5); const n = 3 + Math.round(d * 3); for (let k = 0; k < n; k++) { plat(Math.max(1.0, 1.6 - d * 0.6), 5); step(5); if (k === 1) coin(); } plat(5, 5); },
    pelare(d) { const n = 4 + Math.round(d * 3); for (let k = 0; k < n; k++) { const hh = rnd(1.5, 3 + d * 3); step(6 + d * 1.5, 0, rnd(-2, 2)); e.addBox({ x: cur.x, y: cur.y + (hh - 1) / 2, z: cur.z, w: 3 - d, h: hh + 1, d: 3 - d, color: col() }); cur.y += hh; if (k % 2) coin(); } step(7); plat(5, 5); },
    lavalabyrint(d) { step(7); const W = 12, D = 16 + d * 10; e.addBox({ x: cur.x, y: cur.y - 0.5, z: cur.z - D / 2 + 2.5, w: W, h: 1, d: D, color: col() }); const rows = Math.floor(D / 3.5); for (let k = 0; k < rows; k++) { const gapX = cur.x + pick([-3.5, 0, 3.5]); for (let m = -1; m <= 1; m++) { const lx = cur.x + m * 4; if (Math.abs(lx - gapX) < 1) continue; e.addBox({ x: lx, y: cur.y + 0.05, z: cur.z - 1 - k * 3.5, w: 4.2, h: 0.1, d: 1.4, type: 'lava' }); } } step(D + 1); plat(5, 5); coin(); },
    uppat(d) { const n = 4 + Math.round(d * 2); for (let k = 0; k < n; k++) { step(5.5 + d, 1.6 + d * 0.5, k % 2 ? 3 : -3); plat(3 - d * 0.5, 3 - d * 0.5); } coin(); },
    nedat(d) { const n = 4; for (let k = 0; k < n; k++) { step(7 + d * 2, -2.5, k % 2 ? 3 : -3); plat(3.5, 3.5); } coin(); },
    sicksack(d) { const n = 5 + Math.round(d * 3); for (let k = 0; k < n; k++) { step(4.5 + d * 1.5, 0, (k % 2 ? 1 : -1) * (4 + d * 2)); plat(3.5 - d, 3.5 - d); } coin(); },
  };
  const ORDER = ['hopp', 'lavaplatta', 'trappa', 'rorlig', 'bro', 'pelare', 'lavalabyrint', 'uppat', 'nedat', 'sicksack', 'rorligZ'];

  return {
    cur,
    start() { plat(10, 10); },
    next() {
      const d = Math.min(1, cur.seg / 25); // full svårighet efter 25 bitar
      const name = cur.seg < 2 ? ['hopp', 'lavaplatta'][cur.seg] : pick(ORDER);
      SEGMENTS[name](d); cur.seg++;
      if (cur.y < -4) { SEGMENTS.trappa(0); } // kom inte för nära lavahavet
      step(8); plat(5, 5, { type: 'checkpoint' }); // kontrollpunkt efter varje bit
    },
  };
}

export function start(ctx) {
  const e = new Engine(ctx.container); e.lavaSea(-12);
  const B = makeBuilder(e); B.start(); for (let k = 0; k < 3; k++) B.next();
  const rec = () => ctx.store.current.records.obby || {};
  let t = 0, deaths = 0, started = false, best = rec().dist || 0, dist = 0, cps = 0, animal = ctx.player.obbyAnimal || 'human', coinsGot = 0;
  hud.title('Hinderbanan');
  const refresh = () => hud.right(`📏 ${dist} m <span style="opacity:.8">· 💀 ${deaths} · 🪙 ${coinsGot}</span>${best ? ` <span style="opacity:.7">· Rekord ${best} m</span>` : ''}`);
  function spawn() {
    const a = ANIMALS.find(x => x.id === animal) || ANIMALS[0];
    const keepSpawn = e.player?.spawn.clone();
    const pl = e.spawnPlayer(ctx.player.avatar, keepSpawn || new THREE.Vector3(0, 0, 2), a.id, a.stats);
    if (keepSpawn) { pl.spawn.copy(keepSpawn); pl.pos.copy(keepSpawn); }
    hud.tools(`<button class="hud-btn" id="o-animal">${a.emoji} Byt djur</button>`).querySelector('#o-animal').onclick = () => pickAnimal();
  }
  // Välj vem du vill vara (Yakobs idé!)
  function pickAnimal() {
    e.freeze = true;
    hud.panel(`<h3>Vem vill du vara?</h3>
      <div class="items" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">${ANIMALS.map(a => `<button class="item ${a.id === animal ? 'active' : ''}" data-animal="${a.id}"><span class="big">${a.emoji}</span>${a.label}<div class="sub" style="font-size:11px;font-weight:500;margin-top:4px">${a.desc}</div></button>`).join('')}</div>`);
    document.querySelectorAll('[data-animal]').forEach(b => b.onclick = () => {
      animal = b.dataset.animal; ctx.store.update(p => { p.obbyAnimal = animal; });
      hud.panel(null); spawn(); e.freeze = false; started = true;
      const a = ANIMALS.find(x => x.id === animal);
      hud.center(`<div>${a.emoji} ${a.label}!</div><div class="small">${a.desc}</div>`, 2000);
    });
  }
  spawn(); refresh();
  hud.bottom(ctx.touch ? 'Vänster: gå · Höger: titta · 2 hopp = dubbelhopp · 3 hopp = flyga!' : 'WASD: gå · Mellanslag: hoppa · 2 = dubbelhopp · 3 = flyga · Dra med musen: titta');
  pickAnimal();

  e.on('die', () => { deaths++; refresh(); hud.center('<div style="color:#ff5252">Aj! Försök igen</div>', 800); });
  e.on('checkpoint', () => {
    cps++; ctx.store.addCoins(2); hud.center('<div style="color:#69f0ae">Kontrollpunkt! +2 mynt</div>', 1000);
    ctx.store.bump('obby', 'checkpoints');
  });
  e.on('coin', () => { coinsGot++; ctx.store.addCoins(1); refresh(); });

  e.start((dt) => {
    if (!started) return;
    t += dt;
    const p = e.player; const m = Math.max(0, Math.round(-p.pos.z));
    if (m !== dist) { dist = m; if (dist > best) { best = dist; ctx.store.record('obby', 'dist', dist); } refresh(); }
    // Bygg mer bana när spelaren närmar sig slutet, och städa bort det som ligger långt bakom
    while (B.cur.z > p.pos.z - 90) B.next();
    if (e.boxes.length > 450) for (const b of [...e.boxes]) if (b.z > p.pos.z + 60 && b.name !== 'ground') e.removeBox(b);
    for (const c of e.coins) if (!c.taken && c.z > p.pos.z + 60) { c.taken = true; e.scene.remove(c.mesh); }
    if (cps % 10 === 0 && cps > 0 && !e._milestone?.[cps]) { (e._milestone ||= {})[cps] = true; ctx.store.addCoins(10); sfx.win(); hud.center(`<div>🌟 ${cps} kontrollpunkter!</div><div class="small">+10 mynt</div>`, 2000); }
  });
  return e;
}
