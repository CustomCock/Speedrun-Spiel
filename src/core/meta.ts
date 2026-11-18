/**
 * Meta-Progression: Statistiken und Freischaltungen über alle Runs hinweg.
 * Gespeichert im localStorage des Browsers (bleibt nach dem Schließen erhalten).
 */
import { COINS, RELICS } from './registry';
import type { FlipOutcome, MetaStats, RunState } from './types';

const KEY = 'cockflip.meta.v1';

export function defaultMeta(): MetaStats {
  return {
    runs: 0,
    bestRound: 0,
    totalHeads: 0,
    totalTails: 0,
    totalEdges: 0,
    bestStreak: 0,
    bestFlip: 0,
    bossesBeaten: 0,
    totalGold: 0,
    unlocked: [],
    dailyBest: {},
  };
}

/** Lädt die Meta-Daten. Bei Fehlern (z. B. privater Modus) gibt es frische Werte. */
export function loadMeta(): MetaStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    return { ...defaultMeta(), ...JSON.parse(raw) };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    // Speichern nicht möglich – Spiel läuft trotzdem weiter.
  }
}

/** Ist eine Münze/ein Relikt verfügbar? (ohne unlock-Bedingung: immer) */
export function isUnlocked(meta: MetaStats, id: string): boolean {
  const def = COINS.find((c) => c.id === id) ?? RELICS.find((r) => r.id === id);
  if (!def) return false;
  return !def.unlock || meta.unlocked.includes(id);
}

/** Nach jedem Wurf: Statistik mitzählen. */
export function recordFlip(meta: MetaStats, o: FlipOutcome): void {
  if (o.side === 'heads') meta.totalHeads++;
  else if (o.side === 'tails') meta.totalTails++;
  else meta.totalEdges++;
  meta.bestStreak = Math.max(meta.bestStreak, o.streak);
  meta.bestFlip = Math.max(meta.bestFlip, o.gold);
  if (o.gold > 0) meta.totalGold += o.gold;
}

/** Nach einer geschafften Runde. */
export function recordRoundWon(meta: MetaStats, run: RunState): void {
  meta.bestRound = Math.max(meta.bestRound, run.round + 1);
  if (run.boss) meta.bossesBeaten++;
}

/** Am Ende eines Runs. */
export function recordRunEnd(meta: MetaStats, run: RunState): void {
  meta.runs++;
  meta.bestRound = Math.max(meta.bestRound, run.round);
  if (run.daily) {
    const prev = meta.dailyBest[run.seed] ?? 0;
    meta.dailyBest[run.seed] = Math.max(prev, run.round);
  }
}

/** Prüft alle Bedingungen und gibt die NEU freigeschalteten Namen zurück. */
export function checkUnlocks(meta: MetaStats): string[] {
  const fresh: string[] = [];
  for (const def of [...COINS, ...RELICS]) {
    if (def.unlock && !meta.unlocked.includes(def.id) && def.unlock.check(meta)) {
      meta.unlocked.push(def.id);
      fresh.push(def.name);
    }
  }
  return fresh;
}
