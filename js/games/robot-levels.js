// Banor och regler till Programmera roboten. Ingen Three.js här, så filen kan testas i Node.
// Karta: > v < ^ = start och riktning, . = golv, # = vägg, O = grop, $ = mynt, G = mål.
// Program: lista av { c: 'F' | 'L' | 'R' | 'J' } eller { c: 'REP', n, body: [...] }.
export const LEVELS = [
  { name: 'Rakt fram', max: 6, best: 3, sol: 'F F F', map: `
>..G` },
  { name: 'Mynt på vägen', max: 6, best: 4, sol: 'F F F F', map: `
>$$$G` },
  { name: 'Sväng höger', max: 8, best: 5, sol: 'F F F R F', map: `
>...
...G` },
  { name: 'Hoppa över gropen', max: 6, best: 3, sol: 'F J F', map: `
>.O.G` },
  { name: 'Två svängar', max: 10, best: 8, sol: 'F F R F F R F F', map: `
>..
..$
G..` },
  { name: 'Gropar och mynt', max: 6, best: 4, sol: 'F J J F', map: `
>.O$O.G` },
  { name: 'Upprepa!', max: 4, best: 2, sol: '8[F]', map: `
>$.$.$.$G` },
  { name: 'Hoppa, hoppa', max: 5, best: 3, sol: '3[J] F', map: `
>O.O.O.G` },
  { name: 'Trappan', max: 7, best: 5, sol: '4[F R F L]', map: `
>.###
#..##
##..#
###..
####G` },
  { name: 'Ta alla mynt', max: 9, best: 6, sol: '2[F F R] F F', map: `
>.$.
..$.
G.$.` },
  { name: 'Runt kvarteret', max: 7, best: 5, sol: '3[F F F R]', map: `
>...
.##.
.##.
G...` },
  { name: 'Lång trappa', max: 8, best: 5, sol: '5[F R F L]', map: `
>.####
#..###
##$.##
###..#
####$.
#####G` },
  { name: 'Mynt i hörnen', max: 13, best: 10, sol: 'F F L 3[F F F F L] F', map: `
$...$
.....
.....
.....
$G>.$` },
  { name: 'Labyrinten', max: 14, best: 11, sol: 'F F R 3[F] L 2[F] L 3[F]', map: `
>..#G
##.#.
##.#.
##...` },
  { name: 'Gropringen', max: 10, best: 7, sol: '3[F J F R] F J', map: `
>.O..
G###.
O###O
.###.
..O..` },
  { name: 'Myntgången', max: 17, best: 14, sol: '5[F] R 2[F] R 5[F] L 2[F] L 5[F]', map: `
>$$$$$
#####.
.$$$$.
.#####
.$$$$G` },
  { name: 'Tur och retur', max: 11, best: 9, sol: '3[J] F R F R 3[J] F', map: `
>O.O.O..
G.O.O.O.` },
  { name: 'Ormen', max: 18, best: 15, sol: '2[F F F L F F L F F F R F F R]', map: `
v#...#G
.#.#.#.
.#.#.#.
...#...` },
  { name: 'Skörden', max: 22, best: 19, sol: '2[F F F F R F R F F F F L F L] F F F F', map: `
>$$$$
$$$$$
$$$$$
$$$$$
$$$$G` },
  { name: 'Mästarprovet', max: 13, best: 10, sol: '3[F J F J R] F J F F', map: `
>.O$.O.
G#####.
$#####O
.#####$
O#####.
.#####O
.O.$O..` },
];

export const DIRS = { '>': 0, 'v': 1, '<': 2, '^': 3 }; // 0 = öster, 1 = söder, 2 = väster, 3 = norr
export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

export function parseMap(map) {
  const rows = map.replace(/^\n/, '').split('\n'); const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const cells = rows.map(r => [...r.padEnd(W, '#')]); let start = null;
  cells.forEach((row, y) => row.forEach((c, x) => { if (c in DIRS) { start = { x, y, dir: DIRS[c] }; row[x] = '.'; } }));
  return { W, H, cells, start };
}

// Textform av ett program ("F F 3[F R]") → lista. Används av banornas facit och testerna.
export function parseProgram(text) {
  const toks = text.match(/\d+\[|\]|[FLRJ]/g) || []; const root = []; const stack = [root];
  for (const t of toks) {
    const cur = stack[stack.length - 1];
    if (t === ']') { if (stack.length > 1) stack.pop(); }
    else if (t.endsWith('[')) { const rep = { c: 'REP', n: +t.slice(0, -1), body: [] }; cur.push(rep); stack.push(rep.body); }
    else cur.push({ c: t });
  }
  return root;
}
export function countProgram(prog) { return prog.reduce((a, it) => a + 1 + (it.c === 'REP' ? countProgram(it.body) : 0), 0); }

// Kör programmet och returnerar en lista händelser som spelet animerar.
// {t:'turn',dir} {t:'move',x,y,coin} {t:'jump',x,y,coin} {t:'crash',x,y} {t:'fall',x,y} {t:'win'} {t:'end',onGoal,coinsLeft}
export function simulate(level, prog, maxSteps = 400) {
  const L = parseMap(level.map); const ev = []; let { x, y, dir } = L.start;
  const coins = new Set(); L.cells.forEach((row, yy) => row.forEach((c, xx) => { if (c === '$') coins.add(xx + ',' + yy); }));
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= L.W || yy >= L.H) ? '#' : L.cells[yy][xx];
  let steps = 0, done = false, cur = null; // cur = kommandot som körs, så spelet kan markera det
  const push = (o) => ev.push(Object.assign(o, { it: cur }));
  const land = (nx, ny, jump) => {
    const c = at(nx, ny);
    if (c === '#') { push({ t: 'crash', x: nx, y: ny }); return false; }
    if (c === 'O') { push({ t: 'fall', x: nx, y: ny }); return false; }
    x = nx; y = ny; const key = x + ',' + y; const coin = coins.delete(key);
    push({ t: jump ? 'jump' : 'move', x, y, coin });
    if (c === 'G' && coins.size === 0) { push({ t: 'win' }); return false; }
    return true;
  };
  const run = (items) => {
    for (const it of items) {
      if (done) return;
      if (++steps > maxSteps) { done = true; return; }
      if (it.c === 'REP') { for (let i = 0; i < it.n && !done; i++) run(it.body); continue; }
      cur = it;
      if (it.c === 'L') { dir = (dir + 3) % 4; push({ t: 'turn', dir }); }
      else if (it.c === 'R') { dir = (dir + 1) % 4; push({ t: 'turn', dir }); }
      else if (it.c === 'F') { if (!land(x + DX[dir], y + DY[dir], false)) done = true; }
      else if (it.c === 'J') {
        const mx = x + DX[dir], my = y + DY[dir];
        if (at(mx, my) === '#') { push({ t: 'crash', x: mx, y: my }); done = true; }
        else if (!land(x + 2 * DX[dir], y + 2 * DY[dir], true)) done = true;
      }
    }
  };
  run(prog);
  if (ev[ev.length - 1]?.t !== 'win' && !['crash', 'fall'].includes(ev[ev.length - 1]?.t)) ev.push({ t: 'end', onGoal: at(x, y) === 'G', coinsLeft: coins.size });
  return ev;
}
export function stars(level, prog) { const n = countProgram(prog); return n <= level.best ? 3 : n <= level.best + 2 ? 2 : 1; }
