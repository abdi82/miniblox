// Banor till Kubdash. Rita egna banor här!
//
// En bana är en lång rad med kolumner, från vänster till höger, åtskilda av mellanslag.
// Varje kolumn läses nedifrån och upp:   "^" = spik på marken     "#" = block på marken
//   "##" = två block på varandra        ".#" = block en ruta upp    "^.o" = spik på marken + hopp-orb två rutor upp
// Tecken:  #  block (hoppa upp på det, men kanten dödar)   ^  spik uppåt   v  spik nedåt (hänger i taket)
//          o  gul hopp-orb (håll/tryck när kuben är vid den så hoppar du i luften)
//          _  studsplatta (studsar dig högt automatiskt)      $  hemligt mynt (10 extra mynt när du klarar banan)
//          g  gravitationsportal (vänder upp och ner)     s  skeppsportal (håll för att flyga upp, släpp för att dyka)
//          c  kubportal (tillbaka till kub)                 .  tomt
// Kortformer:  "6*."  = sex tomma kolumner     "3*^" = tre spikar i rad     "o@3" = orb tre rutor upp
//              "#@7-9" = block på rad 7, 8 och 9        "##+#@8-9" = golv två block + tak två block (en skeppstunnel)
// Banan är 10 rutor hög (rad 0 till 9). Taket ligger ovanför rad 9; där springer man när gravitationen är vänd.
// Kuben hoppar ungefär 2,4 rutor högt och 4,5 rutor långt. Tre spikar i rad går att hoppa över, fyra behöver en orb eller platta.

export const LEVELS = [
  {
    id: 'steg', name: 'Första steget', difficulty: 'Lätt', color: '#2bd4ff', reward: 50, bpm: 128,
    map: `
      10*. ^ 7*. ^ 7*. 2*^ 8*. # 6*. ^ 4*. ^ 4*. ^ 8*. 2*^ 6*. # # 5*. ## 6*. $@2 2*. ^ 6*. _ 4*. 3*^ 8*. 2*^ 7*. #
      . .# 6*. ^ 4*. ## ## 3*. ^.o 6*. $@3 3*. 3*^ 7*. ^ 3*. ^ 3*. ^ 3*. ^ 8*. _ 3*. 2*^ 2*. 2*^ 8*. $@1 6*. 2*^ 6*. # 4*. # 10*.
    `,
  },
  {
    id: 'orb', name: 'Orbjakten', difficulty: 'Normal', color: '#ffb300', reward: 80, bpm: 140,
    map: `
      8*. 2*^ 6*. 3*^ 7*. ^ 3*. ^ 3*. ^ 6*. # ## ### 7*. 3*^ 2*. ^.o 3*. 3*^ 6*. _ 3*. 4*^ 2*. $@4 6*. ^ 2*. ^ 2*. ^ 2*. ^ 6*.
      s 4*. 6*#@8-9 3*. 6*##+#@8-9 3*. 6*#+#@7-9 3*. 6*###+#@8-9 2*. $@5 2*. 4*#@8-9 4*. c 5*. 2*^ 5*. ^.o 3*^ 2*. o@3 2*. 3*^ 7*. _ 2*. ## 3*. 3*^ 6*.
      ^ 3*. ^.o 2*. 2*^ 2*. o@2 2*. 2*^ 6*. $@3 2*. 3*^ 7*. # . 2*^ . ## 6*. 3*^ 10*.
    `,
  },
  {
    id: 'rymd', name: 'Rymdrusch', difficulty: 'Svår', color: '#ff3d7f', reward: 120, bpm: 150,
    map: `
      8*. 3*^ 5*. 3*^ 5*. ^ 2*. ^ 2*. ^ 2*. ^ 6*. _ 3*. 4*^ 3*. ^.o 2*. 3*^ 6*. g 9*. v@9 5*. 2*v@9 6*. $@6 3*. 3*v@9 7*. g 6*.
      3*^ 2*. o@2 2*. 3*^ 5*. s 4*. 6*##+#@8-9 2*. 6*#+#@6-9 2*. 6*###+#@8-9 2*. 6*#+#@5-9 2*. 6*##+#@7-9 2*. $@5 3*. c 5*.
      2*^ 2*. o@2 2*. 2*^ 2*. o@2 2*. 2*^ 6*. _ 3*. 5*^ 4*. # 2*^ . ## 2*^ . ### 7*. g 8*. 3*v@9 4*. 2*v@9 4*. 3*v@9 3*. $@6 2*. g 7*. 3*^ 10*.
    `,
  },
];
