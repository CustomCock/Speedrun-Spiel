/**
 * Alle Stellschrauben für die Spielbalance an einem Ort.
 * Wenn sich das Spiel zu leicht/schwer anfühlt: HIER drehen.
 */
import type { Rarity } from '../core/types';

export const BALANCE = {
  /** Grundwahrscheinlichkeit für Kopf */
  baseHeadsChance: 0.5,
  /** Grenzen – nie ganz sicher, nie ganz unmöglich */
  minHeadsChance: 0.02,
  maxHeadsChance: 0.98,

  /** Rand-Landung: 0,5 % */
  edgeChance: 0.005,
  /** Rand-Landung zahlt chips × mult × xMult × diesen Faktor */
  edgeJackpotMult: 25,

  /** Würfe pro Runde */
  flipsPerRound: 8,
  /** Wie viele Münzen gleichzeitig zur Auswahl liegen */
  handSize: 3,
  maxRelics: 5,

  /** Jede wievielte Runde ist eine Bossrunde */
  bossEvery: 3,
  /** Quota der Bossrunde wird damit multipliziert */
  bossQuotaMult: 1.25,

  /** Quota = quotaBase × quotaGrowth^(Runde-1) */
  quotaBase: 12,
  quotaGrowth: 1.5,

  /** Jede Kopf-Serie (ab dem 2. Kopf) gibt so viel +Mult */
  streakMultPerStep: 1,

  /** Pech-Meter */
  luckMax: 6,
  luckGoodChance: 0.65,

  /** Upgrade einer Münze: +Gold und +Kopf-Chance pro Stufe */
  upgradeValue: 2,
  upgradeChance: 0.03,
  maxCoinLevel: 3,

  /** Belohnung pro übrig gebliebenem Wurf, wenn die Quota früh erreicht ist */
  leftoverFlipGold: 2,
  /** Grundbelohnung für jede geschaffte Runde */
  roundClearGold: 4,

  /** Startgold */
  startGold: 6,

  /** Shop */
  shopCoinOffers: 3,
  shopRelicOffers: 2,
  rerollBaseCost: 3,
  upgradeBaseCost: 6,
  removeBaseCost: 4,
  minDeckSize: 3,
  /** Preise steigen pro Runde um diesen Anteil */
  priceGrowthPerRound: 0.15,
} as const;

/** Grundpreise nach Seltenheit */
export const COIN_PRICE: Record<Rarity, number> = { common: 5, uncommon: 8, rare: 12, legendary: 18 };
export const RELIC_PRICE: Record<Rarity, number> = { common: 7, uncommon: 11, rare: 15, legendary: 22 };

/** Wie oft eine Seltenheit im Shop gezogen wird (relatives Gewicht) */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 28, rare: 10, legendary: 2 };

/** Startdeck (IDs aus coins.ts) */
export const STARTER_DECK = ['normal', 'normal', 'normal', 'normal', 'copper', 'copper', 'loaded'];

/** Quota einer Runde ausrechnen */
export function quotaFor(round: number, bossMult = 1): number {
  const q = BALANCE.quotaBase * Math.pow(BALANCE.quotaGrowth, round - 1);
  return Math.round(q * bossMult);
}

/** Ist diese Runde eine Bossrunde? */
export function isBossRound(round: number): boolean {
  return round % BALANCE.bossEvery === 0;
}

/** Preisfaktor für eine Runde */
export function priceScale(round: number): number {
  return 1 + BALANCE.priceGrowthPerRound * (round - 1);
}
