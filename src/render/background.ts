/**
 * TAVERNEN-HINTERGRUND
 * ====================
 * Wird einmal beim Start Pixel für Pixel erzeugt (480×270):
 * Holzwand, Regale mit Flaschen, Fenster mit Mondlicht, Hängelampe,
 * Tisch mit grünem Spielfilz. Jeder Pixel wird von der Lampe beleuchtet
 * (Helligkeit fällt mit der Entfernung ab) und auf eine Farbrampe gerundet.
 *
 * drawAmbient() zeichnet danach jedes Frame die lebendigen Teile:
 * flackerndes Licht, Flamme, Staubkörnchen im Lichtkegel.
 */
import { hexToRgb } from './sprites/palettes';

export const W = 480;
export const H = 270;
export const TABLE_Y = 150;
export const LAMP = { x: 240, y: 32 };

// Material-Farbrampen (dunkel -> hell)
const WOOD = ['#0a0503', '#140a05', '#1e1008', '#2a170b', '#3a2010', '#4d2c16', '#64391c', '#7e4924'].map(hexToRgb);
const WOOD_LIGHT = ['#100804', '#1c0f07', '#2a170b', '#3c2211', '#523018', '#6b4020', '#86532a', '#a66b38'].map(hexToRgb);
const TABLE = ['#0c0503', '#170a05', '#241008', '#33170b', '#45200f', '#592b14', '#70381a', '#8c4822'].map(hexToRgb);
const FELT = ['#050d09', '#08140e', '#0e2218', '#143222', '#1b432d', '#235638', '#2d6a45', '#3a8255'].map(hexToRgb);
const BRASS = ['#1a1006', '#33210a', '#523710', '#7a5418', '#a87624', '#d19a36', '#efc35c', '#fff0b0'].map(hexToRgb);
const GLASS_GREEN = ['#03100a', '#062016', '#0a3322', '#114a30', '#1a6640', '#2a8a55', '#55b47a', '#b0f0c8'].map(hexToRgb);
const GLASS_AMBER = ['#140802', '#2a1204', '#462008', '#6a320c', '#924812', '#bc661c', '#e09440', '#ffd890'].map(hexToRgb);
const GLASS_RED = ['#120304', '#280608', '#440c10', '#661418', '#8c1e22', '#b8343a', '#e06a6a', '#ffc0b8'].map(hexToRgb);
const NIGHT = ['#02040a', '#050a16', '#0a1424', '#122038', '#1c3050', '#2a466c', '#44668c', '#7a9cc0'].map(hexToRgb);

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Deterministisches "Rauschen" – gleiche Eingabe, gleiche Ausgabe */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
/** Weiches Wertrauschen */
function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Wie viel Licht kommt an Pixel (x, y) an? */
function lightAt(x: number, y: number): number {
  const d = Math.hypot(x - LAMP.x, (y - LAMP.y) * 1.15);
  const lamp = 1.25 / (1 + Math.pow(d / 92, 2));
  return 0.1 + lamp;
}

/** Mondlicht vom Fenster (bläulich) */
function moonAt(x: number, y: number): number {
  const d = Math.hypot(x - 420, (y - 60) * 1.2);
  return 0.35 / (1 + Math.pow(d / 45, 2));
}

interface Shape {
  ramp: [number, number, number][];
  tone: number; // Grundhelligkeit 0..1
  lit?: boolean; // selbstleuchtend (ignoriert Licht)
}

