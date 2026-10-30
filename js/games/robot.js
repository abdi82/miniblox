// Programmera roboten: bygg ett program av kommandon och se din figur utföra det i 3D. Samla alla mynt och nå målet.
import * as THREE from 'three';
import { Engine, hud, sfx } from '../engine.js';
import { buildAvatar, animateAvatar } from '../avatar.js';
import { LEVELS, parseMap, countProgram, simulate, stars as calcStars, DX, DY } from './robot-levels.js';

const CELL = 2;
const CSS = `
.rb-bar { position:absolute; left:0; right:0; bottom:0; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; padding:8px 10px max(8px,env(safe-area-inset-bottom)); background:rgba(10,14,40,.92); border-top:1px solid rgba(255,255,255,.15); pointer-events:auto; text-shadow:none; }
.rb-cmds { display:flex; flex-wrap:wrap; gap:6px; flex:1 1 300px; }
.rb-cmds button { border:0; border-radius:12px; min-width:64px; min-height:56px; padding:4px 10px; font-size:13px; font-weight:800; color:#fff; background:#335fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; }
.rb-cmds button b { font-size:22px; line-height:1.1; }
.rb-cmds button.rep { background:#9b51e0; } .rb-cmds button.util { background:rgba(255,255,255,.18); } .rb-cmds button.run { background:#00b06f; min-width:92px; font-size:16px; } .rb-cmds button.stop { background:#e2231a; }
.rb-cmds button:disabled { opacity:.35; }
.rb-prog { flex:1 1 300px; min-height:56px; display:flex; flex-wrap:wrap; align-items:center; gap:5px; padding:6px 8px; border-radius:12px; background:rgba(255,255,255,.1); }
.rb-chip { display:inline-flex; align-items:center; justify-content:center; min-width:40px; height:40px; padding:0 8px; border-radius:9px; background:#fff; color:#191b1d; font-size:20px; font-weight:800; border:0; }
.rb-chip.on { outline:3px solid #ffd54f; transform:scale(1.1); }
.rb-loop { display:inline-flex; align-items:center; gap:5px; padding:4px 6px 4px 4px; border-radius:11px; border:2px dashed #b388ff; background:rgba(155,81,224,.25); flex-wrap:wrap; }
.rb-loop.open { border-style:solid; box-shadow:0 0 0 2px #ffd54f; }
.rb-loop .rb-n { background:#9b51e0; color:#fff; font-size:15px; min-width:46px; }
.rb-loop .rb-hint { color:#d8c8ff; font-size:12px; font-weight:600; padding:0 4px; }
.rb-count { width:100%; color:#cfd8ff; font-size:13px; font-weight:700; text-align:left; }
.rb-count.full { color:#ffd54f; }
.rb-levels { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0 4px; }
.rb-levels button { border:0; border-radius:10px; padding:8px 0 4px; font-size:16px; font-weight:800; background:#e8eaed; color:var(--text); min-height:52px; line-height:1.2; }
.rb-levels button.done { background:#c8f1dc; } .rb-levels button.cur { outline:3px solid var(--blue); }
.rb-levels small { display:block; font-size:11px; color:#c9a400; letter-spacing:-1px; }
@media (max-width: 700px) { .rb-cmds button { min-width:56px; min-height:50px; } .rb-chip { min-width:34px; height:34px; font-size:17px; } }`;

