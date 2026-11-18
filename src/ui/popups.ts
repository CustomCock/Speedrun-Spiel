/**
 * Schwebende Texte ("+24", "KOPF!") und große Banner ("RUNDE 3", "BOSS").
 */
import { C, type UI } from './draw';

interface Floater {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  delay: number;
  color: string;
  size: number;
  pixel: boolean;
  pop: number;
}

interface Banner {
  title: string;
  sub: string;
  color: string;
  life: number;
  maxLife: number;
  y: number;
}

export class Popups {
  private floaters: Floater[] = [];
  private banners: Banner[] = [];

  float(text: string, x: number, y: number, o: { color?: string; size?: number; pixel?: boolean; delay?: number; life?: number; vy?: number } = {}): void {
    const life = o.life ?? 1.3;
    this.floaters.push({
      text,
      x,
      y,
      vy: o.vy ?? -18,
      life,
      maxLife: life,
      delay: o.delay ?? 0,
      color: o.color ?? C.text,
      size: o.size ?? 8,
      pixel: o.pixel ?? false,
      pop: 0,
    });
  }

  banner(title: string, sub = '', color = C.gold, life = 1.8, y = 92): void {
    this.banners = this.banners.filter((b) => b.y !== y);
    this.banners.push({ title, sub, color, life, maxLife: life, y });
  }

  get bannerActive(): boolean {
    return this.banners.length > 0;
  }

  clear(): void {
    this.floaters = [];
    this.banners = [];
  }

  update(dt: number): void {
    for (const f of this.floaters) {
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.97;
      f.pop = Math.min(1, f.pop + dt * 8);
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const b of this.banners) b.life -= dt;
    this.banners = this.banners.filter((b) => b.life > 0);
  }

  draw(ui: UI): void {
    const c = ui.ctx;
    for (const f of this.floaters) {
      if (f.delay > 0) continue;
      const a = Math.min(1, f.life / (f.maxLife * 0.35));
      // "Pop": kurz größer, dann normal
      const scale = 1 + (1 - f.pop) * 0.6;
      c.globalAlpha = a;
      ui.text(f.text, f.x, f.y, { size: f.size * scale, weight: 800, color: f.color, align: 'center', baseline: 'middle', pixel: f.pixel });
      c.globalAlpha = 1;
    }
    for (const b of this.banners) {
      const t = 1 - b.life / b.maxLife;
      // rein- und rausgleiten
      const a = Math.min(1, Math.min(t * 6, b.life * 4));
      const slide = (1 - Math.min(1, t * 5)) * 30;
      c.globalAlpha = a;
      const h = b.sub ? 36 : 26;
      c.fillStyle = 'rgba(8,5,3,0.82)';
      c.fillRect(0, b.y - h / 2, 480, h);
      c.fillStyle = b.color;
      c.fillRect(0, b.y - h / 2, 480, 1);
      c.fillRect(0, b.y + h / 2 - 1, 480, 1);
      ui.text(b.title, 240 + slide, b.y - (b.sub ? 5 : 0), { size: 16, pixel: true, color: b.color, align: 'center', baseline: 'middle' });
      if (b.sub) ui.text(b.sub, 240 - slide, b.y + 10, { size: 7, color: C.text, align: 'center', baseline: 'middle' });
      c.globalAlpha = 1;
    }
  }
}
