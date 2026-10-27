# MiniBlox

En mini-version av Roblox för barnen. Ren webbsida (HTML + JavaScript + Three.js), ingen server, inga konton.
Allt sparas i webbläsaren på den enhet man spelar på.

## Starta

```bash
python3 -m http.server 5173
```

Öppna http://localhost:5173 (eller datorns IP-adress från iPaden på samma wifi).

## Innehåll

- **Vem spelar?** Varje barn har en egen spelare med namn, avatar, mynt och rekord.
- **Avatar**: hudfärg, tröja, byxor, ansikte, hatt. Roterande 3D-förhandsvisning.
- **Butik**: köp hattar för mynt.
- **Hinderbanan** (`js/games/obby.js`): hoppa, lava, rörliga plattformar, kontrollpunkter, tid och rekord.
- **Myntjakten** (`js/games/coins.js`): samla mynt på 60 sekunder.
- **Bygg din värld** (`js/games/build.js`): placera block på en platta, byt färg, ta bort, och gå runt i det du byggt. Världen sparas.

## Styrning

- Dator: WASD/piltangenter, mellanslag hoppar, dra med musen för att titta.
- Pekskärm: vänster sida = joystick, höger sida = titta, knappen Hoppa.

## Kod

- `js/engine.js` – spelmotor: fysik mot lådor, kamera i tredje person, input, HUD, ljud.
- `js/avatar.js` – blockig figur byggd av lådor + ansiktstextur.
- `js/store.js` – spelare och sparade data i localStorage.
- `js/app.js` – lobby, router och spelstart.
