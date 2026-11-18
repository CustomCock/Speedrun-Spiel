/**
 * Nachschlagewerk: findet eine Münze / ein Relikt / einen Boss anhand der id.
 * (Maps sind schneller als jedes Mal die ganze Liste zu durchsuchen.)
 */
import { COINS } from '../data/coins';
import { RELICS } from '../data/relics';
import { BOSSES } from '../data/bosses';
import type { BossDef, CoinDef, RelicDef } from './types';

const coinMap = new Map(COINS.map((c) => [c.id, c]));
const relicMap = new Map(RELICS.map((r) => [r.id, r]));
const bossMap = new Map(BOSSES.map((b) => [b.id, b]));

export function coinDef(id: string): CoinDef {
  const d = coinMap.get(id);
  if (!d) throw new Error(`Unbekannte Münze: "${id}" – Tippfehler in data/coins.ts?`);
  return d;
}

export function relicDef(id: string): RelicDef {
  const d = relicMap.get(id);
  if (!d) throw new Error(`Unbekanntes Relikt: "${id}" – Tippfehler in data/relics.ts?`);
  return d;
}

export function bossDef(id: string): BossDef {
  const d = bossMap.get(id);
  if (!d) throw new Error(`Unbekannter Boss: "${id}" – Tippfehler in data/bosses.ts?`);
  return d;
}

export { COINS, RELICS, BOSSES };
