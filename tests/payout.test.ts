import { describe, expect, it } from 'vitest';
import { payout, resolveFlip, streakMult } from '../src/core/flip';
import { BALANCE } from '../src/data/balance';
import { makeRun } from './helpers';
import type { RunState } from '../src/core/types';

/** Wirft so lange, bis die gewünschte Seite kommt (Seed ist fest => deterministisch) */
function flipUntil(run: RunState, side: 'heads' | 'tails' | 'edge') {
  for (let i = 0; i < 100000; i++) {
    run.luck = 0;
    const before = run.streak;
    const o = resolveFlip(run, run.hand[0]);
    if (o.side === side) return { o, before };
  }
  throw new Error('nicht gefunden');
}

describe('Auszahlungsformel', () => {
  it('chips × mult × xMult, abgerundet', () => {
    expect(payout(3, 1, 1)).toBe(3);
    expect(payout(3, 2, 1.5)).toBe(9);
    expect(payout(5, 3, 2.5)).toBe(37);
    expect(payout(2, 1, 0.75)).toBe(1);
    expect(payout(-5, 1, 1)).toBe(0);
  });

  it('Serien-Mult: 1, 2, 3, ...', () => {
    expect(streakMult(0)).toBe(1);
    expect(streakMult(1)).toBe(1);
    expect(streakMult(2)).toBe(2);
    expect(streakMult(5)).toBe(5);
  });

  it('Kopf mit normaler Münze zahlt Wert × Serien-Mult', () => {
    const run = makeRun(['normal']);
    const { o } = flipUntil(run, 'heads');
    expect(o.gold).toBe(3 * streakMult(o.streak));
  });

  it('Kupfer: +2 Mult', () => {
    const run = makeRun(['copper']);
    const { o } = flipUntil(run, 'heads');
    expect(o.mult).toBe(streakMult(o.streak) + 2);
    expect(o.gold).toBe(2 * o.mult);
  });

  it('Zahl zahlt nichts und setzt die Serie zurück', () => {
    const run = makeRun(['normal']);
    run.streak = 4;
    const { o } = flipUntil(run, 'tails');
    expect(o.gold).toBe(0);
    expect(run.streak).toBe(0);
  });

  it('Bleimünze hält die Serie bei Zahl', () => {
    const run = makeRun(['lead']);
    run.streak = 3;
    flipUntil(run, 'tails');
    // Zwischen-Köpfe erhöhen die Serie evtl. – sie darf aber nie auf 0 fallen
    expect(run.streak).toBeGreaterThanOrEqual(3);
  });

  it('Relikte: Goldzahn (+3 chips) und Krone (×2 ab 4er Serie)', () => {
    const run = makeRun(['normal'], ['golden_tooth', 'crown']);
    run.streak = 10; // Krone sicher aktiv (wenn Kopf)
    const { o, before } = flipUntil(run, 'heads');
    expect(o.chips).toBe(6);
    const expectedX = o.streak >= 4 ? 2 : 1;
    expect(o.xMult).toBe(expectedX);
    expect(o.gold).toBe(payout(6, streakMult(o.streak), expectedX));
    expect(before).toBeGreaterThanOrEqual(0);
  });

  it('Rand-Landung zahlt ×25 (Jackpot)', () => {
    const run = makeRun(['razor']); // 10× Rand-Chance, damit der Test schnell ist
    const { o } = flipUntil(run, 'edge');
    expect(o.xMult).toBe(BALANCE.edgeJackpotMult);
    expect(o.gold).toBe(payout(2, streakMult(o.streak), BALANCE.edgeJackpotMult));
  });

  it('Spiegeltaler kopiert die letzte Münze', () => {
    const run = makeRun(['copper', 'mirror']);
    run.lastCoinDefId = 'copper';
    const mirrorUid = run.deck.find((c) => c.defId === 'mirror')!.uid;
    run.hand = [mirrorUid];
    run.luck = 0;
    const o = resolveFlip(run, mirrorUid);
    if (o.side !== 'tails') expect(o.chips).toBe(2); // Kupferwert statt 3
    expect(run.lastCoinDefId).toBe('copper');
  });

  it('Boss "Steuereintreiber": ×0,75', () => {
    const run = makeRun(['normal']);
    run.boss = 'taxman';
    const { o } = flipUntil(run, 'heads');
    expect(o.xMult).toBeCloseTo(0.75);
  });
});
