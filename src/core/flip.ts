/**
 * DAS HERZSTÜCK: ein Münzwurf.
 *
 * resolveFlip() berechnet das komplette Ergebnis eines Wurfs, BEVOR irgendetwas
 * animiert wird. Die Animation spielt das Ergebnis nur noch ab. Dadurch ist die
 * Logik testbar (siehe tests/) und der Seed bleibt reproduzierbar.
 *
 * Auszahlung bei Kopf:   Gold = chips × mult × xMult
 *   chips = Münzwert (+ Upgrades, + Relikte)
 *   mult  = 1 + Serien-Bonus + Münz-Mult (+ Relikte)
 *   xMult = Münz-×Mult × Relikt-×Mults × Boss
 */
import { BALANCE } from '../data/balance';
import { addCoin, drawHand, findCoin, removeCoinFromRun } from './state';
import { bossDef, coinDef, relicDef } from './registry';
import type { CoinDef, FlipCtx, FlipOutcome, LuckEvent, RunState } from './types';
import type { Rng } from './rng';

/** Sind die Relikte gerade aktiv? (Boss "Pantomime" schaltet sie anfangs ab) */
export function relicsActive(run: RunState): boolean {
  return !(run.boss === 'mime' && run.flipsThisRound < 3);
}

/** Welche Definition gilt für eine Münze? (Spiegeltaler kopiert die letzte) */
export function effectiveDef(run: RunState, defId: string): CoinDef {
  const def = coinDef(defId);
  if (def.copiesLast && run.lastCoinDefId && run.lastCoinDefId !== defId) {
    const copied = coinDef(run.lastCoinDefId);
    if (!copied.copiesLast) return copied;
  }
  return def;
}

/** Baut den Kontext für einen Wurf mit Grundwerten. */
function makeCtx(run: RunState, uid: number, rng: Rng): FlipCtx {
  const coin = findCoin(run, uid);
  if (!coin) throw new Error(`Münze ${uid} ist nicht im Deck`);
  const def = effectiveDef(run, coin.defId);
  return {
    run,
    coin,
    def,
    headsChance: BALANCE.baseHeadsChance + (def.headsBonus ?? 0) + coin.level * BALANCE.upgradeChance,
    edgeChance: BALANCE.edgeChance * (def.edgeFactor ?? 1),
    side: 'tails',
    chips: def.value + coin.level * BALANCE.upgradeValue,
    mult: 1,
    xMult: 1,
    gold: 0,
    messages: [],
    rng,
    breakCoin: false,
    relicsActive: relicsActive(run),
    keepStreak: false,
    luckGain: def.luckGain ?? 1,
    streakGain: 1,
    streakCap: Infinity,
  };
}

/**
 * Ruft einen bestimmten Hook bei Münze, Relikten und Boss auf (in dieser Reihenfolge).
 * "name" ist z. B. 'chance' oder 'score'.
 */
