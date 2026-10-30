// Mysteriet: som Murder Mystery. En skurk, en sheriff, resten oskyldiga. Du spelar mot sju datorstyrda figurer.
import * as THREE from 'three';
import { Engine, hud, sfx, isTouch } from '../engine.js';
import { buildAvatar, AVATAR_HEIGHT } from '../avatar.js';
import { SKIN_COLORS, CLOTH_COLORS, FACES, HATS } from '../store.js';

// Kartan: # = vägg, . = golv, o = låda, C = myntplats. En ruta = 2 enheter.
const MAP = `
##############################
#......#........#............#
#..C...#...C....#....C.......#
#............................#
#......#........#............#
####.####..#####.#####..######
#.......#..#.........#..#....#
#...C...#..#...o.o...#..#.C..#
#.......#..#.........#..#....#
#..........#.........#..##.###
#.......#..####.######.......#
#########..#.........#.......#
#.........##.........#...C...#
#....C....#....C.............#
#.........##.........#...o...#
####.######.####.#####.#######
#.........#.........#........#
#....C....#...C.....#....C...#
#...................#........#
#.........#.........#........#
##############################`.trim().split('\n');
const T = 2, ROWS = MAP.length, COLS = MAP[0].length;
const wall = (cx, cz) => cx < 0 || cz < 0 || cx >= COLS || cz >= ROWS || MAP[cz][cx] === '#' || MAP[cz][cx] === 'o';
const toTile = (x, z) => [Math.floor(x / T), Math.floor(z / T)];
const toWorld = (cx, cz) => [cx * T + T / 2, cz * T + T / 2];
function los(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / 0.5); for (let i = 1; i < n; i++) { const t = i / n; if (wall(...toTile(ax + (bx - ax) * t, az + (bz - az) * t))) return false; } return true; }
function bfs(from, to) {
  const key = (c) => c[0] + ',' + c[1]; const prev = new Map([[key(from), null]]); const q = [from];
  while (q.length) { const c = q.shift(); if (c[0] === to[0] && c[1] === to[1]) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c[0] + dx, c[1] + dz]; if (wall(...n) || prev.has(key(n))) continue; prev.set(key(n), c); q.push(n); } }
  if (!prev.has(key(to))) return null; const path = []; let c = to; while (c) { path.unshift(c); c = prev.get(key(c)); } return path.slice(1);
}
const floorTiles = []; for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) if (MAP[z][x] === '.' || MAP[z][x] === 'C') floorTiles.push([x, z]);
const coinTiles = floorTiles.filter(([x, z]) => MAP[z][x] === 'C');
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
const NAMES = ['Elsa', 'Lova', 'Liam', 'Maja', 'Adam', 'Alice', 'Omar', 'Vera', 'Hugo', 'Sara', 'Leo', 'Nora', 'Elias', 'Ines', 'Theo'];
const ROLES = {
  innocent: { label: 'Oskyldig', color: '#4caf50', emoji: '🟢', desc: 'Spring och göm dig för skurken. Samla mynt. Hittar du sheriffens pistol kan du plocka upp den!' },
  sheriff: { label: 'Sheriff', color: '#2196f3', emoji: '🔫', desc: 'Du är den enda med pistol. Hitta skurken och skjut! Skjuter du en oskyldig åker du själv ut.' },
  murderer: { label: 'Skurk', color: '#e53935', emoji: '🔪', desc: 'Ta ut alla andra innan tiden går ut. Akta dig för sheriffen!' },
};
const ROUND = 150;

function label(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(30, 8, 196, 48, 14); g.fill();
  g.fillStyle = color; g.fillText(text, 128, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(2.4, 0.6, 1); s.renderOrder = 10; return s;
}
function weaponMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'knife') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.05), new THREE.MeshLambertMaterial({ color: 0xdddddd })); b.position.y = 0.5; g.add(b); const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.12), new THREE.MeshLambertMaterial({ color: 0x4e342e })); g.add(h); }
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.7), new THREE.MeshLambertMaterial({ color: 0x455a64 })); b.position.z = 0.3; g.add(b); const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.14), new THREE.MeshLambertMaterial({ color: 0x263238 })); h.position.y = -0.15; g.add(h); }
  return g;
}

