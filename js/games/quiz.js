// Frågekampen: appen läser upp frågor på svenska eller engelska, barnen svarar med rösten (spelas in och tolkas),
// och poängen räknas i en tävling mellan spelarna. Fungerar också med skrivna svar om röst saknas.
import { hud, sfx } from '../engine.js';
import { QUESTIONS, mathQuestion, NUMBER_WORDS } from './quiz-data.js';

const LEVELS = [['1', '🐣 Liten', '4 år'], ['2', '🙂 Mellan', '8 år'], ['3', '🦁 Stor', '10 år']];
const LANGS = [['sv', '🇸🇪 Svenska'], ['en', '🇬🇧 Engelska'], ['mix', '🔀 Blandat']];
const PER_PLAYER = 8, TIME = 12;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// ---------- Röst ----------
// Välj den röst som låter bäst: Apples förbättrade/premium-röster och Googles röster låter naturliga, standardrösterna robotiska.
const PREFERRED = { sv: ['alva', 'klara', 'oskar', 'sofie', 'google svenska', 'microsoft'], en: ['samantha', 'ava', 'allison', 'zoe', 'nicky', 'susan', 'aaron', 'daniel', 'karen', 'moira', 'tessa', 'google us english', 'google uk english', 'microsoft'] };
// Apples skämtröster (Albert, Bahh, Bubblor, Orgel …) ska aldrig väljas automatiskt.
const NOVELTY = /albert|bahh|bells|bjällror|boing|bubbl|cello|bad news|dåliga|good news|goda nyheter|jester|gyckl|organ|orgel|superstar|superstj|trinoids|whisper|visk|wobble|vingl|zarvox|fred|junior|kathy|ralph|grandma|grandpa|mormor|morfar|rocko|shelley|eddy|flo\b|reed|sandy|hysterical|pipe|deranged/;
export function voicesFor(lang) {
  const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const pre = lang === 'en' ? 'en' : 'sv';
  const score = (v) => { const n = v.name.toLowerCase(); let sc = 0; if (/premium|enhanced|förbättrad|natural|neural|siri/.test(n)) sc += 4; if (!v.localService || n.includes('google')) sc += 2; if (PREFERRED[pre].some(x => n.includes(x))) sc += 3; if (/compact|espeak|eloquence/.test(n)) sc -= 3; if (NOVELTY.test(n)) sc -= 6; return sc; };
  return all.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(pre)).sort((a, b) => score(b) - score(a));
}
export function pickVoice(lang) {
  const list = voicesFor(lang); const wanted = localStorage.getItem('miniblox.voice.' + (lang === 'en' ? 'en' : 'sv'));
  return list.find(v => v.name === wanted) || list[0] || null;
}
function speak(text, lang) {
  return new Promise((res) => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'en' ? 'en-US' : 'sv-SE'; u.rate = 0.92; u.pitch = 1.05;
      const v = pickVoice(lang); if (v) { u.voice = v; u.lang = v.lang; }
      u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 8000);
    } catch { res(); }
  });
}
function listen(lang, ms) {
  return new Promise((res) => {
    if (!SR) return res(null);
    const rec = new SR(); rec.lang = lang === 'en' ? 'en-US' : 'sv-SE'; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
    const alts = new Set(); let done = false; let last = '';
    const finish = () => { if (done) return; done = true; try { rec.stop(); } catch { /* ok */ } res({ alts: [...alts], text: last }); };
    rec.onresult = (ev) => { for (const r of ev.results) { for (let i = 0; i < r.length; i++) { alts.add(r[i].transcript); } last = r[0].transcript; } if (ev.results[ev.results.length - 1].isFinal) finish(); };
    rec.onerror = () => finish(); rec.onend = () => finish();
    try { rec.start(); } catch { res(null); }
    setTimeout(finish, ms);
    listen.stop = finish;
  });
}
let recorder = null, stream = null;
async function startRecording() {
  try {
    stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start(); return () => new Promise((res) => { recorder.onstop = () => res(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })); try { recorder.stop(); } catch { res(null); } });
  } catch { return null; }
}

