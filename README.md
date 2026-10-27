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
- **Kubdash** (`js/games/dash.js`): kuben springer själv, tryck för att hoppa. Spikar, block, hopp-orbs, studsplattor, skepp, gravitationsportaler, hemliga mynt, övningsläge och egen synthmusik. Tre banor.

## Rita egna banor till Kubdash

Banorna ligger i `js/games/dash-levels.js` som text, kolumn för kolumn från vänster till höger. Varje kolumn läses nedifrån och upp:

```
10*. ^ 7*. ^ 6*. # 5*. ## 4*. ^.o 3*. _ 3*. 3*^ 6*. $@2 4*. s 4*. 6*##+#@8-9 3*. c 10*.
```

| Tecken | Betyder |
|---|---|
| `.` | tomt |
| `#` | block (hoppa upp på det, kanten dödar) |
| `^` / `v` | spik uppåt / spik som hänger nedåt |
| `o` | gul hopp-orb (håll/tryck vid den så hoppar du i luften) |
| `_` | studsplatta |
| `$` | hemligt mynt |
| `g` | gravitationsportal (vänd upp och ner) |
| `s` / `c` | skeppsportal / tillbaka till kub |
| `6*.` | sex tomma kolumner i rad |
| `o@3` | orb tre rutor upp |
| `#@7-9` | block på rad 7, 8 och 9 |
| `##+#@8-9` | golv och tak i samma kolumn (skeppstunnel) |

Kuben hoppar cirka 2,4 rutor högt och 4,5 rutor långt. Tre spikar i rad går att hoppa över, fyra behöver en orb eller en platta.

## Styrning

- Dator: WASD/piltangenter, mellanslag hoppar, dra med musen för att titta.
- Pekskärm: vänster sida = joystick, höger sida = titta, knappen Hoppa.

## Kod

- `js/engine.js` – spelmotor: fysik mot lådor, kamera i tredje person, input, HUD, ljud.
- `js/avatar.js` – blockig figur byggd av lådor + ansiktstextur.
- `js/store.js` – spelare och sparade data i localStorage.
- `js/app.js` – lobby, router och spelstart.