/** Erzeugt das Hintergrundbild */
export function generateBackground(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);

  // Bretterkanten der Wand (unregelmäßig breit)
  const plankEdges: number[] = [0];
  while (plankEdges[plankEdges.length - 1] < W) plankEdges.push(plankEdges[plankEdges.length - 1] + 22 + Math.floor(hash2(plankEdges.length, 7) * 10));

  // Fugen im Tisch (perspektivisch: nach vorne breiter)
  const tableSeams: number[] = [];
  for (let y = TABLE_Y + 5, gap = 6; y < H; gap *= 1.3, y += Math.round(gap)) tableSeams.push(y);

  // Flaschen auf den Regalen: [x, Breite, Höhe, Rampe]
  const bottles: [number, number, number, [number, number, number][]][] = [];
  const shelfY = 74;
  for (const [start, end] of [[124, 204], [278, 356]]) {
    for (let x = start + 3; x < end - 8; ) {
      const w = 5 + Math.floor(hash2(x, 3) * 3);
      const h = 10 + Math.floor(hash2(x, 5) * 9);
      const ramp = [GLASS_GREEN, GLASS_AMBER, GLASS_RED][Math.floor(hash2(x, 9) * 3)];
      bottles.push([x, w, h, ramp]);
      x += w + 3 + Math.floor(hash2(x, 11) * 6);
    }
  }

  const shapeAt = (x: number, y: number): Shape => {
    // ---------- Fenster ----------
    if (x >= 396 && x < 446 && y >= 20 && y < 92) {
      const inner = x >= 399 && x < 443 && y >= 23 && y < 89;
      const mullion = Math.abs(x - 420.5) < 1.5 || Math.abs(y - 56) < 1.5;
      if (!inner || mullion) return { ramp: WOOD_LIGHT, tone: 0.55 };
      // Nachthimmel mit Mond
      const moon = Math.hypot(x - 430, y - 36);
      if (moon < 6) return { ramp: NIGHT, tone: moon < 5 ? 1 : 0.85, lit: true };
      const star = hash2(x, y) > 0.985 ? 0.8 : 0;
      return { ramp: NIGHT, tone: Math.max(star, 0.32 + (92 - y) / 300 + 0.25 / (1 + moon / 10)), lit: true };
    }

    // ---------- Hängelampe ----------
    if (Math.abs(x - LAMP.x) < 1 && y < 20) return { ramp: BRASS, tone: 0.35 }; // Kette
    if (y >= 18 && y < 44 && Math.abs(x - LAMP.x) <= 8) {
      const dx = Math.abs(x - LAMP.x);
      const roof = y < 22 && dx <= 2 + (y - 18) * 1.6;
      if (roof) return { ramp: BRASS, tone: 0.7 };
      if (y >= 22 && y < 40 && dx <= 6) {
        if (dx >= 5 || y === 22 || y === 39) return { ramp: BRASS, tone: 0.75 };
        return { ramp: BRASS, tone: 0.9 + 0.1 * (1 - dx / 5), lit: true }; // leuchtendes Glas
      }
      if (y >= 40 && y < 44 && dx <= 4 - (y - 40)) return { ramp: BRASS, tone: 0.6 };
    }

    // ---------- Regale + Flaschen ----------
    if ((x >= 120 && x < 208) || (x >= 274 && x < 360)) {
      if (y >= shelfY && y < shelfY + 4) return { ramp: WOOD_LIGHT, tone: y === shelfY ? 0.85 : 0.6 };
      if (y >= shelfY + 4 && y < shelfY + 7 && (x === 124 || x === 203 || x === 278 || x === 355)) return { ramp: WOOD, tone: 0.3 };
      for (const [bx, bw, bh, ramp] of bottles) {
        const top = shelfY - bh;
        if (x >= bx && x < bx + bw && y >= top && y < shelfY) {
          const neckW = 2;
          const neckX = bx + Math.floor((bw - neckW) / 2);
          const shoulder = top + Math.floor(bh * 0.38);
          if (y < shoulder && (x < neckX || x >= neckX + neckW)) break;
          const highlight = x === bx + 1 && y > shoulder + 1 ? 0.35 : 0;
          return { ramp, tone: 0.55 + highlight - (x - bx) * 0.04 };
        }
      }
    }

    // ---------- Wand ----------
    if (y < TABLE_Y) {
      // Brüstungsleiste
      if (y >= 118 && y < 126) {
        const t = y === 118 ? 0.95 : y === 125 ? 0.3 : 0.65 + noise(x * 0.08, y) * 0.1;
        return { ramp: WOOD_LIGHT, tone: t };
      }
      // Kontaktschatten über dem Tisch
      const contact = y > TABLE_Y - 7 ? (y - (TABLE_Y - 7)) * 0.06 : 0;
      // Brett finden
      let p = 0;
      while (plankEdges[p + 1] <= x) p++;
      const edge = x === plankEdges[p];
      const afterEdge = x === plankEdges[p] + 1;
      const plankTone = 0.5 + (hash2(p, 1) - 0.5) * 0.18;
      const grain = (noise(x * 0.9 + p * 17, y * 0.04) - 0.5) * 0.22 + (noise(x * 2.1, y * 0.15 + p) - 0.5) * 0.08;
      let tone = plankTone + grain - contact;
      if (edge) tone = 0.08;
      else if (afterEdge) tone -= 0.12;
      // Nägel
      const nailRow = y === 10 || y === 110 || y === 140;
      if (nailRow && (x === plankEdges[p] + 3 || x === (plankEdges[p + 1] ?? W) - 4)) tone = 0.95;
      // Untere Täfelung: Rahmen
      if (y >= 126) {
        tone -= 0.08;
        const panelX = (x - 116) % 48;
        if (panelX === 0 || y === 128) tone -= 0.12;
        if (panelX === 1 || y === 129) tone += 0.1;
      }
      return { ramp: WOOD, tone };
    }

    // ---------- Tisch ----------
    const ty = y - TABLE_Y;
    // Spielfilz (Trapez, nach vorne breiter)
    const feltTop = TABLE_Y + 8;
    const feltBot = TABLE_Y + 50;
    const feltL = 150 - (y - feltTop) * 0.45;
    const feltR = 330 + (y - feltTop) * 0.45;
    if (y >= feltTop - 1 && y <= feltBot + 1 && x >= feltL - 1 && x <= feltR + 1) {
      const border = y === feltTop - 1 || y === feltBot + 1 || x < feltL || x > feltR;
      if (border) return { ramp: BRASS, tone: y === feltTop - 1 ? 0.8 : 0.6 };
      const fuzz = (hash2(x, y) - 0.5) * 0.08 + (noise(x * 0.3, y * 0.3) - 0.5) * 0.08;
      return { ramp: FELT, tone: 0.62 + fuzz };
    }
    let tone = 0.55 + (noise(x * 0.025, y * 0.9) - 0.5) * 0.25 + (noise(x * 0.2, y * 2) - 0.5) * 0.06;
    if (tableSeams.includes(y)) tone = 0.12;
    else if (tableSeams.includes(y - 1)) tone += 0.12;
    if (ty < 2) tone = 0.75; // Vorderkante oben (Lichtkante)
    return { ramp: TABLE, tone };
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = shapeAt(x, y);
      const light = s.lit ? 1 : lightAt(x, y);
      // Vignette: Ränder dunkler
      const vx = (x - W / 2) / (W / 2);
      const vy = (y - H * 0.45) / (H * 0.6);
      const vig = 1 - 0.55 * Math.min(1, Math.max(0, Math.hypot(vx, vy) - 0.5) * 1.3);
      const intensity = s.tone * light * (s.lit ? 1 : vig);
      const dither = BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.5;
      const idx = Math.max(0, Math.min(7, Math.floor(intensity * 7.4 + dither * 0.9)));
      let [r, g, b] = s.ramp[idx];
      // Mondlicht addieren
      if (!s.lit) {
        const m = moonAt(x, y);
        r += 40 * m;
        g += 70 * m;
        b += 120 * m;
      }
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---------------------------------------------------------------------------
// Lebendige Teile (jedes Frame)
// ---------------------------------------------------------------------------

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}
const motes: Mote[] = Array.from({ length: 26 }, (_, i) => ({
  x: LAMP.x + (hash2(i, 1) - 0.5) * 160,
  y: 40 + hash2(i, 2) * 110,
  vx: (hash2(i, 3) - 0.5) * 3,
  vy: -1 - hash2(i, 4) * 2,
  phase: hash2(i, 5) * 10,
}));

