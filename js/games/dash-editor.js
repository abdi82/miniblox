// Banredigerare till Kubdash: rita egna banor med fingret. Rutnätet är 10 rader högt (rad 0 längst ner)
// och sparas i samma textformat som dash-levels.js, så parseLevel() i dash.js kan läsa det oförändrat.
export const H = 10;
const MIN_COLS = 20, TAIL = 10, MAX_COLS = 400; // TAIL = tomma kolumner mellan sista saken och mållinjen

export const TOOLS = [
  { ch: '.', label: 'Tomt' },
  { ch: '#', label: 'Block' },
  { ch: '^', label: 'Spik' },
  { ch: 'v', label: 'Takspik' },
  { ch: 'o', label: 'Orb' },
  { ch: '_', label: 'Platta' },
  { ch: '$', label: 'Mynt' },
  { ch: 'g', label: 'Gravitation' },
  { ch: 's', label: 'Skepp' },
  { ch: 'c', label: 'Kub' },
];

// ---------- Text ⇄ rutnät ----------
// Rutnätet är en lista med kolumner; varje kolumn är en sträng med 10 tecken, index 0 = längst ner.
export function mapToGrid(map) {
  const cols = [];
  for (const tok of (map || '').trim().split(/\s+/)) {
    if (!tok) continue;
    let n = 1, t = tok; const m = /^(\d+)\*(.+)$/.exec(tok); if (m) { n = +m[1]; t = m[2]; }
    const col = Array(H).fill('.');
    for (const part of t.split('+')) {
      const a = /^(.)@(\d+)(?:-(\d+))?$/.exec(part);
      if (a) { const y0 = +a[2], y1 = a[3] ? +a[3] : y0; for (let y = y0; y <= y1 && y < H; y++) col[y] = a[1]; }
      else [...part].forEach((ch, y) => { if (ch !== '.' && y < H) col[y] = ch; });
    }
    for (let i = 0; i < n && cols.length < MAX_COLS; i++) cols.push(col.join(''));
  }
  return cols;
}
export function lastUsed(grid) { for (let x = grid.length - 1; x >= 0; x--) if (grid[x] !== '.'.repeat(H)) return x; return -1; }
export function endCol(grid) { return Math.max(MIN_COLS, lastUsed(grid) + 1 + TAIL); }
export function gridToMap(grid) {
  const n = endCol(grid), toks = [];
  for (let x = 0; x < n; x++) {
    const col = (grid[x] || '.'.repeat(H)).replace(/\.+$/, '') || '.';
    const prev = toks[toks.length - 1];
    if (prev && prev.t === col) prev.n++; else toks.push({ t: col, n: 1 });
  }
  const out = toks.map(k => (k.n > 1 ? `${k.n}*${k.t}` : k.t));
  const lines = []; for (let i = 0; i < out.length; i += 24) lines.push(out.slice(i, i + 24).join(' '));
  return lines.join('\n');
}

