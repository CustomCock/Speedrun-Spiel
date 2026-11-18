/**
 * ALLE RELIKTE (passive Effekte)
 * ==============================
 * Ein Relikt besteht fast nur aus "hooks" – Funktionen, die das Spiel bei
 * jedem Wurf aufruft. "ctx" enthält alles über den aktuellen Wurf
 * (siehe FlipCtx in src/core/types.ts), "self" ist das Relikt selbst
 * (mit einem freien Zähler self.counter).
 *
 * Die Hooks werden in dieser Reihenfolge aufgerufen:
 *   chance -> (Wurf) -> result -> score (bei Kopf) / tails (bei Zahl) -> after
 *
 * icon.shape: Form aus src/render/sprites/icons.ts
 * icon.palette: Farbe aus src/render/sprites/palettes.ts
 */
import type { RelicDef } from '../core/types';

export const RELICS: RelicDef[] = [
  {
    id: 'horseshoe',
    name: 'Hufeisen',
    desc: '+5 % Kopf-Chance.',
    rarity: 'common',
    icon: { shape: 'horseshoe', palette: 'steel' },
    hooks: {
      chance(ctx) {
        ctx.headsChance += 0.05;
      },
    },
  },
  {
    id: 'golden_tooth',
    name: 'Goldzahn',
    desc: '+3 Gold-Basiswert bei jedem Kopf.',
    rarity: 'common',
    icon: { shape: 'tooth', palette: 'gold' },
    hooks: {
      score(ctx) {
        ctx.chips += 3;
      },
    },
  },
  {
    id: 'piggy',
    name: 'Sparschwein',
    desc: 'Zahl gibt trotzdem 2 Gold.',
    rarity: 'common',
    icon: { shape: 'pig', palette: 'rose' },
    hooks: {
      tails(ctx) {
        ctx.gold += 2;
        ctx.messages.push('Sparschwein +2');
      },
    },
  },
  {
    id: 'comb',
    name: 'Hahnenkamm',
    desc: '+1 Mult für jeden Kopf in deiner aktuellen Serie.',
    rarity: 'common',
    icon: { shape: 'comb', palette: 'ruby' },
    hooks: {
      score(ctx) {
        ctx.mult += ctx.run.streak;
      },
    },
  },
  {
    id: 'third_tails',
    name: 'Dritte Chance',
    desc: 'Jede 3. Zahl wird zu Kopf.',
    rarity: 'uncommon',
    icon: { shape: 'scroll', palette: 'parchment' },
    hooks: {
      result(ctx, self) {
        if (ctx.side !== 'tails') return;
        self.counter++;
        if (self.counter >= 3) {
          self.counter = 0;
          ctx.side = 'heads';
          ctx.messages.push('Dritte Chance!');
        }
      },
    },
  },
  {
    id: 'dawn',
    name: 'Morgengrauen',
    desc: 'Der erste Wurf jeder Runde ist garantiert Kopf.',
    rarity: 'uncommon',
    icon: { shape: 'sun', palette: 'sun' },
    hooks: {
      roundStart(run) {
        run.guaranteedHeads = true;
      },
    },
  },
  {
    id: 'glass_eye',
    name: 'Glasauge',
    desc: 'Glastaler zerbrechen nie.',
    rarity: 'uncommon',
    icon: { shape: 'eye', palette: 'glass' },
    // Kein Hook nötig – der Glastaler prüft selbst, ob dieses Relikt da ist.
  },
  {
    id: 'clover',
    name: 'Vierblättriges Kleeblatt',
    desc: 'Volles Pech-Meter bringt immer eine Belohnung, nie einen Fluch.',
    rarity: 'uncommon',
    icon: { shape: 'clover', palette: 'jade' },
    // Wird in src/core/flip.ts (Pech-Meter) abgefragt.
  },
  {
    id: 'loaded_die',
    name: 'Gezinkter Würfel',
    desc: '×1,5 Mult, wenn die Kopf-Chance unter 50 % lag.',
    rarity: 'uncommon',
    icon: { shape: 'die', palette: 'bone' },
    hooks: {
      score(ctx) {
        if (ctx.headsChance < 0.5) {
          ctx.xMult *= 1.5;
          ctx.messages.push('Würfel ×1,5');
        }
      },
    },
  },
  {
    id: 'momentum',
    name: 'Schwung',
    desc: 'Nach einer Zahl: +12 % Kopf-Chance für den nächsten Wurf.',
    rarity: 'common',
    icon: { shape: 'feather', palette: 'sky' },
    hooks: {
      chance(ctx) {
        if (ctx.run.lastSide === 'tails') ctx.headsChance += 0.12;
      },
    },
  },
  {
    id: 'rusty_nail',
    name: 'Rostiger Nagel',
    desc: '+Mult in Höhe deines Pech-Meters.',
    rarity: 'common',
    icon: { shape: 'nail', palette: 'copper' },
    hooks: {
      score(ctx) {
        ctx.mult += ctx.run.luck;
      },
    },
  },
  {
    id: 'hourglass',
    name: 'Sanduhr',
    desc: '+2 Würfe pro Runde.',
    rarity: 'rare',
    icon: { shape: 'hourglass', palette: 'gold' },
    hooks: {
      roundStart(run) {
        run.flipsLeft += 2;
      },
    },
  },
  {
    id: 'ledger',
    name: 'Schuldbuch',
    desc: 'Rundenende: +1 Gold pro 5 Gold im Geldbeutel (max. +10).',
    rarity: 'uncommon',
    icon: { shape: 'book', palette: 'ruby' },
    hooks: {
      roundEnd(run) {
        return Math.min(10, Math.floor(run.gold / 5));
      },
    },
  },
  {
    id: 'crown',
    name: 'Krone des Hahns',
    desc: '×2 Mult ab einer 4er Kopf-Serie.',
    rarity: 'rare',
    icon: { shape: 'crown', palette: 'gold' },
    unlock: { hint: 'Besiege 2 Bosse (insgesamt).', check: (m) => m.bossesBeaten >= 2 },
    hooks: {
      score(ctx) {
        if (ctx.run.streak >= 4) {
          ctx.xMult *= 2;
          ctx.messages.push('Krone ×2');
        }
      },
    },
  },
  {
    id: 'magnet',
    name: 'Hufmagnet',
    desc: '4× Rand-Chance.',
    rarity: 'rare',
    icon: { shape: 'magnet', palette: 'ruby' },
    unlock: { hint: 'Erreiche Runde 6.', check: (m) => m.bestRound >= 6 },
    hooks: {
      chance(ctx) {
        ctx.edgeChance *= 4;
      },
    },
  },
  {
    id: 'abacus',
    name: 'Abakus',
    desc: '+0,25× Mult für jeden Kopf in dieser Runde.',
    rarity: 'rare',
    icon: { shape: 'abacus', palette: 'bone' },
    unlock: { hint: 'Erziele 100 Gold mit einem einzigen Wurf.', check: (m) => m.bestFlip >= 100 },
    hooks: {
      score(ctx) {
        // headsThisRound zählt den aktuellen Kopf bereits mit
        ctx.xMult *= 1 + 0.25 * (ctx.run.headsThisRound - 1);
      },
    },
  },
  {
    id: 'phoenix',
    name: 'Phönixfeder',
    desc: 'Rettet dich einmal vor dem Game Over. Verbrennt danach.',
    rarity: 'legendary',
    icon: { shape: 'feather', palette: 'fire' },
    unlock: { hint: 'Erreiche Runde 8.', check: (m) => m.bestRound >= 8 },
    // Wird in src/core/state.ts (Rundenende) abgefragt.
  },
];
