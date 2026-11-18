/**
 * PROZEDURALER MÜNZ-GENERATOR
 * ===========================
 * Erzeugt für jede Münze ein "Spritesheet": viele Einzelbilder (Frames)
 * nebeneinander, jedes zeigt die Münze in einem anderen Drehwinkel.
 *
 * Für jeden Pixel wird berechnet:
 *   1. Liegt er auf der Vorderseite, Rückseite oder dem Rand der Münze?
 *   2. Wie ist die Oberfläche dort geneigt? (aus der Prägung = Höhenkarte)
 *   3. Wie viel Licht fällt darauf? (Lampe oben links + kühles Rim Light von hinten rechts
 *      + Glanzpunkt = metallischer Look)
 *   4. Welche Farbe aus der Paletten-Rampe passt zu dieser Helligkeit?
 *      (mit "Dithering"-Muster, damit Übergänge pixelig-schön aussehen)
 */
import { emblemHeight } from './emblems';
import { getPalette, hexToRgb } from './palettes';
import { ICONS } from './icons';

export interface CoinSpriteOptions {
  palette: string;
  heads: string;
  tails: string;
  /** Radius in Pixeln */
  radius: number;
  /** Dicke der Münze in Pixeln */
  thickness: number;
  /** Wie groß ein Motiv-Pixel ist (2 = doppelt) */
  emblemScale: number;
  /** Anzahl Drehwinkel-Frames */
  frames: number;
}

/** 4×4-Bayer-Matrix für geordnetes Dithering (klassischer Retro-Look) */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Farbe des kühlen Rim Lights (Mondlicht vom Fenster) */
const RIM_RGB = hexToRgb('#a8d8ff');

type Vec3 = [number, number, number];
function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Lichtrichtungen (x nach rechts, y nach UNTEN, z zum Betrachter)
const KEY_LIGHT = norm([-0.45, -0.6, 0.66]); // warme Lampe oben links vorne
const HALF_VEC = norm([KEY_LIGHT[0], KEY_LIGHT[1], KEY_LIGHT[2] + 1]); // für Glanzpunkt (Blinn-Phong)

export function coinFrameSize(o: CoinSpriteOptions): { fw: number; fh: number } {
  return { fw: o.radius * 2 + 4, fh: o.radius * 2 + o.thickness + 4 };
}

/** Höhe der Münzoberfläche an Position (u, v) – Rand, Perlenkranz und Motiv */
function faceHeight(o: CoinSpriteOptions, emblem: string, u: number, v: number): number {
  const R = o.radius;
  const r = Math.hypot(u, v) / R;
  // Erhabener Rand
  if (r > 0.84) {
    if (r < 0.87) return (r - 0.84) / 0.03;
    if (r < 0.95) return 1;
    return Math.max(0.3, 1 - (r - 0.95) * 14);
  }
  // Perlenkranz
  if (r > 0.72 && r < 0.81 && R >= 16) {
    const ringR = 0.765 * R;
    const count = Math.round((2 * Math.PI * ringR) / 3.4);
    const a = Math.atan2(v, u);
    const step = (2 * Math.PI) / count;
    const nearest = Math.round(a / step) * step;
    const bx = Math.cos(nearest) * ringR;
    const by = Math.sin(nearest) * ringR;
    if (Math.hypot(u - bx, v - by) < 1.05) return 0.5;
    return 0;
  }
  // Motiv
  const s = o.emblemScale;
  const gx = Math.floor(u / s + 8);
  const gy = Math.floor(v / s + 8);
  return emblemHeight(emblem, gx, gy) * 0.9;
}

/** Wählt die Paletten-Stufe für eine Helligkeit (mit Dithering) */
function rampIndex(intensity: number, x: number, y: number): number {
  const d = BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.5;
  const v = intensity * 7 + d * 0.65;
  return Math.max(0, Math.min(6, Math.floor(v)));
}

/** Beleuchtet einen Punkt mit Normale n und gibt RGBA zurück */
function shade(n: Vec3, x: number, y: number, ramp: [number, number, number][], alpha: number, darken = 0, bright = 0): [number, number, number, number] {
  const diff = Math.max(0, dot(n, KEY_LIGHT));
  const spec = Math.pow(Math.max(0, dot(n, HALF_VEC)), 22);
  const env = 0.16 * Math.max(0, -n[1]); // Reflexion des hellen Raums oberhalb
  const intensity = 0.07 + 0.62 * diff + env - darken + bright;
  let idx = rampIndex(intensity, x, y);
  if (spec > 0.55) idx = 7;
  else if (spec > 0.28) idx = Math.min(7, idx + 1);
  let [r, g, b] = ramp[idx];

  // Rim Light: Kanten, die nach rechts zeigen und vom Betrachter weg geneigt sind
  const rim = Math.max(0, n[0] * 0.92 + n[1] * 0.2) * Math.pow(1 - Math.max(0, n[2]), 1.4) * 1.7;
  const k = Math.min(0.85, rim);
  r += (RIM_RGB[0] - r) * k;
  g += (RIM_RGB[1] - g) * k;
  b += (RIM_RGB[2] - b) * k;
  const a = Math.min(1, alpha + spec * 0.3);
  return [r, g, b, a * 255];
}

