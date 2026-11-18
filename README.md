# CockFlip 🐓🪙

Ein Coin-Flip-Roguelike im Browser, im Geist von Balatro: Du wirfst Münzen.
**Kopf = Gold, Zahl = Niete.** Erreiche in jeder Runde die Gold-Quota, bevor dir die
Würfe ausgehen. Kauf dir beim Hehler bessere Münzen und Relikte und überlebe die Bosse.

## Starten

Du brauchst [Node.js](https://nodejs.org) (Version 20 oder neuer).

```bash
npm install      # einmalig: lädt alle Abhängigkeiten
npm run dev      # startet das Spiel -> Link im Terminal öffnen (meist http://localhost:5173)
```

Weitere Befehle:

| Befehl | Was es tut |
|---|---|
| `npm test` | Unit-Tests (RNG, Wahrscheinlichkeiten, Auszahlung, Balance) |
| `npm run build` | fertige Version in `dist/` bauen (kann auf jeden Webspace) |
| `npm run preview` | die gebaute Version lokal ansehen |

## Spielregeln

- **Würfe:** Pro Runde hast du 8 Würfe. Du hast 3 Münzen aus deinem Deck auf der Hand und wählst, welche du wirfst.
- **Auszahlung bei Kopf:** `Gold = Basiswert × Mult × xMult`
  - **Serie:** Jeder weitere Kopf in Folge gibt +1 Mult. Zahl setzt die Serie zurück.
  - Münzen und Relikte addieren Mult oder multiplizieren (xMult).
- **Quota:** Schaffst du sie, endet die Runde sofort. Übrige Würfe geben Bonus-Gold. Schaffst du sie nicht, ist der Run vorbei.
- **Bosse:** Jede 3. Runde mit einer fiesen Regel und höherer Quota.
- **Pech-Meter:** Jede Zahl füllt es. Ist es voll, gibt es eine Belohnung (65 %) oder einen Fluch (35 %).
- **Rand-Landung:** Mit 0,5 % landet die Münze auf dem Rand. Das ist ein Jackpot mit ×25.
- **Hehler (Shop):** Münzen und Relikte kaufen, neu würfeln, Münzen aufwerten oder entfernen, Relikte verkaufen.
- **Tagesrun:** Jeden Tag ein fester Seed. Alle bekommen exakt dieselben Würfe.
- **Sammlung:** Manche Münzen und Relikte sind gesperrt und werden durch Erfolge freigeschaltet (bleibt im Browser gespeichert).

**Steuerung:** Klick auf eine Münze oder `1`–`3` wirft sie, `Leertaste` wirft die markierte Münze, `←`/`→` wählt,
`F` schaltet doppeltes Tempo um, `M` den Ton, `Enter` geht weiter.

## Projektstruktur

```
src/
  core/      Spiellogik – KEIN Zeichnen
    rng.ts       Zufallsgenerator mit Seed (mulberry32)
    types.ts     alle Datentypen (gut zum Nachschlagen!)
    flip.ts      ein Münzwurf: Wahrscheinlichkeit, Ergebnis, Auszahlung
    state.ts     Run, Runden, Deck, Belohnungen
    shop.ts      Shop-Logik
    meta.ts      Freischaltungen + Statistiken (localStorage)
    game.ts      der "Dirigent": Game Loop und Szenen
  data/      ★ HIER fügst du neue Inhalte hinzu ★
    coins.ts     alle Münzen
    relics.ts    alle Relikte
    bosses.ts    alle Bosse
    balance.ts   alle Zahlen zum Feintunen (Quota, Preise, Chancen …)
  render/    Grafik
    sprites/     Paletten, Münz-Motive, Relikt-Symbole, Münz-Generator
    assets.ts    lädt Grafiken (prozedural oder PNG)
    background.ts  Taverne
    coinAnim.ts  Wurf-Animation
    particles.ts Funken, Goldregen, Screenshake
  ui/        Oberfläche (HUD, Shop, Menüs)
  audio/     Soundeffekte (Web Audio, ohne Dateien)
tests/       Unit-Tests (Vitest)
```

Wichtig: Die Logik berechnet das Ergebnis eines Wurfs **komplett, bevor** die Animation startet.
Die Animation spielt nur noch ab. Deshalb sind die Würfe mit gleichem Seed reproduzierbar und testbar.

## Neue Münze hinzufügen

Öffne `src/data/coins.ts` und füge einen Eintrag zur Liste hinzu, zum Beispiel:

```ts
{
  id: 'silberling',                 // eindeutig, klein, ohne Leerzeichen
  name: 'Silberling',
  desc: '+8 % Kopf-Chance und +1 Mult.',
  rarity: 'uncommon',               // common | uncommon | rare | legendary
  value: 4,                         // Gold bei Kopf (Basiswert)
  headsBonus: 0.08,                 // +8 % Kopf-Chance
  mult: 1,                          // +1 Mult bei Kopf
  look: { palette: 'silver', heads: 'crown', tails: 'numeral' },
},
```

Speichern, und die Münze erscheint automatisch im Shop und in der Sammlung, inklusive Grafik.

**Optionale Felder:** `xMult` (×Mult), `edgeFactor` (Rand-Chance ×), `luckGain` (wie stark Zahl das Pech-Meter füllt),
`inShop: false` (nie im Shop), `unlock` (Freischalt-Bedingung), `hooks` (eigene Effekte, siehe unten).

**Freischaltbar machen:**

```ts
unlock: { hint: 'Erreiche Runde 5.', check: (m) => m.bestRound >= 5 },
```

Alles, was in `m` steht, findest du in `MetaStats` in `src/core/types.ts`.

**Eigenes Aussehen:** Farben stehen in `src/render/sprites/palettes.ts`, Motive (16×16-Pixelbilder) in
`src/render/sprites/emblems.ts`. Ein neues Motiv ist einfach ein neues Pixel-Bild aus Zeichen:
`.` = flach, `1` = leicht erhaben, `2` = stark erhaben, `-` = vertieft.

## Neues Relikt hinzufügen

Relikte bestehen aus **Hooks**, also Funktionen, die das Spiel bei jedem Wurf aufruft.
In `src/data/relics.ts`:

```ts
{
  id: 'wuerfelbecher',
  name: 'Würfelbecher',
  desc: '+2 Gold bei jedem Kopf, +1 Mult ab einer 3er Serie.',
  rarity: 'common',
  icon: { shape: 'die', palette: 'parchment' },   // Formen: src/render/sprites/icons.ts
  hooks: {
    score(ctx) {                    // wird bei Kopf aufgerufen
      ctx.chips += 2;
      if (ctx.run.streak >= 3) ctx.mult += 1;
    },
  },
},
```

**Die Hooks und wann sie laufen** (Reihenfolge pro Wurf):

| Hook | Wann | Typische Nutzung |
|---|---|---|
| `chance(ctx)` | vor dem Wurf | `ctx.headsChance += 0.05`, `ctx.edgeChance *= 2`. **Darf den Run nicht verändern** (wird auch für die Vorschau benutzt). |
| `result(ctx, self)` | nach dem Wurf | Ergebnis ändern: `ctx.side = 'heads'` |
| `score(ctx)` | nur bei Kopf/Rand | `ctx.chips`, `ctx.mult`, `ctx.xMult` anpassen |
| `tails(ctx)` | nur bei Zahl | Trostpreis: `ctx.gold += 2`, oder `ctx.keepStreak = true` |
| `after(ctx)` | immer, ganz am Ende | z. B. `ctx.breakCoin = true` |
| `roundStart(run)` | Rundenbeginn | `run.flipsLeft += 1`, `run.guaranteedHeads = true` |
| `roundEnd(run)` | Runde geschafft | `return 5` gibt 5 Bonus-Gold |

`self.counter` ist ein freier Zähler für Effekte wie „jeder 3. …“. Für Zufall immer `ctx.rng` benutzen,
**nie** `Math.random()`, sonst funktioniert der Seed nicht mehr.

Wenn das Relikt ein neues Symbol braucht: 12×12-Maske in `src/render/sprites/icons.ts` ergänzen
(`#` = Fläche, `+` = hell, `x` = dunkle Details).

## Neuen Boss hinzufügen

In `src/data/bosses.ts`. Einfache Effekte gehen über Felder, alles andere über Hooks wie bei Relikten:

```ts
{
  id: 'geizhals',
  name: 'Der Geizhals',
  desc: 'Kopf zahlt nur die Hälfte.',
  quotaMult: 1.1,                   // optional: eigene Quota-Stärke
  hooks: { score(ctx) { ctx.xMult *= 0.5; } },
},
```

Weitere Felder: `flipsDelta: -2` (weniger Würfe), `handSizeDelta: -1` (kleinere Hand), `hideChance: true`.

## Eigene PNG-Grafiken statt prozeduraler Sprites

1. PNG nach `public/sprites/` legen.
2. In `src/render/assets.ts` bei `PNG_OVERRIDES` eintragen:
   ```ts
   'coin:gold:big': { url: 'sprites/gold.png', frames: 64 },
   ```
   Ein Münz-Sheet ist ein Streifen mit allen Frames nebeneinander. Frame 0 = Kopf von vorne,
   Frame 32 (bei 64 Frames) = Zahl von vorne, dazwischen die Drehung.
   Relikte heißen `relic:<id>` (1 Frame, 14×14 empfohlen).

Klappt das Laden nicht, nutzt das Spiel automatisch wieder die prozedurale Grafik.

## Balance anpassen

Alle Zahlen stehen in `src/data/balance.ts`: Quota-Wachstum, Würfe pro Runde, Preise, Pech-Meter, Jackpot-Faktor …
Nach Änderungen `npm test` laufen lassen. Der Balance-Test prüft, dass Runde 1 mit dem Startdeck
meistens, aber nicht immer schaffbar ist.
