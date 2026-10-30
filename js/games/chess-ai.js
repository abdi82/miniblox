// Datormotspelare för schacket: tre nivåer. Använder chess.js för regler och draggenerering.
// Nybörjare: slumpar, men tar pjäser när det går. Lagom: minimax (alfa-beta) djup 2. Svår: djup 3. Båda med en liten slagsökning på slutet.
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
// Positionstabeller (vit sida, rad 0 = rad 8). "Simplified evaluation function", fritt att använda.
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
const MATE = 100000;
// chess.js interna 0x88-funktioner (_moves, _makeMove, _undoMove, _board, _turn) är mycket snabbare än de publika
// (som bygger SAN-text för varje drag). Versionen i vendor/chess är låst till 1.4.0 så namnen är stabila.
const sqName = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 4));

// Ställningens värde sett från vit (plus = bra för vit).
export function evaluate(chess) {
  const b = chess._board; let s = 0;
  for (let i = 0; i < 120; i++) {
    if (i & 0x88) { i += 7; continue; }
    const sq = b[i]; if (!sq) continue;
    const r = i >> 4, c = i & 7;
    const v = VAL[sq.type] + PST[sq.type][sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c];
    s += sq.color === 'w' ? v : -v;
  }
  return s;
}
const sign = (chess) => (chess._turn === 'w' ? 1 : -1);
// Slag först (värdefullast offer, billigast pjäs), sedan förvandlingar: ger alfa-beta mycket mer klipp.
function order(moves) {
  for (const m of moves) m._o = (m.captured ? 10 * VAL[m.captured] - VAL[m.piece] : 0) + (m.promotion ? 800 : 0);
  return moves.sort((a, b) => b._o - a._o);
}
let nodes = 0;
// Slagsökning: fortsätt bara med slag några steg så datorn inte "ser" en vinst som blir förlust i nästa drag.
function quiesce(chess, alpha, beta, depth) {
  nodes++;
  const stand = sign(chess) * evaluate(chess);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth === 0) return alpha;
  const us = chess._turn, moves = order(chess._moves({ legal: false }).filter(m => m.captured));
  for (const m of moves) {
    chess._makeMove(m);
    if (chess._isKingAttacked(us)) { chess._undoMove(); continue; } // olagligt (lämnar kungen i schack)
    const score = -quiesce(chess, -beta, -alpha, depth - 1); chess._undoMove();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}
function search(chess, depth, alpha, beta, ply) {
  nodes++;
  if (depth === 0) return quiesce(chess, alpha, beta, 2);
  // Pseudolagliga drag är billigare att generera; drag som lämnar egen kung i schack hoppas över efteråt.
  const us = chess._turn, moves = order(chess._moves({ legal: false }));
  let legal = 0;
  for (const m of moves) {
    chess._makeMove(m);
    if (chess._isKingAttacked(us)) { chess._undoMove(); continue; }
    legal++;
    const score = -search(chess, depth - 1, -beta, -alpha, ply + 1); chess._undoMove();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  if (legal === 0) return chess._isKingAttacked(us) ? -(MATE - ply) : 0; // matt eller patt
  return alpha;
}
// Gör om ett internt drag till {from, to, promotion} som chess.move() förstår.
const pretty = (m) => ({ from: sqName(m.from), to: sqName(m.to), promotion: m.promotion });

// Bästa draget på givet djup. Lika bra drag lottas så partierna inte blir likadana.
export function bestMove(chess, depth) {
  nodes = 0;
  const moves = order(chess._moves({ legal: true }));
  let best = [], bestScore = -Infinity;
  for (const m of moves) {
    chess._makeMove(m);
    let score;
    // Undvik att upprepa ställningar (annars blir det lätt remi genom upprepning när datorn ligger bra till)
    if (chess._getPositionCount(chess._hash) >= 2) score = 0;
    else score = -search(chess, depth - 1, -MATE, MATE, 1);
    chess._undoMove();
    if (score > bestScore + 1) { bestScore = score; best = [m]; }
    else if (score >= bestScore - 1) best.push(m);
  }
  const m = best[Math.floor(Math.random() * best.length)];
  return { move: pretty(m), score: bestScore, nodes };
}
// Nybörjare: slumpar, men tar pjäser när det går (helst den värdefullaste), och gör schack matt om det går.
export function easyMove(chess) {
  const moves = chess._moves({ legal: true });
  for (const m of moves) {
    chess._makeMove(m); const mate = chess._isKingAttacked(chess._turn) && chess._moves({ legal: true }).length === 0; chess._undoMove();
    if (mate) return { move: pretty(m), score: MATE, nodes: 0 };
  }
  const caps = moves.filter(m => m.captured);
  if (caps.length) {
    const top = Math.max(...caps.map(m => VAL[m.captured]));
    const bestCaps = caps.filter(m => VAL[m.captured] === top);
    return { move: pretty(bestCaps[Math.floor(Math.random() * bestCaps.length)]), score: 0, nodes: 0 };
  }
  return { move: pretty(moves[Math.floor(Math.random() * moves.length)]), score: 0, nodes: 0 };
}
export function pickMove(chess, level) {
  if (level === 'easy') return easyMove(chess);
  return bestMove(chess, level === 'hard' ? 3 : 2);
}
