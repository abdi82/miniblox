// Sparar spelare, avatarer, mynt och rekord i webbläsaren (localStorage).
const KEY = 'miniblox.v1';

export const SKIN_COLORS = ['#f5c89b', '#e0a878', '#c58b5a', '#8d5a3a', '#5b3a24', '#ffdc5e'];
export const CLOTH_COLORS = ['#335fff', '#e2231a', '#00b06f', '#f5b400', '#9b51e0', '#ff6fb5', '#1c1c1c', '#ffffff', '#00bcd4', '#7a4b2a'];
export const FACES = [
  { id: 'smile', label: 'Glad', emoji: '😊' },
  { id: 'cool', label: 'Cool', emoji: '😎' },
  { id: 'surprised', label: 'Oj!', emoji: '😮' },
  { id: 'angry', label: 'Arg', emoji: '😠' },
  { id: 'wink', label: 'Blink', emoji: '😉' },
];
export const HATS = [
  { id: 'none', label: 'Ingen hatt', emoji: '🚫', price: 0 },
  { id: 'cap', label: 'Keps', emoji: '🧢', price: 0 },
  { id: 'tophat', label: 'Hög hatt', emoji: '🎩', price: 40 },
  { id: 'crown', label: 'Krona', emoji: '👑', price: 120 },
  { id: 'horns', label: 'Horn', emoji: '😈', price: 80 },
  { id: 'halo', label: 'Gloria', emoji: '😇', price: 80 },
  { id: 'party', label: 'Partyhatt', emoji: '🥳', price: 30 },
  { id: 'wizard', label: 'Trollkarl', emoji: '🧙', price: 150 },
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { players: [], currentId: null }; }
  catch { return { players: [], currentId: null }; }
}
let state = load();
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

export function defaultAvatar() {
  return { skin: SKIN_COLORS[0], shirt: CLOTH_COLORS[0], pants: CLOTH_COLORS[6], face: 'smile', hat: 'none' };
}

export const store = {
  get players() { return state.players; },
  get current() { return state.players.find(p => p.id === state.currentId) || null; },
  addPlayer(name) {
    const p = { id: 'p' + Date.now().toString(36), name, avatar: defaultAvatar(), coins: 20, owned: ['none', 'cap'], records: {}, world: {}, created: Date.now() };
    state.players.push(p); state.currentId = p.id; save(); return p;
  },
  select(id) { state.currentId = id; save(); },
  logout() { state.currentId = null; save(); },
  removePlayer(id) { state.players = state.players.filter(p => p.id !== id); if (state.currentId === id) state.currentId = null; save(); },
  update(fn) { const p = this.current; if (!p) return; fn(p); save(); },
  addCoins(n) { this.update(p => { p.coins = Math.max(0, Math.round(p.coins + n)); }); },
  record(gameId, key, value, better = (a, b) => a > b) {
    let isNew = false;
    this.update(p => {
      const r = p.records[gameId] || (p.records[gameId] = {});
      if (r[key] == null || better(value, r[key])) { r[key] = value; isNew = true; }
    });
    return isNew;
  },
  bump(gameId, key, n = 1) { this.update(p => { const r = p.records[gameId] || (p.records[gameId] = {}); r[key] = (r[key] || 0) + n; }); },
};
