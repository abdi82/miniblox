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

### Clumsy Bird
Inga ändringar i koden. Utelämnat: Gruntfile, package.json, Procfile, app.json, CUSTOMIZING.md,
README och `.placeholder`-filer. Källfilerna i `js/` finns med även om spelet kör den byggda
`build/clumsy-min.js`.

## Poäng och mynt
Spelen sparar sina egna rekord i webbläsarens localStorage (2048: `bestScore`/`gameState`,
Hextris: `highscores`/`saveState`, Clumsy Bird: `me.save.*`). Dessa är gemensamma för alla
spelare på samma enhet. `js/games/classic.js` läser poängen från iframen (samma origin) och
ger mynt per avslutad omgång till den inloggade spelaren.
