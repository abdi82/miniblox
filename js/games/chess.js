// Schack mot datorn. Brädet: chessground (lichess, GPL-3). Reglerna: chess.js (BSD-2). Datorn: chess-ai.js (egen, tre nivåer).
import { Chess } from '../../vendor/chess/chess.js';
import { Chessground } from '../../vendor/chess/chessground.min.js';
import { pickMove } from './chess-ai.js';
import { hud, sfx } from '../engine.js';

export const LEVELS = [
  { id: 'easy', name: 'Nybörjare', emoji: '🐣', coins: 10, desc: 'Datorn drar lite hur som helst, men tar pjäser när den kan' },
  { id: 'mid', name: 'Lagom', emoji: '🙂', coins: 20, desc: 'Datorn tänker två drag framåt' },
  { id: 'hard', name: 'Svår', emoji: '🧠', coins: 40, desc: 'Datorn tänker tre drag framåt och räknar på slag' },
];
const PIECE = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const CSS = `
.chess-root { position: absolute; inset: 0; z-index: 0; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 30%, #2c3e50, #0f172a 70%); padding-top: calc(max(10px, env(safe-area-inset-top)) + 42px); box-sizing: border-box; }
.chess-board-wrap { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 6px; }
.chess-board { box-shadow: 0 10px 40px rgba(0,0,0,.6); border-radius: 4px; }
.chess-board .cg-wrap { border-radius: 4px; overflow: hidden; }
.chess-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; padding: 8px 10px max(10px, env(safe-area-inset-bottom)); color: #fff; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.chess-bar .hud-btn { padding: 12px 16px; font-size: 15px; }
.chess-bar .hud-btn:disabled { opacity: .4; }
.chess-status { flex: 1 1 100%; text-align: center; font-size: 16px; min-height: 20px; }
@media (min-width: 700px) { .chess-status { flex: 0 1 auto; margin-right: 10px; } }
.chess-captured { font-size: 17px; opacity: .85; }
.chess-levels { display: grid; gap: 10px; margin-top: 14px; }
.chess-level { display: flex; align-items: center; gap: 12px; text-align: left; border: 2px solid var(--line, #e3e6ea); background: #f7f8fa; border-radius: 12px; padding: 10px 14px; cursor: pointer; font: inherit; color: inherit; }
.chess-level:hover { border-color: var(--blue, #335fff); }
.chess-level .big { font-size: 32px; }
.chess-level b { display: block; font-size: 17px; }
.chess-level small { color: var(--muted, #666); font-weight: 600; }
.chess-level .coins { margin-left: auto; white-space: nowrap; color: #b7791f; }
.chess-side { margin-top: 12px; display: flex; gap: 8px; justify-content: center; }
.chess-side button { font: inherit; font-weight: 700; border: 2px solid var(--line, #e3e6ea); background: #fff; border-radius: 999px; padding: 6px 14px; cursor: pointer; }
.chess-side button.active { border-color: var(--text, #111); background: #111; color: #fff; }
`;

function ensureStyles() {
  if (document.getElementById('chess-styles')) return;
  for (const f of ['chessground.base.css', 'chessground.brown.css', 'chessground.cburnett.css']) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/chess/' + f; l.dataset.chess = '1'; document.head.appendChild(l);
  }
  const s = document.createElement('style'); s.id = 'chess-styles'; s.textContent = CSS; document.head.appendChild(s);
}

