// Lobbyn: spelare, startsida med spel, spelsida, avatar-editor och butik. Startar spelen i helskärm.
import * as THREE from 'three';
import { store, SKIN_COLORS, CLOTH_COLORS, FACES, HATS } from './store.js';
import { buildAvatar, animateAvatar } from './avatar.js';
import { hud, fmtTime, isTouch } from './engine.js';

const GAMES = [
  { id: 'obby', title: 'Hinderbanan', emoji: '🏃', bg: 'linear-gradient(135deg,#ff9a3c,#ff3c6e)', rating: 96, desc: 'Hoppa mellan plattformar, akta dig för lavan och ta dig till målflaggan. Gröna plattformar sparar var du är. Klara banan snabbt för att slå ditt rekord!',
    tips: ['Dubbelhopp: tryck hoppa en gång till i luften', 'Trippelhopp: tryck en tredje gång så flyger du i 10 sekunder (nedräkning uppe till vänster)', 'Första gången du klarar banan får du 60 mynt', 'Färre dödar = fler mynt'], load: () => import('./games/obby.js') },
  { id: 'coins', title: 'Myntjakten', emoji: '🪙', bg: 'linear-gradient(135deg,#ffd200,#f7971e)', rating: 94, desc: 'Samla så många mynt du hinner på 60 sekunder. Mynten finns på marken, på lådor och högst upp i tornen. Varje mynt du samlar blir dina!',
    tips: ['Alla mynt = 25 bonusmynt', 'Tornen har två mynt på toppen'], load: () => import('./games/coins.js') },
  { id: 'build', title: 'Bygg din värld', emoji: '🧱', bg: 'linear-gradient(135deg,#43e97b,#38f9d7)', rating: 98, desc: 'Bygg vad du vill med färgade block: hus, torn, labyrinter. Din värld sparas, så du kan fortsätta nästa gång. Tryck "Spela i världen" för att gå runt i det du byggt!',
    tips: ['Högerklick tar bort block', 'Du kan hoppa upp på ett block i taget'], load: () => import('./games/build.js') },
];
const app = document.getElementById('app');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const faceEmoji = (p) => FACES.find(f => f.id === p.avatar.face)?.emoji || '🙂';
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }

// ---------- Skal ----------
function shell(active, content) {
  const p = store.current;
  const nav = [['home', '🏠', 'Hem'], ['avatar', '🧍', 'Avatar'], ['shop', '🛍️', 'Butik'], ['players', '👥', 'Byt spelare']];
  app.innerHTML = `
    <header class="topbar">
      <a href="#/" class="logo"><span class="cube"></span>MiniBlox</a>
      <nav>${nav.slice(0, 3).map(([id, , l]) => `<a href="#/${id === 'home' ? '' : id}" class="${active === id ? 'active' : ''}">${l}</a>`).join('')}</nav>
      <div class="spacer"></div>
      <div class="coins"><span class="coin-icon"></span>${p.coins}</div>
      <div class="me"><span class="face" style="background:${p.avatar.skin}">${faceEmoji(p)}</span>${esc(p.name)}</div>
    </header>
    <div class="layout">
      <aside class="sidebar">${nav.map(([id, ico, l]) => `<a href="#/${id === 'home' ? '' : id}" class="${active === id ? 'active' : ''}"><span class="ico">${ico}</span>${l}</a>`).join('')}</aside>
      <main class="main">${content}</main>
    </div>`;
}
function gameCard(g) {
  const r = store.current.records[g.id] || {};
  const meta = g.id === 'obby' && r.best ? `Rekord ${fmtTime(r.best)}` : g.id === 'coins' && r.best ? `Rekord ${r.best} mynt` : g.id === 'build' ? `${Object.keys(store.current.world || {}).length} block byggda` : 'Inte spelat än';
  return `<a class="card" href="#/game/${g.id}"><div class="thumb" style="background:${g.bg}">${g.emoji}</div><div class="title">${g.title}</div><div class="meta">👍 ${g.rating}% · ${meta}</div></a>`;
}

