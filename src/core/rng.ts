/**
 * Zufallszahlen mit "Seed".
 *
 * Math.random() liefert jedes Mal andere Zahlen. Für ein Roguelike wollen wir
 * aber reproduzierbare Runs: gleicher Seed => exakt gleiche Würfe, gleicher Shop.
 * Dafür benutzen wir "mulberry32", einen winzigen, schnellen Pseudo-Zufallsgenerator.
 *
 * Ein RNG hat einen internen Zustand (eine 32-Bit-Zahl). Jeder Aufruf von next()
 * verändert den Zustand und liefert eine Zahl zwischen 0 (inklusive) und 1 (exklusive).
 */

export interface Rng {
  /** Zahl im Bereich [0, 1) */
  next(): number;
  /** Ganze Zahl im Bereich [0, max) */
  int(max: number): number;
  /** true mit Wahrscheinlichkeit p (0..1) */
  chance(p: number): boolean;
  /** Ein zufälliges Element aus einer Liste */
  pick<T>(list: readonly T[]): T;
  /** Mischt eine Liste (Kopie) – Fisher-Yates-Verfahren */
  shuffle<T>(list: readonly T[]): T[];
  /** Interner Zustand (zum Speichern/Testen) */
  readonly state: number;
}

/** mulberry32: aus einem 32-Bit-Startwert wird ein Zufallsgenerator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0; // ">>> 0" erzwingt eine vorzeichenlose 32-Bit-Zahl

  const next = (): number => {
    // Die "magischen" Konstanten stammen aus dem Original-Algorithmus.
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (max) => Math.floor(next() * max),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle: (list) => {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    get state() {
      return a;
    },
  };
}

/**
 * Macht aus einem beliebigen Text (z. B. "DAILY-2026-11-18") eine 32-Bit-Zahl.
 * (Hash-Funktion "cyrb53", auf 32 Bit gekürzt.) Gleicher Text => gleiche Zahl.
 */
export function hashString(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Erzeugt einen RNG direkt aus einem Text-Seed. */
export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashString(seed));
}

/** Der Seed des Tages, z. B. "DAILY-2026-11-18". Alle Spieler bekommen denselben Run. */
export function dailySeed(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `DAILY-${y}-${m}-${d}`;
}

/** Ein zufälliger, gut lesbarer Seed wie "K7Q2-M9XA" für normale Runs. */
export function randomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I (Verwechslungsgefahr)
  let s = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) s += '-';
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
