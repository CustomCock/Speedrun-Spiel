/**
 * UI-BAUSTEINE: Text, Panels, Buttons, Balken, Tooltips.
 *
 * "Immediate Mode": Jedes Frame wird die komplette Oberfläche neu gezeichnet.
 * Ein Button ist einfach ein Funktionsaufruf, der zeichnet UND zurückgibt,
 * ob er gerade angeklickt wurde:   if (ui.button(...)) { tuWas(); }
 */
import { sfx } from '../audio/sfx';
import type { Input } from './input';

export const C = {
  text: '#f4e4c1',
  muted: '#a8977c',
  dim: '#6e604c',
  gold: '#ffd56a',
  goldDeep: '#c9962e',
  red: '#ff6b5a',
  green: '#7ee08a',
  blue: '#8cc8ff',
  purple: '#c58cff',
  panel: 'rgba(14, 9, 6, 0.86)',
  panelHi: 'rgba(30, 19, 11, 0.92)',
  border: '#6b4a26',
  borderHi: '#d6a64a',
};

export const RARITY_COLOR: Record<string, string> = {
  common: '#c8bba4',
  uncommon: '#7ee08a',
  rare: '#8cc8ff',
  legendary: '#ffb14a',
};
export const RARITY_NAME: Record<string, string> = {
  common: 'Gewöhnlich',
  uncommon: 'Ungewöhnlich',
  rare: 'Selten',
  legendary: 'Legendär',
};

export const FONT_UI = 'Inter, system-ui, sans-serif';
export const FONT_PIXEL = 'Silkscreen, monospace';

export interface TextOpts {
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  pixel?: boolean;
  shadow?: boolean;
  maxWidth?: number;
}

export class UI {
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  /** Wurde in diesem Frame irgendein Button "gehovert"? (für den Mauszeiger) */
  hovering = false;
  private lastHover = '';
  private hoverThisFrame = '';
  /** Tooltip, der am Ende des Frames oben drauf gezeichnet wird */
  private pendingTip: { title: string; body: string; color?: string } | null = null;

  constructor(ctx: CanvasRenderingContext2D, input: Input) {
    this.ctx = ctx;
    this.input = input;
  }

  beginFrame(): void {
    this.hovering = false;
    this.hoverThisFrame = '';
    this.pendingTip = null;
  }

  endFrame(canvas: HTMLCanvasElement): void {
    if (this.pendingTip) this.drawTooltip(this.pendingTip.title, this.pendingTip.body, this.pendingTip.color);
    if (this.hoverThisFrame && this.hoverThisFrame !== this.lastHover) sfx.hover();
    this.lastHover = this.hoverThisFrame;
    canvas.style.cursor = this.hovering ? 'pointer' : 'default';
  }

  // ---------------------------------------------------------------- Text
  font(size: number, weight = 500, pixel = false): string {
    return pixel ? `${size}px ${FONT_PIXEL}` : `${weight} ${size}px ${FONT_UI}`;
  }

  text(str: string, x: number, y: number, o: TextOpts = {}): number {
    const c = this.ctx;
    c.font = this.font(o.size ?? 7, o.weight ?? 500, o.pixel);
    c.textAlign = o.align ?? 'left';
    c.textBaseline = o.baseline ?? 'alphabetic';
    if (o.shadow !== false) {
      c.fillStyle = 'rgba(0,0,0,0.75)';
      c.fillText(str, x + 0.5, y + 0.5, o.maxWidth);
    }
    c.fillStyle = o.color ?? C.text;
    c.fillText(str, x, y, o.maxWidth);
    return c.measureText(str).width;
  }

  measure(str: string, size = 7, weight = 500, pixel = false): number {
    this.ctx.font = this.font(size, weight, pixel);
    return this.ctx.measureText(str).width;
  }

