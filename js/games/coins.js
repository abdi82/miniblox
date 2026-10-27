// Myntjakten: samla så många mynt du hinner på 60 sekunder.
import * as THREE from 'three';
import { Engine, hud, sfx, fmtTime } from '../engine.js';

export function start(ctx) {
  const e = new Engine(ctx.container, { sky: 0x8ecae6 });
  e.ground(80, -0.5, 0x7cb342);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const palette = [0x4fc3f7, 0xffb74d, 0xba68c8, 0xf06292, 0xaed581];
  // Torn med trappor
  const towers = [[18, 18], [-18, 18], [18, -18], [-18, -18], [0, 24], [0, -24], [26, 0], [-26, 0]];
  towers.forEach(([tx, tz], ti) => {
    const steps = 3 + (ti % 3);
    for (let s = 0; s < steps; s++) e.addBox({ x: tx, y: (s + 1) * 1.0, z: tz + s * 3 - steps * 1.5, w: 4, h: (s + 1) * 2.0, d: 3, color: palette[ti % palette.length] });
    e.addCoin(tx, steps * 2.0 + 1.2, tz + (steps - 1) * 3 - steps * 1.5);
    e.addCoin(tx, steps * 2.0 + 1.2, tz + (steps - 1) * 3 - steps * 1.5 + 2.2);
  });
  // Lådor att hoppa på
  for (let k = 0; k < 14; k++) { const s = rnd(2, 4); e.addBox({ x: rnd(-30, 30), y: s / 2, z: rnd(-30, 30), w: s, h: s, d: s, color: palette[k % palette.length] }); }
  // Mynt på marken och i luften
  for (let k = 0; k < 40; k++) e.addCoin(rnd(-34, 34), rnd(0, 1) > 0.7 ? 3.4 : 1.2, rnd(-34, 34));
  // Några mynt i en ring runt starten
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; e.addCoin(Math.cos(a) * 7, 1.2, Math.sin(a) * 7); }
  // Staket (osynlig vägg) så ingen ramlar av
  const W = 40; [[W, 0, 1, 80], [-W, 0, 1, 80], [0, W, 80, 1], [0, -W, 80, 1]].forEach(([x, z, w, d]) => { const b = e.addBox({ x, y: 4, z, w, h: 8, d }); b.mesh.visible = false; });

  e.spawnPlayer(ctx.player.avatar, new THREE.Vector3(0, 0, 0));
  const TOTAL = 60; let left = TOTAL, score = 0, done = false;
  const total = e.coins.length;
  hud.title('Myntjakten');
  hud.bottom(ctx.touch ? 'Vänster: gå · Höger: titta · Hoppa-knappen' : 'WASD: gå · Mellanslag: hoppa · Dra med musen: titta');
  hud.center(`<div>Samla mynt!</div><div class="small">Du har ${TOTAL} sekunder</div>`, 2200);
  const refresh = () => hud.right(`<span class="coin-icon"></span> ${score}/${total} &nbsp; ⏱ ${Math.ceil(left)}`);
  refresh();
  e.on('coin', () => { score++; refresh(); if (score === total) finish(); });
  function finish() {
    if (done) return; done = true; e.freeze = true; sfx.win();
    const reward = score + (score === total ? 25 : 0);
    ctx.store.addCoins(reward); ctx.store.bump('coins', 'plays');
    const best = ctx.store.record('coins', 'best', score);
    hud.panel(`<h3>${score === total ? '🌟 Alla mynt!' : '⏰ Tiden är ute!'}</h3><div>Du samlade <b>${score}</b> av ${total} mynt ${best ? '· 🆕 Nytt rekord!' : ''}</div><div>Du fick <b>+${reward}</b> mynt</div>
      <div class="row"><button class="btn green" id="again">Spela igen</button><button class="btn ghost" id="lobby">Till lobbyn</button></div>`);
    document.getElementById('again').onclick = () => ctx.restart();
    document.getElementById('lobby').onclick = () => ctx.exit();
  }
  e.start((dt) => { if (done) return; left -= dt; refresh(); if (left <= 0) { left = 0; finish(); } });
  return e;
}
