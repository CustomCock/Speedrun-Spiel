import { describe, expect, it } from 'vitest';
import { previewChance, resolveFlip } from '../src/core/flip';
import { newRun, startRound, roundStatus } from '../src/core/state';
import { BALANCE } from '../src/data/balance';
import { makeRun } from './helpers';

/** Wirft n-mal und zählt die Ergebnisse */
function simulate(deck: string[], relics: string[], n: number, seed = 'SIM') {
  const run = makeRun(deck, relics, seed);
  const count = { heads: 0, tails: 0, edge: 0 };
  for (let i = 0; i < n; i++) {
    run.luck = 0; // Pech-Meter-Ereignisse rausnehmen
    run.guaranteedHeads = false;
    const o = resolveFlip(run, run.hand[0]);
    count[o.side]++;
  }
  return count;
}

describe('Wahrscheinlichkeiten', () => {
  it('normale Münze: ~50 % Kopf', () => {
    const n = 40000;
    const c = simulate(['normal'], [], n);
    expect(Math.abs(c.heads / n - 0.5)).toBeLessThan(0.01);
  });

  it('Rand-Landung: ~0,5 %', () => {
    const n = 200000;
    const c = simulate(['normal'], [], n);
    expect(Math.abs(c.edge / n - BALANCE.edgeChance)).toBeLessThan(0.001);
  });

  it('gezinkte Münze: ~65 % Kopf', () => {
    const n = 40000;
    const c = simulate(['loaded'], [], n);
    expect(Math.abs(c.heads / n - 0.65)).toBeLessThan(0.012);
  });

  it('Vorschau zeigt die gleiche Chance, die tatsächlich gilt', () => {
    const run = makeRun(['loaded'], ['horseshoe']);
    expect(previewChance(run, run.hand[0]).heads).toBeCloseTo(0.7);
    const n = 30000;
    const c = simulate(['loaded'], ['horseshoe'], n);
    expect(Math.abs(c.heads / n - 0.7)).toBeLessThan(0.012);
  });

  it('Chance wird auf 2 %..98 % begrenzt', () => {
    const run = makeRun(['loaded'], []);
    run.deck[0].level = 99; // absurd hohes Upgrade
    expect(previewChance(run, run.hand[0]).heads).toBe(BALANCE.maxHeadsChance);
  });

  it('"Dritte Chance": jede 3. Zahl wird Kopf', () => {
    const run = makeRun(['normal'], ['third_tails']);
    let rawTails = 0;
    let converted = 0;
    for (let i = 0; i < 3000; i++) {
      run.luck = 0;
      const o = resolveFlip(run, run.hand[0]);
      if (o.rolledSide === 'tails') {
        rawTails++;
        if (o.side === 'heads') converted++;
      }
    }
    expect(converted).toBe(Math.floor(rawTails / 3));
  });

  it('Garantierter Kopf wirkt genau einmal', () => {
    const run = makeRun(['cursed'], []);
    run.guaranteedHeads = true;
    expect(resolveFlip(run, run.hand[0]).side).not.toBe('tails');
    expect(run.guaranteedHeads).toBe(false);
  });
});

describe('Reproduzierbarkeit', () => {
  it('gleicher Seed + gleiche Entscheidungen => identischer Run', () => {
    const play = () => {
      const run = newRun('REPRO');
      startRound(run);
      const log: string[] = [];
      while (roundStatus(run) === 'playing') {
        const o = resolveFlip(run, run.hand[0]);
        log.push(`${o.side}:${o.gold}`);
      }
      return log.join(',');
    };
    expect(play()).toBe(play());
  });
});
