// Lobbyn: spelare, startsida med spel, spelsida, avatar-editor och butik. Startar spelen i helskärm.
import * as THREE from 'three';
import { store, SKIN_COLORS, CLOTH_COLORS, FACES, HATS } from './store.js';
import { buildAvatar, animateAvatar } from './avatar.js';
import { hud, isTouch } from './engine.js';
import { checkForUpdate, VERSION } from './update.js';

const GAMES = [
  { id: 'obby', owner: 'Yakob', title: 'Hinderbanan', emoji: '🏃', bg: 'linear-gradient(135deg,#ff9a3c,#ff3c6e)', rating: 96, desc: 'En bana som aldrig tar slut! Hoppa mellan plattformar, akta dig för lavan och kom så långt du kan. Det blir svårare ju längre du kommer. Gröna plattformar är kontrollpunkter och ger mynt. Välj vilket djur du vill vara!',
    tips: ['Välj djur: groda hoppar högt, gepard springer fort, örn flyger länge, kanin hoppar tre gånger, sköldpadda tål lava', 'Dubbelhopp: tryck hoppa en gång till i luften', 'Trippelhopp: tryck en tredje gång så flyger du i 10 sekunder (nedräkning uppe till vänster)', 'Varje kontrollpunkt ger 2 mynt, var tionde ger 10 extra', 'Rekordet räknas i meter'], load: () => import('./games/obby.js') },
  { id: 'coins', owner: 'Yakob', title: 'Myntjakten', emoji: '🪙', bg: 'linear-gradient(135deg,#ffd200,#f7971e)', rating: 94, desc: 'Samla så många mynt du hinner på 60 sekunder. Mynten finns på marken, på lådor och högst upp i tornen. Varje mynt du samlar blir dina!',
    tips: ['Alla mynt = 25 bonusmynt', 'Tornen har två mynt på toppen'], load: () => import('./games/coins.js') },
  { id: 'build', owner: 'Zaki', title: 'Bygg din värld', emoji: '🧱', bg: 'linear-gradient(135deg,#43e97b,#38f9d7)', rating: 98, desc: 'Bygg vad du vill med färgade block: hus, torn, labyrinter. Din värld sparas, så du kan fortsätta nästa gång. Tryck "Spela i världen" för att gå runt i det du byggt!',
    tips: ['Högerklick tar bort block', 'Du kan hoppa upp på ett block i taget'], load: () => import('./games/build.js') },
  { id: 'dash', owner: 'Zaki', title: 'Kubdash', emoji: '🟦', bg: 'linear-gradient(135deg,#1a0b3a,#2bd4ff)', rating: 97, desc: 'Kuben springer själv till musiken. Tryck för att hoppa över spikar och block. Nuddar du något börjar du om från början! Tre banor: Lätt, Normal och Svår, med hopp-orbs, studsplattor, skeppsflygning och gravitation som vänds upp och ner. Hitta de hemliga mynten. Rita egna banor i banredigeraren!',
    tips: ['Håll inne knappen så hoppar du igen direkt när du landar', 'Övningsläge: börja om från senaste gröna flaggan i stället för från början', 'Rita egna banor: tryck på Egna banor i banvalet'], load: () => import('./games/dash.js') },
  { id: 'city', owner: 'Zaki', title: 'Stadsbyggaren', emoji: '🏙️', bg: 'linear-gradient(135deg,#00c6ff,#0072ff)', rating: 97, desc: 'Bygg din egen stad! Dra vägar, sätt bostäder, butiker, fabriker och parker på rutnätet. Folk flyttar in, husen växer i tre nivåer, små bilar kör på vägarna och varje dag kommer skatten in i kronor. Staden sparas så du kan bygga vidare nästa gång. Varje 100 nya invånare ger dig 10 mynt!',
    tips: ['Vägar först! Hus måste ha en väg högst två rutor bort, annars får de ett rött utropstecken', 'Bostäder växer när det finns butiker eller fabriker i närheten, och parker gör att de når nivå 3', 'Butiker och fabriker växer när många bor i närheten', 'Slut på kronor? Vänta på nästa dag, då kommer skatten'], load: () => import('./games/city.js') },
  { id: 'mystery', owner: 'Noah', title: 'Noahs Murder Mysteri', emoji: '🔪', bg: 'linear-gradient(135deg,#2b2d42,#e53935)', rating: 95, desc: 'Åtta figurer i en herrgård. En är skurk med kniv, en är sheriff med pistol, resten är oskyldiga. Vem är vem? Oskyldiga: spring, göm dig och samla mynt. Sheriff: hitta skurken och skjut. Skurk: ta alla innan tiden går ut! Du spelar mot sju datorstyrda figurer, rollerna lottas varje runda.',
    tips: ['Skurken avslöjas om någon ser honom ta någon', 'Om sheriffen åker ut ligger pistolen kvar på golvet, plocka upp den och bli hjälte!', 'Sheriff: sikta med kameran mot skurken och tryck Skjut. Skjuter du en oskyldig åker du ut själv'], load: () => import('./games/mystery.js') },
  { id: 'quiz', owner: 'Tävling', title: 'Frågekampen', emoji: '🎤', bg: 'linear-gradient(135deg,#1e3c72,#6a11cb)', rating: 96, desc: 'Appen läser upp frågor med röst på svenska eller engelska och du svarar högt med rösten! Svaret spelas in så du kan lyssna på dig själv. Tävla mot syskonen: alla får lika många frågor på sin egen nivå, snabba svar ger extra poäng, och den som vinner får mest mynt. Räknefrågor, djur, länder, engelska ord och mycket mer.',
    tips: ['Nivå Liten (4 år): färger, djur och enkla engelska ord', 'Nivå Mellan (8 år) och Stor (10 år): huvudstäder, räkning, engelska meningar', 'Tre rätt i rad ger bonus 🔥', 'Fungerar bäst i Safari på iPaden: tillåt mikrofonen när den frågar'], load: () => import('./games/quiz.js') },
  { id: 'blockly', owner: 'Hjärngympa', title: 'Blockly Games', emoji: '🧩', bg: 'linear-gradient(135deg,#5b8def,#8e44ad)', rating: 95, vendorPath: 'vendor/blockly-games/sv', unit: 'poäng', desc: 'Lär dig programmera genom att pussla ihop block! Googles Blockly Games på svenska: Pussel, Labyrint, Fågel, Sköldpadda, Film, Musik och Damm. Styr en figur genom labyrinten, rita med sköldpaddan och gör egna filmer med kod. Du får 5 mynt varje gång du startar.',
    tips: ['Pussel och Labyrint passar Noah (4 år) med lite hjälp av en storebror eller vuxen', 'Fågel och Sköldpadda passar Zaki (8 år) och Yakob (10 år)', 'Film och Musik: gör egna animationer och låtar med kod', 'Dina lösningar sparas i webbläsaren så du kan fortsätta där du var'], how: 'Tryck på ett spel på startsidan. Dra block från listan till arbetsytan och tryck på "Kör program". Pilen uppe till vänster går tillbaka till startsidan, "‹ Lobby" går tillbaka hit.', load: () => import('./games/blockly.js') },
  { id: 'chess', owner: 'Hjärngympa', title: 'Schack mot datorn', emoji: '♟️', bg: 'linear-gradient(135deg,#2c3e50,#b58863)', rating: 97, desc: 'Spela schack mot datorn på tre nivåer: Nybörjare, Lagom och Svår. Tryck på en pjäs så visas alla rutor den får gå till. Gör du ett misstag kan du ångra draget. Vinner du får du mynt: 10, 20 eller 40 beroende på nivå!',
    tips: ['Nybörjare: datorn drar lite hur som helst men tar pjäser när den kan, bra för att lära sig', 'Lagom: datorn tänker två drag framåt. Svår: tre drag framåt', 'Bonden blir alltid dam när den når sista raden', 'Håll koll på "Schack!": då måste du rädda kungen', 'Du kan välja att spela med svart, då börjar datorn'], how: 'Tryck på en pjäs och sedan på rutan du vill flytta till (eller dra pjäsen). Knappen Ångra tar tillbaka ditt senaste drag. Nytt parti låter dig byta nivå.', load: () => import('./games/chess.js') },
  { id: 'sokoban', owner: 'Hjärngympa', title: 'Lådknuffaren', emoji: '📦', bg: 'linear-gradient(135deg,#f7971e,#ffd200)', rating: 96, desc: 'Knuffa lådorna till de orange målrutorna! Du kan bara knuffa, aldrig dra, så tänk efter innan du kör fast en låda i ett hörn. 25 banor, från pyttesmå till riktigt kluriga. Varje bana du löser ger mynt: 10 första gången och 2 om du löser den igen.',
    tips: ['En låda i ett hörn sitter fast för alltid: då är det bara att trycka Ångra', 'Två lådor bredvid varandra längs en vägg går inte att flytta', 'Räkna ut vilken låda som ska in sist, den behöver fri väg', 'Färre knuffar ger inte fler mynt, men du kan tävla med syskonen om vem som löser banan på minst knuffar'], how: isTouch ? 'Svep på skärmen eller tryck på pilarna nere till vänster för att gå ett steg. Gå in i en låda så knuffar du den. Knapparna Ångra, Börja om och Banor finns uppe till höger.' : 'Piltangenter eller WASD går ett steg i taget. Gå in i en låda så knuffar du den. Z ångrar, R börjar om. Du kan också svepa med musen.', load: () => import('./games/sokoban.js') },
  { id: 'robot', owner: 'Hjärngympa', title: 'Programmera roboten', emoji: '🤖', bg: 'linear-gradient(135deg,#00c9ff,#92fe9d)', rating: 97, desc: 'Din figur är en robot som bara gör precis det du säger! Bygg ett program av kommandon: Fram, Vänster, Höger, Hoppa och Upprepa. Tryck Kör och se roboten gå steg för steg. Samla alla mynt och kom fram till den gröna flaggan. Krockar den med en vägg eller ramlar i en grop får du ändra programmet och köra igen. 20 banor, och på de sista måste du använda Upprepa för att få plats inom max antal kommandon!',
    tips: ['Vänster och Höger vrider bara roboten, den går inte', 'Hoppa flyger över en ruta: perfekt över gropar', 'Upprepa: allt du lägger in i den lila rutan körs flera gånger. Tryck på 🔁×3 för att byta antal och på Klar när loopen är färdig', 'Tre stjärnor får du om programmet inte är längre än det bästa', 'Tryck på ett kommando i programmet för att ta bort det'], how: 'Tryck på knapparna längst ner för att lägga till kommandon i programmet. Tryck ▶ Kör för att starta roboten. Ta bort tar bort det sista kommandot, Rensa tömmer allt. Banor byter bana.', load: () => import('./games/robot.js') },
  { id: 'sudoku', owner: 'Hjärngympa', title: 'Barnsudoku', emoji: '🔢', bg: 'linear-gradient(135deg,#667eea,#764ba2)', rating: 95, desc: 'Sudoku för alla åldrar! Börja med 4×4 där du sorterar djur: varje djur ska finnas exakt en gång i varje rad, kolumn och ruta. Sedan 6×6 och riktigt 9×9 med siffror. Varje pussel slumpas fram och har alltid precis en lösning. Fel markeras försiktigt med rosa, och du har tre ledtrådar per pussel. Mynt: 5, 10 eller 20 beroende på storlek, och din bästa tid sparas.',
    tips: ['Leta efter raden eller rutan som bara saknar en symbol', 'Blir en ruta rosa har du valt fel, prova en annan', 'Ledtråden fyller i rutan du har markerat, eller en slumpad tom ruta', 'Spara ledtrådarna till slutet när det blir riktigt svårt'], how: 'Tryck på en tom ruta och sedan på ett djur eller en siffra i raden under. Sudda tar bort. På datorn går det också att skriva siffror och flytta med piltangenterna.', load: () => import('./games/sudoku.js') },
  // Klassiker: kända spel med öppen källkod som körs i en ruta inuti appen (se vendor/README.md för källor och licenser)
  { id: 'g2048', owner: 'Klassiker', title: '2048', emoji: '🔢', bg: 'linear-gradient(135deg,#edc22e,#f65e3b)', rating: 93, vendorPath: 'vendor/2048', unit: 'poäng', desc: 'Skjut brickorna åt något håll. När två brickor med samma tal krockar blir de en bricka med dubbla talet: 2 och 2 blir 4, 4 och 4 blir 8… Kan du komma till 2048? Spelet sparas automatiskt så du kan fortsätta nästa gång.',
    tips: ['Håll din största bricka i ett hörn och fyll på runt den', 'Skjut inte brickorna åt alla håll huller om buller, välj två riktningar du mest använder', 'Varje omgång ger mynt: 1 mynt per 250 poäng (högst 40). Rekordet ligger i spelet självt', '👶 Passar även Noah (4 år): bara svep, inget kan gå fel'], how: 'Pekskärm: svep uppåt, nedåt, åt vänster eller höger på rutnätet. Tangentbord: piltangenterna. "New Game" börjar om.', load: () => import('./games/classic.js') },
  { id: 'hextris', owner: 'Klassiker', title: 'Hextris', emoji: '⬡', bg: 'linear-gradient(135deg,#2c3e50,#3498db)', rating: 92, vendorPath: 'vendor/hextris', unit: 'poäng', desc: 'Som Tetris, fast på en sexkant! Färgade block faller in mot mitten från alla håll. Vrid sexkanten så att tre eller fler block i samma färg hamnar bredvid varandra, då försvinner de. Blir högen för hög är det slut.',
    tips: ['Fyll inte en sida för högt, vrid runt och fördela blocken', 'Gör kombo: ta bort flera grupper snabbt efter varandra så får du mer poäng', 'Varje omgång ger mynt: 1 mynt per 100 poäng (högst 40). Rekordet ligger i spelet självt', '🧒 För de äldre: det går fort och kräver att man tänker på färgerna'], how: 'Pekskärm: tryck på vänster eller höger sida av skärmen för att vrida sexkanten. Tangentbord: vänster- och högerpil vrider, nedpil snabbar på. Tryck på play-knappen i mitten för att börja.', load: () => import('./games/classic.js') },
  { id: 'clumsy', owner: 'Klassiker', title: 'Clumsy Bird', emoji: '🐦', bg: 'linear-gradient(135deg,#4ec0ca,#ded895)', rating: 91, vendorPath: 'vendor/clumsy-bird', unit: 'rör', desc: 'Den klumpiga fågeln flaxar fram mellan gröna rör. Tryck för att flaxa uppåt, släpp så dalar den. Nuddar du ett rör eller marken är det kört! Hur många rör klarar du?',
    tips: ['Små, lugna tryck är bättre än att hamra på skärmen', 'Titta på nästa öppning, inte på fågeln', 'Varje omgång ger mynt: 1 mynt per rör du klarar (högst 40). Rekordet ligger i spelet självt', '🧒 För de äldre: svårt! Men även små kan prova, man trycker bara'], how: 'Pekskärm: tryck var som helst för att flaxa. Tangentbord: mellanslag. Tryck en gång till efter game over för att spela igen.', load: () => import('./games/classic.js') },
  { id: 'astray', owner: 'Klassiker', title: 'Astray', emoji: '🔮', bg: 'linear-gradient(135deg,#1b1b2f,#7b2cbf)', rating: 94, vendorPath: 'vendor/astray', unit: 'nivåer', desc: 'Rulla kulan genom labyrinten och hitta vägen ut! Utgången finns längst bort i hörnet. Varje gång du kommer ut blir nästa labyrint lite större. Lugnt och utan fiender, ingen tid som rinner ut.',
    tips: ['👶 Passar Noah (4 år): inget kan gå fel, rulla bara runt tills du hittar ut', 'Utgången är i högra kanten, högst upp', 'Varje klarad labyrint ger 3 mynt'], how: 'Pekskärm: lägg fingret på skärmen och dra åt det håll kulan ska rulla, håll kvar så rullar den vidare. Tangentbord: piltangenterna.', load: () => import('./games/classic.js') },
  { id: 'hexgl', owner: 'Klassiker', title: 'HexGL', emoji: '🚀', bg: 'linear-gradient(135deg,#0b132b,#00c9ff)', rating: 95, vendorPath: 'vendor/hexgl', unit: 'poäng', query: { touch: '?quality=1', desktop: '' }, desc: 'Ett superfort rymdskepp på en svävande bana genom staden! Kör tre varv så fort du kan utan att krocka med kanterna, för skeppet tål bara ett visst antal smällar. Kör över de blå plattorna så får du turbo.',
    tips: ['🧒 För de äldre (Yakob och Zaki): snabbt och svårt, kräver precision', 'Blå plattor = turbo, röda kanter skadar skeppet', 'Laddningen tar en stund första gången, allt sparas i surfplattan', 'Kommer du i mål får du poäng: fler ju snabbare du kör (10 till 60), och poängen blir mynt'], how: 'Pekskärm: tryck Start. Håll ett finger på högra halvan av skärmen för att gasa, och dra med ett annat finger åt vänster eller höger på vänstra halvan för att styra (bilden före loppet visar). Tangentbord: pil upp = gas, pil vänster/höger = styra, A/D = luta.', load: () => import('./games/classic.js') },
];
const app = document.getElementById('app');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHELF = { 'Klassiker': '🕹️ Klassiker', 'Hjärngympa': '🧠 Hjärngympa', 'Tävling': '🏆 Tävlingar' };
const shelfName = (o) => SHELF[o] || `🎮 ${o}s spel`;
const ownerLabel = (o) => SHELF[o] ? SHELF[o].slice(SHELF[o].indexOf(' ') + 1) : `${o}s spel`;
const faceEmoji = (p) => FACES.find(f => f.id === p.avatar.face)?.emoji || '🙂';
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }

