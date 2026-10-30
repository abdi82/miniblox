// Rörpusslet: vrid rörbitarna genom att trycka så att vattnet rinner från brunnen till huset. 20 banor, 3x3 till 8x8.
import { hud, sfx } from '../engine.js';

// Storlek per bana. Banorna slumpas fram med ett fast frö per bana, så bana 7 ser alltid likadan ut.
const SIZES = [3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8];
const COINS = (n) => n <= 4 ? 5 : n <= 6 ? 10 : 15;
const N_ = 1, E_ = 2, S_ = 4, W_ = 8; const DIRS = [[0, -1, N_, S_], [1, 0, E_, W_], [0, 1, S_, N_], [-1, 0, W_, E_]];
const rot = (m, k) => { for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Bygger en bana: ett slumpat träd över alla rutor (så varje bit har en lösning), brunnen i en kant och huset längst bort.
export function makeLevel(i) {
  const n = SIZES[i]; const R = rng(1000 + i * 7919);
  const base = new Array(n * n).fill(0); const seen = new Array(n * n).fill(false); const dist = new Array(n * n).fill(0);
  const src = Math.floor(R() * n) * n; // vänsterkanten
  const st = [src]; seen[src] = true;
  while (st.length) {
    const c = st[st.length - 1]; const x = c % n, y = Math.floor(c / n);
    const opts = DIRS.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny * n + nx]; });
    if (!opts.length) { st.pop(); continue; }
    const [dx, dy, bit, back] = opts[Math.floor(R() * opts.length)]; const nc = (y + dy) * n + x + dx;
    base[c] |= bit; base[nc] |= back; seen[nc] = true; dist[nc] = dist[c] + 1; st.push(nc);
  }
  let house = 0; for (let k = 0; k < n * n; k++) if (dist[k] > dist[house] && k !== src) house = k;
  const r = base.map((m) => { if (m === 15) return 0; let k = Math.floor(R() * 4); if ((m === 5 || m === 10) && k >= 2) k -= 2; return k; });
  if (r.every((k, idx) => rot(base[idx], k) === base[idx])) r[src] = (r[src] + 1) % 4;
  // startläget får inte redan vara löst
  return { n, base, r, src, house };
}
const CSS = `
.pp-root { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:52px 0 max(10px,env(safe-area-inset-bottom)); background:linear-gradient(160deg,#4a2c0a,#1f3d1a); pointer-events:auto; text-shadow:none; }
.pp-board { display:grid; gap:2px; padding:6px; background:#5d4037; border-radius:12px; touch-action:manipulation; }
.pp-cell { position:relative; background:#8d6e63; border-radius:6px; overflow:hidden; cursor:pointer; user-select:none; -webkit-user-select:none; }
.pp-cell svg { position:absolute; inset:0; width:100%; height:100%; transition:transform .18s ease-out; }
.pp-cell .pp-ico { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; filter:drop-shadow(0 2px 2px rgba(0,0,0,.4)); }
.pp-bar { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:10px; padding:0 8px; }
.pp-bar button { border:0; border-radius:12px; min-width:92px; height:54px; padding:0 14px; font-size:16px; font-weight:800; background:rgba(255,255,255,.18); color:#fff; }
.pp-levels { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0 4px; }
.pp-levels button { border:0; border-radius:10px; padding:8px 0 4px; font-size:16px; font-weight:800; background:#e8eaed; color:var(--text); min-height:52px; line-height:1.2; }
.pp-levels button.done { background:#c8f1dc; } .pp-levels button.cur { outline:3px solid var(--blue); }
.pp-levels small { display:block; font-size:11px; color:var(--muted); font-weight:600; }`;

