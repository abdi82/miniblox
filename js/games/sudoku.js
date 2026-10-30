// Barnsudoku: 4x4 med djur, 6x6 och 9x9 med siffror. Pusslen slumpas fram med unik lösning.
import { hud, sfx } from '../engine.js';

const MODES = [
  { id: 4, label: '4×4 Djur', emoji: '🐸', bw: 2, bh: 2, givens: 6, coins: 5, symbols: ['🐸', '🐱', '🐶', '🐰'], desc: 'Varje djur en gång per rad, kolumn och ruta' },
  { id: 6, label: '6×6 Siffror', emoji: '6️⃣', bw: 3, bh: 2, givens: 14, coins: 10, symbols: ['1', '2', '3', '4', '5', '6'], desc: 'Siffrorna 1–6 en gång per rad, kolumn och låda' },
  { id: 9, label: '9×9 Siffror', emoji: '9️⃣', bw: 3, bh: 3, givens: 38, coins: 20, symbols: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], desc: 'Riktigt sudoku! Siffrorna 1–9 en gång per rad, kolumn och låda' },
];
const CSS = `
.sd-root { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:52px 0 max(10px,env(safe-area-inset-bottom)); background:linear-gradient(160deg,#1f2a5a,#3b1f5e); pointer-events:auto; text-shadow:none; }
.sd-board { display:grid; gap:0; background:#fff; border:3px solid #1a1a2e; border-radius:8px; overflow:hidden; margin-top:6px; }
.sd-cell { display:flex; align-items:center; justify-content:center; border:1px solid #cfd4da; background:#fff; color:#1a237e; font-weight:800; cursor:pointer; user-select:none; position:relative; }
.sd-cell.given { background:#eef1f5; color:#1a1a2e; }
.sd-cell.sel { background:#ffe082 !important; }
.sd-cell.same { background:#e3f2fd; }
.sd-cell.err { background:#ffe0e6; color:#c62828; }
.sd-cell.hint { background:#dcedc8; }
.sd-cell.bt { border-top:3px solid #1a1a2e; } .sd-cell.bl { border-left:3px solid #1a1a2e; }
.sd-keys { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin-top:10px; padding:0 8px; max-width:100%; }
.sd-keys button { border:0; border-radius:12px; min-width:50px; height:54px; padding:0 10px; font-size:24px; font-weight:800; background:#fff; color:#1a237e; }
.sd-keys button.util { background:rgba(255,255,255,.2); color:#fff; font-size:15px; min-width:92px; }
.sd-keys button:disabled { opacity:.4; }
.sd-keys button.left { outline:3px solid #ffd54f; }
.sd-modes { display:flex; flex-direction:column; gap:10px; margin:12px 0 4px; }
.sd-modes button { border:0; border-radius:12px; padding:12px 14px; font-size:18px; font-weight:800; background:#e8eaed; color:var(--text); display:flex; align-items:center; gap:12px; text-align:left; min-height:60px; }
.sd-modes button span.big { font-size:30px; } .sd-modes small { display:block; font-size:12px; color:var(--muted); font-weight:600; }
@media (max-height: 500px) { .sd-root { padding-top:46px; } .sd-keys button { height:44px; min-width:42px; font-size:20px; } }`;

