/**
 * SOUNDEFFEKTE mit der Web Audio API
 * ==================================
 * Keine Audiodateien – alle Klänge werden live erzeugt:
 *   - Oszillatoren (Sinus, Dreieck, Rechteck) für Töne
 *   - weißes Rauschen (Zufallswerte) für Rascheln, Aufprall, Kasse
 *   - "Hüllkurven" (lauter/leiser über die Zeit) formen den Klang
 *
 * Ein Metall-Klingen entsteht durch mehrere Sinustöne mit "unharmonischen"
 * Frequenzverhältnissen (1 : 2,76 : 5,4 : 8,9) – genau wie bei echten Glocken.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

try {
  muted = localStorage.getItem('cockflip.muted') === '1';
} catch {
  /* egal */
}

/** Browser erlauben Ton erst nach einer Nutzeraktion – deshalb erst beim ersten Klick starten. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // 1 Sekunde Rauschen vorberechnen
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
  try {
    localStorage.setItem('cockflip.muted', muted ? '1' : '0');
  } catch {
    /* egal */
  }
  return muted;
}

/** Ein einzelner Ton mit Hüllkurve */
function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slideTo?: number; attack?: number } = {}): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const vol = opts.vol ?? 0.2;
  const atk = opts.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Gefiltertes Rauschen */
function noise(dur: number, opts: { freq?: number; q?: number; vol?: number; at?: number; type?: BiquadFilterType; sweepTo?: number } = {}): void {
  if (!ctx || !master || !noiseBuf) return;
  const t0 = ctx.currentTime + (opts.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq ?? 1000, t0);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  const vol = opts.vol ?? 0.2;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

/** Metallisches "Ping" einer Münze */
function clink(base: number, vol = 0.12, at = 0, decay = 0.5): void {
  const ratios = [1, 2.76, 5.4, 8.93];
  ratios.forEach((r, i) => tone(base * r * (1 + (Math.random() - 0.5) * 0.01), decay / (1 + i * 0.6), { vol: vol / (1 + i * 0.8), at }));
}

// ---------------------------------------------------------------------------
// Öffentliche Sounds
// ---------------------------------------------------------------------------

export const sfx = {
  /** Daumen schnippt die Münze hoch */
  flip() {
    clink(1900, 0.1, 0, 0.3);
    noise(0.28, { freq: 600, sweepTo: 2800, q: 2, vol: 0.08 });
  },
  /** Münze schlägt auf dem Filz auf */
  land() {
    tone(150, 0.12, { type: 'sine', slideTo: 60, vol: 0.35 });
    noise(0.08, { freq: 400, type: 'lowpass', vol: 0.25 });
    clink(1500, 0.08, 0.01, 0.35);
  },
  /** Kleines Klirren beim Ausrollen */
  tick() {
    clink(1700 + Math.random() * 400, 0.05, 0, 0.18);
  },
  /** Kopf! Höhe steigt mit der Serie */
  heads(streak: number) {
    const base = 880 * Math.pow(1.06, Math.min(streak, 12));
    tone(base, 0.18, { type: 'triangle', vol: 0.12 });
    tone(base * 1.5, 0.3, { type: 'triangle', vol: 0.1, at: 0.06 });
    clink(2400, 0.08, 0.02, 0.6);
  },
  /** Zahl – dumpfes "Bonk" */
  tails() {
    tone(220, 0.2, { type: 'triangle', slideTo: 140, vol: 0.18 });
    tone(110, 0.25, { type: 'sine', vol: 0.12, at: 0.02 });
  },
  /** Kasse klingelt (große Gewinne) */
  kaching() {
    noise(0.05, { freq: 3000, q: 0.7, vol: 0.2 });
    clink(1320, 0.1, 0.04, 0.9);
    tone(2093, 0.6, { type: 'square', vol: 0.03, at: 0.05 });
    tone(2637, 0.6, { type: 'square', vol: 0.03, at: 0.09 });
  },
  /** Jackpot (Rand-Landung) */
  jackpot() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, { type: 'square', vol: 0.05, at: i * 0.07 }));
    for (let i = 0; i < 8; i++) clink(1500 + Math.random() * 1200, 0.06, 0.3 + i * 0.06, 0.4);
    this.kaching();
  },
  /** Klick auf Buttons */
  click() {
    tone(1200, 0.04, { type: 'square', vol: 0.03 });
  },
  hover() {
    tone(1800, 0.02, { type: 'sine', vol: 0.015 });
  },
  /** Kaufen im Shop */
  buy() {
    for (let i = 0; i < 3; i++) clink(1600 + i * 300, 0.07, i * 0.05, 0.3);
    noise(0.04, { freq: 2500, vol: 0.1, at: 0.15 });
  },
  /** Geht nicht */
  error() {
    tone(140, 0.15, { type: 'square', vol: 0.06 });
    tone(110, 0.15, { type: 'square', vol: 0.06, at: 0.08 });
  },
  /** Glas zerbricht */
  shatter() {
    noise(0.3, { freq: 5000, q: 0.5, vol: 0.2, type: 'highpass' });
    for (let i = 0; i < 6; i++) tone(3000 + Math.random() * 3000, 0.12, { vol: 0.03, at: Math.random() * 0.15 });
  },
  /** Boss erscheint – tiefer Gong */
  boss() {
    [55, 110, 165, 220.5].forEach((f, i) => tone(f, 2.2, { vol: 0.25 / (i + 1), attack: 0.01 }));
    noise(0.5, { freq: 200, type: 'lowpass', vol: 0.3 });
  },
  /** Pech-Meter: Belohnung */
  luckGood() {
    [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.08, at: i * 0.06 }));
  },
  /** Pech-Meter: Fluch */
  luckBad() {
    [440, 415, 330, 247].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.04, at: i * 0.1 }));
  },
  /** Runde geschafft */
  roundWin() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.1, at: i * 0.09 }));
    this.kaching();
  },
  /** Game Over – trauriges Posaunen-Gefühl */
  gameOver() {
    [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.35, { type: 'sawtooth', vol: 0.06, at: i * 0.32, slideTo: i === 3 ? 260 : undefined }));
  },
  /** Neue Runde */
  roundStart() {
    clink(1200, 0.08, 0, 0.5);
    clink(1600, 0.08, 0.1, 0.5);
  },
};
