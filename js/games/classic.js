// Klassiker: öppna spel (2048, Hextris, Clumsy Bird) som körs i en iframe inuti appen.
// Spelet själv sköter sina rekord (de ligger i webbläsaren). Vi läser poängen från iframen
// (samma origin, så vi kommer åt dess globala variabler och localStorage) och ger mynt efter varje omgång.
import { hud, sfx } from '../engine.js';

// Hur poäng blir mynt: `read` hämtar aktuell poäng ur iframens fönster (eller ur localStorage för 2048, som sparar
// spelet där), `coins` räknar om poängökningen under en omgång till mynt, högst `max` mynt per omgång.
const RULES = {
  g2048: { max: 40, unit: 'poäng', coins: (g) => Math.floor(g / 250), read: () => { const s = JSON.parse(localStorage.getItem('gameState') || 'null'); return s ? (s.score | 0) : 0; } },
  hextris: { max: 40, unit: 'poäng', coins: (g) => Math.floor(g / 100), read: (w) => (w.score | 0) },
  clumsy: { max: 40, unit: 'rör', coins: (g) => g, read: (w) => (w.game?.data?.steps | 0) },
  // Astray: nivå 1 har labyrint 11x11, varje klarad nivå gör den 2 större. 3 mynt per klarad nivå.
  astray: { max: 40, unit: 'nivåer', coins: (g) => g * 3, read: (w) => Math.max(0, ((w.mazeDimension | 0) - 11) / 2) },
  // HexGL: poäng bara när loppet körs i mål, fler ju snabbare (60 minus 1 per 5 sekunder, minst 10).
  hexgl: { max: 40, unit: 'poäng', coins: (g) => g, read: (w) => { const gp = w.hexGL?.gameplay; return gp && gp.result === gp.results.FINISH ? Math.max(10, 60 - Math.round(gp.finishTime / 5000)) : 0; } },
};

export function start(ctx) {
  const g = ctx.game, rule = RULES[g.id] || { max: 0, unit: 'poäng', coins: () => 0, read: () => 0 };
  const gameEl = document.getElementById('game'); gameEl.classList.add('classic');
  hud.title(g.title);
  let earned = 0; // mynt den här gången
  const showEarned = () => hud.right(`<span>🪙 +${earned}</span>`);
  showEarned();

  const frame = document.createElement('iframe');
  frame.className = 'classic-frame'; frame.title = g.title; frame.setAttribute('allow', 'autoplay; fullscreen');
  frame.src = g.vendorPath + '/index.html' + (g.query ? (ctx.touch ? g.query.touch : g.query.desktop) || '' : '');
  frame.addEventListener('load', () => { hud.center(''); try { frame.contentWindow.focus(); } catch { /* ok */ } });
  ctx.container.appendChild(frame);

  // Omgångar: poängen stiger under en omgång och faller tillbaka när en ny börjar. Då (och när man lämnar) delas mynt ut.
  let base = 0, max = 0, seen = false;
  const read = () => { try { return Math.max(0, rule.read(frame.contentWindow) || 0); } catch { return 0; } };
  const settle = () => {
    const gain = max - base; if (gain <= 0) return;
    const coins = Math.min(rule.max, Math.floor(rule.coins(gain)));
    ctx.store.bump(g.id, 'plays');
    ctx.store.record(g.id, 'best', max);
    if (coins > 0) { ctx.store.addCoins(coins); earned += coins; showEarned(); sfx.coin(); hud.center(`<div class="small">🪙 +${coins} mynt för ${max} ${rule.unit}!</div>`, 2500); }
    base = 0; max = 0;
  };
  const timer = setInterval(() => {
    const s = read();
    if (!seen) { seen = true; base = s; max = s; return; } // pågående sparat spel räknas inte om
    if (s < max) { settle(); base = 0; max = s; } else max = s;
  }, 500);

  return {
    stop() { clearInterval(timer); },
    dispose() { clearInterval(timer); settle(); frame.remove(); gameEl.classList.remove('classic'); },
  };
}