// ---------- Svarskoll ----------
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
function toNumber(words, lang) {
  const map = NUMBER_WORDS[lang]; let total = 0, found = false;
  for (const w of words.split(' ')) {
    if (/^\d+$/.test(w)) { total += +w; found = true; }
    else if (map[w] != null) { total += map[w]; found = true; }
    else { // sammansatta tal: "tjugofyra", "twentyfour", "hundrafem"
      const parts = Object.keys(map).filter(k => map[k] >= 20 && w.startsWith(k) && map[w.slice(k.length)] != null);
      if (parts.length) { const k = parts.sort((a, b) => b.length - a.length)[0]; total += map[k] + map[w.slice(k.length)]; found = true; }
    }
  }
  return found ? total : null;
}
export function isCorrect(answer, accepted, lang) {
  const a = norm(answer); if (!a) return false;
  for (const acc of accepted) {
    const n = norm(acc);
    if (a === n || new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(a)) return true;
    if (/^\d+$/.test(n)) { const got = toNumber(a, lang); if (got === +n) return true; const got2 = toNumber(a, lang === 'en' ? 'sv' : 'en'); if (got2 === +n) return true; }
  }
  return false;
}

export function start(ctx) {
  const root = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0;background:linear-gradient(160deg,#1e3c72,#2a5298 50%,#6a11cb);'; ctx.container.appendChild(root);
  const store = ctx.store; let alive = true;
  hud.title('Frågekampen'); hud.center(''); hud.bottom('');
  const allPlayers = store.players;
  let players = [], lang = 'mix', qi = 0, turn = 0, state = null, lastBlobUrl = null;

  // ---------- Startpanel ----------
  function setup() {
    const chosen = new Set(players.length ? players.map(p => p.id) : [store.current.id]);
    const levels = Object.fromEntries(allPlayers.map(p => [p.id, p.quizLevel || (p.id === store.current.id ? '2' : '2')]));
    const render = () => {
      hud.panel(`<h3>🎤 Frågekampen</h3><div class="sub" style="font-size:13px">Jag läser frågan, du svarar med rösten. Snabbt svar ger extra poäng!</div>
        <div style="margin-top:12px;font-size:13px"><b>Vilka tävlar?</b> (tryck för att välja)</div>
        <div class="row" style="flex-wrap:wrap">${allPlayers.map(p => `<button class="btn small ${chosen.has(p.id) ? 'green' : 'ghost'}" data-p="${p.id}">${chosen.has(p.id) ? '✔ ' : ''}${p.name}</button>`).join('')}</div>
        <div style="margin-top:12px;font-size:13px"><b>Nivå per spelare</b></div>
        ${[...chosen].map(id => { const p = allPlayers.find(x => x.id === id); return `<div class="row" style="margin-top:6px;align-items:center"><span style="width:70px;text-align:right;font-size:13px">${p.name}</span>${LEVELS.map(l => `<button class="btn small ${levels[id] === l[0] ? '' : 'ghost'}" data-lvl="${id}:${l[0]}" title="${l[2]}">${l[1]}</button>`).join('')}</div>`; }).join('')}
        <div style="margin-top:12px;font-size:13px"><b>Språk</b></div>
        <div class="row" style="margin-top:6px">${LANGS.map(l => `<button class="btn small ${lang === l[0] ? '' : 'ghost'}" data-lang="${l[0]}">${l[1]}</button>`).join('')}</div>
        <details style="margin-top:12px;font-size:13px;text-align:left"><summary style="cursor:pointer;text-align:center"><b>🔊 Röster</b> (byt om rösten låter robotisk)</summary>
          ${['sv', 'en'].map(l => { const list = voicesFor(l); const cur = pickVoice(l); return `<div class="row" style="margin-top:8px;align-items:center;justify-content:flex-start"><span style="width:70px">${l === 'sv' ? 'Svenska' : 'Engelska'}</span><select data-voice="${l}" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--line);font-size:13px">${list.length ? list.map(v => `<option ${cur && v.name === cur.name ? 'selected' : ''}>${v.name}</option>`).join('') : '<option>Inga röster hittades</option>'}</select><button class="btn ghost small" data-try="${l}">Prova</button></div>`; }).join('')}
          <div class="sub" style="font-size:11px;margin-top:8px">På iPad: hämta naturliga röster i <b>Inställningar → Hjälpmedel → Uppläst innehåll → Röster → Svenska → Alva (Premium)</b> och Engelska → Samantha/Ava (Premium). Öppna sedan spelet igen så dyker de upp här.</div>
        </details>
        <div class="row" style="margin-top:16px"><button class="btn green" id="go" style="font-size:18px">🏁 Starta tävlingen</button></div>
        <div class="sub" style="font-size:11px;margin-top:8px">${SR ? 'Röstsvar: på. Svaret spelas in så du kan lyssna efteråt.' : 'Den här webbläsaren kan inte tolka tal, så ni skriver svaren. Svaret spelas ändå in.'}</div>`);
      document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const id = b.dataset.p; if (chosen.has(id)) { if (chosen.size > 1) chosen.delete(id); } else chosen.add(id); render(); });
      document.querySelectorAll('[data-lvl]').forEach(b => b.onclick = () => { const [id, l] = b.dataset.lvl.split(':'); levels[id] = l; store.updatePlayer(id, p => { p.quizLevel = l; }); render(); });
      document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { lang = b.dataset.lang; render(); });
      document.querySelectorAll('[data-voice]').forEach(sel => sel.onchange = () => localStorage.setItem('miniblox.voice.' + sel.dataset.voice, sel.value));
      document.querySelectorAll('[data-try]').forEach(b => b.onclick = () => speak(b.dataset.try === 'en' ? 'Hello! What is the capital of Sweden?' : 'Hej! Vad heter Sveriges huvudstad?', b.dataset.try));
      document.getElementById('go').onclick = () => { players = [...chosen].map(id => ({ ...allPlayers.find(x => x.id === id), level: +levels[id], score: 0, correct: 0, streak: 0 })); begin(); };
    };
    render();
  }

  // ---------- Frågor ----------
  const used = new Set();
  function nextQuestion(p) {
    const qlang = lang === 'mix' ? (Math.random() < 0.5 ? 'sv' : 'en') : lang;
    if (Math.random() < 0.3) return mathQuestion(p.level, qlang);
    const pool = QUESTIONS.filter(q => q.t === p.level && q.lang === qlang && !used.has(q.q));
    const q = pool.length ? pool[Math.floor(Math.random() * pool.length)] : mathQuestion(p.level, qlang);
    used.add(q.q); return q;
  }
  async function begin() {
    hud.panel(null); qi = 0; turn = 0; used.clear();
    for (const p of players) { p.score = 0; p.correct = 0; p.streak = 0; }
    await speak(lang === 'en' ? 'Lets go!' : 'Då kör vi!', lang === 'en' ? 'en' : 'sv');
    askNext();
  }
  function scoreboard() { return `<div class="row" style="gap:14px;flex-wrap:wrap">${players.map((p, i) => `<span style="padding:4px 10px;border-radius:999px;background:${i === turn ? '#ffd54f' : '#eee'};font-size:13px">${p.name}: <b>${p.score}</b></span>`).join('')}</div>`; }
  async function askNext() {
    if (!alive) return;
    if (qi >= PER_PLAYER * players.length) return finish();
    turn = qi % players.length; const p = players[turn]; const q = nextQuestion(p); const qlang = q.lang; const ansLang = q.ansLang || q.lang;
    state = { q, p, t0: 0, answered: false };
    hud.right(`${p.name} · fråga ${Math.floor(qi / players.length) + 1}/${PER_PLAYER}`);
    hud.panel(`<div class="sub" style="font-size:13px">${players.length > 1 ? `<b style="font-size:18px;color:#1e3c72">${p.name}s tur!</b><br>` : ''}${qlang === 'en' ? '🇬🇧 Svara på ' : '🇸🇪 Svara på '}${ansLang === 'en' ? 'engelska' : 'svenska'}</div>
      <div style="font-size:${q.math ? 40 : 24}px;font-weight:800;margin:14px 0;line-height:1.3">${q.math ? q.show : q.q}</div>
      <div id="timer" style="height:10px;border-radius:5px;background:#eee;overflow:hidden;margin:6px 0 14px"><div id="bar" style="height:100%;width:100%;background:#00b06f;transition:width .2s linear"></div></div>
      <div id="answer-area">
        <button class="btn" id="mic" style="width:120px;height:120px;border-radius:50%;font-size:40px;background:#e53935;box-shadow:0 0 0 8px rgba(229,57,53,.25)">🎤</button>
        <div class="sub" style="font-size:12px;margin-top:8px">${SR ? 'Tryck och svara högt' : 'Tryck och säg svaret, skriv sedan vad du sa'}</div>
        <div id="heard" style="min-height:24px;margin-top:8px;font-weight:600"></div>
        <div id="typebox" ${SR ? 'hidden' : ''}><input class="input" id="typed" placeholder="Skriv svaret" style="margin-top:8px;max-width:260px" /><div class="row"><button class="btn small" id="send">Svara</button></div></div>
        ${SR ? '<button class="btn ghost small" id="showtype" style="margin-top:6px">⌨️ Skriv i stället</button>' : ''}
      </div>
      <div class="row" style="margin-top:12px"><button class="btn ghost small" id="repeat">🔊 Läs igen</button><button class="btn ghost small" id="skip">Vet inte</button></div>
      <div style="margin-top:12px">${scoreboard()}</div>`);
    const mic = document.getElementById('mic');
    document.getElementById('repeat').onclick = () => speak(q.q, qlang);
    document.getElementById('skip').onclick = () => resolve('', null);
    mic.onclick = () => capture();
    const send = document.getElementById('send'); if (send) send.onclick = () => resolve(document.getElementById('typed').value, null);
    const typed = document.getElementById('typed'); if (typed) typed.onkeydown = (ev) => { if (ev.key === 'Enter') resolve(typed.value, null); };
    const st = document.getElementById('showtype'); if (st) st.onclick = () => { document.getElementById('typebox').hidden = false; st.hidden = true; typed?.focus(); };
    if (!SR && st) st.hidden = true;
    await speak(q.q, qlang);
    state.t0 = performance.now();
    const tick = setInterval(() => { if (!alive || state.answered || state.q !== q) return clearInterval(tick); const left = Math.max(0, 1 - (performance.now() - state.t0) / 1000 / TIME); const bar = document.getElementById('bar'); if (bar) { bar.style.width = left * 100 + '%'; bar.style.background = left < 0.3 ? '#e53935' : '#00b06f'; } if (left <= 0) { clearInterval(tick); if (!state.answered) resolve('', null); } }, 200);
    if (SR) capture(); // börja lyssna direkt
  }
  async function capture() {
    if (!state || state.answered || state.listening) return; state.listening = true;
    const mic = document.getElementById('mic'); if (mic) { mic.style.background = '#43a047'; mic.textContent = '👂'; }
    const stopRec = await startRecording();
    const ansLang = state.q.ansLang || state.q.lang;
    const heard = await listen(ansLang, 6000);
    const blob = stopRec ? await stopRec() : null;
    state.listening = false;
    if (mic) { mic.style.background = '#e53935'; mic.textContent = '🎤'; }
    if (!state.answered) {
      if (heard && (heard.alts.length || heard.text)) resolve(heard.text, blob, heard.alts);
      else if (!SR) { const h = document.getElementById('heard'); if (h) h.textContent = blob ? 'Inspelat! Skriv nu vad du sa.' : ''; state.blob = blob; }
      else { const h = document.getElementById('heard'); if (h) h.textContent = 'Jag hörde inget. Tryck på micken igen, eller skriv svaret.'; state.blob = blob; const tb = document.getElementById('typebox'); if (tb) tb.hidden = false; const st2 = document.getElementById('showtype'); if (st2) st2.hidden = true; }
    }
  }
  function resolve(text, blob, alts = []) {
    if (!state || state.answered) return; state.answered = true;
    const { q, p } = state; const ansLang = q.ansLang || q.lang;
    const elapsed = (performance.now() - state.t0) / 1000;
    const candidates = [text, ...alts].filter(Boolean);
    const ok = candidates.some(c => isCorrect(c, q.a, ansLang));
    let pts = 0;
    if (ok) { p.correct++; p.streak++; pts = 10 + Math.max(0, Math.round(5 - elapsed / 2)) + (p.streak >= 3 ? 3 : 0); sfx.coin(); } else { p.streak = 0; sfx.remove(); }
    p.score += pts;
    blob = blob || state.blob; if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = blob ? URL.createObjectURL(blob) : null;
    hud.panel(`<div style="font-size:56px">${ok ? '✅' : '❌'}</div><h3 style="color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? (pts >= 14 ? 'Blixtsnabbt!' : 'Rätt!') : (text ? 'Fel' : 'Tiden gick ut')}</h3>
      ${text ? `<div class="sub" style="font-size:13px">Du sa: "${text}"</div>` : ''}
      <div style="margin-top:6px">Rätt svar: <b>${q.a[0]}</b></div>
      ${ok ? `<div style="color:var(--green);font-weight:800;font-size:20px;margin-top:6px">+${pts} poäng${p.streak >= 3 ? ' 🔥' : ''}</div>` : ''}
      <div class="row" style="margin-top:12px">${lastBlobUrl ? '<button class="btn ghost small" id="play">🔁 Lyssna på ditt svar</button>' : ''}<button class="btn green" id="next">Nästa</button></div>
      <div style="margin-top:12px">${scoreboard()}</div>`);
    speak(ok ? (ansLang === 'en' ? 'Correct!' : 'Rätt!') : (ansLang === 'en' ? `The answer is ${q.a[0]}` : `Rätt svar är ${q.a[0]}`), ansLang);
    const play = document.getElementById('play'); if (play) play.onclick = () => { const a = new Audio(lastBlobUrl); a.play(); };
    document.getElementById('next').onclick = () => { qi++; askNext(); };
  }
  function finish() {
    const ranked = [...players].sort((a, b) => b.score - a.score); const win = ranked[0]; const tie = ranked.length > 1 && ranked[1].score === win.score;
    sfx.win(); speak(tie ? 'Oavgjort!' : `${win.name} vann!`, 'sv');
    const rewards = players.map(p => { const r = players.length > 1 ? (p === win && !tie ? 20 : 5) + p.correct : 5 + p.correct; store.updatePlayer(p.id, x => { x.coins = Math.max(0, x.coins + r); const rec = x.records.quiz = x.records.quiz || {}; rec.plays = (rec.plays || 0) + 1; if (p === win && !tie && players.length > 1) rec.wins = (rec.wins || 0) + 1; if (!rec.best || p.score > rec.best) rec.best = p.score; }); return [p, r]; });
    hud.right('');
    hud.panel(`<h3>${tie ? '🤝 Oavgjort!' : `🏆 ${win.name} vann!`}</h3>
      ${ranked.map((p, i) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid #eee;font-size:15px"><span>${['🥇', '🥈', '🥉'][i] || ''} ${p.name}</span><span>${p.correct}/${PER_PLAYER} rätt · <b>${p.score} p</b> · +${rewards.find(r => r[0] === p)[1]} 🪙</span></div>`).join('')}
      <div class="row" style="margin-top:14px"><button class="btn green" id="again">Igen!</button><button class="btn ghost" id="setup">Ändra spelare</button><button class="btn ghost" id="lobby">Lobbyn</button></div>`);
    document.getElementById('again').onclick = () => begin();
    document.getElementById('setup').onclick = () => setup();
    document.getElementById('lobby').onclick = () => ctx.exit();
  }

  if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { if (alive && !players.length) setup(); }; }
  setup();
  return {
    stop() { alive = false; },
    dispose() { alive = false; try { speechSynthesis.cancel(); } catch { /* ok */ } try { listen.stop?.(); } catch { /* ok */ } if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl); root.remove(); },
  };
}