// ---------- Rita en ruta (används både i rutnätet och i verktygsknapparna) ----------
// px, py = skärmkoordinat för rutans övre vänstra hörn, u = rutans storlek
export function drawTile(g, ch, px, py, u, col = '#2bd4ff') {
  g.save();
  if (ch === '#') { g.fillStyle = '#1d1c4a'; g.fillRect(px, py, u, u); g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, u - 2, u - 2); }
  else if (ch === '^' || ch === 'v') {
    g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    if (ch === '^') { g.moveTo(px, py + u); g.lineTo(px + u / 2, py); g.lineTo(px + u, py + u); } else { g.moveTo(px, py); g.lineTo(px + u / 2, py + u); g.lineTo(px + u, py); }
    g.closePath(); g.fill(); g.stroke();
  } else if (ch === 'o') {
    g.fillStyle = '#ffd400'; g.shadowColor = '#ffd400'; g.shadowBlur = u * 0.4; g.beginPath(); g.arc(px + u / 2, py + u / 2, u * 0.32, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(px + u / 2, py + u / 2, u * 0.18, 0, Math.PI * 2); g.stroke();
  } else if (ch === '_') { g.fillStyle = '#ffd400'; g.shadowColor = '#ffd400'; g.shadowBlur = u * 0.3; g.beginPath(); g.ellipse(px + u / 2, py + u - 3, u * 0.45, u * 0.12, 0, 0, Math.PI * 2); g.fill(); }
  else if (ch === '$') { g.fillStyle = '#ffc107'; g.shadowColor = '#ffc107'; g.shadowBlur = u * 0.3; g.beginPath(); g.ellipse(px + u / 2, py + u / 2, u * 0.26, u * 0.3, 0, 0, Math.PI * 2); g.fill(); }
  else if ('gsc'.includes(ch)) {
    const c = ch === 'g' ? '#4da3ff' : ch === 's' ? '#ff5fd2' : '#5bff7a';
    g.fillStyle = c; g.shadowColor = c; g.shadowBlur = u * 0.4; g.globalAlpha = 0.85; g.beginPath(); g.roundRect(px + u * 0.2, py - u, u * 0.6, u * 3, u * 0.3); g.fill(); g.globalAlpha = 1; g.shadowBlur = 0;
    g.fillStyle = '#fff'; g.font = `bold ${u * 0.5}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch === 'g' ? '⇅' : ch === 's' ? '✈' : '■', px + u / 2, py + u * 0.5);
  }
  g.restore();
}

// ---------- Själva redigeraren ----------
// state = { name, grid, scroll, tool }  (ändras på plats så att den kan återöppnas efter "Testa")
// cb = { onTest(state), onSave(state), onClose(state), color }
export function openEditor(container, state, cb) {
  const col = cb.color || '#b388ff';
  state.grid = state.grid || []; state.scroll = state.scroll ?? -3; state.tool = state.tool || '#';
  const root = document.createElement('div'); root.className = 'dash-ed';
  root.innerHTML = `
    <div class="dash-ed-grid"><canvas></canvas></div>
    <div class="dash-ed-bars">
      <div class="dash-ed-palette">${TOOLS.map(t => `<button type="button" class="dash-ed-tool" data-tool="${t.ch}" aria-label="${t.label}"><canvas width="36" height="36"></canvas><span>${t.label}</span></button>`).join('')}</div>
      <div class="dash-ed-actions">
        <input class="dash-ed-name" maxlength="20" placeholder="Banans namn" autocomplete="off">
        <button type="button" class="hud-btn" id="ed-test">▶ Testa</button>
        <button type="button" class="hud-btn green" id="ed-save">💾 Spara</button>
        <button type="button" class="hud-btn" id="ed-close">✕ Stäng</button>
      </div>
    </div>`;
  container.appendChild(root);
  const gridEl = root.querySelector('.dash-ed-grid'), canvas = gridEl.querySelector('canvas'), g = canvas.getContext('2d');
  const nameEl = root.querySelector('.dash-ed-name'); nameEl.value = state.name || '';
  nameEl.oninput = () => { state.name = nameEl.value; state.dirty = true; };
  // verktygsikoner
  root.querySelectorAll('.dash-ed-tool').forEach(b => {
    const ic = b.querySelector('canvas').getContext('2d'), ch = b.dataset.tool;
    if (ch === '.') { ic.strokeStyle = 'rgba(255,255,255,.4)'; ic.setLineDash([3, 3]); ic.strokeRect(6, 6, 24, 24); }
    else if ('gsc'.includes(ch)) { ic.save(); ic.beginPath(); ic.rect(0, 0, 36, 36); ic.clip(); drawTile(ic, ch, 6, 12, 24, col); ic.restore(); }
    else drawTile(ic, ch, 6, 6, 24, col);
    b.onclick = () => { state.tool = ch; selectTool(); };
  });
  const selectTool = () => root.querySelectorAll('.dash-ed-tool').forEach(b => b.classList.toggle('active', b.dataset.tool === state.tool));
  selectTool();
  root.querySelector('#ed-test').onclick = () => cb.onTest(state);
  root.querySelector('#ed-save').onclick = () => cb.onSave(state);
  root.querySelector('#ed-close').onclick = () => cb.onClose(state);

  // ----- geometri -----
  let w = 0, h = 0, u = 10, oy = 0, ox = 0, pending = 0;
  const resize = () => { const dpr = Math.min(devicePixelRatio, 2); w = gridEl.clientWidth; h = gridEl.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); u = Math.max(8, Math.floor((h - 46) / H)); oy = h - 24; ox = 0; render(); };
  const sx = (x) => ox + (x - state.scroll) * u, sy = (y) => oy - y * u; // sy = skärm-y för rutans underkant
  const cellAt = (cx, cy) => ({ x: Math.floor((cx - ox) / u + state.scroll), y: Math.floor((oy - cy) / u) });
  const maxScroll = () => Math.min(MAX_COLS - 2, endCol(state.grid) + 20) - Math.floor(w / u) + 2;
  const clampScroll = () => { state.scroll = Math.max(-3, Math.min(Math.max(-3, maxScroll()), state.scroll)); };
  const render = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); };

  function setCell(x, y) {
    if (x < 0 || x >= MAX_COLS || y < 0 || y >= H) return;
    while (state.grid.length <= x) state.grid.push('.'.repeat(H));
    const colStr = [...state.grid[x]]; const ch = state.tool;
    colStr[y] = (ch !== '.' && colStr[y] === ch) ? '.' : ch; // samma verktyg en gång till = ta bort
    state.grid[x] = colStr.join(''); state.dirty = true; render();
  }

  // ----- pekare: tryck = sätt, dra i sidled = scrolla -----
  let ptr = null;
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s0: state.scroll, drag: false, t: performance.now() }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
    if (!ptr.drag && Math.hypot(dx, dy) > 10) ptr.drag = true;
    if (ptr.drag) { state.scroll = ptr.s0 - dx / u; clampScroll(); render(); }
  });
  const pointerEnd = (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (!ptr.drag && e.type === 'pointerup') { const r = canvas.getBoundingClientRect(); const c = cellAt(e.clientX - r.left, e.clientY - r.top); setCell(c.x, c.y); }
    ptr = null;
  };
  canvas.addEventListener('pointerup', pointerEnd); canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); state.scroll += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / u * 0.6; clampScroll(); render(); }, { passive: false });
  const key = (e) => { if (document.activeElement === nameEl) return; if (e.key === 'ArrowLeft') state.scroll -= 3; else if (e.key === 'ArrowRight') state.scroll += 3; else return; e.preventDefault(); clampScroll(); render(); };
  addEventListener('keydown', key);

  // ----- rita -----
  function draw() {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#0b0b2b'); grad.addColorStop(1, '#1a0b3a'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const x0 = Math.floor(state.scroll) - 1, x1 = Math.ceil(state.scroll + w / u) + 1, end = endCol(state.grid);
    // tak och golv
    g.fillStyle = '#11103a'; g.fillRect(0, 0, w, sy(H)); g.fillRect(0, sy(0), w, h - sy(0));
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16; g.fillRect(0, sy(0), w, 3); g.fillRect(0, sy(H) - 3, w, 3); g.shadowBlur = 0;
    // rutnät
    g.lineWidth = 1;
    for (let x = Math.max(0, x0); x <= x1; x++) { g.strokeStyle = x % 10 === 0 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(sx(x) + 0.5, sy(H)); g.lineTo(sx(x) + 0.5, sy(0)); g.stroke();
      if (x % 10 === 0) { g.fillStyle = 'rgba(255,255,255,.5)'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(x, sx(x) + 4, sy(H) - 5); } }
    g.strokeStyle = 'rgba(255,255,255,.07)'; for (let y = 1; y < H; y++) { g.beginPath(); g.moveTo(Math.max(0, sx(0)), sy(y) + 0.5); g.lineTo(w, sy(y) + 0.5); g.stroke(); }
    // start
    if (x0 <= 0) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, sy(H), sx(0), sy(0) - sy(H));
      g.fillStyle = col; g.globalAlpha = 0.6; g.fillRect(sx(-2) + u * 0.05, sy(1) + u * 0.05, u * 0.9, u * 0.9); g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('Start', sx(-1.5), sy(1) - 4); }
    // rutor (portaler ritas sist så de hamnar ovanpå)
    const portals = [];
    for (let x = Math.max(0, x0); x <= Math.min(x1, state.grid.length - 1); x++) { const c = state.grid[x]; if (c === '.'.repeat(H)) continue;
      for (let y = 0; y < H; y++) { const ch = c[y]; if (ch === '.') continue; if ('gsc'.includes(ch)) portals.push([ch, x, y]); else drawTile(g, ch, sx(x), sy(y + 1), u, col); } }
    for (const [ch, x, y] of portals) drawTile(g, ch, sx(x), sy(y + 1), u, col);
    // mållinje
    if (end >= x0 && end <= x1) { g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 20; g.fillRect(sx(end), sy(H), 4, sy(0) - sy(H)); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('Mål', sx(end) + 8, sy(H) - 5); }
    // rullningslist
    const total = Math.max(1, maxScroll() + 3 + w / u), vis = w / u, bw = Math.max(24, w * vis / total), bx = (state.scroll + 3) / total * w;
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(bx, h - 20, bw, 3, 2); g.fill();
    // tips
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '600 12px sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText(`Tryck = sätt ${TOOLS.find(t => t.ch === state.tool).label.toLowerCase()} · tryck igen = ta bort · dra i sidled = scrolla`, w - 10, h - 7);
  }

  const ro = new ResizeObserver(resize); ro.observe(gridEl); resize();
  return {
    state,
    close() { ro.disconnect(); removeEventListener('keydown', key); cancelAnimationFrame(pending); root.remove(); },
  };
}