// ---------- Vyer ----------
function viewPlayers() {
  app.innerHTML = `<div class="center">
    <div class="logo" style="justify-content:center;font-size:34px"><span class="cube" style="width:32px;height:32px"></span>MiniBlox</div>
    <h1>Vem spelar?</h1>
    <div class="players">
      ${store.players.map(p => `<button class="player-card" data-id="${p.id}"><span class="face" style="background:${p.avatar.skin}">${faceEmoji(p)}</span>${esc(p.name)}<div class="sub" style="font-size:12px;font-weight:600"><span class="coin-icon" style="width:11px;height:11px"></span> ${p.coins}</div></button>`).join('')}
      <button class="player-card new" id="new-player"><span class="face" style="background:#eee">＋</span>Ny spelare</button>
    </div>
    ${isIOS && !standalone ? `<p class="sub tip">📱 Tips för iPad: tryck på <b>Dela</b> <span style="font-size:16px">⎋</span> i Safari och välj <b>Lägg till på hemskärmen</b>. Då öppnas MiniBlox i helskärm som en app.</p>` : ''}
    <div id="new-form" hidden><input class="input" id="new-name" maxlength="14" placeholder="Vad heter du?" autocomplete="off" /><div style="margin-top:12px"><button class="btn green" id="new-ok">Börja spela</button></div></div>
  </div>`;
  app.querySelectorAll('.player-card[data-id]').forEach(b => b.onclick = () => { store.select(b.dataset.id); location.hash = '#/'; });
  const form = app.querySelector('#new-form'), name = app.querySelector('#new-name');
  app.querySelector('#new-player').onclick = () => { form.hidden = false; name.focus(); };
  const create = () => { const n = name.value.trim(); if (!n) return name.focus(); store.addPlayer(n); location.hash = '#/avatar'; };
  app.querySelector('#new-ok').onclick = create; name.onkeydown = (e) => { if (e.key === 'Enter') create(); };
}
function viewHome() {
  const p = store.current;
  shell('home', `<h1>Hej ${esc(p.name)}! 👋</h1>
    <h2>Rekommenderat för dig</h2><div class="grid">${GAMES.map(gameCard).join('')}</div>
    <h2>Dina rekord</h2>
    <div class="stats">
      <div class="stat"><b>${p.records.obby?.best ? fmtTime(p.records.obby.best) : '–'}</b><span>Hinderbanan, bästa tid</span></div>
      <div class="stat"><b>${p.records.coins?.best ?? '–'}</b><span>Myntjakten, flest mynt</span></div>
      <div class="stat"><b>${Object.keys(p.world || {}).length}</b><span>Block i din värld</span></div>
      <div class="stat"><b>${p.owned.length - 1}</b><span>Hattar du äger</span></div>
    </div>`);
}
function viewGame(id) {
  const g = GAMES.find(x => x.id === id); if (!g) return (location.hash = '#/');
  const r = store.current.records[id] || {};
  shell('home', `<div class="game-hero">
    <div><div class="thumb" style="background:${g.bg}">${g.emoji}</div></div>
    <div>
      <h1 style="margin-top:0">${g.title}</h1><div class="sub">Av MiniBlox · 👍 ${g.rating}%</div>
      <button class="btn green play" id="play">▶ Spela</button>
      <div class="stats">
        <div class="stat"><b>${id === 'obby' ? (r.best ? fmtTime(r.best) : '–') : id === 'coins' ? (r.best ?? '–') : Object.keys(store.current.world || {}).length}</b><span>${id === 'obby' ? 'Bästa tid' : id === 'coins' ? 'Flest mynt' : 'Block'}</span></div>
        <div class="stat"><b>${r.wins ?? r.plays ?? 0}</b><span>${id === 'obby' ? 'Gånger klarad' : 'Gånger spelad'}</span></div>
      </div>
    </div></div>
    <h2>Om spelet</h2><div class="desc">${g.desc}<ul>${g.tips.map(t => `<li>${t}</li>`).join('')}</ul>
    <b>Så spelar du:</b> ${isTouch ? 'Vänster sida av skärmen: gå. Höger sida: titta runt. Knappen "Hoppa": hoppa, tryck igen i luften för dubbelhopp, och en tredje gång för att flyga i 10 sekunder.' : 'WASD eller piltangenter: gå. Mellanslag: hoppa, tryck igen i luften för dubbelhopp, och en tredje gång för att flyga i 10 sekunder. Dra med musen: titta runt.'}</div>`);
  app.querySelector('#play').onclick = () => play(g);
}