export function start(ctx) {
  ensureStyles();
  const { store } = ctx;
  const root = document.createElement('div'); root.className = 'chess-root';
  root.innerHTML = `<div class="chess-board-wrap"><div class="chess-board"></div></div>
    <div class="chess-bar"><div class="chess-status" id="chess-status"></div>
      <button class="hud-btn" id="chess-undo" type="button">↩ Ångra</button>
      <button class="hud-btn" id="chess-new" type="button">🔄 Nytt parti</button></div>`;
  ctx.container.appendChild(root);
  const boardEl = root.querySelector('.chess-board'), statusEl = root.querySelector('#chess-status');
  const undoBtn = root.querySelector('#chess-undo'), newBtn = root.querySelector('#chess-new');
  hud.title('♟️ Schack'); hud.center('');

  let chess = new Chess(), level = LEVELS[0], me = 'white', thinking = false, over = true, timer = 0, disposed = false;
  const meCh = () => me[0];
  const other = (c) => (c === 'white' ? 'black' : 'white');
  const wins = () => store.current.records.chess?.wins || 0;
  const showWins = () => hud.right(`<span>🏆 ${wins()}</span><span>${level.emoji} ${level.name}</span>`);

  // Alla lagliga drag för den som ska dra, i chessgrounds form (från → [till…]), så brädet visar dem när man trycker på en pjäs
  const dests = () => {
    const map = new Map();
    for (const m of chess.moves({ verbose: true })) { const a = map.get(m.from); if (a) a.push(m.to); else map.set(m.from, [m.to]); }
    return map;
  };
  const cg = Chessground(boardEl, {
    orientation: me, coordinates: true, animation: { duration: 180 },
    highlight: { lastMove: true, check: true }, premovable: { enabled: false }, drawable: { enabled: false },
    movable: { color: me, free: false, showDests: true, dests: new Map(), events: { after: onMove } },
    draggable: { enabled: true, showGhost: true }, selectable: { enabled: true },
  });
  // Storlek: så stort bräde som får plats, jämnt delbart med 8 så rutorna blir skarpa
  const wrap = root.querySelector('.chess-board-wrap');
  const resize = () => {
    const size = Math.max(160, Math.floor(Math.min(wrap.clientWidth - 12, wrap.clientHeight - 12) / 8) * 8);
    boardEl.style.width = boardEl.style.height = size + 'px'; cg.redrawAll();
  };
  addEventListener('resize', resize); resize(); setTimeout(resize, 50);

  const captured = () => {
    // Vad som tagits: räkna pjäser som saknas jämfört med startuppställningen
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, left = { w: { ...start }, b: { ...start } };
    for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== 'k') left[sq.color][sq.type]--;
    const list = (c) => Object.entries(left[c]).flatMap(([t, n]) => Array(Math.max(0, n)).fill(PIECE[t])).join('');
    return { byMe: list(me === 'white' ? 'b' : 'w'), byPc: list(meCh()) };
  };
  const status = () => {
    const c = captured();
    const turn = over ? '' : thinking ? '🤔 Datorn tänker…' : chess.inCheck() ? '⚠️ Schack! Din tur' : 'Din tur';
    statusEl.innerHTML = `${turn}<br><span class="chess-captured">Du tog: ${c.byMe || '–'} · Datorn tog: ${c.byPc || '–'}</span>`;
    undoBtn.disabled = over || thinking || chess.history().length === 0;
  };
  const sync = (last) => {
    const myTurn = chess.turn() === meCh();
    cg.set({ fen: chess.fen(), turnColor: chess.turn() === 'w' ? 'white' : 'black', check: chess.inCheck(), lastMove: last,
      movable: { color: me, dests: myTurn && !over && !thinking ? dests() : new Map() } });
    status();
  };

  function onMove(from, to) {
    if (over || thinking) return sync();
    const m = chess.move({ from, to, promotion: 'q' });
    if (!m) return sync();
    m.captured ? sfx.coin() : sfx.place();
    sync([from, to]);
    if (!checkEnd()) computerMove();
  }
  function computerMove() {
    thinking = true; status(); cg.set({ movable: { color: me, dests: new Map() } });
    timer = setTimeout(() => {
      if (disposed || over) return;
      const { move } = pickMove(chess, level.id);
      const m = chess.move(move);
      thinking = false;
      m.captured ? sfx.remove() : sfx.place();
      sync([m.from, m.to]);
      checkEnd();
    }, 350 + Math.random() * 400);
  }
  function checkEnd() {
    if (!chess.isGameOver()) return false;
    over = true; status(); cg.set({ movable: { color: me, dests: new Map() } });
    let title, text, coins = 0;
    if (chess.isCheckmate()) {
      const winner = other(chess.turn() === 'w' ? 'white' : 'black');
      if (winner === me) { title = '🏆 Du vann!'; coins = level.coins; text = `Schack matt! Du slog datorn på nivå ${level.name}.`; sfx.win(); store.bump('chess', 'wins'); store.bump('chess', 'wins_' + level.id); }
      else { title = '😅 Datorn vann'; text = 'Schack matt. Prova igen, du klarar det!'; sfx.die(); }
    } else {
      title = '🤝 Remi'; text = chess.isStalemate() ? 'Patt: den som ska dra kan inte göra något drag.' : chess.isThreefoldRepetition() ? 'Samma ställning tre gånger.' : chess.isInsufficientMaterial() ? 'Ingen av er har pjäser nog för att göra matt.' : 'Femtio drag utan slag eller bondedrag.'; sfx.check();
    }
    store.bump('chess', 'games');
    if (coins) store.addCoins(coins);
    showWins();
    hud.panel(`<h3>${title}</h3><p>${text}</p>${coins ? `<p style="font-size:22px">🪙 +${coins} mynt</p>` : ''}
      <div class="row"><button class="btn green" id="chess-again">Spela igen</button><button class="btn ghost" id="chess-level">Byt nivå</button><button class="btn ghost" id="chess-exit">Lobby</button></div>`);
    hud.el('chess-again').onclick = () => newGame(level);
    hud.el('chess-level').onclick = choose;
    hud.el('chess-exit').onclick = ctx.exit;
    return true;
  }
  function undo() {
    if (over || thinking || chess.history().length === 0) return;
    // Ta tillbaka datorns drag och ditt eget, så att det är din tur igen
    do { chess.undo(); } while (chess.history().length && chess.turn() !== meCh());
    const h = chess.history({ verbose: true }), last = h.length ? [h[h.length - 1].from, h[h.length - 1].to] : undefined;
    sfx.remove(); sync(last);
  }
  function newGame(lv) {
    clearTimeout(timer); level = lv; chess = new Chess(); over = false; thinking = false;
    hud.panel(null); showWins(); cg.set({ orientation: me, lastMove: undefined }); sync();
    hud.center(`<div class="small">${level.emoji} ${level.name}: vinst ger ${level.coins} mynt</div>`, 2200);
    if (chess.turn() !== meCh()) computerMove();
  }
  function choose() {
    clearTimeout(timer); over = true; thinking = false; status();
    const w = store.current.records.chess || {};
    hud.panel(`<h3>♟️ Schack</h3><p>Välj hur bra datorn ska spela</p>
      <div class="chess-levels">${LEVELS.map(l => `<button class="chess-level" data-level="${l.id}"><span class="big">${l.emoji}</span><span><b>${l.name}</b><small>${l.desc}</small></span><span class="coins">🪙 ${l.coins}<br><small>${w['wins_' + l.id] || 0} vinster</small></span></button>`).join('')}</div>
      <div class="chess-side"><span>Jag spelar:</span><button data-side="white" class="${me === 'white' ? 'active' : ''}">♙ Vit</button><button data-side="black" class="${me === 'black' ? 'active' : ''}">♟ Svart</button></div>`);
    const p = hud.el('hud-panel');
    p.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { me = b.dataset.side; p.querySelectorAll('[data-side]').forEach(o => o.classList.toggle('active', o === b)); });
    p.querySelectorAll('[data-level]').forEach(b => b.onclick = () => newGame(LEVELS.find(l => l.id === b.dataset.level)));
  }
  undoBtn.onclick = undo; newBtn.onclick = choose;
  showWins(); sync(); choose();
  // Testkrok (bara lokalt): window.__chess.load(fen) ställer upp en ställning så slutet av partiet kan provas snabbt
  if (location.hostname === 'localhost') window.__chess = { load(fen, lv) { clearTimeout(timer); if (lv) level = LEVELS.find(l => l.id === lv) || level; chess = new Chess(fen); over = false; thinking = false; hud.panel(null); showWins(); sync(); if (!checkEnd() && chess.turn() !== meCh()) computerMove(); } };

  return {
    dispose() { disposed = true; clearTimeout(timer); removeEventListener('resize', resize); cg.destroy(); root.remove(); },
  };
}