export function start(ctx) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'pp-root'; ctx.container.appendChild(root);
  const rec = () => { const r = ctx.store.current.records; r.pipes = r.pipes || {}; r.pipes.solved = r.pipes.solved || {}; return r.pipes; };
  const firstUnsolved = () => { const s = rec().solved; const i = SIZES.findIndex((_, k) => !s[k]); return i < 0 ? 0 : i; };
  let cur = firstUnsolved(), L = null, r = [], moves = 0, done = false, cells = [], svgs = [], wet = [];

  const mask = (i) => rot(L.base[i], r[i]);
  function flow() {
    wet = new Array(L.n * L.n).fill(false); const st = [L.src]; wet[L.src] = true;
    while (st.length) { const c = st.pop(); const x = c % L.n, y = Math.floor(c / L.n), m = mask(c);
      for (const [dx, dy, bit, back] of DIRS) { if (!(m & bit)) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= L.n || ny >= L.n) continue; const nc = ny * L.n + nx; if (wet[nc] || !(mask(nc) & back)) continue; wet[nc] = true; st.push(nc); } }
  }
  const pipeSvg = (m, color) => `<svg viewBox="0 0 100 100"><g stroke="${color}" stroke-width="30" stroke-linecap="butt" fill="none">${m & N_ ? '<line x1="50" y1="50" x2="50" y2="0"/>' : ''}${m & E_ ? '<line x1="50" y1="50" x2="100" y2="50"/>' : ''}${m & S_ ? '<line x1="50" y1="50" x2="50" y2="100"/>' : ''}${m & W_ ? '<line x1="50" y1="50" x2="0" y2="50"/>' : ''}</g><circle cx="50" cy="50" r="17" fill="${color}"/><g stroke="rgba(255,255,255,.35)" stroke-width="6" fill="none">${m & N_ ? '<line x1="42" y1="45" x2="42" y2="0"/>' : ''}${m & E_ ? '<line x1="55" y1="42" x2="100" y2="42"/>' : ''}${m & S_ ? '<line x1="42" y1="55" x2="42" y2="100"/>' : ''}${m & W_ ? '<line x1="45" y1="42" x2="0" y2="42"/>' : ''}</g></svg>`;

  function load(i) {
    cur = i; L = makeLevel(i); r = L.r.slice(); moves = 0; done = false; hud.panel(null);
    root.innerHTML = `<div class="pp-board" id="pp-board" style="grid-template-columns:repeat(${L.n},1fr)">${L.base.map((m, k) => `<div class="pp-cell" data-i="${k}"><div class="pp-svg"></div>${k === L.src ? '<div class="pp-ico">⛲</div>' : k === L.house ? '<div class="pp-ico">🏠</div>' : ''}</div>`).join('')}</div>
      <div class="pp-bar"><button id="pp-restart">🔄 Börja om</button><button id="pp-levels">📋 Banor</button></div>`;
    cells = [...root.querySelectorAll('.pp-cell')]; svgs = cells.map(c => c.querySelector('.pp-svg'));
    cells.forEach(c => c.onclick = () => turn(+c.dataset.i));
    root.querySelector('#pp-restart').onclick = () => load(cur); root.querySelector('#pp-levels').onclick = showLevels;
    hud.title(`🚰 Bana ${i + 1} (${L.n}×${L.n})`); updateHud(); layout(); paintAll();
    hud.center(`<div>Bana ${i + 1}</div><div class="small">Tryck på rören så vattnet når huset 🏠</div>`, 1800);
  }
  function updateHud() { hud.right(`🔄 ${moves} · ✅ ${Object.keys(rec().solved).length}/${SIZES.length}`); }
  function layout() {
    if (!L) return; const w = root.clientWidth, h = root.clientHeight; const bar = root.querySelector('.pp-bar'); const bh = bar ? bar.offsetHeight + 16 : 70;
    const size = Math.max(200, Math.min(w - 16, h - 52 - bh - 16, 720)); const board = root.querySelector('#pp-board'); if (!board) return;
    board.style.width = board.style.height = size + 'px'; board.style.gridTemplateRows = `repeat(${L.n},1fr)`;
    root.querySelectorAll('.pp-ico').forEach(e => { e.style.fontSize = Math.round(size / L.n * 0.45) + 'px'; });
  }
  function paintAll() { flow(); cells.forEach((c, i) => paintCell(i)); }
  function paintCell(i) {
    const color = wet[i] ? '#29b6f6' : '#cfd8dc';
    const el = svgs[i]; const key = L.base[i] + color; if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = pipeSvg(L.base[i], color); el.firstChild.style.transform = `rotate(${r[i] * 90}deg)`; el.style.position = 'absolute'; el.style.inset = '0'; }
    else el.firstChild.style.transform = `rotate(${r[i] * 90}deg)`;
  }
  function turn(i) {
    if (done) return; r[i] = r[i] + 1; moves++; sfx.place(); // r växer bara så CSS-rotationen snurrar åt samma håll
    flow(); cells.forEach((_, k) => paintCell(k)); updateHud();
    if (wet[L.house]) win();
  }
  function win() {
    done = true; sfx.win(); const rr = rec(); const first = !rr.solved[cur]; const coins = first ? COINS(L.n) : 2;
    ctx.store.update(p => { p.records.pipes.solved[cur] = Math.min(moves, rr.solved[cur] || 1e9); }); ctx.store.bump('pipes', 'wins'); ctx.store.addCoins(coins); updateHud();
    setTimeout(() => { const next = cur + 1 < SIZES.length ? cur + 1 : null;
      const p = hud.panel(`<h3>💧 Vattnet är framme!</h3><div>${moves} vridningar</div><div style="margin-top:6px">+${coins} <span class="coin-icon" style="vertical-align:-3px"></span>${first ? '' : ' <span class="sub" style="font-size:13px">(redan klarad)</span>'}</div>
        <div class="row">${next != null ? `<button class="btn green" id="pp-next">Nästa bana ▶</button>` : '<div style="font-size:14px">Alla banor klara! 🏆</div>'}<button class="btn ghost" id="pp-again">Igen</button><button class="btn ghost" id="pp-list">Banor</button></div>`);
      p.querySelector('#pp-next') && (p.querySelector('#pp-next').onclick = () => load(next)); p.querySelector('#pp-again').onclick = () => load(cur); p.querySelector('#pp-list').onclick = showLevels; }, 700);
  }
  function showLevels() {
    const s = rec().solved;
    const p = hud.panel(`<h3>🚰 Rörpusslet</h3><div class="sub" style="font-weight:600">Välj bana. Gröna är klarade.</div>
      <div class="pp-levels">${SIZES.map((n, i) => `<button data-i="${i}" class="${s[i] ? 'done' : ''} ${i === cur ? 'cur' : ''}">${s[i] ? '✅' : ''}${i + 1}<small>${n}×${n}</small></button>`).join('')}</div>
      <div class="row"><button class="btn ghost" id="pp-close">Stäng</button></div>`);
    p.querySelectorAll('[data-i]').forEach(b => b.onclick = () => load(+b.dataset.i)); p.querySelector('#pp-close').onclick = () => { hud.panel(null); if (done) load(cur); };
  }
  addEventListener('resize', layout); hud.bottom(''); load(cur);
  return { dispose() { removeEventListener('resize', layout); root.remove(); style.remove(); } };
}
