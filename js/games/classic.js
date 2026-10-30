// Klassiker: öppna spel (2048, Hextris, Clumsy Bird) som körs i en iframe inuti appen.
// Spelet själv sköter sina rekord (de ligger i webbläsaren). Vi läser poängen från iframen
// (samma origin, så vi kommer åt dess globala variabler och localStorage) och ger mynt efter varje omgång.
import { hud, sfx } from '../engine.js';

// Hur poäng blir mynt: ett mynt per `per` poäng, högst `max` mynt per omgång.
// `read` hämtar aktuell poäng ur iframens fönster (eller ur localStorage för 2048, som sparar spelet där).
const RULES = {
  g2048: { per: 250, max: 40, unit: 'poäng', read: () => { const s = JSON.parse(localStorage.getItem('gameState') || 'null'); return s ? (s.score | 0) : 0; } },
  hextris: { per: 100, max: 40, unit: 'poäng', read: (w) => (w.score | 0) },
  clumsy: { per: 1, max: 40, unit: 'rör', read: (w) => (w.game?.data?.steps | 0) },
};

export function start(ctx) {
  const g = ctx.game, rule = RULES[g.id] || { per: 1e9, max: 0, unit: 'poäng', read: () => 0 };
  const gameEl = document.getElementById('game'); gameEl.classList.add('classic');
  hud.title(g.title);
  let earned = 0; // mynt den här gången
  const showEarned = () => hud.right(`<span>🪙 +${earned}</span>`);
  showEarned();

  const frame = document.createElement('iframe');
  frame.className = 'classic-frame'; frame.title = g.title; frame.setAttribute('allow', 'autoplay; fullscreen');
  frame.src = g.vendorPath + '/index.html';
  frame.addEventListener('load', () => { hud.center(''); try { frame.contentWindow.focus(); } catch { /* ok */ } });
  ctx.container.appendChild(frame);

  // Omgångar: poängen stiger under en omgång och faller tillbaka när en ny börjar. Då (och när man lämnar) delas mynt ut.
  let base = 0, max = 0, seen = false;
  const read = () => { try { return Math.max(0, rule.read(frame.contentWindow) || 0); } catch { return 0; } };
  const settle = () => {
    const gain = max - base; if (gain <= 0) return;
    const coins = Math.min(rule.max, Math.floor(gain / rule.per));
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
