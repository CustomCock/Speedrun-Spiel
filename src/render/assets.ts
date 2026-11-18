/**
 * ASSET-SYSTEM
 * ============
 * Alle Grafiken werden hier geladen und unter einem Namen abgelegt.
 * Standardmäßig werden sie prozedural erzeugt (siehe sprites/coinGen.ts).
 *
 * EIGENE PNG-GRAFIKEN BENUTZEN:
 *   1. PNG in den Ordner  public/sprites/  legen
 *   2. Unten in PNG_OVERRIDES eintragen, z. B.
 *        'coin:gold:big': { url: 'sprites/gold.png', frames: 64 },
 *   Ein Münz-Sheet ist ein Streifen mit allen Frames nebeneinander (gleich breit).
 *   Frame 0 = Kopf von vorne, Frame frames/2 = Zahl von vorne, dazwischen die Drehung.
 *   Klappt das Laden nicht, wird automatisch die prozedurale Grafik benutzt.
 *
 * Namen: 'coin:<id>:big', 'coin:<id>:small', 'relic:<id>'
 */
import { COINS, RELICS } from '../core/registry';
import { coinFrameSize, generateCoinSheet, generateIcon, type CoinSpriteOptions } from './sprites/coinGen';

export interface Sheet {
  image: CanvasImageSource;
  /** Breite/Höhe EINES Frames */
  fw: number;
  fh: number;
  frames: number;
}

export const PNG_OVERRIDES: Record<string, { url: string; frames: number }> = {
  // Beispiel: 'coin:normal:big': { url: 'sprites/normal.png', frames: 64 },
};

/** Größen der Münz-Varianten */
export const BIG: Omit<CoinSpriteOptions, 'palette' | 'heads' | 'tails'> = { radius: 22, thickness: 4, emblemScale: 2, frames: 64 };
export const SMALL: Omit<CoinSpriteOptions, 'palette' | 'heads' | 'tails'> = { radius: 11, thickness: 3, emblemScale: 1, frames: 16 };

const sheets = new Map<string, Sheet>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Lädt bzw. erzeugt alle Grafiken. Muss einmal beim Start aufgerufen werden. */
export async function loadAssets(): Promise<void> {
  for (const coin of COINS) {
    for (const [size, opts] of [['big', BIG], ['small', SMALL]] as const) {
      const full: CoinSpriteOptions = { ...opts, ...coin.look };
      const { fw, fh } = coinFrameSize(full);
      sheets.set(`coin:${coin.id}:${size}`, { image: generateCoinSheet(full), fw, fh, frames: opts.frames });
    }
  }
  for (const relic of RELICS) {
    sheets.set(`relic:${relic.id}`, { image: generateIcon(relic.icon.shape, relic.icon.palette), fw: 14, fh: 14, frames: 1 });
  }

  // PNG-Ersatzgrafiken (überschreiben die prozeduralen)
  for (const [key, def] of Object.entries(PNG_OVERRIDES)) {
    try {
      const img = await loadImage(def.url);
      sheets.set(key, { image: img, fw: img.width / def.frames, fh: img.height, frames: def.frames });
    } catch {
      console.warn(`PNG "${def.url}" konnte nicht geladen werden – nutze prozedurale Grafik.`);
    }
  }
}

export function getSheet(key: string): Sheet {
  const s = sheets.get(key);
  if (!s) throw new Error(`Grafik "${key}" nicht gefunden`);
  return s;
}

/** Welcher Frame passt zu einem Drehwinkel (Bogenmaß)? */
export function frameForAngle(sheet: Sheet, theta: number): number {
  const t = theta / (Math.PI * 2);
  return (((Math.round(t * sheet.frames) % sheet.frames) + sheet.frames) % sheet.frames);
}

/** Zeichnet einen Frame zentriert auf (x, y). */
export function drawFrame(ctx: CanvasRenderingContext2D, sheet: Sheet, frame: number, x: number, y: number, scale = 1): void {
  const w = sheet.fw * scale;
  const h = sheet.fh * scale;
  ctx.drawImage(sheet.image, frame * sheet.fw, 0, sheet.fw, sheet.fh, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}

/** Bequem: Münze im Winkel theta zeichnen */
export function drawCoin(ctx: CanvasRenderingContext2D, defId: string, size: 'big' | 'small', theta: number, x: number, y: number, scale = 1): void {
  const sheet = getSheet(`coin:${defId}:${size}`);
  drawFrame(ctx, sheet, frameForAngle(sheet, theta), x, y, scale);
}

export function drawRelicIcon(ctx: CanvasRenderingContext2D, defId: string, x: number, y: number, scale = 1): void {
  drawFrame(ctx, getSheet(`relic:${defId}`), 0, x, y, scale);
}
