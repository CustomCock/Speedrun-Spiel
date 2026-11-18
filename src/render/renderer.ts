/**
 * BILDSCHIRM / RENDERER
 * =====================
 * Zwei Ebenen:
 *   lo  = kleine 480×270-Leinwand für die Spielszene (Pixel-Art)
 *   ctx = die sichtbare Leinwand in voller Bildschirmauflösung
 *
 * Jedes Frame wird die kleine Leinwand mit einem GANZZAHLIGEN Faktor
 * (2×, 3×, 4× …) hochskaliert – ohne Weichzeichnen ("pixelated").
 * Danach wird die Benutzeroberfläche (Text in Inter, Panels) direkt in
 * voller Auflösung darübergezeichnet, damit Schrift gestochen scharf ist.
 *
 * Koordinaten sind überall "logische Pixel" (0..480, 0..270).
 */
import { H, W } from './background';

export class Screen {
  readonly canvas: HTMLCanvasElement;
  /** Hochauflösender Kontext für UI (Transformation: 1 Einheit = 1 logischer Pixel) */
  readonly ctx: CanvasRenderingContext2D;
  /** Kleine Pixel-Leinwand für die Szene */
  readonly lo: HTMLCanvasElement;
  readonly lctx: CanvasRenderingContext2D;
  /** Geräte-Pixel pro logischem Pixel (immer ganzzahlig) */
  scale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lo = document.createElement('canvas');
    this.lo.width = W;
    this.lo.height = H;
    this.lctx = this.lo.getContext('2d')!;
    this.lctx.imageSmoothingEnabled = false;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Passt die Größe an das Fenster an (Integer-Scaling) */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const s = Math.max(1, Math.floor(Math.min((window.innerWidth * dpr) / W, (window.innerHeight * dpr) / H)));
    this.scale = s;
    this.canvas.width = W * s;
    this.canvas.height = H * s;
    this.canvas.style.width = `${(W * s) / dpr}px`;
    this.canvas.style.height = `${(H * s) / dpr}px`;
  }

  /** Beginnt ein neues Frame */
  begin(): void {
    this.lctx.setTransform(1, 0, 0, 1, 0, 0);
    this.lctx.clearRect(0, 0, W, H);
  }

  /** Kopiert die Pixel-Szene auf den Bildschirm (mit optionalem Screenshake-Versatz) */
  present(shakeX = 0, shakeY = 0): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.imageSmoothingEnabled = false;
    const s = this.scale;
    c.drawImage(this.lo, Math.round(shakeX) * s, Math.round(shakeY) * s, W * s, H * s);
    // Ab jetzt zeichnet die UI in logischen Pixeln
    c.setTransform(s, 0, 0, s, 0, 0);
  }

  /** Bildschirmkoordinaten (Maus) -> logische Pixel */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }
}