export function start(ctx) {
  const e = new Engine(ctx.container, { sky: 0x2b2d42, fog: false });
  e.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  e.cam.dist = 8; e.camCollide = true; hud.center('');
  // Golv och väggar
  e.ground(COLS * T + 40, -0.5, 0x3e4a5c).mesh.position.set(COLS, -0.5, ROWS);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 }), crateMat = new THREE.MeshLambertMaterial({ color: 0xa1887f });
  for (let z = 0; z < ROWS; z++) { let x = 0; while (x < COLS) { if (MAP[z][x] === '#') { let x2 = x; while (x2 + 1 < COLS && MAP[z][x2 + 1] === '#') x2++; const [wx, wz] = [(x + x2 + 1) / 2 * T, z * T + T / 2]; const b = e.addBox({ x: wx, y: 2, z: wz, w: (x2 - x + 1) * T, h: 4, d: T, color: 0x8d6e63 }); b.mesh.material = wallMat; x = x2 + 1; } else { if (MAP[z][x] === 'o') { const [wx, wz] = toWorld(x, z); e.addBox({ x: wx, y: 0.5, z: wz, w: 1.8, h: 1, d: 1.8 }).mesh.material = crateMat; } x++; } } }
  // Lite färg: mattor i rummen
  for (const [x, z] of coinTiles) { const [wx, wz] = toWorld(x, z); const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 5), new THREE.MeshLambertMaterial({ color: pick([0x7e57c2, 0x26a69a, 0xef5350, 0xffa726]) })); m.position.set(wx, 0.03, wz); m.receiveShadow = true; e.scene.add(m); }
  // Lampor
  for (const [x, z] of coinTiles) { const [wx, wz] = toWorld(x, z); const l = new THREE.PointLight(0xffe0b2, 8, 18); l.position.set(wx, 3.5, wz); e.scene.add(l); }

  // ---------- Figurer ----------
  const chars = []; // {name, mesh, pos, role, alive, bot, path, target, think, label, weapon, revealed, hasGun}
  const randomAvatar = () => ({ skin: pick(SKIN_COLORS), shirt: pick(CLOTH_COLORS), pants: pick(CLOTH_COLORS), face: pick(FACES).id, hat: pick(HATS).id });
  const me = { name: ctx.player.name, bot: false, avatar: ctx.player.avatar };
  const bots = [...NAMES].sort(() => Math.random() - 0.5).slice(0, 7).map(n => ({ name: n, bot: true, avatar: randomAvatar() }));
  let round = 0, time = ROUND, state = 'intro', revealed = false, gunDrop = null, coinsRound = 0, myRole = 'innocent', killer = null;
  const player = e.spawnPlayer(ctx.player.avatar, new THREE.Vector3(3, 0, 3));
  const coins = [];

  function spawnAll() {
    for (const c of chars) { e.scene.remove(c.mesh); }
    chars.length = 0;
    const spots = [...floorTiles].sort(() => Math.random() - 0.5);
    const all = [me, ...bots]; const roles = ['murderer', 'sheriff', ...Array(all.length - 2).fill('innocent')].sort(() => Math.random() - 0.5);
    all.forEach((p, i) => {
      const [wx, wz] = toWorld(...spots[i]);
      const c = { ...p, role: roles[i], alive: true, path: [], target: null, think: Math.random(), revealed: false, hasGun: roles[i] === 'sheriff', hunting: false, aim: 0, cooldown: roles[i] === 'murderer' ? 12 : 0, speed: roles[i] === 'murderer' ? 7.0 : 6.3 };
      if (p.bot) { c.mesh = buildAvatar(p.avatar); c.pos = new THREE.Vector3(wx, 0, wz); c.mesh.position.copy(c.pos); e.scene.add(c.mesh); }
      else { c.mesh = player.mesh; c.pos = player.pos; player.pos.set(wx, 0, wz); player.spawn.copy(player.pos); player.vel.set(0, 0, 0); myRole = c.role; }
      c.label = label(c.name, '#ffffff'); c.label.position.y = AVATAR_HEIGHT + 0.6; c.mesh.add(c.label); if (!p.bot) c.label.visible = false;
      c.weapon = weaponMesh(c.role === 'murderer' ? 'knife' : 'gun'); c.weapon.visible = c.hasGun; c.weapon.position.set(1.7 * 0.46 * 2.1, 2.9 * 0.46 * 2.1, 0.5); c.weapon.scale.setScalar(1 / 0.46); c.mesh.userData.body.add(c.weapon);
      setGhost(c, false);
      chars.push(c);
    });
    // Mynt
    for (const c of coins) e.scene.remove(c.mesh); coins.length = 0;
    for (const [x, z] of floorTiles.sort(() => Math.random() - 0.5).slice(0, 26)) { const [wx, wz] = toWorld(x, z); coins.push({ mesh: null, x: wx, z: wz, taken: false, ...(() => { const m = e.addCoin(wx + rnd(-0.5, 0.5), 1, wz + rnd(-0.5, 0.5)); return { mesh: m.mesh, c: m }; })() }); }
    if (gunDrop) { e.scene.remove(gunDrop.mesh); gunDrop = null; }
    revealed = false; coinsRound = 0; time = ROUND; killer = null;
  }
  function setGhost(c, ghost) { c.mesh.traverse(o => { if (o.material && !o.isSprite) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.transparent = ghost; m.opacity = ghost ? 0.3 : 1; }); }); if (c.label) c.label.material.opacity = ghost ? 0.4 : 1; }
  const meC = () => chars.find(c => !c.bot);
  const alive = () => chars.filter(c => c.alive);
  const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
  const canSee = (a, b) => los(a.pos.x, a.pos.z, b.pos.x, b.pos.z);

  function poof(pos, color) { for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color })); m.position.set(pos.x, pos.y + 1.2, pos.z); m.userData.v = new THREE.Vector3(rnd(-4, 4), rnd(2, 8), rnd(-4, 4)); m.userData.life = 0.9; e.scene.add(m); parts.push(m); } }
  const parts = [];
  function eliminate(victim, by) {
    if (!victim.alive) return; victim.alive = false; sfx.die(); poof(victim.pos, 0xffffff);
    victim.weapon.visible = false; setGhost(victim, true);
    if (victim.hasGun) { victim.hasGun = false; const g = weaponMesh('gun'); g.position.set(victim.pos.x, 0.5, victim.pos.z); g.rotation.x = Math.PI / 2; e.scene.add(g); gunDrop = { mesh: g, x: victim.pos.x, z: victim.pos.z }; hud.center('<div class="small">Sheriffens pistol ligger på golvet!</div>', 2500); }
    if (by.role === 'murderer') { // vittnen avslöjar skurken
      for (const w of alive()) if (w !== by && dist(w, by) < 14 && canSee(w, by)) reveal(by);
    }
    if (!victim.bot) { hud.center(`<div style="color:#ff5252">Du åkte ut!</div><div class="small">Du är ett spöke nu. Titta på resten av rundan.</div>`, 3000); }
    checkEnd();
  }
  function reveal(m) { if (revealed) return; revealed = true; m.revealed = true; m.label.material.map = label(m.name + ' 🔪', '#ff5252').material.map; hud.center(`<div style="color:#ff5252">🔪 Skurken är avslöjad: ${m.name}!</div>`, 2500); sfx.check(); }
  function shoot(shooter, target) {
    sfx.remove(); shooter.aim = 0;
    if (!target) return;
    if (target.role === 'murderer') { eliminate(target, shooter); killer = shooter; }
    else { eliminate(target, shooter); if (shooter.alive) { hud.center(shooter.bot ? `<div class="small">${shooter.name} sköt en oskyldig och åkte ut!</div>` : `<div style="color:#ff5252">Oj! Det var en oskyldig…</div>`, 2500); eliminate(shooter, shooter); } }
  }
  function stab(m, target) { if (dist(m, target) < 2.4) eliminate(target, m); }

  // ---------- Rundor ----------
  function startRound() {
    round++; spawnAll(); state = 'intro'; e.freeze = true;
    const r = ROLES[myRole];
    hud.panel(`<h3>Runda ${round}</h3><div style="font-size:14px;color:var(--muted)">Du är…</div><div style="font-size:34px;font-weight:900;color:${r.color};margin:6px 0">${r.emoji} ${r.label}</div><div style="max-width:320px;margin:0 auto">${r.desc}</div><div class="row"><button class="btn green" id="go">Kör!</button></div>`);
    document.getElementById('go').onclick = () => { hud.panel(null); state = 'play'; e.freeze = false; renderHud(); };
    renderTools();
  }
  function renderTools() {
    const c = meC(); const canAct = c && c.alive && (c.role === 'murderer' || c.hasGun);
    const t = hud.tools(canAct ? `<button class="hud-btn" id="act" style="width:96px;height:96px;border-radius:50%;font-size:15px;background:${c.role === 'murderer' ? '#e53935' : '#2196f3'};position:fixed;right:${isTouch ? '140px' : '20px'};bottom:${isTouch ? '60px' : '110px'}">${c.role === 'murderer' ? '🔪 Hugg' : '🔫 Skjut'}</button>` : '');
    const b = t.querySelector('#act'); if (b) b.onpointerdown = (ev) => { ev.preventDefault(); act(); };
  }
  function act() {
    const c = meC(); if (!c || !c.alive || state !== 'play') return;
    const f = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    const camF = new THREE.Vector3(-Math.sin(e.cam.yaw), 0, -Math.cos(e.cam.yaw));
    if (c.role === 'murderer') {
      c.weapon.visible = true; setTimeout(() => { if (c.alive) c.weapon.visible = false; }, 700);
      let best = null; for (const o of alive()) { if (o === c) continue; const d = dist(c, o); if (d > 2.4) continue; const v = new THREE.Vector3(o.pos.x - c.pos.x, 0, o.pos.z - c.pos.z).normalize(); if (v.dot(f) > 0.2 || d < 1.2) best = o; }
      if (best) stab(c, best); else sfx.place();
    } else if (c.hasGun) {
      let best = null, bestA = 0.9; for (const o of alive()) { if (o === c) continue; const d = dist(c, o); if (d > 26 || !canSee(c, o)) continue; const v = new THREE.Vector3(o.pos.x - c.pos.x, 0, o.pos.z - c.pos.z).normalize(); const a = v.dot(camF); if (a > bestA) { bestA = a; best = o; } }
      shoot(c, best); if (!best) hud.center('<div class="small">Bom! Sikta med kameran mot skurken.</div>', 1200);
    }
  }
  function renderHud() {
    const c = meC(); const r = ROLES[c.role]; const a = alive().length;
    hud.right(`<span style="background:${r.color};padding:3px 10px;border-radius:999px">${r.emoji} ${c.hasGun && c.role === 'innocent' ? 'Hjälte' : r.label}</span> ⏱ ${Math.ceil(time)} · 👤 ${a} · 🪙 ${coinsRound}`);
  }
  function checkEnd() {
    if (state !== 'play') return;
    const m = chars.find(c => c.role === 'murderer'); const others = alive().filter(c => c.role !== 'murderer');
    if (!m.alive) endRound('sheriff'); else if (others.length === 0) endRound('murderer'); else if (time <= 0) endRound('time');
  }
  function endRound(who) {
    state = 'end'; e.freeze = true; sfx.win();
    const c = meC(); const m = chars.find(x => x.role === 'murderer');
    let reward = coinsRound, lines = [];
    if (who === 'murderer') { lines.push(`🔪 Skurken ${m.name} tog alla!`); if (c.role === 'murderer') reward += 25; }
    else if (who === 'sheriff') { lines.push(`🔫 ${killer?.name || 'Sheriffen'} sköt skurken ${m.name}!`); if (killer === c) reward += 30; else if (c.alive) reward += 10; }
    else { lines.push(`⏰ Tiden gick ut. Skurken var ${m.name}.`); if (c.alive && c.role !== 'murderer') reward += 15; }
    if (c.alive && c.role !== 'murderer' && who !== 'murderer') lines.push('Du överlevde!');
    ctx.store.addCoins(reward); ctx.store.bump('mystery', 'rounds'); if (who !== 'murderer' && c.alive && c.role !== 'murderer' || who === 'murderer' && c.role === 'murderer' || killer === c) ctx.store.bump('mystery', 'wins');
    hud.tools(null);
    hud.panel(`<h3>${who === 'murderer' ? '🔪' : who === 'sheriff' ? '🔫' : '⏰'} Rundan är slut</h3><div>${lines.join('<br>')}</div><div style="margin-top:8px">Du fick <b>+${reward}</b> mynt</div>
      <div class="row"><button class="btn green" id="next">Nästa runda</button><button class="btn ghost" id="lobby">Lobbyn</button></div>`);
    document.getElementById('next').onclick = () => startRound();
    document.getElementById('lobby').onclick = () => ctx.exit();
  }

  // ---------- Bot-AI ----------
  function botThink(c, dt) {
    c.think -= dt; const m = chars.find(x => x.role === 'murderer');
    const sheriff = alive().find(x => x.hasGun);
    if (c.role === 'murderer') {
      const targets = alive().filter(x => x !== c);
      c.cooldown -= dt;
      if (c.cooldown > 0) { // låtsas vara oskyldig en stund: vandra runt utan kniv
        c.hunting = false; c.weapon.visible = false;
        if (!c.path.length || c.think <= 0) { c.path = bfs(toTile(c.pos.x, c.pos.z), pick(floorTiles)) || []; c.think = rnd(2, 4); }
        return;
      }
      if (sheriff && dist(c, sheriff) < 11 && canSee(c, sheriff) && Math.random() < 0.7) { // fly från sheriffen
        if (c.think <= 0) { c.target = pick(floorTiles.filter(t => { const [wx, wz] = toWorld(...t); return Math.hypot(wx - sheriff.pos.x, wz - sheriff.pos.z) > 16; })); c.path = bfs(toTile(c.pos.x, c.pos.z), c.target) || []; c.think = 1.5; }
        c.hunting = false;
      } else if (targets.length) {
        let best = null, bd = 1e9; for (const t of targets) { const d = dist(c, t) + (t.hasGun ? 6 : 0); if (d < bd) { bd = d; best = t; } }
        c.hunting = dist(c, best) < 9 && canSee(c, best);
        if (c.think <= 0) { c.path = bfs(toTile(c.pos.x, c.pos.z), toTile(best.pos.x, best.pos.z)) || []; c.think = c.hunting ? 0.3 : 1.0; }
        if (dist(c, best) < 1.8 && canSee(c, best)) { c.weapon.visible = true; stab(c, best); c.think = 0.6; c.cooldown = rnd(7, 11); }
      }
      c.weapon.visible = c.hunting || c.weapon.visible && c.think > 0.3;
      return;
    }
    // Sheriff / hjälte: skjut skurken om avslöjad och synlig
    if (c.hasGun && m.alive && (revealed || (m.hunting && dist(c, m) < 8 && canSee(c, m))) && dist(c, m) < 20 && canSee(c, m)) {
      c.aim += dt; if (c.aim > 1.1) { const hit = Math.random() < 0.65; shoot(c, hit ? m : null); } c.path = []; return;
    }
    c.aim = Math.max(0, c.aim - dt);
    // Oskyldiga: fly från avslöjad/jagande skurk
    const danger = m.alive && m !== c && (revealed || m.hunting) && dist(c, m) < 12 && canSee(c, m);
    if (danger) { if (c.think <= 0) { c.target = pick(floorTiles.filter(t => { const [wx, wz] = toWorld(...t); return Math.hypot(wx - m.pos.x, wz - m.pos.z) > 18; })); c.path = bfs(toTile(c.pos.x, c.pos.z), c.target) || []; c.think = 1.2; } return; }
    // Plocka upp pistol
    if (gunDrop && !c.hasGun && Math.hypot(gunDrop.x - c.pos.x, gunDrop.z - c.pos.z) < 14 && c.think <= 0) { c.path = bfs(toTile(c.pos.x, c.pos.z), toTile(gunDrop.x, gunDrop.z)) || []; c.think = 1.0; return; }
    // Vandra, gärna mot mynt
    if (!c.path.length || c.think <= 0) {
      const near = coins.filter(x => !x.c.taken && Math.hypot(x.x - c.pos.x, x.z - c.pos.z) < 12);
      const t = near.length && Math.random() < 0.6 ? toTile(pick(near).x, pick(near).z) : pick(floorTiles);
      c.path = bfs(toTile(c.pos.x, c.pos.z), t) || []; c.think = rnd(2, 4);
    }
  }
  function botMove(c, dt) {
    if (!c.path.length) return;
    const [wx, wz] = toWorld(...c.path[0]); const dx = wx - c.pos.x, dz = wz - c.pos.z; const d = Math.hypot(dx, dz);
    if (d < 0.25) { c.path.shift(); return; }
    const sp = c.speed * dt; c.pos.x += dx / d * Math.min(sp, d); c.pos.z += dz / d * Math.min(sp, d);
    c.mesh.position.copy(c.pos); c.mesh.rotation.y = Math.atan2(dx, dz);
    const u = c.mesh.userData; const s = Math.sin(e.time * 11); u.legL.rotation.x = s * 0.7; u.legR.rotation.x = -s * 0.7; u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7;
  }

  // ---------- Loop ----------
  hud.title('Noahs Murder Mysteri');
  hud.bottom(isTouch ? 'Vänster: gå · Höger: titta · Hoppa · Stora knappen: hugg/skjut' : 'WASD: gå · Mus: titta · Mellanslag: hoppa · Klick eller F: hugg/skjut');
  const keyF = (ev) => { if (ev.key.toLowerCase() === 'f') act(); }; addEventListener('keydown', keyF);
  startRound();
  e.start((dt) => {
    for (const m of [...parts]) { m.position.addScaledVector(m.userData.v, dt); m.userData.v.y -= 15 * dt; m.userData.life -= dt; if (m.userData.life <= 0) { e.scene.remove(m); parts.splice(parts.indexOf(m), 1); } }
    if (state !== 'play') return;
    for (const click of e.input.takeClicks()) if (click.button === 0 && !isTouch) act();
    time -= dt; if (time <= 0) { time = 0; checkEnd(); }
    const c = meC();
    for (const b of chars) if (b.bot && b.alive) { botThink(b, dt); botMove(b, dt); }
    // mynt till bottar och spelare
    for (const coin of coins) if (!coin.c.taken) for (const ch of alive()) if (Math.abs(coin.x - ch.pos.x) < 1 && Math.abs(coin.z - ch.pos.z) < 1) { coin.c.taken = true; e.scene.remove(coin.c.mesh); if (ch === c) { coinsRound++; ctx.store.addCoins(1); sfx.coin(); } }
    // plocka upp pistolen
    if (gunDrop) for (const ch of alive()) if (ch.role !== 'murderer' && !ch.hasGun && Math.hypot(gunDrop.x - ch.pos.x, gunDrop.z - ch.pos.z) < 1.3) { ch.hasGun = true; ch.weapon.visible = true; e.scene.remove(gunDrop.mesh); gunDrop = null; sfx.check(); hud.center(`<div class="small">${ch === c ? 'Du' : ch.name} plockade upp pistolen!</div>`, 2000); if (ch === c) renderTools(); }
    if (c.alive && c.role !== 'murderer' && !c.hasGun) c.weapon.visible = false;
    if (c.role === 'murderer' && c.alive) { /* kniven syns när man hugger */ }
    for (const ch of chars) if (ch.label) ch.label.quaternion.copy(e.camera.quaternion);
    renderHud();
    if (Math.floor(time) !== Math.floor(time + dt)) checkEnd();
  });
  const base = e.dispose.bind(e);
  e.dispose = () => { removeEventListener('keydown', keyF); base(); };
  return e;
}