/** Zeichnet einen Frame (Drehwinkel theta) in ImageData ab Position ox */
function renderFrame(o: CoinSpriteOptions, img: ImageData, ox: number, theta: number): void {
  const { fw, fh } = coinFrameSize(o);
  const pal = getPalette(o.palette);
  const ramp = pal.ramp.map(hexToRgb);
  const alpha = pal.alpha ?? 1;
  const R = o.radius;
  const T = o.thickness;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const front = c >= 0;
  const faceSign = front ? 1 : -1;
  const zFace = (faceSign * T) / 2;
  const emblem = front ? o.heads : o.tails;
  const cx = fw / 2;
  const cy = fh / 2;
  const k = 1.4; // Stärke der Prägung für das Licht

  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      if (Math.abs(px) > R) continue;
      let rgba: [number, number, number, number] | null = null;

      // --- Liegt der Pixel auf der sichtbaren Seite? ---
      if (Math.abs(c) > 0.03) {
        const v = (py + zFace * s) / c;
        if (px * px + v * v <= R * R) {
          const vf = front ? v : -v; // Rückseite aufrecht lesen
          const h = (du: number, dv: number) => faceHeight(o, emblem, px + du, vf + dv);
          const gx = (h(1, 0) - h(-1, 0)) / 2;
          const gy = (h(0, 1) - h(0, -1)) / 2;
          const nf = norm([-gx * k, -gy * k, 1]);
          // Normale ins Weltkoordinatensystem drehen
          const nl: Vec3 = front ? nf : [nf[0], -nf[1], -nf[2]];
          const n: Vec3 = [nl[0], nl[1] * c - nl[2] * s, nl[1] * s + nl[2] * c];
          // "Proof"-Look: erhabenes Motiv heller (mattiert), Münzgrund dunkler (spiegelnd)
          const h0 = h(0, 0);
          const r0 = Math.hypot(px, vf) / R;
          const bright = r0 < 0.72 ? (h0 > 0.3 ? 0.16 : h0 < 0 ? -0.2 : -0.07) : 0;
          rgba = shade(norm(n), x, y, ramp, alpha, 0, bright);
        }
      }

      // --- Sonst: liegt er auf dem Münzrand (der Seite)? ---
      if (!rgba) {
        const hh = Math.sqrt(R * R - px * px);
        const extent = hh * Math.abs(c) + (T / 2) * Math.abs(s);
        if (Math.abs(py) <= extent) {
          const sg = s >= 0 ? 1 : -1;
          const vr = sg * hh;
          const n: Vec3 = norm([px / R, (vr / R) * c, (vr / R) * s + 0.15]);
          // Riffelung des Randes
          const phi = Math.atan2(vr, px);
          const reed = Math.floor((phi * R) / 1.6) % 2 === 0 ? 0.12 : 0;
          rgba = shade(n, x, y, ramp, alpha, reed);
        }
      }

      if (rgba) {
        const i = (y * img.width + ox + x) * 4;
        img.data[i] = rgba[0];
        img.data[i + 1] = rgba[1];
        img.data[i + 2] = rgba[2];
        img.data[i + 3] = rgba[3];
      }
    }
  }
}

/** Dunkle 1-Pixel-Kontur um alles Sichtbare herum (Pixel-Art-Klarheit) */
function addOutline(img: ImageData, color: [number, number, number], alpha = 230): void {
  const { width: w, height: h, data } = img;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid[y * w + x]) continue;
      const near =
        (x > 0 && solid[y * w + x - 1]) ||
        (x < w - 1 && solid[y * w + x + 1]) ||
        (y > 0 && solid[(y - 1) * w + x]) ||
        (y < h - 1 && solid[(y + 1) * w + x]);
      if (near) {
        const i = (y * w + x) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = alpha;
      }
    }
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/** Erzeugt das komplette Spritesheet (alle Frames nebeneinander) */
export function generateCoinSheet(o: CoinSpriteOptions): HTMLCanvasElement {
  const { fw, fh } = coinFrameSize(o);
  const cv = makeCanvas(fw * o.frames, fh);
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(fw * o.frames, fh);
  for (let f = 0; f < o.frames; f++) {
    renderFrame(o, img, f * fw, (f / o.frames) * Math.PI * 2);
  }
  addOutline(img, [8, 5, 3], 200);
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Erzeugt ein Relikt-Symbol (14×14) aus einer Maske */
export function generateIcon(shape: string, palette: string): HTMLCanvasElement {
  const mask = ICONS[shape] ?? ICONS.scroll;
  const ramp = getPalette(palette).ramp.map(hexToRgb);
  const S = 12;
  const cv = makeCanvas(S + 2, S + 2);
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(S + 2, S + 2);
  const at = (x: number, y: number) => (y >= 0 && y < S && x >= 0 && x < S ? mask[y][x] : '.');
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ch = at(x, y);
      if (ch === '.') continue;
      let idx: number;
      if (ch === 'x') idx = 1;
      else {
        idx = ch === '+' ? 6 : 4;
        if (at(x, y - 1) === '.' || at(x - 1, y) === '.') idx = Math.min(7, idx + 2);
        else if (at(x, y + 1) === '.' || at(x + 1, y) === '.') idx = Math.max(1, idx - 2);
      }
      const [r, g, b] = ramp[idx];
      const i = ((y + 1) * (S + 2) + x + 1) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  addOutline(img, [10, 6, 4], 255);
  ctx.putImageData(img, 0, 0);
  return cv;
}
