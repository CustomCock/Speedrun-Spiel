/**
 * Shop-Logik: Angebote erzeugen, kaufen, rerollen, Münzen aufwerten/entfernen.
 *
 * "isUnlocked" wird von außen hineingereicht, damit diese Datei nichts über
 * localStorage wissen muss (und testbar bleibt).
 */
import { BALANCE, COIN_PRICE, RARITY_WEIGHT, RELIC_PRICE, priceScale } from '../data/balance';
import { addCoin, findCoin, removeCoinFromRun } from './state';
import { COINS, RELICS, coinDef, relicDef } from './registry';
import type { Rarity, RunState, ShopOffer } from './types';
import type { Rng } from './rng';

export type UnlockCheck = (id: string) => boolean;

/** Zieht ein Element gewichtet nach Seltenheit. */
function weightedPick<T extends { rarity: Rarity }>(rng: Rng, pool: T[]): T | undefined {
  if (pool.length === 0) return undefined;
  const total = pool.reduce((s, x) => s + RARITY_WEIGHT[x.rarity], 0);
  let roll = rng.next() * total;
  for (const x of pool) {
    roll -= RARITY_WEIGHT[x.rarity];
    if (roll < 0) return x;
  }
  return pool[pool.length - 1];
}

function makeOffers(run: RunState, isUnlocked: UnlockCheck): ShopOffer[] {
  const rng = run.rngShop;
  const scale = priceScale(run.round);
  const offers: ShopOffer[] = [];

  let coinPool = COINS.filter((c) => c.inShop !== false && isUnlocked(c.id));
  for (let i = 0; i < BALANCE.shopCoinOffers; i++) {
    const pick = weightedPick(rng, coinPool);
    if (!pick) break;
    coinPool = coinPool.filter((c) => c !== pick); // keine Doppelten
    offers.push({ kind: 'coin', defId: pick.id, price: Math.round(COIN_PRICE[pick.rarity] * scale), sold: false });
  }

  let relicPool = RELICS.filter((r) => isUnlocked(r.id) && !run.relics.some((o) => o.defId === r.id));
  for (let i = 0; i < BALANCE.shopRelicOffers; i++) {
    const pick = weightedPick(rng, relicPool);
    if (!pick) break;
    relicPool = relicPool.filter((r) => r !== pick);
    offers.push({ kind: 'relic', defId: pick.id, price: Math.round(RELIC_PRICE[pick.rarity] * scale), sold: false });
  }
  return offers;
}

/** Öffnet den Shop nach einer geschafften Runde. */
export function openShop(run: RunState, isUnlocked: UnlockCheck): void {
  const scale = priceScale(run.round);
  run.shop = {
    offers: makeOffers(run, isUnlocked),
    rerollCost: BALANCE.rerollBaseCost,
    upgradeCost: Math.round(BALANCE.upgradeBaseCost * scale),
    removeCost: Math.round(BALANCE.removeBaseCost * scale),
  };
}

export interface ShopResult {
  ok: boolean;
  reason?: string;
}

function pay(run: RunState, price: number): ShopResult {
  if (run.gold < price) return { ok: false, reason: 'Nicht genug Gold' };
  run.gold -= price;
  return { ok: true };
}

export function reroll(run: RunState, isUnlocked: UnlockCheck): ShopResult {
  const shop = run.shop;
  if (!shop) return { ok: false };
  const res = pay(run, shop.rerollCost);
  if (!res.ok) return res;
  shop.rerollCost++;
  shop.offers = makeOffers(run, isUnlocked);
  return res;
}

export function buy(run: RunState, index: number): ShopResult {
  const offer = run.shop?.offers[index];
  if (!offer || offer.sold) return { ok: false };
  if (offer.kind === 'relic' && run.relics.length >= run.maxRelics) {
    return { ok: false, reason: 'Relikt-Plätze voll' };
  }
  const res = pay(run, offer.price);
  if (!res.ok) return res;
  offer.sold = true;
  if (offer.kind === 'coin') addCoin(run, offer.defId);
  else run.relics.push({ defId: offer.defId, counter: 0, used: false });
  return res;
}

export function upgradeCoin(run: RunState, uid: number): ShopResult {
  const coin = findCoin(run, uid);
  if (!coin || !run.shop) return { ok: false };
  if (coin.level >= BALANCE.maxCoinLevel) return { ok: false, reason: 'Schon maximal aufgewertet' };
  const res = pay(run, run.shop.upgradeCost);
  if (!res.ok) return res;
  coin.level++;
  run.shop.upgradeCost += 2;
  return res;
}

export function removeCoin(run: RunState, uid: number): ShopResult {
  if (!run.shop) return { ok: false };
  if (run.deck.length <= BALANCE.minDeckSize) return { ok: false, reason: `Mindestens ${BALANCE.minDeckSize} Münzen` };
  const res = pay(run, run.shop.removeCost);
  if (!res.ok) return res;
  removeCoinFromRun(run, uid);
  run.shop.removeCost += 2;
  return res;
}

/** Relikt verkaufen (halber Grundpreis). */
export function sellRelic(run: RunState, index: number): ShopResult {
  const r = run.relics[index];
  if (!r) return { ok: false };
  run.relics.splice(index, 1);
  run.gold += Math.floor(RELIC_PRICE[relicDef(r.defId).rarity] / 2);
  return { ok: true };
}

/** Name für ein Angebot (für die Anzeige) */
export function offerName(o: ShopOffer): string {
  return o.kind === 'coin' ? coinDef(o.defId).name : relicDef(o.defId).name;
}
