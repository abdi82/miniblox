# Klassiker (tredjepartsspel)

Spelen i den här mappen är öppen källkod från andra utvecklare. De körs oförändrade i en iframe
inuti Mina Boys Games (se `js/games/classic.js`) och behåller sina egna licenser, som ligger
som licensfil i respektive mapp. Vi har bara kopierat de filer som behövs för att köra spelen
statiskt (inga byggverktyg, tester eller README-filer från originalen).

| Mapp | Spel | Källa | Version (commit) | Licens |
|------|------|-------|------------------|--------|
| `2048/` | 2048 av Gabriele Cirulli | https://github.com/gabrielecirulli/2048 | `478b6ec` (2024-10-24) | MIT (`2048/LICENSE.txt`) |
| `hextris/` | Hextris av Logan Engstrom, Garrett Finucane m.fl. | https://github.com/Hextris/hextris | `3f4847d` (2022-02-08) | GPL-3.0 (`hextris/LICENSE.md`) |
| `clumsy-bird/` | Clumsy Bird av Ellison Leão | https://github.com/ellisonleao/clumsy-bird | `fae3d48` (2017-06-16) | GPL-3.0 enligt `clumsy-bird/LICENSE.md` (package.json anger MIT). Innehåller melonJS 4.0.0 (MIT). |
| `astray/` | Astray av Rye Terrell (wwwtyro) | https://github.com/wwwtyro/Astray | `d3c4f61` (2022-08-13) | Public domain/Unlicense (`astray/LICENSE.md`). Innehåller Three.js r49 (MIT), Box2dWeb (zlib), KeyboardJS (MIT), jQuery (MIT). |
| `hexgl/` | HexGL av Thibaut Despoulain (BKcore) | https://github.com/BKcore/HexGL | `6addc95` (2021-03-21) | Kod MIT (`hexgl/LICENSE`). Grafik och ljud: CC BY-NC 3.0 (icke-kommersiellt, se `hexgl/audio/LICENSE` och projektets README). |

Mina Boys Games är i sig publikt på GitHub, så den fullständiga källkoden (inklusive
ändringarna nedan) är tillgänglig i enlighet med GPL-3.0.

## Ändringar jämfört med originalen

### 2048
Inga ändringar i koden. Utelämnat: README, CONTRIBUTING, Rakefile, SCSS-källor, .jshintrc.

### Hextris
Alla sökvägar var redan relativa, så spelet kör som det är under en undermapp. Följande har
ändrats i `hextris/index.html` och `hextris/js/main.js` för att inte ladda tredjepartsskript
eller skicka data från barnens surfplattor (de http-adresserna blockeras dessutom som
"mixed content" när appen körs via https och gav fel i konsolen):

- `index.html`: Google AdSense-skriptet (`adsbygoogle.js`) borttaget.
- `index.html`: Google Analytics-snutten borttagen.
- `index.html`: Google Fonts-länken ändrad från `http://` till `https://`.
- `index.html`: en liten `<style>`-rad som döljer dela-knapparna (Twitter/Facebook) och
  App Store/Google Play-märkena på game over-skärmen (`#socialShare`, `#buttonCont`).
- `js/main.js`: `$.get('http://54.183.184.126/' + score)` (skickade poängen till en extern
  server vid game over) borttagen.
- `js/main.js`: den avslutande funktionen som laddade `http://hextris.io/a.js` borttagen.

Utelämnat: README, CNAME, `a.js` (tom), `.github/`, Open Graph-bilderna (`images/facebook-opengraph.png`,
`images/twitter-opengraph.png`) som bara refereras av meta-taggar.

### Astray
`astray/index.html`: texturerna laddades med absoluta sökvägar (`/ball.png` osv.), ändrade till relativa
så spelet kör under en undermapp. Dessutom tillagt ett litet `<script>`-block med pekstyrning (dra med
fingret så rullar kulan åt det hållet, sätter samma `keyAxis` som piltangenterna) och `touch-action: none`
på body, eftersom originalet bara har tangentbordsstyrning. Utelämnat: README.

### HexGL
`hexgl/index.html`: Google Analytics-snutten borttagen och favicon-länkarna (absoluta `http://`) ersatta med
den lokala `favicon.png`. Koden i övrigt orörd. Appen startar spelet med `?quality=1` (MID) på pekskärmar,
vilket spelets egen `launch.js` läser som URL-parameter. Utelämnat: CoffeeScript-källor (bara de kompilerade
`.js`-filerna är med), `replays/`, `package.zip`, `manifest.webapp`, `cache.appcache`, `.htaccess`,
`libs/Editor*`, `libs/Three.r53.js`, ikoner och README.

### Clumsy Bird
Inga ändringar i koden. Utelämnat: Gruntfile, package.json, Procfile, app.json, CUSTOMIZING.md,
README och `.placeholder`-filer. Källfilerna i `js/` finns med även om spelet kör den byggda
`build/clumsy-min.js`.

## Poäng och mynt
Spelen sparar sina egna rekord i webbläsarens localStorage (2048: `bestScore`/`gameState`,
Hextris: `highscores`/`saveState`, Clumsy Bird: `me.save.*`, HexGL: `score-Cityscape-casual`; Astray sparar inget). Dessa är gemensamma för alla
spelare på samma enhet. `js/games/classic.js` läser poängen från iframen (samma origin) och
ger mynt per avslutad omgång till den inloggade spelaren.