export function start(ctx) {
  const e = new Engine(ctx.container, { sky: 0xdbeafe, fog: false });
  e.freeze = true; e.input.touchEl.hidden = true; e.input.takeLook = () => ({ x: 0, y: 0 });
  e.cam.yaw = 0; e.cam.pitch = 0.95; e.camTarget = new THREE.Vector3(0, -1.5, 0);
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const rec = () => { const r = ctx.store.current.records; r.robot = r.robot || {}; r.robot.stars = r.robot.stars || {}; return r.robot; };
  const firstUnsolved = () => { const s = rec().stars; const i = LEVELS.findIndex((_, k) => !s[k]); return i < 0 ? 0 : i; };

  let cur = firstUnsolved(), lv = null, L = null, world = null, coinMeshes = [], program = [], stack = [], running = false, queue = [], act = null, pos = { x: 0, y: 0, dir: 0 }, busy = false;
  const avatar = buildAvatar(ctx.player.avatar); e.scene.add(avatar);
  const wx = (x) => (x - (L.W - 1) / 2) * CELL, wz = (y) => (y - (L.H - 1) / 2) * CELL;
  const facing = (d) => Math.atan2(DX[d], DY[d]);

  function load(i) {
    cur = i; lv = LEVELS[i]; L = parseMap(lv.map); program = []; stack = []; running = false; queue = []; act = null; busy = false;
    if (world) { e.scene.remove(world); world.traverse(o => o.geometry?.dispose?.()); }
    for (const c of e.coins) e.scene.remove(c.mesh); e.coins = []; coinMeshes = [];
    world = new THREE.Group(); e.scene.add(world);
    const floorGeo = new THREE.BoxGeometry(CELL - 0.1, 0.3, CELL - 0.1), wallGeo = new THREE.BoxGeometry(CELL, 1.6, CELL), pitGeo = new THREE.BoxGeometry(CELL - 0.1, 0.1, CELL - 0.1);
    const f1 = new THREE.MeshLambertMaterial({ color: 0xeceff1 }), f2 = new THREE.MeshLambertMaterial({ color: 0xd9dee3 }), wallMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 }), pitMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e }), goalMat = new THREE.MeshLambertMaterial({ color: 0x66bb6a, emissive: 0x1b5e20, emissiveIntensity: 0.3 }), startMat = new THREE.MeshLambertMaterial({ color: 0x90caf9 });
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const c = L.cells[y][x];
      if (c === '#') { const m = new THREE.Mesh(wallGeo, wallMat); m.position.set(wx(x), 0.8 - 0.3, wz(y)); m.castShadow = m.receiveShadow = true; world.add(m); continue; }
      if (c === 'O') { const m = new THREE.Mesh(pitGeo, pitMat); m.position.set(wx(x), -1.2, wz(y)); world.add(m); continue; }
      const isStart = x === L.start.x && y === L.start.y;
      const m = new THREE.Mesh(floorGeo, c === 'G' ? goalMat : isStart ? startMat : (x + y) % 2 ? f1 : f2); m.position.set(wx(x), -0.15, wz(y)); m.receiveShadow = true; world.add(m);
      if (c === 'G') { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee })); pole.position.set(wx(x) + 0.7, 1.6, wz(y) - 0.7); world.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.06), new THREE.MeshLambertMaterial({ color: 0xffd54f, side: THREE.DoubleSide })); flag.position.set(wx(x) + 0.7 + 0.55, 2.8, wz(y) - 0.7); world.add(flag); }
      if (c === '$') coinMeshes.push(e.addCoin(wx(x), 1.1, wz(y)));
    }
    resetRobot(); renderBar(); hud.panel(null);
    hud.title(`🤖 Bana ${i + 1}: ${lv.name}`); updateHud();
    hud.center(`<div>Bana ${i + 1}</div><div class="small">${lv.name} · max ${lv.max} kommandon</div>`, 1600);
    fitCamera();
  }
  function resetRobot() {
    pos = { ...L.start }; avatar.position.set(wx(pos.x), 0, wz(pos.y)); avatar.rotation.y = facing(pos.dir); avatar.visible = true; avatar.scale.setScalar(0.46);
    for (const c of coinMeshes) if (c.taken) { c.taken = false; e.scene.add(c.mesh); }
  }
  function updateHud() { const s = rec().stars; const n = Object.keys(s).length, tot = Object.values(s).reduce((a, b) => a + b, 0); hud.right(`✅ ${n}/${LEVELS.length} · ⭐ ${tot}`); }
  function fitCamera() {
    const w = ctx.container.clientWidth || 1, h = ctx.container.clientHeight || 1; const barH = bar.offsetHeight || 120; const usable = Math.max(0.35, (h - barH - 60) / h); const aspect = w / h;
    const need = Math.max((L.W * CELL + 2) / (1.15 * aspect * 0.95), (L.H * CELL * 0.7 + 3) / (1.15 * usable));
    e.cam.dist = Math.max(9, need);
    // skjut målpunkten mot kameran så rutnätet hamnar ovanför programlisten
    e.camTarget.z = (1 - usable) * 0.5 * (need * 0.9);
  }

  // ---------- Programmet ----------
  const container = () => (stack.length ? stack[stack.length - 1].body : program);
  const count = () => countProgram(program);
  function add(c) {
    if (running) return; if (count() >= lv.max) { hud.center(`<div class="small">Max ${lv.max} kommandon. Prova 🔁 Upprepa!</div>`, 1500); return; }
    if (c === 'REP') { const rep = { c: 'REP', n: 3, body: [] }; container().push(rep); stack.push(rep); }
    else container().push({ c });
    sfx.place(); renderBar();
  }
  function closeLoop() { if (stack.length) { const rep = stack.pop(); if (!rep.body.length) { const arr = stack.length ? stack[stack.length - 1].body : program; arr.splice(arr.indexOf(rep), 1); } renderBar(); } }
  function removeLast() { if (running) return; const arr = container(); if (arr.length) arr.pop(); else if (stack.length) { closeLoop(); return; } sfx.remove(); renderBar(); }
  function removeItem(it, arr) { if (running) return; const i = arr.indexOf(it); if (i >= 0) arr.splice(i, 1); stack = stack.filter(s => s !== it && contains(it, s) === false); sfx.remove(); renderBar(); }
  const contains = (it, target) => it.c === 'REP' && it.body.some(b => b === target || contains(b, target));
  const ICON = { F: '⬆', L: '↰', R: '↱', J: '🦘' };
  function chipHtml(it, arr) {
    const id = ids.length; ids.push({ it, arr });
    if (it.c !== 'REP') return `<button class="rb-chip" data-id="${id}">${ICON[it.c]}</button>`;
    const open = stack.includes(it);
    return `<span class="rb-loop ${open ? 'open' : ''}"><button class="rb-chip rb-n" data-n="${id}">🔁×${it.n}</button>${it.body.map(b => chipHtml(b, it.body)).join('')}${open ? '<span class="rb-hint">← kommandon hamnar här</span>' : ''}<button class="rb-chip" data-id="${id}" style="min-width:26px;height:26px;font-size:13px;background:#ffcdd2">✕</button></span>`;
  }
  let ids = [];
  const bar = document.createElement('div'); bar.className = 'rb-bar'; hud.el('hud').appendChild(bar);
  function renderBar() {
    ids = []; const n = count(); const full = n >= lv.max; const inLoop = stack.length > 0;
    bar.innerHTML = `
      <div class="rb-cmds">
        <button data-c="F" ${full || running ? 'disabled' : ''}><b>⬆</b>Fram</button>
        <button data-c="L" ${full || running ? 'disabled' : ''}><b>↰</b>Vänster</button>
        <button data-c="R" ${full || running ? 'disabled' : ''}><b>↱</b>Höger</button>
        <button data-c="J" ${full || running ? 'disabled' : ''}><b>🦘</b>Hoppa</button>
        ${inLoop ? `<button class="rep" id="rb-close"><b>⤴</b>Klar</button>` : `<button class="rep" data-c="REP" ${full || running ? 'disabled' : ''}><b>🔁</b>Upprepa</button>`}
        <button class="util" id="rb-del" ${running ? 'disabled' : ''}><b>⌫</b>Ta bort</button>
        <button class="util" id="rb-clear" ${running ? 'disabled' : ''}><b>🗑</b>Rensa</button>
        <button class="${running ? 'stop' : 'run'}" id="rb-run">${running ? '■ Stopp' : '▶ Kör'}</button>
        <button class="util" id="rb-levels"><b>📋</b>Banor</button>
      </div>
      <div class="rb-prog">${program.length ? program.map(it => chipHtml(it, program)).join('') : '<span style="color:#aab;font-weight:600;font-size:14px">Tryck på knapparna för att bygga ditt program →</span>'}</div>
      <div class="rb-count ${full ? 'full' : ''}">${n} / ${lv.max} kommandon${full ? ' · fullt! Använd 🔁 Upprepa för att få plats' : ''} · ⭐⭐⭐ om du klarar det på ${lv.best}</div>`;
    bar.querySelectorAll('[data-c]').forEach(b => b.onclick = () => add(b.dataset.c));
    bar.querySelector('#rb-close') && (bar.querySelector('#rb-close').onclick = closeLoop);
    bar.querySelector('#rb-del').onclick = removeLast;
    bar.querySelector('#rb-clear').onclick = () => { if (running) return; program = []; stack = []; renderBar(); };
    bar.querySelector('#rb-run').onclick = () => running ? stopRun(true) : run();
    bar.querySelector('#rb-levels').onclick = showLevels;
    bar.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const { it, arr } = ids[+b.dataset.id]; removeItem(it, arr); });
    bar.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { if (running) return; const { it } = ids[+b.dataset.n]; const NS = [2, 3, 4, 5, 6, 8, 10]; it.n = NS[(NS.indexOf(it.n) + 1) % NS.length] || 2; renderBar(); });
    fitCamera();
  }

  // ---------- Köra ----------
  function run() {
    if (running || !program.length) { if (!program.length) hud.center('<div class="small">Bygg ett program först!</div>', 1200); return; }
    stack = []; resetRobot(); running = true; queue = simulate(lv, program); act = null; renderBar(); hud.center('');
  }
  function stopRun(manual) { running = false; queue = []; act = null; bar.querySelectorAll('.rb-chip.on').forEach(c => c.classList.remove('on')); if (manual) { resetRobot(); renderBar(); } }
  function highlight(it) { bar.querySelectorAll('.rb-chip.on').forEach(c => c.classList.remove('on')); if (!it) return; const idx = ids.findIndex(x => x.it === it); if (idx >= 0) bar.querySelector(`[data-id="${idx}"]`)?.classList.add('on'); }
  function nextEvent() {
    const ev = queue.shift(); if (!ev) { stopRun(); renderBar(); return; }
    highlight(ev.it);
    if (ev.t === 'turn') { act = { kind: 'turn', t: 0, dur: 0.28, from: avatar.rotation.y, to: facing(ev.dir) }; pos.dir = ev.dir; let d = act.to - act.from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; act.to = act.from + d; }
    else if (ev.t === 'move' || ev.t === 'jump') { act = { kind: ev.t, t: 0, dur: ev.t === 'jump' ? 0.55 : 0.4, fx: wx(pos.x), fz: wz(pos.y), tx: wx(ev.x), tz: wz(ev.y), coin: ev.coin }; pos.x = ev.x; pos.y = ev.y; if (ev.t === 'jump') sfx.jump(); }
    else if (ev.t === 'crash') { act = { kind: 'crash', t: 0, dur: 1.3, fx: avatar.position.x, fz: avatar.position.z, tx: wx(ev.x), tz: wz(ev.y) }; sfx.die(); hud.center('<div>Oj! 💥</div><div class="small">Roboten krockade. Försök igen!</div>', 1800); }
    else if (ev.t === 'fall') { act = { kind: 'fall', t: 0, dur: 1.3, fx: avatar.position.x, fz: avatar.position.z, tx: wx(ev.x), tz: wz(ev.y) }; sfx.die(); hud.center('<div>Oj! 🕳️</div><div class="small">Roboten ramlade i gropen. Försök igen!</div>', 1800); }
    else if (ev.t === 'win') { act = { kind: 'win', t: 0, dur: 0.9 }; sfx.win(); }
    else if (ev.t === 'end') { act = { kind: 'end', t: 0, dur: 1.2 }; hud.center(ev.onGoal ? `<div>Nästan! 🪙</div><div class="small">Du kom fram men missade ${ev.coinsLeft} mynt.</div>` : '<div>Hmm 🤔</div><div class="small">Roboten kom inte fram till målet. Ändra programmet!</div>', 2200); }
  }
  function finishWin() {
    const n = countProgram(program), st = calcStars(lv, program); const r = rec(); const first = !r.stars[cur]; const prevStars = r.stars[cur] || 0;
    let coins = first ? 10 : 2; if (st === 3 && prevStars < 3) coins += 5;
    ctx.store.update(p => { p.records.robot.stars[cur] = Math.max(prevStars, st); }); ctx.store.bump('robot', 'wins'); ctx.store.addCoins(coins); updateHud();
    const next = cur + 1 < LEVELS.length ? cur + 1 : null;
    const p = hud.panel(`<h3>🎉 Målet nått!</h3><div style="font-size:34px;letter-spacing:2px">${'⭐'.repeat(st)}${'<span style="opacity:.25">⭐</span>'.repeat(3 - st)}</div>
      <div>${n} kommandon${st < 3 ? ` · det går på ${lv.best}!` : ' · perfekt!'}</div><div style="margin-top:6px">+${coins} <span class="coin-icon" style="vertical-align:-3px"></span></div>
      <div class="row">${next != null ? `<button class="btn green" id="r-next">Nästa bana ▶</button>` : '<div style="font-size:14px">Alla banor klara! 🏆</div>'}<button class="btn ghost" id="r-again">Igen</button><button class="btn ghost" id="r-list">Banor</button></div>`);
    p.querySelector('#r-next') && (p.querySelector('#r-next').onclick = () => load(next));
    p.querySelector('#r-again').onclick = () => { hud.panel(null); resetRobot(); renderBar(); }; p.querySelector('#r-list').onclick = showLevels;
  }
  function showLevels() {
    if (running) stopRun(true);
    const s = rec().stars;
    const p = hud.panel(`<h3>🤖 Programmera roboten</h3><div class="sub" style="font-weight:600">Välj bana</div>
      <div class="rb-levels">${LEVELS.map((l, i) => `<button data-i="${i}" class="${s[i] ? 'done' : ''} ${i === cur ? 'cur' : ''}" title="${l.name}">${i + 1}<small>${s[i] ? '⭐'.repeat(s[i]) : '&nbsp;'}</small></button>`).join('')}</div>
      <div class="row"><button class="btn ghost" id="r-close">Stäng</button></div>`);
    p.querySelectorAll('[data-i]').forEach(b => b.onclick = () => load(+b.dataset.i));
    p.querySelector('#r-close').onclick = () => hud.panel(null);
  }

  hud.bottom('');
  load(cur);
  e.start((dt) => {
    e.input.takeClicks();
    if (running && !act) nextEvent();
    if (act) {
      act.t += dt; const s = Math.min(1, act.t / act.dur), ease = s * s * (3 - 2 * s);
      if (act.kind === 'turn') { avatar.rotation.y = act.from + (act.to - act.from) * ease; animateAvatar(avatar, e.time, false, false); }
      else if (act.kind === 'move' || act.kind === 'jump') {
        avatar.position.x = act.fx + (act.tx - act.fx) * ease; avatar.position.z = act.fz + (act.tz - act.fz) * ease;
        avatar.position.y = act.kind === 'jump' ? Math.sin(s * Math.PI) * 2.2 : 0; animateAvatar(avatar, e.time, act.kind === 'move', act.kind === 'jump');
        if (act.coin && s > 0.5) { const c = coinMeshes.find(c => !c.taken && Math.abs(c.x - act.tx) < 0.1 && Math.abs(c.z - act.tz) < 0.1); if (c) { c.taken = true; e.scene.remove(c.mesh); sfx.coin(); } }
      } else if (act.kind === 'crash') { const k = Math.min(1, s * 4); avatar.position.x = act.fx + (act.tx - act.fx) * 0.35 * k; avatar.position.z = act.fz + (act.tz - act.fz) * 0.35 * k; avatar.rotation.z = Math.sin(act.t * 30) * 0.15 * (1 - s); }
      else if (act.kind === 'fall') { const k = Math.min(1, s * 3); avatar.position.x = act.fx + (act.tx - act.fx) * k; avatar.position.z = act.fz + (act.tz - act.fz) * k; avatar.position.y = -Math.max(0, s * 3 - 0.8) * 2.5; }
      else if (act.kind === 'win') { avatar.position.y = Math.abs(Math.sin(s * Math.PI * 2)) * 1.2; avatar.rotation.y += dt * 6; }
      if (s >= 1) {
        const k = act.kind; act = null;
        if (k === 'crash' || k === 'fall' || k === 'end') { stopRun(); avatar.rotation.z = 0; resetRobot(); renderBar(); }
        else if (k === 'win') { stopRun(); avatar.position.y = 0; renderBar(); finishWin(); }
        else avatar.position.y = 0;
      }
    } else animateAvatar(avatar, e.time, false, false);
  });
  const onResize = () => fitCamera(); addEventListener('resize', onResize);
  return { dispose() { removeEventListener('resize', onResize); bar.remove(); style.remove(); e.dispose(); } };
}
