/**
 * PARTIKEL: Funken, Staub, Glassplitter und Goldmünzen-Regen.
 * Alles wird in die kleine Pixel-Leinwand gezeichnet.
 * (Optischer Zufall mit Math.random() ist ok – er beeinflusst das Spiel nicht.)
 */
import { drawCoin } from './assets';
import { TABLE_Y } from './background';

interface Particle {
  kind: 'spark' | 'dust' | 'shard' | 'coin';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  theta: number;
  spin: number;
  defId: string;
  floor: number;
  bounces: number;
}

const GOLD_SPARKS = ['#fff6c0', '#ffe27a', '#ffc040', '#ff9a20'];

export class Particles {
  private list: Particle[] = [];

  private add(p: Partial<Particle>): void {
    this.list.push({
      kind: 'spark',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 1,
      maxLife: 1,
      color: '#fff',
      size: 1,
      theta: 0,
      spin: 0,
      defId: 'gold',
      floor: 999,
      bounces: 0,
      ...p,
    });
  }

  /** Goldene Funken (Kopf) */
  sparks(x: number, y: number, n: number, colors = GOLD_SPARKS): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      const life = 0.3 + Math.random() * 0.5;
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life, maxLife: life, color: colors[i % colors.length] });
    }
  }

  /** Staubwölkchen (Zahl / Aufprall) */
  dust(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const life = 0.4 + Math.random() * 0.4;
      this.add({
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 50,
        vy: -8 - Math.random() * 14,
        life,
        maxLife: life,
        color: '#8a7a66',
        size: 2,
      });
    }
  }

  /** Glassplitter (Glastaler zerbricht) */
  shards(x: number, y: number): void {
    const cols = ['#c6eef5', '#8bd0e0', '#ffffff', '#55acc6'];
    for (let i = 0; i < 24; i++) {
      const a = -Math.PI * Math.random();
      const sp = 60 + Math.random() * 120;
      const life = 0.6 + Math.random() * 0.6;
      this.add({ kind: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, maxLife: life, color: cols[i % 4], size: 1 + (i % 2), floor: y + 14 });
    }
  }

  /** Goldmünzen regnen vom Himmel (große Gewinne) */
  coinRain(n: number, defId = 'gold'): void {
    for (let i = 0; i < n; i++) {
      const life = 2.4 + Math.random() * 1.2;
      this.add({
        kind: 'coin',
        x: 120 + Math.random() * 240,
        y: -10 - Math.random() * 160,
        vx: (Math.random() - 0.5) * 30,
        vy: Math.random() * 40,
        life,
        maxLife: life,
        theta: Math.random() * 6.28,
        spin: 8 + Math.random() * 14,
        defId,
        floor: TABLE_Y + 12 + Math.random() * 60,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      switch (p.kind) {
        case 'spark':
          p.vy += 260 * dt;
          p.vx *= 0.98;
          break;
        case 'dust':
          p.vx *= 0.92;
          p.vy *= 0.95;
          break;
        case 'shard':
        case 'coin':
          p.vy += (p.kind === 'coin' ? 420 : 380) * dt;
          p.theta += p.spin * dt;
          if (p.y > p.floor && p.vy > 0) {
            p.y = p.floor;
            p.vy *= -0.35;
            p.vx *= 0.6;
            p.spin *= 0.5;
            p.bounces++;
          }
          break;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const a = Math.min(1, (p.life / p.maxLife) * 2);
      ctx.globalAlpha = a;
      if (p.kind === 'coin') {
        drawCoin(ctx, p.defId, 'small', p.theta, p.x, p.y);
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        // kurzer Schweif bei Funken
        if (p.kind === 'spark') {
          ctx.globalAlpha = a * 0.4;
          ctx.fillRect(Math.round(p.x - p.vx * 0.02), Math.round(p.y - p.vy * 0.02), 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  get count(): number {
    return this.list.length;
  }
}

/**
 * SCREENSHAKE mit "Trauma": Je mehr Trauma, desto stärker wackelt es.
 * Trauma klingt von selbst ab. Die Stärke wächst quadratisch – kleine
 * Erschütterungen sind dezent, große richtig spürbar.
 */
export class Shake {
  private trauma = 0;
  enabled = true;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  offset(time: number): { x: number; y: number } {
    if (!this.enabled || this.trauma <= 0) return { x: 0, y: 0 };
    const s = this.trauma * this.trauma * 7;
    return { x: Math.sin(time * 71) * s, y: Math.cos(time * 59) * s };
  }
}