function runHooks(ctx: FlipCtx, name: 'chance' | 'result' | 'score' | 'tails' | 'after'): void {
  ctx.def.hooks?.[name]?.(ctx, ctx.coin);
  if (ctx.relicsActive) {
    for (const r of ctx.run.relics) relicDef(r.defId).hooks?.[name]?.(ctx, r);
  }
  if (ctx.run.boss) bossDef(ctx.run.boss).hooks?.[name]?.(ctx, ctx.run);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Vorschau: Wie hoch ist die Kopf-Chance, wenn ich diese Münze werfe?
 * Verändert den Run NICHT (deshalb ein Wegwerf-RNG).
 */
export function previewChance(run: RunState, uid: number): { heads: number; edge: number; guaranteed: boolean } {
  const dummyRng: Rng = { next: () => 0, int: () => 0, chance: () => false, pick: (l) => l[0], shuffle: (l) => l.slice(), state: 0 };
  const ctx = makeCtx(run, uid, dummyRng);
  runHooks(ctx, 'chance');
  return {
    heads: clamp(ctx.headsChance, BALANCE.minHeadsChance, BALANCE.maxHeadsChance),
    edge: clamp(ctx.edgeChance, 0, 0.5),
    guaranteed: run.guaranteedHeads,
  };
}

/** Reine Auszahlungs-Formel (auch einzeln getestet). */
export function payout(chips: number, mult: number, xMult: number): number {
  return Math.max(0, Math.floor(chips * mult * xMult + 1e-9));
}

/** Serien-Bonus auf den Mult bei einer Serie der Länge "streak". */
export function streakMult(streak: number): number {
  return 1 + Math.max(0, streak - 1) * BALANCE.streakMultPerStep;
}

/**
 * Wirft die Münze mit der uid "uid" und wendet ALLES auf den Run an:
 * Gold, Serie, Pech-Meter, Zerbrechen, neue Hand.
 */
export function resolveFlip(run: RunState, uid: number): FlipOutcome {
  const ctx = makeCtx(run, uid, run.rngFlip);

  // 1) Wahrscheinlichkeiten
  runHooks(ctx, 'chance');
  ctx.headsChance = clamp(ctx.headsChance, BALANCE.minHeadsChance, BALANCE.maxHeadsChance);
  ctx.edgeChance = clamp(ctx.edgeChance, 0, 0.5);

  // 2) Der eigentliche Wurf – genau EINE Zufallszahl pro Wurf.
  //    [0 .. edge) = Rand, danach wird der Rest im Verhältnis Kopf/Zahl aufgeteilt.
  const r = ctx.rng.next();
  if (r < ctx.edgeChance) ctx.side = 'edge';
  else ctx.side = (r - ctx.edgeChance) / (1 - ctx.edgeChance) < ctx.headsChance ? 'heads' : 'tails';

  if (run.guaranteedHeads) {
    run.guaranteedHeads = false;
    if (ctx.side === 'tails') {
      ctx.side = 'heads';
      ctx.messages.push('Garantiert!');
    }
  }
  const rolledSide = ctx.side;

  // 3) Effekte dürfen das Ergebnis ändern
  runHooks(ctx, 'result');

  // 4) Auswertung
  if (ctx.side === 'tails') {
    runHooks(ctx, 'tails');
    if (!ctx.keepStreak) run.streak = 0;
    run.luck += ctx.luckGain;
    run.stats.tails++;
  } else {
    run.streak = Math.min(ctx.streakCap, run.streak + ctx.streakGain);
    run.headsThisRound++;
    ctx.mult = streakMult(run.streak) + (ctx.def.mult ?? 0);
    ctx.xMult = ctx.def.xMult ?? 1;
    runHooks(ctx, 'score');
    if (ctx.side === 'edge') {
      ctx.xMult *= BALANCE.edgeJackpotMult;
      ctx.messages.unshift('RAND! JACKPOT!');
      run.stats.edges++;
    } else {
      run.stats.heads++;
    }
    ctx.gold += payout(ctx.chips, ctx.mult, ctx.xMult);
  }

  // 5) Abschluss-Effekte (z. B. Glas zerbricht)
  runHooks(ctx, 'after');

  // Gold gutschreiben (nie unter 0)
  run.roundGold = Math.max(0, run.roundGold + ctx.gold);
  run.gold = Math.max(0, run.gold + ctx.gold);
  if (ctx.gold > 0) run.stats.totalGold += ctx.gold;
  run.stats.bestStreak = Math.max(run.stats.bestStreak, run.streak);
  run.stats.bestFlip = Math.max(run.stats.bestFlip, ctx.gold);

  run.lastSide = ctx.side;
  run.lastCoinDefId = ctx.def.id;
  run.flipsLeft--;
  run.flipsThisRound++;

  // Pech-Meter voll?
  let luckEvent: LuckEvent | null = null;
  if (run.luck >= run.luckMax) {
    run.luck = 0;
    luckEvent = triggerLuckEvent(run);
  }

  // Münze aus der Hand nehmen (abgelegt) bzw. zerstören, dann nachziehen
  run.hand = run.hand.filter((u) => u !== uid);
  if (ctx.breakCoin && run.deck.length > 1) removeCoinFromRun(run, uid);
  drawHand(run);

  return {
    coinUid: uid,
    defId: ctx.coin.defId,
    side: ctx.side,
    chance: ctx.headsChance,
    chips: ctx.chips,
    mult: ctx.mult,
    xMult: ctx.xMult,
    gold: ctx.gold,
    streak: run.streak,
    messages: ctx.messages,
    luckEvent,
    broke: ctx.breakCoin,
    rolledSide,
  };
}

/** Pech-Meter ist voll: Belohnung oder Fluch würfeln. */
export function triggerLuckEvent(run: RunState): LuckEvent {
  const rng = run.rngMisc;
  const hasClover = run.relics.some((r) => r.defId === 'clover');
  const good = hasClover || rng.chance(BALANCE.luckGoodChance);

  if (good) {
    const roll = rng.int(3);
    if (roll === 0) {
      const g = Math.max(5, Math.round(run.quota * 0.25));
      run.gold += g;
      run.roundGold += g;
      return { good, text: `Glückspilz! +${g} Gold` };
    }
    if (roll === 1) {
      run.guaranteedHeads = true;
      return { good, text: 'Nächster Wurf: garantiert Kopf!' };
    }
    const upgradable = run.deck.filter((c) => c.level < BALANCE.maxCoinLevel);
    if (upgradable.length > 0) {
      const c = rng.pick(upgradable);
      c.level++;
      return { good, text: `${coinDef(c.defId).name} aufgewertet!` };
    }
    run.gold += 8;
    return { good, text: 'Glückspilz! +8 Gold' };
  }

  const roll = rng.int(3);
  if (roll === 0 && run.gold > 0) {
    const lost = Math.ceil(run.gold * 0.25);
    run.gold -= lost;
    return { good, text: `Taschendieb! -${lost} Gold` };
  }
  if (roll === 1 && run.flipsLeft > 1) {
    run.flipsLeft--;
    return { good, text: 'Verschluckt! -1 Wurf' };
  }
  addCoin(run, 'cursed');
  return { good, text: 'Ein verfluchter Groschen schleicht sich ins Deck…' };
}
