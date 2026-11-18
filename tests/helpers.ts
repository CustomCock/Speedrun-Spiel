// Hilfsfunktionen für Tests: einen Run mit bestimmtem Deck/Relikten bauen.
import { newRun, startRound, addCoin } from '../src/core/state';
import type { RunState } from '../src/core/types';

export function makeRun(deck: string[], relics: string[] = [], seed = 'TEST'): RunState {
  const run = newRun(seed);
  run.deck = [];
  run.drawPile = [];
  for (const id of deck) addCoin(run, id);
  run.relics = relics.map((defId) => ({ defId, counter: 0, used: false }));
  startRound(run);
  run.flipsLeft = 1e9; // Für Tests: unendlich viele Würfe
  return run;
}
