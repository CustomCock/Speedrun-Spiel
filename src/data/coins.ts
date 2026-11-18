/**
 * ALLE MÜNZEN DES SPIELS
 * ======================
 * Neue Münze hinzufügen = einen neuen Eintrag in die Liste unten schreiben.
 * Fertig – Shop, Sammlung und Grafik übernehmen sie automatisch.
 *
 * Wichtigste Felder:
 *   id          eindeutiger Name (nur Kleinbuchstaben/Unterstrich)
 *   name, desc  Anzeigename und Beschreibung (deutsch)
 *   rarity      'common' | 'uncommon' | 'rare' | 'legendary'
 *   value       Basis-Gold bei Kopf
 *   headsBonus  +Kopf-Chance (0.1 = +10 %), negativ = schlechter
 *   mult        +Mult bei Kopf
 *   xMult       ×Mult bei Kopf
 *   look        Aussehen: palette (Farbe) + heads/tails (Motiv)
 *               -> mögliche Werte: src/render/sprites/palettes.ts und emblems.ts
 *   unlock      optional: Bedingung zum Freischalten (sonst sofort verfügbar)
 *   hooks       optional: eigene Spezialeffekte (siehe src/core/types.ts -> Hooks)
 */
import type { CoinDef } from '../core/types';

export const COINS: CoinDef[] = [
  {
    id: 'normal',
    name: 'Hahnentaler',
    desc: 'Eine ehrliche Münze. Fast.',
    rarity: 'common',
    value: 3,
    look: { palette: 'silver', heads: 'rooster', tails: 'numeral' },
  },
  {
    id: 'copper',
    name: 'Kupferpfennig',
    desc: '+2 Mult bei Kopf.',
    rarity: 'common',
    value: 2,
    mult: 2,
    look: { palette: 'copper', heads: 'rooster', tails: 'numeral' },
  },
  {
    id: 'loaded',
    name: 'Gezinkter Taler',
    desc: '+15 % Kopf-Chance. Niemand muss das wissen.',
    rarity: 'uncommon',
    value: 2,
    headsBonus: 0.15,
    look: { palette: 'steel', heads: 'rooster', tails: 'numeral' },
  },
  {
    id: 'lucky',
    name: 'Glücksgroschen',
    desc: '+5 % Kopf-Chance. Zahl füllt das Pech-Meter doppelt.',
    rarity: 'common',
    value: 3,
    headsBonus: 0.05,
    luckGain: 2,
    look: { palette: 'jade', heads: 'clover', tails: 'numeral' },
  },
  {
    id: 'glass',
    name: 'Glastaler',
    desc: '×3 Mult bei Kopf. Zerbricht mit 25 % Chance nach dem Wurf.',
    rarity: 'uncommon',
    value: 3,
    xMult: 3,
    look: { palette: 'glass', heads: 'star', tails: 'numeral' },
    hooks: {
      after(ctx) {
        // Das Relikt "Glasauge" verhindert das Zerbrechen
        const protectedByRelic = ctx.relicsActive && ctx.run.relics.some((r) => r.defId === 'glass_eye');
        if (!protectedByRelic && ctx.rng.chance(0.25)) {
          ctx.breakCoin = true;
          ctx.messages.push('Zerbrochen!');
        }
      },
    },
  },
  {
    id: 'cursed',
    name: 'Verfluchter Groschen',
    desc: '-12 % Kopf-Chance, aber ×2,5 Mult bei Kopf.',
    rarity: 'uncommon',
    value: 4,
    headsBonus: -0.12,
    xMult: 2.5,
    look: { palette: 'cursed', heads: 'skull', tails: 'numeral' },
  },
  {
    id: 'lead',
    name: 'Bleimünze',
    desc: 'Zahl setzt deine Kopf-Serie nicht zurück.',
    rarity: 'uncommon',
    value: 2,
    look: { palette: 'lead', heads: 'rooster', tails: 'numeral' },
    hooks: {
      tails(ctx) {
        ctx.keepStreak = true;
        if (ctx.run.streak > 0) ctx.messages.push('Serie gehalten!');
      },
    },
  },
  {
    id: 'twin',
    name: 'Zwillingstaler',
    desc: 'Kopf zählt doppelt für die Serie.',
    rarity: 'rare',
    value: 3,
    look: { palette: 'rose', heads: 'twin', tails: 'numeral' },
    unlock: { hint: 'Erreiche eine 6er Kopf-Serie.', check: (m) => m.bestStreak >= 6 },
    hooks: {
      result(ctx) {
        ctx.streakGain = 2;
      },
    },
  },
  {
    id: 'mirror',
    name: 'Spiegeltaler',
    desc: 'Kopiert Werte und Effekte der zuletzt geworfenen Münze.',
    rarity: 'rare',
    value: 3,
    copiesLast: true,
    look: { palette: 'mirror', heads: 'eye', tails: 'numeral' },
    unlock: { hint: 'Spiele 5 Runs.', check: (m) => m.runs >= 5 },
  },
  {
    id: 'gold',
    name: 'Goldhahn',
    desc: 'Schwer, glänzend, wertvoll.',
    rarity: 'rare',
    value: 9,
    look: { palette: 'gold', heads: 'crown', tails: 'numeral' },
    unlock: { hint: 'Erreiche Runde 4.', check: (m) => m.bestRound >= 4 },
  },
  {
    id: 'razor',
    name: 'Rasierklinge',
    desc: '10× Rand-Chance. Rand = Jackpot.',
    rarity: 'rare',
    value: 2,
    edgeFactor: 10,
    look: { palette: 'razor', heads: 'blade', tails: 'numeral' },
    unlock: { hint: 'Lande insgesamt 150× Kopf.', check: (m) => m.totalHeads >= 150 },
  },
  {
    id: 'sun',
    name: 'Sonnentaler',
    desc: '+10 % Kopf-Chance und ×1,5 Mult.',
    rarity: 'legendary',
    value: 6,
    headsBonus: 0.1,
    xMult: 1.5,
    look: { palette: 'sun', heads: 'sun', tails: 'numeral' },
    unlock: { hint: 'Erreiche Runde 10.', check: (m) => m.bestRound >= 10 },
  },
];
