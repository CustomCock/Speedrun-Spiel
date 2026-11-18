/**
 * ALLE BOSSE (jede 3. Runde)
 * ==========================
 * Ein Boss bringt einen negativen Modifikator für eine Runde.
 * Einfache Effekte gehen über Felder (flipsDelta, handSizeDelta, hideChance,
 * quotaMult), alles andere über hooks – genau wie bei Relikten.
 */
import type { BossDef } from '../core/types';

export const BOSSES: BossDef[] = [
  {
    id: 'house',
    name: 'Das Haus',
    desc: 'Das Haus gewinnt immer: -10 % Kopf-Chance.',
    hooks: {
      chance(ctx) {
        ctx.headsChance -= 0.1;
      },
    },
  },
  {
    id: 'taxman',
    name: 'Der Steuereintreiber',
    desc: 'Nimmt sich ein Viertel jedes Gewinns (×0,75 Mult).',
    hooks: {
      score(ctx) {
        ctx.xMult *= 0.75;
      },
    },
  },
  {
    id: 'fuse',
    name: 'Die kurze Lunte',
    desc: 'Deine Kopf-Serie kann höchstens 2 erreichen.',
    hooks: {
      chance(ctx) {
        ctx.streakCap = 2;
      },
    },
  },
  {
    id: 'fog',
    name: 'Der Nebel',
    desc: 'Du siehst deine Kopf-Chance nicht. Und sie sinkt um 5 %.',
    hideChance: true,
    hooks: {
      chance(ctx) {
        ctx.headsChance -= 0.05;
      },
    },
  },
  {
    id: 'glutton',
    name: 'Der Vielfraß',
    desc: 'Frisst 2 deiner Würfe.',
    flipsDelta: -2,
  },
  {
    id: 'mime',
    name: 'Der Pantomime',
    desc: 'Deine Relikte schweigen bei den ersten 3 Würfen.',
    // Wird in src/core/flip.ts abgefragt (relicsActive).
  },
  {
    id: 'chain',
    name: 'Der Kettenhund',
    desc: 'Jede Zahl kostet dich 3 Gold dieser Runde.',
    hooks: {
      tails(ctx) {
        ctx.gold -= 3;
        ctx.messages.push('Kettenhund -3');
      },
    },
  },
  {
    id: 'doubter',
    name: 'Der Zweifler',
    desc: 'Nur 2 Münzen zur Auswahl.',
    handSizeDelta: -1,
  },
];
