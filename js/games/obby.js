// Hinderbanan: hoppa mellan plattformar, undvik lava, nå målet så snabbt du kan.
import * as THREE from 'three';
import { Engine, hud, sfx, fmtTime } from '../engine.js';

const COLORS = [0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xf06292, 0x90a4ae];

function buildLevel(e) {
  let z = 0, y = 0, x = 0, i = 0;
  const col = () => COLORS[i++ % COLORS.length];
  const plat = (w, d, h = 1, extra = {}) => e.addBox({ x, y: y - h / 2, z, w, h, d, color: col(), ...extra });
  const step = (dz, dy = 0, dx = 0) => { z -= dz; y += dy; x += dx; };

  plat(10, 10); // start
  e.spawnAt = new THREE.Vector3(0, 0, 2);
  // 1. Lätta hopp
  step(8); for (let k = 0; k < 5; k++) { plat(4, 4); step(7); }
  // 2. Lavaplattan
  plat(6, 14, 1); for (let k = 0; k < 4; k++) e.addBox({ x: x + (k % 2 ? 1.5 : -1.5), y: y + 0.05, z: z + 5 - k * 3.2, w: 3, h: 0.1, d: 1.6, type: 'lava' });
  step(10); plat(5, 5, 1, { type: 'checkpoint' });
  // 3. Trappa upp
  for (let k = 0; k < 6; k++) { step(4.5, 1.5); plat(4, 4); }
  // 4. Rörliga plattformar
  step(9); e.addBox({ x, y: y - 0.5, z, w: 4, h: 1, d: 4, color: 0xffeb3b, motion: { dx: 8, speed: 1.2 } }); i++;
  step(9); plat(4, 4);
  step(9); e.addBox({ x, y: y - 0.5, z, w: 4, h: 1, d: 4, color: 0xffeb3b, motion: { dz: -7, speed: 1.0 } }); i++;
  step(14); plat(5, 5, 1, { type: 'checkpoint' });
  // 5. Smala bron med lava vid sidorna
  step(5); for (let k = 0; k < 4; k++) { plat(1.4, 5); step(5); }
  plat(5, 5);
  // 6. Pelare i olika höjd
  const heights = [1.5, 3, 1.5, 4, 2.5, 5];
  for (const hh of heights) { step(6.5, 0, (Math.random() - 0.5) * 4); e.addBox({ x, y: y + (hh - 1) / 2, z, w: 3, h: hh + 1, d: 3, color: col() }); y += hh; }
  step(7); plat(5, 5, 1, { type: 'checkpoint' });
  // 7. Lavalabyrint: plattform med lavaremsor
  step(7); const W = 12, D = 20; e.addBox({ x, y: y - 0.5, z: z - D / 2 + 2.5, w: W, h: 1, d: D, color: col() });
  for (let k = 0; k < 5; k++) { const gapX = x + (k % 2 ? -3.5 : 3.5); for (let m = -1; m <= 1; m++) { const lx = x + m * 4; if (Math.abs(lx - gapX) < 1) continue; e.addBox({ x: lx, y: y + 0.05, z: z - 1 - k * 3.5, w: 4.2, h: 0.1, d: 1.4, type: 'lava' }); } }
  step(D + 1); plat(5, 5, 1, { type: 'checkpoint' });
  // 8. Hopp uppåt med små plattformar
  for (let k = 0; k < 5; k++) { step(6, 1.8, k % 2 ? 3 : -3); plat(2.5, 2.5); }
  // 9. Mål
  step(8); e.addBox({ x, y: y - 0.5, z, w: 8, h: 1, d: 8, type: 'finish' });
}

export function start(ctx) {
  const e = new Engine(ctx.container); e.lavaSea(-12);
  buildLevel(e);
  const p = e.spawnPlayer(ctx.player.avatar, e.spawnAt);
  let t = 0, deaths = 0, done = false, cps = 0;
  hud.title('Hinderbanan');
  hud.bottom(ctx.touch ? 'Vänster: gå · Höger: titta · 2 hopp = dubbelhopp · 3 hopp = flyga!' : 'WASD: gå · Mellanslag: hoppa · 2 = dubbelhopp · 3 = flyga i 10 s · Dra med musen: titta');
  hud.center('<div>Spring till flaggan!</div><div class="small">2 hopp = dubbelhopp · 3 hopp = flyga i 10 sekunder</div>', 2500);
  const refresh = () => hud.right(`⏱ ${fmtTime(t)} <span style="opacity:.8">💀 ${deaths}</span>`);
  e.on('die', () => { deaths++; refresh(); hud.center('<div style="color:#ff5252">Aj! Försök igen</div>', 800); });
  e.on('checkpoint', () => { cps++; hud.center('<div style="color:#69f0ae">Kontrollpunkt!</div>', 1000); });
  e.on('finish', () => {
    if (done) return; done = true; e.freeze = true; sfx.win();
    const first = !ctx.store.current.records.obby?.wins;
    const reward = first ? 60 : 15 + Math.max(0, 10 - deaths);
    ctx.store.addCoins(reward); ctx.store.bump('obby', 'wins');
    const best = ctx.store.record('obby', 'best', t, (a, b) => a < b);
    hud.panel(`<h3>🏁 Du klarade det!</h3><div>Tid: <b>${fmtTime(t)}</b> ${best ? '· 🆕 Nytt rekord!' : ''}</div><div>Du fick <b>+${reward}</b> mynt ${first ? '(första gången!)' : ''}</div>
      <div class="row"><button class="btn green" id="again">Spela igen</button><button class="btn ghost" id="lobby">Till lobbyn</button></div>`);
    document.getElementById('again').onclick = () => ctx.restart();
    document.getElementById('lobby').onclick = () => ctx.exit();
  });
  e.start((dt) => { if (!done) { t += dt; refresh(); } });
  return e;
}
