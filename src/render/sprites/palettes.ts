/**
 * FARBPALETTEN
 * ============
 * Jede Palette ist eine "Rampe" aus 8 Farben: von ganz dunkel (Schatten)
 * bis ganz hell (Glanzlicht). Der Münz-Generator wählt je nach Lichteinfall
 * eine Stufe aus dieser Rampe – so entsteht echte Pixel-Art-Beleuchtung.
 *
 * Neue Palette = neuen Eintrag hinzufügen und in coins.ts / relics.ts benutzen.
 * Farben sind Hex-Codes (#rrggbb). Ein Farbwähler im Browser hilft beim Aussuchen.
 */

export interface Palette {
  /** 8 Farben, dunkel -> hell */
  ramp: string[];
  /** Deckkraft 0..1 (Glas ist etwas durchsichtig) */
  alpha?: number;
}

export const PALETTES: Record<string, Palette> = {
  gold: { ramp: ['#2a1a08', '#4f3210', '#7a4f12', '#a8721a', '#d19a2a', '#eec14a', '#fbe08a', '#fffbe0'] },
  silver: { ramp: ['#1c1e26', '#33363f', '#4f535d', '#737882', '#9aa0a8', '#c2c7cc', '#e2e5e8', '#ffffff'] },
  copper: { ramp: ['#24100a', '#4a2012', '#73331a', '#9c4a24', '#c26a35', '#e08f55', '#f5b98a', '#fff0e0'] },
  steel: { ramp: ['#141a22', '#243040', '#36475a', '#4e6378', '#6d8399', '#93a8bb', '#c1d1de', '#f2f8ff'] },
  jade: { ramp: ['#0b1f17', '#143a2a', '#1e5a3e', '#2b7d54', '#3fa06c', '#6cc58e', '#a8e5bd', '#effff4'] },
  glass: { ramp: ['#0c2230', '#12405a', '#1d6080', '#2e86a6', '#55acc6', '#8bd0e0', '#c6eef5', '#ffffff'], alpha: 0.78 },
  cursed: { ramp: ['#12081a', '#26102f', '#3d1846', '#57225e', '#6f3a6e', '#8f5f7a', '#c49aa0', '#f0e0d0'] },
  lead: { ramp: ['#15161a', '#24262b', '#34373d', '#464a51', '#5c6068', '#777b82', '#9da0a5', '#d0d2d4'] },
  rose: { ramp: ['#240c14', '#461828', '#6c2640', '#93395a', '#b85477', '#d77d98', '#f0b4c4', '#fff0f4'] },
  mirror: { ramp: ['#10121c', '#262a40', '#3e4566', '#5d6690', '#8a93b8', '#b8c0dc', '#e0e6f6', '#ffffff'] },
  razor: { ramp: ['#0a0c0e', '#1a1e22', '#2c3238', '#444c54', '#66707a', '#929ca6', '#c8d0d8', '#ffffff'] },
  sun: { ramp: ['#2e1004', '#5c2208', '#8f3c0c', '#c45e12', '#ec8a1c', '#ffb83a', '#ffe27a', '#fffde6'] },
  ruby: { ramp: ['#1a0508', '#3a0a12', '#62101e', '#8c1a2a', '#b8283a', '#de4c58', '#f5868a', '#ffe0e0'] },
  parchment: { ramp: ['#2a2014', '#4a3a24', '#6e5a3a', '#927a52', '#b49a6e', '#d0b88e', '#e8d8b4', '#fff8e8'] },
  bone: { ramp: ['#1e1c18', '#3a362e', '#5a5448', '#7c7466', '#a0978a', '#c2baae', '#e0dad0', '#ffffff'] },
  sky: { ramp: ['#0a1424', '#142a48', '#1e426c', '#2c5e90', '#4280b4', '#68a6d4', '#a2ccec', '#eef8ff'] },
  fire: { ramp: ['#1e0602', '#4a0e04', '#7a1c06', '#b0340a', '#e05a12', '#ff8c2a', '#ffc45a', '#fff4c0'] },
};

/** Hex "#rrggbb" -> [r, g, b] */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function getPalette(name: string): Palette {
  return PALETTES[name] ?? PALETTES.silver;
}