/** Aktuelle Flacker-Stärke der Lampe (0.85 .. 1.1) */
export function lampFlicker(time: number): number {
  return 0.95 + Math.sin(time * 7.1) * 0.03 + Math.sin(time * 13.3 + 1) * 0.025 + (noise(time * 6, 0) - 0.5) * 0.08;
}

export function drawAmbient(ctx: CanvasRenderingContext2D, time: number, dt: number): void {
  const f = lampFlicker(time);

  // Warmer Lichtschein (additiv)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(LAMP.x, LAMP.y + 6, 2, LAMP.x, LAMP.y + 6, 150);
  g.addColorStop(0, `rgba(255, 190, 110, ${0.2 * f})`);
  g.addColorStop(0.25, `rgba(255, 150, 70, ${0.07 * f})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Flamme (2–3 Pixel, flackernd)
  const fh = 3 + Math.round((f - 0.9) * 10);
  ctx.fillStyle = '#fff6d0';
  ctx.fillRect(LAMP.x - 1, LAMP.y + 2 - fh, 2, fh);
  ctx.fillStyle = '#ffb040';
  ctx.fillRect(LAMP.x - 2, LAMP.y + 1, 4, 2);

  // Staub im Lichtkegel
  for (const m of motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.y < 30) {
      m.y = 150;
      m.x = LAMP.x + (Math.random() - 0.5) * 160;
    }
    const a = 0.25 + 0.25 * Math.sin(time * 1.3 + m.phase);
    const d = Math.abs(m.x - LAMP.x) / 90;
    ctx.fillStyle = `rgba(255, 220, 160, ${Math.max(0, a * (1 - d))})`;
    ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
  }
  ctx.restore();
}