// ---------- Skal ----------
function shell(active, content) {
  const p = store.current;
  const nav = [['home', '🏠', 'Hem'], ['avatar', '🧍', 'Avatar'], ['shop', '🛍️', 'Butik'], ['players', '👥', 'Byt spelare']];
  app.innerHTML = `
    <header class="topbar">
      <a href="#/" class="logo"><span class="cube"></span>Mina Boys Games</a>
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
  const dashBest = g.id === 'dash' ? Math.max(0, ...Object.values(r).map(x => x.best || 0)) : 0;
  const meta = g.id === 'obby' && r.dist ? `Rekord ${r.dist} m` : g.id === 'coins' && r.best ? `Rekord ${r.best} mynt` : g.id === 'build' ? `${Object.keys(store.current.world || {}).length} block byggda` : g.id === 'dash' && dashBest ? `Bäst ${dashBest} %` : g.id === 'mystery' && r.rounds ? `${r.wins || 0} vunna av ${r.rounds}` : g.id === 'chess' && r.games ? `${r.wins || 0} vunna av ${r.games}` : g.id === 'blockly' && r.plays ? `Spelat ${r.plays} ${r.plays === 1 ? 'gång' : 'gånger'}` : g.id === 'sokoban' && r.solved ? `${Object.keys(r.solved).length} / 25 banor` : g.id === 'robot' && r.stars ? `${Object.keys(r.stars).length} / 20 banor · ⭐ ${Object.values(r.stars).reduce((a, b) => a + b, 0)}` : g.id === 'sudoku' && r.wins ? `${r.wins} lösta` : g.id === 'city' && r.best ? `Rekord ${r.best} invånare` : g.vendorPath && r.best ? `Rekord ${r.best} ${g.unit}` : 'Inte spelat än';
  return `<a class="card" href="#/game/${g.id}"><div class="thumb" style="background:${g.bg}">${g.emoji}</div><div class="title">${g.title}</div><div class="meta">${ownerLabel(g.owner)} · 👍 ${g.rating}% · ${meta}</div></a>`;
}

// ---------- Vyer ----------
function viewPlayers() {
  app.innerHTML = `<div class="center">
    <div class="logo" style="justify-content:center;font-size:34px"><span class="cube" style="width:32px;height:32px"></span>Mina Boys Games</div>
    <h1>Vem spelar?</h1>
    <div class="players">
      ${store.players.map(p => `<button class="player-card" data-id="${p.id}"><span class="face" style="background:${p.avatar.skin}">${faceEmoji(p)}</span>${esc(p.name)}<div class="sub" style="font-size:12px;font-weight:600"><span class="coin-icon" style="width:11px;height:11px"></span> ${p.coins}</div></button>`).join('')}
      <button class="player-card new" id="new-player"><span class="face" style="background:#eee">＋</span>Ny spelare</button>
    </div>
    ${isIOS && !standalone ? `<p class="sub tip">📱 Tips för iPad: tryck på <b>Dela</b> <span style="font-size:16px">⎋</span> i Safari och välj <b>Lägg till på hemskärmen</b>. Då öppnas Mina Boys Games i helskärm som en app.</p>` : ''}
    <p class="sub" style="font-size:11px;margin-top:30px">Version ${VERSION}</p>
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
    ${[...new Set(GAMES.map(g => g.owner))].map(o => `<h2>${shelfName(o)}</h2><div class="grid">${GAMES.filter(g => g.owner === o).map(gameCard).join('')}</div>`).join('')}
    <h2>Dina rekord</h2>
    <div class="stats">
      <div class="stat"><b>${p.records.obby?.dist ? p.records.obby.dist + ' m' : '–'}</b><span>Hinderbanan, längst</span></div>
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
      <h1 style="margin-top:0">${g.title}</h1><div class="sub">${ownerLabel(g.owner)} · 👍 ${g.rating}%</div>
      <button class="btn green play" id="play">▶ Spela</button>
      <div class="stats">
        <div class="stat"><b>${id === 'sokoban' ? Object.keys(r.solved || {}).length + ' / 25' : id === 'robot' ? Object.keys(r.stars || {}).length + ' / 20' : id === 'sudoku' ? (r.wins ?? 0) : id === 'chess' ? (r.wins ?? 0) : id === 'blockly' ? (r.plays ?? 0) : g.vendorPath ? (r.best ? `${r.best} ${g.unit}` : '–') : id === 'city' ? (r.best ?? 0) : id === 'mystery' ? (r.wins ?? 0) : id === 'obby' ? (r.dist ? r.dist + ' m' : '–') : id === 'coins' ? (r.best ?? '–') : id === 'dash' ? Object.entries(r).filter(([k, x]) => !k.startsWith('egen') && x.wins).length + ' / 3' : Object.keys(store.current.world || {}).length}</b><span>${id === 'sokoban' || id === 'robot' ? 'Banor klarade' : id === 'sudoku' ? 'Pussel lösta' : id === 'chess' ? 'Vunna partier' : id === 'blockly' ? 'Gånger spelat' : g.vendorPath ? 'Rekord här' : id === 'city' ? 'Flest invånare' : id === 'mystery' ? 'Vunna rundor' : id === 'obby' ? 'Längst' : id === 'coins' ? 'Flest mynt' : id === 'dash' ? 'Banor klarade' : 'Block'}</span></div>
        <div class="stat"><b>${id === 'robot' ? Object.values(r.stars || {}).reduce((a, b) => a + b, 0) : id === 'sudoku' ? (r.best4 || r.best6 || r.best9 ? [r.best4, r.best6, r.best9].map(t => t ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : '–').join(' · ') : '–') : id === 'dash' ? Object.values(r).reduce((a, x) => a + (x.attempts || 0), 0) : id === 'obby' ? (r.checkpoints ?? 0) : id === 'city' ? (r.days ?? 0) : id === 'mystery' ? (r.rounds ?? 0) : id === 'chess' ? (r.games ?? 0) : id === 'blockly' ? (r.plays ?? 0) * 5 : (r.wins ?? r.plays ?? 0)}</b><span>${id === 'robot' ? 'Stjärnor' : id === 'sudoku' ? 'Bästa tid 4×4 · 6×6 · 9×9' : id === 'chess' ? 'Partier spelade' : id === 'blockly' ? 'Mynt tjänade' : id === 'city' ? 'Dagar byggt' : id === 'mystery' ? 'Rundor spelade' : id === 'obby' ? 'Kontrollpunkter' : id === 'dash' ? 'Försök totalt' : 'Gånger spelad'}</span></div>
      </div>
    </div></div>
    <h2>Om spelet</h2><div class="desc">${g.desc}<ul>${g.tips.map(t => `<li>${t}</li>`).join('')}</ul>
    <b>Så spelar du:</b> ${g.how ? g.how : id === 'city' ? (isTouch ? 'Välj ett verktyg till höger och tryck på en ruta för att bygga. Dra på skärmen för att snurra kameran, dra nere till vänster för att flytta den. Plus och minus zoomar.' : 'Välj ett verktyg till höger och klicka på en ruta för att bygga. Dra med musen för att snurra kameran, WASD flyttar den, mushjulet zoomar.') : id === 'mystery' ? (isTouch ? 'Vänster sida: gå. Höger sida: titta. Hoppa-knappen hoppar. Den stora röda eller blå knappen hugger/skjuter om du är skurk eller sheriff.' : 'WASD: gå. Mus: titta. Mellanslag: hoppa. Klick eller F hugger/skjuter om du är skurk eller sheriff.') : id === 'dash' ? (isTouch ? 'Tryck var som helst på skärmen för att hoppa. Håll inne för att hoppa igen direkt. I skeppet: håll för att flyga upp, släpp för att dyka.' : 'Mellanslag, pil upp eller klick = hoppa. Håll inne för att hoppa igen direkt. I skeppet: håll för att flyga upp, släpp för att dyka.') : isTouch ? 'Vänster sida av skärmen: gå. Höger sida: titta runt. Knappen "Hoppa": hoppa, tryck igen i luften för dubbelhopp, och en tredje gång för att flyga i 10 sekunder.' : 'WASD eller piltangenter: gå. Mellanslag: hoppa, tryck igen i luften för dubbelhopp, och en tredje gång för att flyga i 10 sekunder. Dra med musen: titta runt.'}</div>`);
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
  const ctx = { container, game: g, player: store.current, store, touch: isTouch, restart: () => play(g), exit: () => exitGame() };
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
// Hämta ny version automatiskt när spelet öppnas (och när man kommer tillbaka till det på iPaden)
checkForUpdate(() => toast('Hämtar ny version…'));
addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !engine) checkForUpdate(() => toast('Hämtar ny version…')); });
