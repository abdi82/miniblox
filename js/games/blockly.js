// Blockly Games (Google, Apache-2.0, vendor/blockly-games) på svenska i en iframe via Klassiker-spelens ram (classic.js).
// Ger 5 mynt varje gång man startar, som en liten belöning för att man programmerar.
import { start as startClassic } from './classic.js';
import { hud, sfx } from '../engine.js';

export function start(ctx) {
  const game = startClassic(ctx);
  ctx.store.addCoins(5); ctx.store.bump('blockly', 'plays'); sfx.coin();
  hud.right('<span>🪙 +5</span>');
  hud.center('<div class="small">+5 mynt för att du programmerar! 🧩</div>', 2500);
  return game;
}
