/**
 * Zentrale Typ-Definitionen.
 *
 * TypeScript-"interfaces" beschreiben nur, wie ein Objekt aussehen muss
 * (welche Felder, welche Typen). Sie erzeugen keinen Code – sie helfen dem
 * Editor, Tippfehler und falsche Werte sofort zu markieren.
 */
import type { Rng } from './rng';

/** Wie eine Münze landet: Kopf, Zahl oder (sehr selten) auf dem Rand. */
export type Side = 'heads' | 'tails' | 'edge';

/** Seltenheit beeinflusst Preis und wie oft etwas im Shop auftaucht. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

// ---------------------------------------------------------------------------
// Laufzeit-Objekte (existieren während eines Runs)
// ---------------------------------------------------------------------------

/** Eine konkrete Münze im Deck des Spielers. */
export interface CoinInstance {
  /** Eindeutige Nummer – damit man zwei gleiche Münzen unterscheiden kann */
  uid: number;
  /** Verweis auf die Definition in src/data/coins.ts */
  defId: string;
  /** Upgrade-Stufe (0 = nicht aufgewertet) */
  level: number;
}

/** Ein Relikt, das der Spieler besitzt. */
export interface RelicInstance {
  defId: string;
  /** Freier Zähler für Effekte wie "jede 3. Zahl ..." */
  counter: number;
  /** Für Einmal-Effekte (z. B. Phönixfeder) */
  used: boolean;
}

/** Ein Angebot im Shop. */
export interface ShopOffer {
  kind: 'coin' | 'relic';
  defId: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  offers: ShopOffer[];
  rerollCost: number;
  upgradeCost: number;
  removeCost: number;
}

/** Ergebnis, wenn das Pech-Meter voll ist. */
export interface LuckEvent {
  good: boolean;
  text: string;
}

/** Der komplette Zustand eines laufenden Runs. */
export interface RunState {
  seed: string;
  daily: boolean;

  round: number;
  quota: number;
  /** Gold, das in dieser Runde erspielt wurde (zählt für die Quota) */
  roundGold: number;
  /** Geldbeutel – damit wird im Shop bezahlt */
  gold: number;
  flipsLeft: number;
  flipsThisRound: number;

  /** Alle Münzen, die der Spieler besitzt */
  deck: CoinInstance[];
  /** uids der Münzen, die noch gezogen werden können */
  drawPile: number[];
  /** uids der Münzen, die gerade zur Auswahl liegen */
  hand: number[];
  handSize: number;
  nextUid: number;

  relics: RelicInstance[];
  maxRelics: number;

  streak: number;
  luck: number;
  luckMax: number;

  boss: string | null;
  /** Relikt-/Effekt-Flags */
  guaranteedHeads: boolean;
  lastSide: Side | null;
  lastCoinDefId: string | null;
  headsThisRound: number;

  stats: { heads: number; tails: number; edges: number; bestStreak: number; bestFlip: number; totalGold: number };

  /** Getrennte Zufallsströme: Shop-Rerolls verändern nicht die Würfe! */
  rngFlip: Rng;
  rngShop: Rng;
  rngMisc: Rng;

  shop: ShopState | null;
}

// ---------------------------------------------------------------------------
// Effekt-System ("Hooks")
// ---------------------------------------------------------------------------

/**
 * Alles, was während EINES Wurfs berechnet wird. Effekte (Münzen, Relikte,
 * Bosse) dürfen diese Werte verändern.
 *
 * Auszahlung bei Kopf:   gold = chips × mult × xMult
 */
export interface FlipCtx {
  run: RunState;
  coin: CoinInstance;
  def: CoinDef;
  /** Kopf-Wahrscheinlichkeit 0..1 (wird am Ende auf 2 %..98 % begrenzt) */
  headsChance: number;
  /** Rand-Wahrscheinlichkeit (Standard 0,5 %) */
  edgeChance: number;
  /** Das Ergebnis – erst ab dem "result"-Hook gesetzt */
  side: Side;
  /** Basis-Gold */
  chips: number;
  /** Additiver Multiplikator (Startwert 1 + Streak) */
  mult: number;
  /** Multiplikativer Multiplikator (Startwert 1) */
  xMult: number;
  /** Endgültiges Gold dieses Wurfs (nach dem Rechnen) */
  gold: number;
  /** Kurze Texte, die als Popup erscheinen ("Hufeisen!") */
  messages: string[];
  /** Zufall – NUR diesen benutzen, nie Math.random() (sonst kaputter Seed) */
  rng: Rng;
  /** Wenn true, wird die Münze nach dem Wurf zerstört (z. B. Glas) */
  breakCoin: boolean;
  /** Sind Relikte gerade aktiv? (ein Boss kann sie abschalten) */
  relicsActive: boolean;
  /** Wenn true, setzt Zahl die Serie NICHT zurück */
  keepStreak: boolean;
  /** Wie stark Zahl das Pech-Meter füllt */
  luckGain: number;
  /** Um wie viel eine Kopf-Landung die Serie erhöht */
  streakGain: number;
  /** Höchstmögliche Serie (Boss kann begrenzen) */
  streakCap: number;
}

