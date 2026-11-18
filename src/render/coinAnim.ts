/**
 * MÜNZWURF-ANIMATION
 * ==================
 * Spielt ein BEREITS BERECHNETES Ergebnis ab (siehe core/flip.ts).
 * Ablauf:
 *   toss    – Flugbahn (Parabel) mit schneller Rotation
 *   bounce  – Aufprall und kleiner Hüpfer
 *   settle  – Ausrollen: die Münze eiert aus und kommt zur Ruhe
 *   done    – liegt still; das Ergebnis wird angezeigt
 *
 * Die Endrotation wird so gewählt, dass die richtige Seite oben liegt.
 */
import type { Side } from '../core/types';
import { drawCoin } from './assets';

/** Wo die Münze landet (Mitte des Spielfilzes) */
export const LAND = { x: 240, y: 176 };
/** Neigung einer liegenden Münze (wir schauen schräg von oben auf den Tisch) */
export const REST_TILT = (Math.PI * 2 * 11) / 64;

export type TossEvent = 'land' | 'tick' | 'done';

const TAU = Math.PI * 2;

export class CoinToss {
  readonly defId: string;
  readonly side: Side;
  phase: 'toss' | 'bounce' | 'settle' | 'done' = 'toss';
  x: number;
  y: number;
  theta: number;
  /** Ereignisse seit dem letzten Abholen (für Sound/Effekte) */
  events: TossEvent[] = [];

  private t = 0;
  private readonly startX: number;
  private readonly startY: number;
  private readonly endX: number;
  private readonly thetaEnd: number;
  private readonly thetaStart: number;
  private readonly tossDur: number;
  private readonly bounceDur: number;
  private readonly settleDur: number;
  private ticksDone = 0;

  constructor(defId: string, side: Side, fromX: number, fromY: number, speed = 1) {
    this.defId = defId;
    this.side = side;
    this.startX = fromX;
    this.startY = fromY;
    this.x = fromX;
    this.y = fromY;
    // Rein optischer Zufall (beeinflusst das Ergebnis NICHT)
    this.endX = LAND.x + (Math.random() - 0.5) * 50;
    // Endwinkel je nach Ergebnis
    if (side === 'heads') this.thetaEnd = REST_TILT;
    else if (side === 'tails') this.thetaEnd = Math.PI + REST_TILT;
    else this.thetaEnd = 0; // Rand: Münze steht aufrecht und zeigt ihr Gesicht
    const spins = 4 + Math.floor(Math.random() * 3);
    this.thetaStart = this.thetaEnd - spins * TAU - 0.9;
    this.theta = this.thetaStart;
    this.tossDur = 0.8 / speed;
    this.bounceDur = 0.26 / speed;
    this.settleDur = (side === 'edge' ? 0.9 : 0.5) / speed;
  }

  /** Höhe über dem Tisch (für Schatten) */
  get height(): number {
    return Math.max(0, LAND.y - this.y);
  }

  update(dt: number): void {
    if (this.phase === 'done') return;
    this.t += dt;

    if (this.phase === 'toss') {
      const p = Math.min(1, this.t / this.tossDur);
      this.x = this.startX + (this.endX - this.startX) * p;
      // Parabel: gleichmäßige Schwerkraft
      this.y = this.startY + (LAND.y - this.startY) * p - 150 * 4 * p * (1 - p);
      this.theta = this.thetaStart + (this.thetaEnd - 0.9 - this.thetaStart) * p;
      if (p >= 1) {
        this.phase = 'bounce';
        this.t = 0;
        this.events.push('land');
      }
    } else if (this.phase === 'bounce') {
      const q = Math.min(1, this.t / this.bounceDur);
      this.y = LAND.y - 10 * 4 * q * (1 - q);
      this.x += dt * 12;
      this.theta = this.thetaEnd - 0.9 * (1 - q);
      if (q >= 1) {
        this.phase = 'settle';
        this.t = 0;
        this.events.push('tick');
      }
    } else if (this.phase === 'settle') {
      const q = Math.min(1, this.t / this.settleDur);
      const amp = this.side === 'edge' ? 0.12 : 0.38;
      // Gedämpfte Schwingung = "Ausrollen"
      this.theta = this.thetaEnd + amp * Math.exp(-4 * q) * Math.cos(16 * q) * (1 - q);
      this.y = LAND.y;
      this.x += dt * 6 * (1 - q);
      const tickAt = [0.2, 0.4, 0.58];
      if (this.ticksDone < tickAt.length && q > tickAt[this.ticksDone]) {
        this.ticksDone++;
        this.events.push('tick');
      }
      if (q >= 1) {
        this.theta = this.thetaEnd;
        this.phase = 'done';
        this.events.push('done');
      }
    }
  }

  /** Schatten + Münze in die Pixel-Szene zeichnen */
  draw(ctx: CanvasRenderingContext2D, time: number): void {
    // Weicher Schatten (Licht kommt von oben links -> Schatten nach rechts unten)
    const h = this.height;
    const spread = 1 - Math.min(0.55, h / 280);
    const a = 0.6 * (1 - Math.min(0.75, h / 180));
    const sx = this.x + 3 + h * 0.04;
    const sy = LAND.y + 11;
    ctx.fillStyle = `rgba(0,0,0,${a * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 27 * spread, 8 * spread, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 20 * spread, 5.5 * spread, 0, 0, TAU);
    ctx.fill();

    // Goldener Schein bei Rand-Landung
    if (this.side === 'edge' && this.phase === 'done') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.2 * Math.sin(time * 6);
      const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, 50);
      g.addColorStop(0, `rgba(255,220,120,${pulse})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.x - 50, this.y - 50, 100, 100);
      ctx.restore();
    }

    drawCoin(ctx, this.defId, 'big', this.theta, this.x, this.y);
  }
}
