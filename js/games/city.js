// Stadsbyggaren: ett litet SimCity för barn. Bygg vägar, bostäder, butiker, fabriker och parker på ett rutnät.
// Byggnader växer i nivåer när de har väg och rätt grannar, skatt kommer in varje dag och små bilar kör på vägarna.
// Inspirerat av Dan Greenhecks "simcity-threejs-clone" (github.com/dgreenheck/simcity-threejs-clone, MIT-licens,
// Copyright (c) 2023 Daniel Greenheck): idén med zoner som utvecklas i steg, vägåtkomst inom några rutor,
// boende/jobb som styr tillväxten och bilar som väljer slumpmässig nästa väg. Koden här är skriven från grunden
// för vår egen motor och HUD.
import * as THREE from 'three';
import { Engine, hud, sfx } from '../engine.js';

const N = 24, CELL = 2, HALF = N / 2; // 24x24 rutor, 2 enheter var
const SIM_STEP = 1, DAY_STEPS = 10; // simulering varje sekund, en dag = 10 sekunder
const START_MONEY = 500;
const TOOLS = [
  { id: 'r', label: 'Väg', emoji: '🛣️', cost: 10 },
  { id: 'h', label: 'Bostad', emoji: '🏠', cost: 50 },
  { id: 's', label: 'Butik', emoji: '🏪', cost: 80 },
  { id: 'f', label: 'Fabrik', emoji: '🏭', cost: 120 },
  { id: 'p', label: 'Park', emoji: '🌳', cost: 30 },
  { id: 'x', label: 'Riv', emoji: '🧨', cost: 0 },
];
const NAMES = { r: 'Väg', h: 'Bostad', s: 'Butik', f: 'Fabrik', p: 'Park' };
const CAP = [0, 4, 10, 20]; // invånare per bostad, per nivå
const JOBS = { s: [0, 3, 8, 16], f: [0, 5, 12, 25] }; // jobb per butik/fabrik, per nivå
const TAX = { s: 10, f: 15, pop: 2 }; // kronor per dag: per nivå för butik/fabrik, per invånare för bostad
const HOUSE_COLORS = [0xfff3b0, 0xffccbc, 0xc8e6c9, 0xbbdefb, 0xe1bee7, 0xffe0b2, 0xf8bbd0, 0xffffff];