// ---------- Generator och lösare ----------
function makeSolver(N, bw, bh) {
  const box = (r, c) => Math.floor(r / bh) * (N / bw) + Math.floor(c / bw);
  function candidates(g, i) {
    const r = Math.floor(i / N), c = i % N; const used = new Set();
    for (let k = 0; k < N; k++) { used.add(g[r * N + k]); used.add(g[k * N + c]); }
    const br = Math.floor(r / bh) * bh, bc = Math.floor(c / bw) * bw; for (let y = br; y < br + bh; y++) for (let x = bc; x < bc + bw; x++) used.add(g[y * N + x]);
    const out = []; for (let v = 1; v <= N; v++) if (!used.has(v)) out.push(v); return out;
  }
  // Räknar lösningar upp till "limit". Väljer alltid rutan med minst kandidater.
  function count(g, limit = 2) {
    let best = -1, bestC = null;
    for (let i = 0; i < N * N; i++) if (!g[i]) { const c = candidates(g, i); if (bestC == null || c.length < bestC.length) { best = i; bestC = c; if (!c.length) return 0; } }
    if (best < 0) return 1;
    let n = 0; for (const v of bestC) { g[best] = v; n += count(g, limit - n); if (n >= limit) break; } g[best] = 0; return n;
  }
  function fill(g) {
    let best = -1, bestC = null;
    for (let i = 0; i < N * N; i++) if (!g[i]) { const c = candidates(g, i); if (bestC == null || c.length < bestC.length) { best = i; bestC = c; if (!c.length) return false; } }
    if (best < 0) return true;
    for (const v of bestC.sort(() => Math.random() - 0.5)) { g[best] = v; if (fill(g)) return true; } g[best] = 0; return false;
  }
  return { count, fill, box };
}
export function generate(mode) {
  const N = mode.id; const S = makeSolver(N, mode.bw, mode.bh);
  const sol = new Array(N * N).fill(0); S.fill(sol);
  const puzzle = sol.slice(); const order = [...Array(N * N).keys()].sort(() => Math.random() - 0.5);
  let givens = N * N; const t0 = performance.now();
  for (const i of order) {
    if (givens <= mode.givens || performance.now() - t0 > 2500) break;
    const v = puzzle[i]; puzzle[i] = 0;
    if (S.count(puzzle.slice(), 2) !== 1) puzzle[i] = v; else givens--;
  }
  return { sol, puzzle, N };
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function start(ctx) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'sd-root'; ctx.container.appendChild(root);
  const rec = () => { const r = ctx.store.current.records; r.sudoku = r.sudoku || {}; return r.sudoku; };
  let mode = null, P = null, grid = [], given = [], sel = -1, hints = 3, hinted = new Set(), secs = 0, timer = 0, done = false, cells = [];

  function chooseMode() {
    clearInterval(timer); root.innerHTML = ''; hud.right('');
    const r = rec();
    const p = hud.panel(`<h3>🔢 Barnsudoku</h3><div class="sub" style="font-weight:600">Välj hur svårt</div>
      <div class="sd-modes">${MODES.map(m => `<button data-m="${m.id}"><span class="big">${m.emoji}</span><span>${m.label}<small>${m.desc}</small><small>${r['best' + m.id] ? '🏆 Bästa tid ' + fmt(r['best' + m.id]) : 'Inte klarat än'} · ${m.coins} mynt</small></span></button>`).join('')}</div>`);
    p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => newGame(MODES.find(m => m.id === +b.dataset.m)));
  }
  function newGame(m) {
    mode = m; hud.panel(null); hud.center('<div class="small">Blandar pusslet…</div>');
    setTimeout(() => {
      P = generate(m); grid = P.puzzle.slice(); given = P.puzzle.map(v => v > 0); sel = -1; hints = 3; hinted = new Set(); secs = 0; done = false;
      hud.center(''); hud.title(`🔢 Barnsudoku ${m.label}`); build(); tick();
      clearInterval(timer); timer = setInterval(() => { if (!done) { secs++; tick(); } }, 1000);
    }, 30);
  }
  function tick() { hud.right(`⏱ ${fmt(secs)}`); }
  function build() {
    const N = mode.id;
    root.innerHTML = `<div class="sd-board" id="sd-board" style="grid-template-columns:repeat(${N},1fr)">${grid.map((v, i) => { const r = Math.floor(i / N), c = i % N; return `<div class="sd-cell ${given[i] ? 'given' : ''} ${r % mode.bh === 0 && r ? 'bt' : ''} ${c % mode.bw === 0 && c ? 'bl' : ''}" data-i="${i}"></div>`; }).join('')}</div>
      <div class="sd-keys" id="sd-keys">${mode.symbols.map((s, k) => `<button data-v="${k + 1}">${s}</button>`).join('')}<button class="util" id="sd-erase">⌫ Sudda</button><button class="util left" id="sd-hint">💡 Ledtråd (${hints})</button><button class="util" id="sd-new">🔀 Nytt</button></div>`;
    cells = [...root.querySelectorAll('.sd-cell')];
    cells.forEach(c => c.onclick = () => { sel = +c.dataset.i; paint(); });
    root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => place(+b.dataset.v));
    root.querySelector('#sd-erase').onclick = () => place(0);
    root.querySelector('#sd-hint').onclick = hint;
    root.querySelector('#sd-new').onclick = chooseMode;
    layout(); paint();
  }
  function layout() {
    if (!mode) return; const N = mode.id; const w = root.clientWidth, h = root.clientHeight; const keys = root.querySelector('#sd-keys'); const kh = keys ? keys.offsetHeight + 16 : 80;
    const size = Math.max(160, Math.min(w - 20, h - 52 - kh - 20, 620)); const board = root.querySelector('#sd-board'); if (!board) return;
    board.style.width = board.style.height = size + 'px'; board.style.gridTemplateRows = `repeat(${N},1fr)`;
    const fs = Math.round(size / N * (N === 4 ? 0.55 : 0.55)); cells.forEach(c => { c.style.fontSize = fs + 'px'; });
  }
  function paint() {
    const N = mode.id; const sv = sel >= 0 ? grid[sel] : 0;
    cells.forEach((c, i) => {
      const v = grid[i]; c.textContent = v ? mode.symbols[v - 1] : '';
      c.classList.toggle('sel', i === sel); c.classList.toggle('same', !!v && v === sv && i !== sel);
      c.classList.toggle('err', !!v && !given[i] && v !== P.sol[i]); c.classList.toggle('hint', hinted.has(i));
    });
    const hb = root.querySelector('#sd-hint'); if (hb) { hb.textContent = `💡 Ledtråd (${hints})`; hb.disabled = hints <= 0 || done; }
    // dölj symboler som redan är fulltaliga
    root.querySelectorAll('[data-v]').forEach(b => { const v = +b.dataset.v; const n = grid.filter(x => x === v).length; b.style.opacity = n >= N ? 0.4 : 1; });
  }
  function place(v) {
    if (done) return;
    if (sel < 0 || given[sel]) { hud.center('<div class="small">Tryck på en tom ruta först</div>', 1000); return; }
    grid[sel] = v; hinted.delete(sel); if (v) (v === P.sol[sel] ? sfx.place() : sfx.remove()); paint(); checkWin();
  }
  function hint() {
    if (done || hints <= 0) return;
    let i = sel >= 0 && !given[sel] && grid[sel] !== P.sol[sel] ? sel : -1;
    if (i < 0) { const empty = grid.map((v, k) => (!given[k] && v !== P.sol[k] ? k : -1)).filter(k => k >= 0); if (!empty.length) return; i = empty[Math.floor(Math.random() * empty.length)]; }
    grid[i] = P.sol[i]; hinted.add(i); hints--; sel = i; sfx.check(); paint(); checkWin();
  }
  function checkWin() {
    if (!grid.every((v, i) => v === P.sol[i])) return;
    done = true; clearInterval(timer); sfx.win();
    const r = rec(); const key = 'best' + mode.id; const isBest = ctx.store.record('sudoku', key, secs, (a, b) => a < b); ctx.store.bump('sudoku', 'wins'); ctx.store.addCoins(mode.coins);
    const p = hud.panel(`<h3>🎉 Pusslet löst!</h3><div>Tid ${fmt(secs)} ${isBest ? '· 🏆 Ny bästa tid!' : r[key] ? '· bästa ' + fmt(r[key]) : ''}</div><div style="margin-top:6px">+${mode.coins} <span class="coin-icon" style="vertical-align:-3px"></span>${hinted.size ? ` <span class="sub" style="font-size:13px">(${hinted.size} ledtråd${hinted.size > 1 ? 'ar' : ''})</span>` : ''}</div>
      <div class="row"><button class="btn green" id="sd-again">Nytt pussel ▶</button><button class="btn ghost" id="sd-modes">Byt nivå</button></div>`);
    p.querySelector('#sd-again').onclick = () => newGame(mode); p.querySelector('#sd-modes').onclick = chooseMode;
  }
  const onKey = (ev) => {
    if (!mode || done || !hud.el('hud-panel').hidden) return; const N = mode.id;
    if (/^[1-9]$/.test(ev.key) && +ev.key <= N) place(+ev.key); else if (ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === '0') place(0);
    else if (ev.key.startsWith('Arrow') && sel >= 0) { const d = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[ev.key]; const n = sel + d; if (n >= 0 && n < N * N) { sel = n; paint(); } ev.preventDefault(); }
  };
  addEventListener('keydown', onKey); addEventListener('resize', layout);
  hud.bottom(''); chooseMode();
  return { dispose() { clearInterval(timer); removeEventListener('keydown', onKey); removeEventListener('resize', layout); root.remove(); style.remove(); } };
}
