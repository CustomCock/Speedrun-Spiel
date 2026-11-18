/**
 * Run-Zustand: neuen Run anlegen, Runden starten/beenden, Münzen ziehen.
 * Hier gibt es KEIN Zeichnen und KEINE Animation – nur Spielregeln.
 */
import { BALANCE, STARTER_DECK, isBossRound, quotaFor } from '../data/balance';
import { BOSSES, bossDef, relicDef } from './registry';
import { rngFromSeed } from './rng';
import type { CoinInstance, RunState } from './types';

/** Legt einen frischen Run an (noch vor Runde 1). */
export function newRun(seed: string, daily = false): RunState {
  const run: RunState = {
    seed,
    daily,
    round: 0,
    quota: 0,
    roundGold: 0,
    gold: BALANCE.startGold,
    flipsLeft: 0,
    flipsThisRound: 0,
    deck: [],
    drawPile: [],
    hand: [],
    handSize: BALANCE.handSize,
    nextUid: 1,
    relics: [],
    maxRelics: BALANCE.maxRelics,
    streak: 0,
    luck: 0,
    luckMax: BALANCE.luckMax,
    boss: null,
    guaranteedHeads: false,
    lastSide: null,
    lastCoinDefId: null,
    headsThisRound: 0,
    stats: { heads: 0, tails: 0, edges: 0, bestStreak: 0, bestFlip: 0, totalGold: 0 },
    // Drei unabhängige Zufallsströme aus demselben Seed:
    rngFlip: rngFromSeed(seed + '#flip'),
    rngShop: rngFromSeed(seed + '#shop'),
    rngMisc: rngFromSeed(seed + '#misc'),
    shop: null,
  };
  for (const id of STARTER_DECK) addCoin(run, id);
  return run;
}

/** Fügt eine Münze ins Deck ein und gibt sie zurück. */
export function addCoin(run: RunState, defId: string, level = 0): CoinInstance {
  const coin: CoinInstance = { uid: run.nextUid++, defId, level };
  run.deck.push(coin);
  run.drawPile.push(coin.uid);
  return coin;
}

/** Entfernt eine Münze komplett (Deck, Hand, Ziehstapel). */
export function removeCoinFromRun(run: RunState, uid: number): void {
  run.deck = run.deck.filter((c) => c.uid !== uid);
  run.hand = run.hand.filter((u) => u !== uid);
  run.drawPile = run.drawPile.filter((u) => u !== uid);
}

export function findCoin(run: RunState, uid: number): CoinInstance | undefined {
  return run.deck.find((c) => c.uid === uid);
}

/** Startet die nächste Runde. */
export function startRound(run: RunState): void {
  run.round++;
  run.shop = null;

  // Boss?
  run.boss = isBossRound(run.round) ? run.rngMisc.pick(BOSSES).id : null;
  const boss = run.boss ? bossDef(run.boss) : null;

  const bossMult = boss ? (boss.quotaMult ?? BALANCE.bossQuotaMult) : 1;
  run.quota = quotaFor(run.round, bossMult);
  run.roundGold = 0;
  run.flipsThisRound = 0;
  run.headsThisRound = 0;
  run.flipsLeft = Math.max(1, BALANCE.flipsPerRound + (boss?.flipsDelta ?? 0));
  run.handSize = Math.max(1, BALANCE.handSize + (boss?.handSizeDelta ?? 0));
  run.streak = 0;
  run.guaranteedHeads = false;
  run.lastSide = null;

  // Ziehstapel neu mischen: alle Münzen sind wieder verfügbar
  run.hand = [];
  run.drawPile = run.rngMisc.shuffle(run.deck.map((c) => c.uid));
  drawHand(run);

  // Relikte & Boss dürfen auf den Rundenstart reagieren (z. B. +2 Würfe)
  for (const r of run.relics) relicDef(r.defId).hooks?.roundStart?.(run, r);
  boss?.hooks?.roundStart?.(run, run);
}

/** Füllt die Hand wieder auf. Ist der Stapel leer, wird neu gemischt. */
export function drawHand(run: RunState): void {
  const target = Math.min(run.handSize, run.deck.length);
  while (run.hand.length < target) {
    if (run.drawPile.length === 0) {
      const notInHand = run.deck.map((c) => c.uid).filter((u) => !run.hand.includes(u));
      if (notInHand.length === 0) break;
      run.drawPile = run.rngMisc.shuffle(notInHand);
    }
    run.hand.push(run.drawPile.pop()!);
  }
}

export type RoundStatus = 'playing' | 'won' | 'lost';

export function roundStatus(run: RunState): RoundStatus {
  if (run.roundGold >= run.quota) return 'won';
  if (run.flipsLeft <= 0) return 'lost';
  return 'playing';
}

export interface RewardLine {
  label: string;
  gold: number;
}

/** Rundenende bei Erfolg: Belohnungen auszahlen. Gibt die Einzelposten zurück. */
export function payRoundRewards(run: RunState): RewardLine[] {
  const lines: RewardLine[] = [];
  lines.push({ label: 'Runde geschafft', gold: BALANCE.roundClearGold + Math.floor(run.round / 2) });
  if (run.flipsLeft > 0) {
    lines.push({ label: `${run.flipsLeft} Würfe übrig`, gold: run.flipsLeft * BALANCE.leftoverFlipGold });
  }
  if (run.boss) lines.push({ label: 'Boss besiegt', gold: 5 });
  for (const r of run.relics) {
    const def = relicDef(r.defId);
    const bonus = def.hooks?.roundEnd?.(run, r);
    if (bonus) lines.push({ label: def.name, gold: bonus });
  }
  for (const l of lines) run.gold += l.gold;
  return lines;
}

/** Phönixfeder: rettet einmal vor Game Over. true = gerettet. */
export function tryPhoenix(run: RunState): boolean {
  const feather = run.relics.find((r) => r.defId === 'phoenix' && !r.used);
  if (!feather) return false;
  run.relics = run.relics.filter((r) => r !== feather);
  return true;
}