  /** Bricht Text in Zeilen um, die in maxWidth passen */
  wrap(str: string, maxWidth: number, size = 6, weight = 500): string[] {
    this.ctx.font = this.font(size, weight);
    const words = str.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (this.ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Mehrzeiliger Text; gibt die Höhe zurück */
  paragraph(str: string, x: number, y: number, maxWidth: number, o: TextOpts = {}): number {
    const size = o.size ?? 6;
    const lh = size * 1.3;
    const lines = this.wrap(str, maxWidth, size, o.weight ?? 500);
    lines.forEach((l, i) => this.text(l, x, y + i * lh, { ...o, size }));
    return lines.length * lh;
  }

  // ---------------------------------------------------------------- Formen
  /** Pixel-Art-Panel: abgeschrägte Ecken, Messing-Rahmen, feine Lichtkante oben */
  panel(x: number, y: number, w: number, h: number, opts: { fill?: string; border?: string; glow?: boolean } = {}): void {
    const c = this.ctx;
    x = Math.round(x);
    y = Math.round(y);
    c.fillStyle = opts.fill ?? C.panel;
    c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = opts.border ?? C.border;
    c.fillRect(x + 2, y, w - 4, 1);
    c.fillRect(x + 2, y + h - 1, w - 4, 1);
    c.fillRect(x, y + 2, 1, h - 4);
    c.fillRect(x + w - 1, y + 2, 1, h - 4);
    c.fillRect(x + 1, y + 1, 1, 1);
    c.fillRect(x + w - 2, y + 1, 1, 1);
    c.fillRect(x + 1, y + h - 2, 1, 1);
    c.fillRect(x + w - 2, y + h - 2, 1, 1);
    c.fillStyle = 'rgba(255, 220, 160, 0.10)';
    c.fillRect(x + 2, y + 1, w - 4, 1);
    if (opts.glow) {
      c.fillStyle = 'rgba(255, 200, 90, 0.08)';
      c.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
  }

  /** Fortschrittsbalken */
  bar(x: number, y: number, w: number, h: number, frac: number, color: string, bg = 'rgba(0,0,0,0.5)'): void {
    const c = this.ctx;
    c.fillStyle = bg;
    c.fillRect(x, y, w, h);
    const fw = Math.round(Math.max(0, Math.min(1, frac)) * (w - 2));
    c.fillStyle = color;
    c.fillRect(x + 1, y + 1, fw, h - 2);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(x + 1, y + 1, fw, 1);
  }

  // ---------------------------------------------------------------- Interaktion
  /** Merkt sich "id" als gehovert (für Hover-Sound und Mauszeiger) */
  hot(id: string, x: number, y: number, w: number, h: number): boolean {
    const over = this.input.over(x, y, w, h);
    if (over) {
      this.hovering = true;
      this.hoverThisFrame = id;
    }
    return over;
  }

  /** Klickfläche ohne Aussehen */
  area(id: string, x: number, y: number, w: number, h: number): boolean {
    return this.hot(id, x, y, w, h) && this.input.clicked;
  }

  /** Ein Button. Gibt true zurück, wenn er in diesem Frame geklickt wurde. */
  button(id: string, x: number, y: number, w: number, h: number, label: string, o: { enabled?: boolean; primary?: boolean; size?: number; sub?: string; danger?: boolean } = {}): boolean {
    const enabled = o.enabled !== false;
    const over = enabled && this.hot(id, x, y, w, h);
    const fill = !enabled ? 'rgba(20,14,10,0.85)' : over ? (o.primary ? '#7a5418' : '#4a2e18') : o.primary ? '#5a3c12' : '#2c1b0f';
    const border = !enabled ? '#3a2c1e' : o.danger ? '#c0504a' : over || o.primary ? C.borderHi : C.border;
    this.panel(x, y, w, h, { fill, border });
    // kleine Lichtkante = "erhabener" Button
    this.ctx.fillStyle = enabled ? 'rgba(255,230,180,0.15)' : 'rgba(255,255,255,0.03)';
    this.ctx.fillRect(Math.round(x) + 2, Math.round(y) + 1, w - 4, 1);
    const size = o.size ?? 7;
    const color = !enabled ? C.dim : o.primary ? C.gold : C.text;
    if (o.sub) {
      this.text(label, x + w / 2, y + h / 2 - 1, { size, weight: 700, color, align: 'center', baseline: 'middle' });
      this.text(o.sub, x + w / 2, y + h / 2 + size * 0.85, { size: size * 0.75, weight: 500, color: enabled ? C.muted : C.dim, align: 'center', baseline: 'middle' });
    } else {
      this.text(label, x + w / 2, y + h / 2 + 0.5, { size, weight: 700, color, align: 'center', baseline: 'middle' });
    }
    const clicked = over && this.input.clicked;
    if (clicked) sfx.click();
    return clicked;
  }

  /** Tooltip vormerken (wird zuletzt, also ganz oben, gezeichnet) */
  tooltip(title: string, body: string, color?: string): void {
    this.pendingTip = { title, body, color };
  }

  private drawTooltip(title: string, body: string, color?: string): void {
    const w = 120;
    const lines = this.wrap(body, w - 10, 6);
    const h = 16 + lines.length * 7.8;
    let x = this.input.mx + 8;
    let y = this.input.my + 8;
    if (x + w > 476) x = this.input.mx - w - 6;
    if (y + h > 266) y = 266 - h;
    this.panel(x, y, w, h, { fill: 'rgba(10,6,4,0.96)', border: C.borderHi });
    this.text(title, x + 5, y + 10, { size: 7, weight: 700, color: color ?? C.gold });
    lines.forEach((l, i) => this.text(l, x + 5, y + 18.5 + i * 7.8, { size: 6, color: C.text }));
  }
}

/** Zahl hübsch formatieren: 1234 -> "1.234", große Zahlen -> "1,2 Mio." */
export function fmt(n: number): string {
  n = Math.floor(n);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mrd.';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.';
  return n.toLocaleString('de-DE');
}

/** Prozent: 0.625 -> "63 %" */
export function pct(p: number, digits = 0): string {
  return (p * 100).toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }) + ' %';
}

/** Multiplikator: 2.5 -> "2,5" */
export function num(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
