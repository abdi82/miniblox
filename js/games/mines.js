// Minröjaren: klassisk minröjning med stora rutor för fingrar. Första trycket är alltid säkert. Långtryck eller flagg-läge sätter flagga.
import { hud, sfx } from '../engine.js';

const SIZES = [
  { id: 6, label: '6×6 Liten', emoji: '🐣', n: 6, mines: 4, coins: 5, desc: 'Fyra bomber. Bra för de minsta' },
  { id: 9, label: '9×9 Mellan', emoji: '🙂', n: 9, mines: 10, coins: 10, desc: 'Tio bomber. Lagom klurigt' },
  { id: 14, label: '14×14 Stor', emoji: '😎', n: 14, mines: 30, coins: 25, desc: 'Trettio bomber. För riktiga minröjare' },
];
const NUMC = ['', '#1e88e5', '#43a047', '#e53935', '#5e35b1', '#6d4c41', '#00897b', '#212121', '#757575'];
const CSS = `
.mn-root { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:52px 0 max(10px,env(safe-area-inset-bottom)); background:linear-gradient(160deg,#1b3a2a,#0f2a3a); pointer-events:auto; text-shadow:none; }
.mn-board { display:grid; gap:3px; padding:6px; background:#263238; border-radius:10px; touch-action:none; }
.mn-cell { display:flex; align-items:center; justify-content:center; border-radius:6px; background:linear-gradient(180deg,#90caf9,#64b5f6); box-shadow:inset 0 -3px 0 rgba(0,0,0,.18); font-weight:900; user-select:none; -webkit-user-select:none; cursor:pointer; position:relative; }
.mn-cell.open { background:#eceff1; box-shadow:none; cursor:default; }
.mn-cell.boom { background:#ef5350; }
.mn-cell.wrong { background:#ffcc80; }
.mn-cell.press { filter:brightness(1.15); transform:scale(.95); }
.mn-bar { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:10px; padding:0 8px; }
.mn-bar button { border:0; border-radius:12px; min-width:92px; height:54px; padding:0 14px; font-size:16px; font-weight:800; background:rgba(255,255,255,.18); color:#fff; }
.mn-bar button.flagmode.on { background:#ffb300; color:#1a1a1a; }
.mn-sizes { display:flex; flex-direction:column; gap:10px; margin:12px 0 4px; }
.mn-sizes button { border:0; border-radius:12px; padding:12px 14px; font-size:18px; font-weight:800; background:#e8eaed; color:var(--text); display:flex; align-items:center; gap:12px; text-align:left; min-height:60px; }
.mn-sizes span.big { font-size:30px; } .mn-sizes small { display:block; font-size:12px; color:var(--muted); font-weight:600; }`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function start(ctx) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'mn-root'; ctx.container.appendChild(root);
  const rec = () => { const r = ctx.store.current.records; r.mines = r.mines || {}; return r.mines; };
  let S = null, N = 0, mines = new Set(), open = [], flag = [], started = false, done = false, secs = 0, timer = 0, flagMode = false, cells = [], press = null;
  const idx = (r, c) => r * N + c;
  const around = (i) => { const r = Math.floor(i / N), c = i % N, out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < N && cc < N) out.push(idx(rr, cc)); } return out; };
  const count = (i) => around(i).filter(j => mines.has(j)).length;

  function chooseSize() {
    clearInterval(timer); root.innerHTML = ''; hud.right(''); const r = rec();
    const p = hud.panel(`<h3>💣 Minröjaren</h3><div class="sub" style="font-weight:600">Hur stort fält?</div>
      <div class="mn-sizes">${SIZES.map(s => `<button data-s="${s.id}"><span class="big">${s.emoji}</span><span>${s.label}<small>${s.desc}</small><small>${r['best' + s.id] ? '🏆 Bästa tid ' + fmt(r['best' + s.id]) : 'Inte klarat än'} · ${s.coins} mynt</small></span></button>`).join('')}</div>`);
    p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => newGame(SIZES.find(s => s.id === +b.dataset.s)));
  }
  function newGame(s) {
    S = s; N = s.n; mines = new Set(); open = new Array(N * N).fill(false); flag = new Array(N * N).fill(false); started = false; done = false; secs = 0; flagMode = false;
    hud.panel(null); hud.title(`💣 Minröjaren ${s.label}`); clearInterval(timer); tick(); build();
    hud.center(`<div class="small">Tryck på en ruta. Siffran visar hur många bomber som finns runt om.</div>`, 2500);
  }
  function placeMines(safe) {
    const banned = new Set([safe, ...around(safe)]); const all = [...Array(N * N).keys()].filter(i => !banned.has(i));
    for (let k = 0; k < S.mines && all.length; k++) { const j = Math.floor(Math.random() * all.length); mines.add(all.splice(j, 1)[0]); }
    started = true; timer = setInterval(() => { if (!done) { secs++; tick(); } }, 1000);
  }
  function tick() { hud.right(`🚩 ${S.mines - flag.filter(Boolean).length} · ⏱ ${fmt(secs)}`); }
  function build() {
    root.innerHTML = `<div class="mn-board" id="mn-board" style="grid-template-columns:repeat(${N},1fr)">${open.map((_, i) => `<div class="mn-cell" data-i="${i}"></div>`).join('')}</div>
      <div class="mn-bar"><button class="flagmode" id="mn-flag">🚩 Flagga</button><button id="mn-new">🔀 Nytt</button><button id="mn-sizes">📐 Storlek</button></div>`;
    cells = [...root.querySelectorAll('.mn-cell')];
    const board = root.querySelector('#mn-board');
    // Pekare: kort tryck = öppna, långtryck (0,45 s) = flagga, högerklick = flagga
    board.addEventListener('pointerdown', (ev) => { const c = ev.target.closest('.mn-cell'); if (!c || done) return; ev.preventDefault(); const i = +c.dataset.i; c.classList.add('press');
      press = { i, long: false, t: setTimeout(() => { press.long = true; c.classList.remove('press'); toggleFlag(i); }, 450) }; });
    const up = (ev) => { if (!press) return; clearTimeout(press.t); cells[press.i].classList.remove('press'); const c = ev.target?.closest?.('.mn-cell'); if (!press.long && c && +c.dataset.i === press.i) { if (ev.button === 2 || flagMode) toggleFlag(press.i); else reveal(press.i); } press = null; };
    board.addEventListener('pointerup', up); board.addEventListener('pointercancel', () => { if (press) { clearTimeout(press.t); cells[press.i].classList.remove('press'); press = null; } });
    board.addEventListener('contextmenu', (ev) => ev.preventDefault());
    root.querySelector('#mn-flag').onclick = () => { flagMode = !flagMode; root.querySelector('#mn-flag').classList.toggle('on', flagMode); hud.center(flagMode ? '<div class="small">Flagg-läge: tryck på rutor du tror har bomber</div>' : '<div class="small">Öppna-läge</div>', 1200); };
    root.querySelector('#mn-new').onclick = () => newGame(S); root.querySelector('#mn-sizes').onclick = chooseSize;
    layout(); paint();
  }
  function layout() {
    if (!S) return; const w = root.clientWidth, h = root.clientHeight; const bar = root.querySelector('.mn-bar'); const bh = bar ? bar.offsetHeight + 16 : 70;
    const size = Math.max(200, Math.min(w - 16, h - 52 - bh - 16, 720)); const board = root.querySelector('#mn-board'); if (!board) return;
    board.style.width = board.style.height = size + 'px'; board.style.gridTemplateRows = `repeat(${N},1fr)`;
    const fs = Math.round(size / N * 0.55); cells.forEach(c => { c.style.fontSize = fs + 'px'; });
  }
  function paint(lostAt = -1) {
    cells.forEach((c, i) => {
      c.className = 'mn-cell'; c.textContent = '';
      if (open[i]) { c.classList.add('open'); if (mines.has(i)) { c.textContent = '💣'; if (i === lostAt) c.classList.add('boom'); } else { const n = count(i); if (n) { c.textContent = n; c.style.color = NUMC[n]; } } }
      else if (flag[i]) { c.textContent = '🚩'; if (done && lostAt >= 0 && !mines.has(i)) c.classList.add('wrong'); }
    });
  }
  function toggleFlag(i) { if (done || open[i]) return; flag[i] = !flag[i]; sfx.place(); paint(); if (S) tick(); }
  function reveal(i) {
    if (done || flag[i]) return;
    if (!started) placeMines(i);
    if (open[i]) { // tryck på en öppen siffra med rätt antal flaggor runt: öppna grannarna
      const n = count(i); const ar = around(i); if (n && ar.filter(j => flag[j]).length === n) { for (const j of ar) if (!flag[j] && !open[j]) { if (mines.has(j)) return lose(j); flood(j); } paint(); checkWin(); }
      return;
    }
    if (mines.has(i)) return lose(i);
    flood(i); sfx.remove(); paint(); checkWin();
  }
  function flood(i) { const st = [i]; while (st.length) { const k = st.pop(); if (open[k] || flag[k] || mines.has(k)) continue; open[k] = true; if (count(k) === 0) for (const j of around(k)) if (!open[j]) st.push(j); } }
  function lose(i) {
    done = true; clearInterval(timer); sfx.die(); for (const m of mines) open[m] = true; paint(i);
    setTimeout(() => { const p = hud.panel(`<h3>💥 Pang!</h3><div>Där låg en bomb. Ingen fara, försök igen!</div><div class="row"><button class="btn green" id="mn-again">Nytt spel ▶</button><button class="btn ghost" id="mn-sz">Storlek</button></div>`);
      p.querySelector('#mn-again').onclick = () => newGame(S); p.querySelector('#mn-sz').onclick = chooseSize; }, 900);
  }
  function checkWin() {
    if (open.filter(Boolean).length !== N * N - S.mines) return;
    done = true; clearInterval(timer); sfx.win(); for (const m of mines) flag[m] = true; paint(); tick();
    const key = 'best' + S.id; const r = rec(); const isBest = ctx.store.record('mines', key, secs, (a, b) => a < b); ctx.store.bump('mines', 'wins'); ctx.store.addCoins(S.coins);
    const p = hud.panel(`<h3>🎉 Alla bomber hittade!</h3><div>Tid ${fmt(secs)} ${isBest ? '· 🏆 Ny bästa tid!' : r[key] ? '· bästa ' + fmt(r[key]) : ''}</div><div style="margin-top:6px">+${S.coins} <span class="coin-icon" style="vertical-align:-3px"></span></div>
      <div class="row"><button class="btn green" id="mn-again">Nytt spel ▶</button><button class="btn ghost" id="mn-sz">Storlek</button></div>`);
    p.querySelector('#mn-again').onclick = () => newGame(S); p.querySelector('#mn-sz').onclick = chooseSize;
  }
  addEventListener('resize', layout); hud.bottom(''); chooseSize();
  return { dispose() { clearInterval(timer); removeEventListener('resize', layout); root.remove(); style.remove(); } };
}