// ---------- Delade geometrier, material och texturer ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(0.74, 0.6, 4),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  tree: new THREE.ConeGeometry(0.34, 0.8, 7),
};
const MATS = new Map();
const mat = (c) => { if (!MATS.has(c)) MATS.set(c, new THREE.MeshLambertMaterial({ color: c })); return MATS.get(c); };
const TEX = new Map();
// Väggtextur med fönster: wall = färg, floors = antal våningar, cols = fönster per våning
function wallMat(wall, floors, cols = 3, glass = '#bbdefb') {
  const key = `${wall}/${floors}/${cols}/${glass}`;
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = 64; c.height = 32 * floors; const x = c.getContext('2d');
  x.fillStyle = '#' + wall.toString(16).padStart(6, '0'); x.fillRect(0, 0, c.width, c.height);
  const w = 64 / cols;
  for (let f = 0; f < floors; f++) for (let i = 0; i < cols; i++) {
    x.fillStyle = '#5d6a75'; x.fillRect(i * w + w * 0.22 - 1, f * 32 + 7, w * 0.56 + 2, 16);
    x.fillStyle = glass; x.fillRect(i * w + w * 0.22, f * 32 + 8, w * 0.56, 14);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  const m = new THREE.MeshLambertMaterial({ map: t }); TEX.set(key, m); return m;
}
// Lägg till en del i en grupp: geometri, material, position, skala och vridning
function part(g, geo, m, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, shadow = true) {
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.y = ry;
  mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); return mesh;
}
// Låda med fönster på sidorna och enfärgat tak
function building(g, w, h, d, wall, floors, roof, cols = 3, glass) {
  const side = wallMat(wall, floors, cols, glass), top = mat(roof);
  const mesh = new THREE.Mesh(G.box, [side, side, top, top, side, side]); mesh.scale.set(w, h, d); mesh.position.y = h / 2;
  mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
}
const hash = (x, z, k = 0) => { let h = (x * 374761393 + z * 668265263 + k * 97) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

// ---------- Utseende per ruta ----------
function buildRoad(g, conns) {
  part(g, G.box, mat(0x4a4f55), 0, 0.06, 0, CELL, 0.12, CELL, 0, false);
  const line = mat(0xffd54f); let any = false;
  for (const [dx, dz] of conns) { any = true; part(g, G.box, line, dx * CELL / 4, 0.13, dz * CELL / 4, dx ? CELL / 2 : 0.1, 0.02, dz ? CELL / 2 : 0.1, 0, false); }
  if (!any) part(g, G.box, line, 0, 0.13, 0, 0.3, 0.02, 0.3, 0, false);
}
function buildZoneSlab(g, type, state, x, z) {
  const tint = { h: 0xaed581, s: 0x90caf9, f: 0xffe082 }[type];
  part(g, G.box, mat(state === 1 ? 0xa1887f : tint), 0, 0.03, 0, CELL * 0.92, 0.06, CELL * 0.92, 0, false);
  if (state === 1) { // bygge: fyra stolpar och en ställning
    const wood = mat(0xffb300);
    for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) part(g, G.box, wood, sx, 0.5, sz, 0.1, 1, 0.1);
    part(g, G.box, wood, 0, 1, 0, 1.3, 0.08, 0.08); part(g, G.box, wood, 0, 1, 0, 0.08, 0.08, 1.3);
    part(g, G.box, mat(0x8d6e63), 0, 0.2, 0, 0.8 + hash(x, z) * 0.3, 0.3, 0.7);
  } else part(g, G.box, mat(0xffffff), 0.7, 0.4, 0.7, 0.06, 0.8, 0.06, 0, false); // liten skylt
}
function buildHouse(g, level, color, ry) {
  const roof = [0xc62828, 0x6d4c41, 0x37474f, 0x1565c0][Math.floor(hash(color, level) * 4)];
  if (level === 1) {
    building(g, 1.2, 0.9, 1.2, color, 1, 0xdddddd, 2); const r = part(g, G.roof, mat(roof), 0, 1.2, 0, 1.15, 1, 1.15, Math.PI / 4);
    part(g, G.box, mat(0x6d4c41), 0, 0.3, 0.61, 0.3, 0.6, 0.04); r.castShadow = true;
  } else if (level === 2) {
    building(g, 1.4, 1.7, 1.4, color, 2, 0xdddddd, 2); part(g, G.roof, mat(roof), 0, 2.0, 0, 1.35, 1, 1.35, Math.PI / 4);
    part(g, G.box, mat(0x6d4c41), 0, 0.35, 0.71, 0.32, 0.7, 0.04); part(g, G.box, mat(0x8d6e63), 0.45, 2.2, -0.3, 0.2, 0.5, 0.2);
  } else {
    building(g, 1.6, 2.8, 1.6, color, 3, 0x78909c, 3); part(g, G.box, mat(0x90a4ae), 0, 2.95, 0, 1.7, 0.3, 1.7);
    part(g, G.box, mat(0x546e7a), 0.4, 3.3, 0.3, 0.5, 0.4, 0.5); part(g, G.box, mat(0x6d4c41), 0, 0.45, 0.81, 0.5, 0.9, 0.04);
  }
  g.rotation.y = ry;
}
function buildShop(g, level) {
  if (level === 1) {
    building(g, 1.5, 0.9, 1.5, 0x81d4fa, 1, 0xeceff1, 3, '#fff8e1'); part(g, G.box, mat(0xff7043), 0, 0.72, 0.85, 1.5, 0.06, 0.45, 0, false);
    part(g, G.box, mat(0xffeb3b), 0, 1.05, 0.3, 0.9, 0.3, 0.1);
  } else if (level === 2) {
    building(g, 1.6, 1.6, 1.6, 0x4fc3f7, 2, 0xeceff1, 3, '#fff8e1'); part(g, G.box, mat(0xff7043), 0, 0.75, 0.9, 1.6, 0.06, 0.45, 0, false);
    part(g, G.box, mat(0xffeb3b), 0, 1.85, 0, 1.3, 0.4, 0.15); part(g, G.box, mat(0xe53935), 0, 1.85, 0.09, 0.3, 0.3, 0.02, 0, false);
  } else {
    building(g, 1.7, 2.6, 1.7, 0x29b6f6, 4, 0xb0bec5, 4, '#e1f5fe'); part(g, G.box, mat(0xff7043), 0, 0.8, 0.95, 1.7, 0.06, 0.45, 0, false);
    part(g, G.box, mat(0xffeb3b), 0, 2.95, 0, 1.4, 0.5, 0.15); part(g, G.box, mat(0xe53935), 0, 2.95, 0.09, 0.4, 0.4, 0.02, 0, false);
    part(g, G.box, mat(0x546e7a), -0.5, 2.75, -0.5, 0.3, 0.3, 0.3);
  }
}
function buildFactory(g, level, smoke) {
  const chim = mat(0x616161), gray = [0xa4a4a4, 0x9e9e9e, 0x8d8d8d][level - 1];
  const w = [1.5, 1.7, 1.8][level - 1], h = [0.8, 1.2, 1.8][level - 1];
  building(g, w, h, w, gray, Math.max(1, level - 1), 0x757575, 2, '#ffe082');
  part(g, G.box, mat(0xff9800), 0, h - 0.15, 0, w + 0.02, 0.12, w + 0.02, 0, false); // orange rand
  const chimneys = [[0.5, -0.5], [-0.5, -0.5], [0.5, 0.5]].slice(0, level);
  for (const [cx, cz] of chimneys) {
    part(g, G.cyl, chim, cx, h + 0.5, cz, 0.14, 1.1, 0.14);
    if (level >= 2) for (let i = 0; i < 3; i++) { const s = part(g, G.sphere, mat(0xcfd8dc), cx, h + 1.1, cz, 0.12, 0.12, 0.12, 0, false); smoke.push({ m: s, t: i / 3, cx, cz, y: h + 1.1 }); }
  }
}
function buildPark(g, x, z) {
  part(g, G.box, mat(0x81c784), 0, 0.03, 0, CELL * 0.96, 0.06, CELL * 0.96, 0, false);
  const trunk = mat(0x6d4c41), leaf = [mat(0x2e7d32), mat(0x388e3c), mat(0x43a047)];
  const n = 2 + Math.floor(hash(x, z, 1) * 2);
  for (let i = 0; i < n; i++) {
    const px = (hash(x, z, 2 + i) - 0.5) * 1.3, pz = (hash(x, z, 9 + i) - 0.5) * 1.3, s = 0.8 + hash(x, z, 20 + i) * 0.5;
    part(g, G.cyl, trunk, px, 0.2 * s, pz, 0.07, 0.4 * s, 0.07); part(g, G.tree, leaf[i % 3], px, 0.75 * s, pz, s, s, s);
  }
  if (hash(x, z, 5) < 0.4) part(g, G.cyl, mat(0x4fc3f7), (hash(x, z, 6) - 0.5) * 0.8, 0.06, (hash(x, z, 7) - 0.5) * 0.8, 0.35, 0.03, 0.3, 0, false);
  else part(g, G.box, mat(0x8d6e63), (hash(x, z, 6) - 0.5) * 0.8, 0.15, (hash(x, z, 7) - 0.5) * 0.8, 0.5, 0.08, 0.2); // bänk
}
function buildMarker(g) { // rött utropstecken: saknar väg
  const red = mat(0xe53935); const m = new THREE.Group();
  part(m, G.box, red, 0, 0.45, 0, 0.14, 0.5, 0.14, 0, false); part(m, G.box, red, 0, 0.05, 0, 0.14, 0.14, 0.14, 0, false);
  m.position.y = 2.4; g.add(m); return m;
}