/**
 * Hooks sind Funktionen, die das Spiel zu bestimmten Zeitpunkten aufruft.
 * Jede ist optional – man implementiert nur, was man braucht.
 * "self" ist die Münze bzw. das Relikt, zu dem der Hook gehört.
 *
 * Reihenfolge pro Wurf:
 *   1. chance  – Wahrscheinlichkeiten anpassen
 *   2. (Münze wird geworfen)
 *   3. result  – Ergebnis darf verändert werden (z. B. Zahl -> Kopf)
 *   4. score   – nur bei Kopf/Rand: chips / mult / xMult anpassen
 *      tails   – nur bei Zahl
 *   5. after   – immer, ganz am Ende
 */
export interface Hooks<Self> {
  /** WICHTIG: darf den Run NICHT verändern (wird auch für die Vorschau benutzt) */
  chance?(ctx: FlipCtx, self: Self): void;
  result?(ctx: FlipCtx, self: Self): void;
  score?(ctx: FlipCtx, self: Self): void;
  tails?(ctx: FlipCtx, self: Self): void;
  after?(ctx: FlipCtx, self: Self): void;
  roundStart?(run: RunState, self: Self): void;
  /** Am Rundenende (nur bei Erfolg). Gibt Bonus-Gold für den Geldbeutel zurück. */
  roundEnd?(run: RunState, self: Self): number | void;
}

/** Bedingung für Freischaltungen (Meta-Progression). */
export interface Unlock {
  /** Text, der im Sammlungs-Menü bei gesperrten Dingen steht */
  hint: string;
  check(meta: MetaStats): boolean;
}

// ---------------------------------------------------------------------------
// Daten-Definitionen (stehen in src/data/*.ts)
// ---------------------------------------------------------------------------

/** Aussehen einer Münze – Namen aus src/render/sprites/palettes.ts und emblems.ts */
export interface CoinLook {
  palette: string;
  heads: string;
  tails: string;
}

export interface CoinDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  /** Basis-Gold bei Kopf ("Chips") */
  value: number;
  /** Bonus auf die Kopf-Chance, z. B. 0.15 = +15 Prozentpunkte */
  headsBonus?: number;
  /** +Mult bei Kopf */
  mult?: number;
  /** ×Mult bei Kopf */
  xMult?: number;
  /** Rand-Chance wird damit multipliziert */
  edgeFactor?: number;
  /** Wie stark Zahl das Pech-Meter füllt (Standard 1) */
  luckGain?: number;
  /** true = kopiert Werte und Effekte der zuletzt geworfenen Münze */
  copiesLast?: boolean;
  /** false = taucht nicht im Shop auf (z. B. Fluch-Münzen) */
  inShop?: boolean;
  look: CoinLook;
  unlock?: Unlock;
  hooks?: Hooks<CoinInstance>;
}

export interface RelicIcon {
  /** Form aus src/render/sprites/icons.ts */
  shape: string;
  /** Palette aus src/render/sprites/palettes.ts */
  palette: string;
}

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: RelicIcon;
  unlock?: Unlock;
  hooks?: Hooks<RelicInstance>;
}

export interface BossDef {
  id: string;
  name: string;
  desc: string;
  /** Würfe pro Runde verändern (negativ = weniger) */
  flipsDelta?: number;
  /** Handgröße verändern */
  handSizeDelta?: number;
  /** Kopf-Chance im UI verstecken */
  hideChance?: boolean;
  /** Quota-Faktor (Standard aus balance.ts) */
  quotaMult?: number;
  hooks?: Hooks<RunState>;
}

// ---------------------------------------------------------------------------
// Meta-Progression (bleibt zwischen Runs im Browser gespeichert)
// ---------------------------------------------------------------------------

export interface MetaStats {
  runs: number;
  bestRound: number;
  totalHeads: number;
  totalTails: number;
  totalEdges: number;
  bestStreak: number;
  bestFlip: number;
  bossesBeaten: number;
  totalGold: number;
  unlocked: string[];
  dailyBest: Record<string, number>;
}

/** Was ein Wurf zurückgibt – die Animation spielt das nur noch ab. */
export interface FlipOutcome {
  coinUid: number;
  defId: string;
  side: Side;
  /** Kopf-Chance, mit der geworfen wurde */
  chance: number;
  chips: number;
  mult: number;
  xMult: number;
  gold: number;
  streak: number;
  messages: string[];
  luckEvent: LuckEvent | null;
  broke: boolean;
  /** Das Ergebnis vor dem result-Hook (z. B. für "Zahl wurde zu Kopf") */
  rolledSide: Side;
}
