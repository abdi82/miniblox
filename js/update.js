// Automatisk uppdatering: när spelet öppnas jämförs versionen med version.txt på servern.
// Är den nyare hämtas alla filer om (förbi cachen) och sidan laddas om en gång. Då får iPads nya versionen direkt.
export const VERSION = '2026-10-27.1141';
const FILES = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/update.js', 'js/engine.js', 'js/avatar.js', 'js/store.js',
  'js/games/obby.js', 'js/games/coins.js', 'js/games/build.js', 'js/games/dash.js', 'js/games/dash-levels.js', 'js/games/dash-editor.js'];

export async function checkForUpdate(onUpdating) {
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const latest = (await r.text()).trim();
    if (!latest || latest === VERSION) return;
    const key = 'miniblox.reloaded.' + latest;
    if (sessionStorage.getItem(key)) return; // ladda bara om en gång per version
    sessionStorage.setItem(key, '1');
    onUpdating?.();
    await Promise.all(FILES.map(f => fetch(f, { cache: 'reload' }).catch(() => null)));
    location.reload();
  } catch { /* offline, kör vidare som vanligt */ }
}
