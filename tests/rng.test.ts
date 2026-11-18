import { describe, expect, it } from 'vitest';
import { dailySeed, hashString, mulberry32, rngFromSeed } from '../src/core/rng';

describe('RNG (mulberry32)', () => {
  it('gleicher Seed => exakt gleiche Folge', () => {
    const a = rngFromSeed('ABC');
    const b = rngFromSeed('ABC');
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('verschiedene Seeds => verschiedene Folgen', () => {
    const a = rngFromSeed('ABC');
    const b = rngFromSeed('ABD');
    const same = Array.from({ length: 50 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBeLessThan(3);
  });

  it('liefert Werte in [0, 1)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 100000; i++) {
      const v = r.next();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });

  it('ist gleichverteilt (10 Fächer, je ~10 %)', () => {
    const r = mulberry32(7);
    const bins = new Array(10).fill(0);
    const n = 200000;
    for (let i = 0; i < n; i++) bins[Math.floor(r.next() * 10)]++;
    for (const b of bins) expect(Math.abs(b / n - 0.1)).toBeLessThan(0.005);
  });

  it('int(), pick() und shuffle() bleiben im Rahmen', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
    }
    const list = [1, 2, 3, 4, 5, 6, 7];
    const sh = r.shuffle(list);
    expect([...sh].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5, 6, 7]); // Original unverändert
  });

  it('hashString ist stabil und Daily Seed hat das richtige Format', () => {
    expect(hashString('CockFlip')).toBe(hashString('CockFlip'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(dailySeed(new Date(2026, 10, 18))).toBe('DAILY-2026-11-18');
  });
});