export function start(ctx) {
  const e = new Engine(ctx.container, { sky: 0xbbdefb, fog: false });
  // Mark, platta och rutnät
  const ground = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400), mat(0x8bc34a)); ground.position.y = -0.8; ground.receiveShadow = true; e.scene.add(ground);
  const base = new THREE.Mesh(new THREE.BoxGeometry(N * CELL, 0.4, N * CELL), mat(0xa5d66f)); base.position.y = -0.2; base.receiveShadow = true; e.scene.add(base);
  const grid = new THREE.GridHelper(N * CELL, N, 0x3e6b22, 0x6a9a3f); grid.position.y = 0.01; e.scene.add(grid);
  const cityRoot = new THREE.Group(); e.scene.add(cityRoot);

  // ---------- Stadens data ----------
  const saved = ctx.store.current.city;
  const city = { money: START_MONEY, day: 1, step: 0, rewarded: 0, tiles: new Map() }; // tiles: "x,z" -> { t, l, st, pop, c, bt, nr, g, sig }
  const key = (x, z) => `${x},${z}`;
  const at = (x, z) => city.tiles.get(key(x, z));
  const inside = (x, z) => x >= 0 && x < N && z >= 0 && z < N;
  const center = (x, z) => [(x - HALF + 0.5) * CELL, (z - HALF + 0.5) * CELL];
  function save() {
    const tiles = {}; for (const [k, t] of city.tiles) tiles[k] = [t.t, t.l, t.st, t.pop, t.c];
    ctx.store.update(p => { p.city = { v: 1, money: city.money, day: city.day, step: city.step, rewarded: city.rewarded, tiles }; });
  }
  function setTile(x, z, t, l = 1, st = 0, pop = 0, c = Math.floor(Math.random() * HOUSE_COLORS.length)) {
    const old = at(x, z); if (old) { cityRoot.remove(old.g); city.tiles.delete(key(x, z)); }
    if (!t) { refreshAround(x, z); return null; }
    const g = new THREE.Group(); const [cx, cz] = center(x, z); g.position.set(cx, 0, cz); cityRoot.add(g);
    const tile = { x, z, t, l, st: t === 'r' || t === 'p' ? 2 : st, pop, c, bt: 0, nr: 0, g, sig: '', smoke: [] };
    city.tiles.set(key(x, z), tile); refresh(tile); refreshAround(x, z); return tile;
  }
  function refreshAround(x, z) { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(x + dx, z + dz); if (n && n.t === 'r') refresh(n); } }
  function refresh(tile) {
    const conns = tile.t === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => at(tile.x + dx, tile.z + dz)?.t === 'r') : [];
    const sig = [tile.t, tile.l, tile.st, conns.map(c => c.join('')).join('|'), tile.nr > 2].join('/');
    if (sig === tile.sig) return; tile.sig = sig;
    const g = tile.g; while (g.children.length) g.remove(g.children[0]); g.rotation.y = 0; tile.smoke = []; tile.marker = null;
    if (tile.t === 'r') buildRoad(g, conns);
    else if (tile.t === 'p') buildPark(g, tile.x, tile.z);
    else if (tile.st < 2) buildZoneSlab(g, tile.t, tile.st, tile.x, tile.z);
    else if (tile.t === 'h') buildHouse(g, tile.l, HOUSE_COLORS[tile.c % HOUSE_COLORS.length], Math.floor(hash(tile.x, tile.z, 3) * 4) * Math.PI / 2);
    else if (tile.t === 's') buildShop(g, tile.l);
    else if (tile.t === 'f') buildFactory(g, tile.l, tile.smoke);
    if (tile.nr > 2 && tile.t !== 'r' && tile.t !== 'p') tile.marker = buildMarker(g);
  }
  // Ladda sparad stad, annars en liten startväg
  if (saved && saved.tiles) {
    Object.assign(city, { money: saved.money ?? START_MONEY, day: saved.day ?? 1, step: saved.step ?? 0, rewarded: saved.rewarded ?? 0 });
    for (const [k, v] of Object.entries(saved.tiles)) { const [x, z] = k.split(',').map(Number); if (inside(x, z)) setTile(x, z, v[0], v[1], v[2], v[3], v[4]); }
  } else for (let x = HALF - 3; x < HALF + 3; x++) setTile(x, HALF, 'r');

  // ---------- Statistik ----------
  const stats = { pop: 0, jobs: 0, houses: 0, shops: 0, factories: 0 };
  function recount() {
    stats.pop = 0; stats.jobs = 0; stats.houses = 0; stats.shops = 0; stats.factories = 0;
    for (const t of city.tiles.values()) {
      if (t.t === 'h') { stats.houses++; stats.pop += t.pop; }
      if (t.st === 2 && (t.t === 's' || t.t === 'f')) stats.jobs += JOBS[t.t][t.l];
      if (t.t === 's') stats.shops++; if (t.t === 'f') stats.factories++;
    }
  }
  function showHud() { hud.right(`💰 ${city.money} kr · 👥 ${stats.pop} · 📅 Dag ${city.day}`); }

  // ---------- Verktyg ----------
  let tool = 'r';
  function renderTools() {
    const t = hud.tools(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${TOOLS.map(x => `<button class="hud-btn" data-t="${x.id}" style="min-width:70px;min-height:52px;line-height:1.15;${tool === x.id ? 'outline:3px solid #fff;background:#335fff' : ''}${x.cost > city.money ? 'opacity:.55' : ''}">${x.emoji} ${x.label}<br><small style="font-weight:600">${x.cost ? x.cost + ' kr' : 'gratis'}</small></button>`).join('')}</div>
      <div style="display:flex;gap:6px"><button class="hud-btn" id="t-zin" style="min-width:48px">➕</button><button class="hud-btn" id="t-zout" style="min-width:48px">➖</button><button class="hud-btn" id="t-new" style="opacity:.8">Ny stad</button></div>`);
    t.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tool = b.dataset.t; renderTools(); hud.bottom(tool === 'x' ? 'Tryck på något för att riva det' : `Tryck på en ruta för att bygga ${NAMES[tool].toLowerCase()}`); });
    t.querySelector('#t-zin').onclick = () => { e.cam.dist = Math.max(14, e.cam.dist - 6); };
    t.querySelector('#t-zout').onclick = () => { e.cam.dist = Math.min(80, e.cam.dist + 6); };
    const nw = t.querySelector('#t-new');
    nw.onclick = () => {
      if (nw.dataset.armed) { for (const k of [...city.tiles.keys()]) { const [x, z] = k.split(',').map(Number); setTile(x, z, null); } Object.assign(city, { money: START_MONEY, day: 1, step: 0, rewarded: 0 }); for (let x = HALF - 3; x < HALF + 3; x++) setTile(x, HALF, 'r'); cars.splice(0).forEach(c => e.scene.remove(c.m)); recount(); save(); showHud(); renderTools(); }
      else { nw.dataset.armed = '1'; nw.textContent = 'Säker? Tryck igen'; nw.style.background = '#e2231a'; nw.style.opacity = 1; setTimeout(() => { delete nw.dataset.armed; nw.textContent = 'Ny stad'; nw.style.background = ''; nw.style.opacity = .8; }, 2500); }
    };
  }
  function describe(t) {
    if (t.t === 'r') return '🛣️ Väg';
    if (t.t === 'p') return '🌳 Park · husen runt omkring blir gladare';
    const em = TOOLS.find(x => x.id === t.t).emoji;
    if (t.nr > 2) return `${em} ${NAMES[t.t]} · saknar väg!`;
    if (t.st === 0) return `${em} ${NAMES[t.t]} · väntar på att byggas`;
    if (t.st === 1) return `${em} ${NAMES[t.t]} · byggs…`;
    return `${em} ${NAMES[t.t]} nivå ${t.l}` + (t.t === 'h' ? ` · ${t.pop} av ${CAP[t.l]} invånare` : ` · ${JOBS[t.t][t.l]} jobb`);
  }
  function tap(x, z) {
    if (!inside(x, z)) return;
    const cur = at(x, z);
    if (tool === 'x') { if (cur) { setTile(x, z, null); sfx.remove(); recount(); save(); showHud(); renderTools(); } return; }
    if (cur) { hud.center(`<div class="small">${describe(cur)}</div>`, 1800); return; }
    const cost = TOOLS.find(t => t.id === tool).cost;
    if (city.money < cost) { hud.center(`<div class="small">Du behöver ${cost - city.money} kr till 💰</div><div class="small">Vänta på nästa dag, skatten kommer!</div>`, 1800); return; }
    city.money -= cost; setTile(x, z, tool); sfx.place(); recount(); save(); showHud(); renderTools();
  }

  // ---------- Simulering ----------
  const hasRoad = (x, z) => { for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2 && at(x + dx, z + dz)?.t === 'r') return true; return false; };
  const near = (a, b, r) => Math.abs(a.x - b.x) <= r && Math.abs(a.z - b.z) <= r;
  let best = ctx.store.current.records.city?.best || 0, hint = '';
  function simulate() {
    const tiles = [...city.tiles.values()];
    const homes = tiles.filter(t => t.t === 'h' && t.st === 2), work = tiles.filter(t => (t.t === 's' || t.t === 'f') && t.st === 2), parks = tiles.filter(t => t.t === 'p');
    const nearPop = (t, r) => homes.reduce((s, h) => s + (near(t, h, r) ? h.pop : 0), 0);
    const demand = stats.jobs * 1.5 + 6 - stats.pop; // fler jobb än invånare → folk vill flytta in (några jobbar inte, så 1,5 per jobb)
    let leveled = false;
    for (const t of tiles) {
      if (t.t === 'r' || t.t === 'p') continue;
      const road = hasRoad(t.x, t.z);
      t.nr = road ? 0 : t.nr + 1;
      if (!road) { if (t.st === 2 && t.nr > 8) { t.st = 0; t.l = 1; t.pop = 0; } refresh(t); continue; }
      if (t.st === 0) { if (Math.random() < 0.35) { t.st = 1; t.bt = 0; } }
      else if (t.st === 1) { if (++t.bt >= 3) { t.st = 2; t.l = 1; t.popAnim = 0.35; } }
      else if (t.t === 'h') {
        if (t.pop < CAP[t.l] && demand > 0 && Math.random() < 0.6) t.pop++;
        if (t.pop > CAP[t.l]) t.pop--;
        const jobsNear = work.some(w => near(t, w, 5)), parkNear = parks.some(p => near(t, p, 3));
        if (t.l < 3 && t.pop >= CAP[t.l] && jobsNear && (t.l === 1 || parkNear) && Math.random() < 0.15) { t.l++; leveled = true; t.popAnim = 0.35; }
      } else if (t.t === 's') {
        const p = nearPop(t, 6);
        if (t.l < 3 && p >= [0, 8, 25][t.l] && Math.random() < 0.12) { t.l++; leveled = true; t.popAnim = 0.35; }
      } else if (t.t === 'f') {
        const p = nearPop(t, 8);
        if (t.l < 3 && p >= [0, 12, 35][t.l] && Math.random() < 0.12) { t.l++; leveled = true; t.popAnim = 0.35; }
      }
      refresh(t);
    }
    if (leveled) sfx.check();
    recount();
    if (stats.pop > best) { best = stats.pop; ctx.store.record('city', 'best', best); }
    const hundreds = Math.floor(stats.pop / 100);
    if (hundreds > city.rewarded) { const n = hundreds - city.rewarded; city.rewarded = hundreds; ctx.store.addCoins(10 * n); sfx.win(); hud.center(`<div>🎉 ${stats.pop} invånare!</div><div class="small">+${10 * n} mynt till dig</div>`, 2800); }
    city.step++;
    if (city.step % DAY_STEPS === 0) {
      let income = stats.pop * TAX.pop;
      for (const t of work) income += TAX[t.t] * t.l;
      city.money += income; city.day++; sfx.coin(); ctx.store.record('city', 'days', city.day);
      if (income) hud.center(`<div class="small">📅 Dag ${city.day} · +${income} kr i skatt</div>`, 1500);
      // Ett tips om vad staden behöver
      let h = '';
      if (tiles.some(t => t.nr > 2)) h = '🛣️ Några byggnader saknar väg! Bygg väg intill dem.';
      else if (homes.length && homes.some(t => t.pop < CAP[t.l]) && stats.jobs <= stats.pop) h = '👷 Invånarna behöver jobb: bygg butiker eller fabriker!';
      else if (work.length && !homes.length) h = '🏠 Butikerna behöver kunder: bygg bostäder i närheten!';
      else if (homes.length && homes.every(t => t.l === 1) && !parks.length) h = '🌳 Parker gör att husen växer till nivå 3!';
      else if (!homes.length && !tiles.some(t => t.t === 'h')) h = '🏠 Bygg bostäder bredvid vägen så flyttar folk in!';
      if (h !== hint) { hint = h; hud.bottom(h); }
      save();
    }
    showHud(); renderTools();
  }

  // ---------- Bilar ----------
  const cars = []; // { m, x, z, nx, nz, dx, dz, t, speed }
  const carGeo = new THREE.Group();
  function makeCar() {
    const g = new THREE.Group(); const c = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xffffff, 0xff7043, 0x8e24aa][Math.floor(Math.random() * 7)];
    part(g, G.box, mat(c), 0, 0.13, 0, 0.34, 0.2, 0.6); part(g, G.box, mat(0x263238), 0, 0.3, -0.03, 0.3, 0.14, 0.32, 0, false);
    const wheel = mat(0x212121); for (const [wx, wz] of [[-0.17, 0.18], [0.17, 0.18], [-0.17, -0.18], [0.17, -0.18]]) part(g, G.box, wheel, wx, 0.06, wz, 0.06, 0.12, 0.14, 0, false);
    return g;
  }
  const roadNeighbors = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => at(x + dx, z + dz)?.t === 'r');
  function spawnCar() {
    const roads = [...city.tiles.values()].filter(t => t.t === 'r' && roadNeighbors(t.x, t.z).length);
    if (!roads.length) return;
    const r = roads[Math.floor(Math.random() * roads.length)]; const [dx, dz] = roadNeighbors(r.x, r.z)[Math.floor(Math.random() * roadNeighbors(r.x, r.z).length)];
    const m = makeCar(); e.scene.add(m);
    cars.push({ m, x: r.x, z: r.z, nx: r.x + dx, nz: r.z + dz, dx, dz, t: 0, speed: 1.2 + Math.random() * 0.8, life: 30 + Math.random() * 30 });
  }
  function moveCars(dt) {
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i]; c.t += dt * c.speed; c.life -= dt;
      if (at(c.nx, c.nz)?.t !== 'r' || at(c.x, c.z)?.t !== 'r' || (c.life < 0 && c.t >= 1)) { e.scene.remove(c.m); cars.splice(i, 1); continue; }
      if (c.t >= 1) {
        c.t -= 1; c.x = c.nx; c.z = c.nz;
        let opts = roadNeighbors(c.x, c.z).filter(([dx, dz]) => !(dx === -c.dx && dz === -c.dz));
        if (!opts.length) opts = roadNeighbors(c.x, c.z);
        if (!opts.length) { e.scene.remove(c.m); cars.splice(i, 1); continue; }
        [c.dx, c.dz] = opts[Math.floor(Math.random() * opts.length)]; c.nx = c.x + c.dx; c.nz = c.z + c.dz;
      }
      const [ax, az] = center(c.x, c.z), [bx, bz] = center(c.nx, c.nz);
      c.m.position.set(ax + (bx - ax) * c.t - c.dz * 0.32, 0.12, az + (bz - az) * c.t + c.dx * 0.32); // högertrafik
      c.m.rotation.y = Math.atan2(c.dx, c.dz);
    }
  }

  // ---------- Kamera och styrning ----------
  e.freeze = true; const camT = new THREE.Vector3(0, 0, 0); e.camTarget = camT; e.cam.dist = 44; e.cam.pitch = 0.85; e.cam.yaw = 0.5;
  const ray = new THREE.Raycaster();
  const onWheel = (ev) => { e.cam.dist = Math.max(14, Math.min(80, e.cam.dist * (1 + ev.deltaY * 0.001))); ev.preventDefault(); };
  e.renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  const jumpBtn = document.getElementById('btn-jump'); jumpBtn.style.display = 'none';
  const dispose = e.dispose.bind(e);
  e.dispose = () => { save(); jumpBtn.style.display = ''; e.renderer.domElement.removeEventListener('wheel', onWheel); dispose(); };

  hud.title('Stadsbyggaren'); recount(); showHud(); renderTools();
  hud.center('<div>Bygg din egen stad! 🏙️</div><div class="small">Vägar först, sen hus bredvid vägen</div>', 3000);
  hud.bottom(ctx.touch ? 'Tryck: bygg · Dra: snurra · Nere till vänster: flytta' : 'Klick: bygg · Dra: snurra · WASD: flytta · Hjul: zooma');
  let simAcc = 0, carAcc = 0;

  e.start((dt) => {
    // Flytta kameran med joystick/WASD
    const mv = e.input.move; const yaw = e.cam.yaw; const sp = (10 + e.cam.dist * 0.3) * dt; const fwd = -mv.y;
    camT.x += (-fwd * Math.sin(yaw) + mv.x * Math.cos(yaw)) * sp; camT.z += (-fwd * Math.cos(yaw) - mv.x * Math.sin(yaw)) * sp;
    camT.x = Math.max(-HALF * CELL, Math.min(HALF * CELL, camT.x)); camT.z = Math.max(-HALF * CELL, Math.min(HALF * CELL, camT.z));
    // Tryck på en ruta
    for (const c of e.input.takeClicks()) {
      const r = e.renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((c.x - r.left) / r.width) * 2 - 1, -((c.y - r.top) / r.height) * 2 + 1), e.camera);
      const hit = ray.intersectObject(base)[0]; if (!hit) continue;
      tap(Math.floor(hit.point.x / CELL + HALF), Math.floor(hit.point.z / CELL + HALF));
    }
    // Simulering och bilar
    simAcc += dt; if (simAcc >= SIM_STEP) { simAcc -= SIM_STEP; simulate(); }
    carAcc += dt; const roads = [...city.tiles.values()].filter(t => t.t === 'r').length;
    if (carAcc > 1 && cars.length < Math.min(16, Math.floor(roads / 3))) { carAcc = 0; spawnCar(); }
    moveCars(dt);
    // Små animationer: rök, studs vid nivåhöjning, utropstecken som guppar
    for (const t of city.tiles.values()) {
      for (const s of t.smoke) { s.t = (s.t + dt * 0.4) % 1; s.m.position.set(s.cx + s.t * 0.3, s.y + s.t * 1.2, s.cz); const k = 0.08 + s.t * 0.22; s.m.scale.setScalar(k); }
      if (t.popAnim > 0) { t.popAnim -= dt; const k = 1 + Math.sin(Math.max(0, t.popAnim) / 0.35 * Math.PI) * 0.25; t.g.scale.set(k, k, k); if (t.popAnim <= 0) t.g.scale.set(1, 1, 1); }
      if (t.marker) t.marker.position.y = 2.4 + Math.sin(e.time * 4) * 0.15;
    }
  });
  return e;
}
