import { describe, expect, it } from 'vitest';
import { resolveFlip } from '../src/core/flip';
import { newRun, roundStatus, startRound } from '../src/core/state';
import { quotaFor } from '../src/data/balance';

describe('Balance', () => {
  it('Quota steigt jede Runde', () => {
    for (let r = 1; r < 20; r++) expect(quotaFor(r + 1)).toBeGreaterThan(quotaFor(r));
  });

  it('Runde 1 ist mit dem Startdeck meistens schaffbar (aber nicht immer)', () => {
    let wins = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const run = newRun('BAL' + i);
      startRound(run);
      while (roundStatus(run) === 'playing') resolveFlip(run, run.hand[0]);
      if (roundStatus(run) === 'won') wins++;
    }
    const rate = wins / n;
    expect(rate).toBeGreaterThan(0.75);
    expect(rate).toBeLessThan(0.99);
  });
});
