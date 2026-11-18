/**
 * EINGABE: Maus/Touch und Tastatur.
 * Pro Frame merken wir uns: Wo ist die Maus? Wurde geklickt? Welche Tasten wurden gedrückt?
 */
import { unlockAudio } from '../audio/sfx';
import type { Screen } from '../render/renderer';

export class Input {
  /** Mausposition in logischen Pixeln */
  mx = -100;
  my = -100;
  /** true genau in dem Frame, in dem die Maustaste losgelassen wurde */
  clicked = false;
  private keys = new Set<string>();

  constructor(screen: Screen) {
    const c = screen.canvas;
    c.addEventListener('pointermove', (e) => {
      const p = screen.toLogical(e.clientX, e.clientY);
      this.mx = p.x;
      this.my = p.y;
    });
    c.addEventListener('pointerdown', (e) => {
      unlockAudio();
      const p = screen.toLogical(e.clientX, e.clientY);
      this.mx = p.x;
      this.my = p.y;
    });
    c.addEventListener('pointerup', (e) => {
      const p = screen.toLogical(e.clientX, e.clientY);
      this.mx = p.x;
      this.my = p.y;
      this.clicked = true;
    });
    c.addEventListener('pointerleave', () => {
      this.mx = -100;
      this.my = -100;
    });
    window.addEventListener('keydown', (e) => {
      unlockAudio();
      if (e.repeat) return;
      this.keys.add(e.code);
      // Leertaste soll die Seite nicht scrollen
      if (e.code === 'Space') e.preventDefault();
    });
  }

  /** Wurde diese Taste in diesem Frame gedrückt? (z. B. 'Space', 'Digit1', 'KeyR') */
  key(code: string): boolean {
    return this.keys.has(code);
  }

  /** Liegt die Maus im Rechteck? */
  over(x: number, y: number, w: number, h: number): boolean {
    return this.mx >= x && this.mx < x + w && this.my >= y && this.my < y + h;
  }

  /** Am Ende jedes Frames aufrufen */
  endFrame(): void {
    this.clicked = false;
    this.keys.clear();
  }
}