// ---------- Avatar-editor ----------
let preview = null;
function stopPreview() { if (preview) { preview.stop(); preview = null; } }
function startPreview(canvasHost) {
  stopPreview();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50); camera.position.set(0, 1.6, 7); camera.lookAt(0, 1.2, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(3, 6, 4); scene.add(d);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.2, 32), new THREE.MeshLambertMaterial({ color: 0xdfe6ee })); floor.position.y = -0.1; scene.add(floor);
  let avatar = null, running = true, t = 0, yaw = 0, dragging = false, lastX = 0, auto = true;
  const resize = () => { const w = canvasHost.clientWidth, h = canvasHost.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);
  renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lastX = e.clientX; });
  addEventListener('pointermove', (e) => { if (dragging) { yaw += (e.clientX - lastX) * 0.01; lastX = e.clientX; } });
  addEventListener('pointerup', () => { dragging = false; });
  const loop = () => { if (!running) return; t += 0.016; if (auto) yaw += 0.006; if (avatar) { avatar.rotation.y = yaw; animateAvatar(avatar, t, false, false); } renderer.render(scene, camera); requestAnimationFrame(loop); };
  loop();
  return {
    set(cfg) { if (avatar) scene.remove(avatar); avatar = buildAvatar(cfg); scene.add(avatar); },
    stop() { running = false; removeEventListener('resize', resize); renderer.dispose(); renderer.domElement.remove(); },
  };
}
function viewAvatar(tab = 'skin') {
  const p = store.current;
  const tabs = [['skin', 'Hud'], ['shirt', 'Tröja'], ['pants', 'Byxor'], ['face', 'Ansikte'], ['hat', 'Hatt'], ['name', 'Namn']];
  let body = '';
  if (tab === 'skin' || tab === 'shirt' || tab === 'pants') {
    const cols = tab === 'skin' ? SKIN_COLORS : CLOTH_COLORS;
    body = `<div class="swatches">${cols.map(c => `<button class="swatch ${p.avatar[tab] === c ? 'active' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}</div>`;
  } else if (tab === 'face') {
    body = `<div class="items">${FACES.map(f => `<button class="item ${p.avatar.face === f.id ? 'active' : ''}" data-v="${f.id}"><span class="big">${f.emoji}</span>${f.label}</button>`).join('')}</div>`;
  } else if (tab === 'hat') {
    body = `<div class="items">${HATS.map(h => { const owned = p.owned.includes(h.id); return `<button class="item ${p.avatar.hat === h.id ? 'active' : ''} ${owned ? '' : 'locked'}" data-v="${h.id}" data-owned="${owned}"><span class="big">${h.emoji}</span>${h.label}${owned ? '' : `<div class="price">🔒 <span class="coin-icon"></span>${h.price}</div>`}</button>`; }).join('')}</div>
      <p class="sub">Låsta hattar köper du i <a href="#/shop" style="color:var(--blue);font-weight:700">Butiken</a>.</p>`;
  } else {
    body = `<input class="input" id="name" value="${esc(p.name)}" maxlength="14" style="text-align:left" /><div style="margin-top:12px"><button class="btn" id="save-name">Spara</button></div>`;
  }
  shell('avatar', `<h1>Avatar</h1><div class="editor">
    <div class="preview" id="preview"></div>
    <div><div class="tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${tab === id ? 'active' : ''}">${l}</button>`).join('')}</div>${body}</div></div>`);
  preview = startPreview(app.querySelector('#preview')); preview.set(p.avatar);
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { stopPreview(); viewAvatar(b.dataset.tab); });
  app.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    if (b.dataset.owned === 'false') { toast('Köp hatten i butiken först'); return; }
    store.update(x => { x.avatar[tab] = b.dataset.v; }); preview.set(store.current.avatar);
    app.querySelectorAll('[data-v]').forEach(o => o.classList.toggle('active', o === b));
  });
  const sn = app.querySelector('#save-name'); if (sn) sn.onclick = () => { const n = app.querySelector('#name').value.trim(); if (n) { store.update(x => { x.name = n; }); toast('Sparat!'); viewAvatar('name'); } };
}
function viewShop() {
  const p = store.current;
  shell('shop', `<h1>Butik</h1><p class="sub">Du har <b><span class="coin-icon"></span> ${p.coins} mynt</b>. Tjäna fler genom att spela!</p>
    <h2>Hattar</h2><div class="items">${HATS.filter(h => h.id !== 'none').map(h => { const owned = p.owned.includes(h.id); return `<button class="item" data-buy="${h.id}" ${owned ? 'disabled' : ''}><span class="big">${h.emoji}</span>${h.label}<div class="price">${owned ? '✅ Du äger den' : `<span class="coin-icon"></span>${h.price}`}</div></button>`; }).join('')}</div>`);
  app.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const h = HATS.find(x => x.id === b.dataset.buy);
    if (store.current.coins < h.price) return toast(`Du behöver ${h.price - store.current.coins} mynt till`);
    store.update(x => { x.coins -= h.price; x.owned.push(h.id); x.avatar.hat = h.id; }); toast(`Du köpte ${h.label}! 🎉`); viewShop();
  });
}

// ---------- Spel ----------
let engine = null;
async function play(g) {
  const gameEl = document.getElementById('game'), container = document.getElementById('game-canvas');
  gameEl.hidden = false; hud.reset(); hud.center('<div class="small">Laddar…</div>');
  if (engine) { engine.dispose(); engine = null; }
  const mod = await g.load();
  const ctx = { container, player: store.current, store, touch: isTouch, restart: () => play(g), exit: () => exitGame() };
  engine = mod.start(ctx);
  document.getElementById('hud-exit').onclick = exitGame;
  try { if (isTouch && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch { /* ok */ }
}
function exitGame() {
  if (engine) { engine.dispose(); engine = null; }
  hud.reset(); document.getElementById('game').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.();
  route();
}

// ---------- Router ----------
function route() {
  stopPreview();
  if (engine) { engine.dispose(); engine = null; hud.reset(); document.getElementById('game').hidden = true; }
  const h = location.hash.replace(/^#\/?/, '');
  if (!store.current || h === 'players') return viewPlayers();
  if (h === '') return viewHome();
  if (h === 'avatar') return viewAvatar();
  if (h === 'shop') return viewShop();
  if (h.startsWith('game/')) return viewGame(h.slice(5));
  location.hash = '#/';
}
addEventListener('hashchange', route);
route();
