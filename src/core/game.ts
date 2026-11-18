/**
 * GAME – der Dirigent
 * ===================
 * Verbindet Spiellogik (core), Grafik (render), Oberfläche (ui) und Sound (audio).
 *
 * Game Loop: Der Browser ruft ~60× pro Sekunde frame() auf. Jedes Mal:
 *   1. update(dt) – Animationen, Timer, Tastatur
 *   2. render()   – alles neu zeichnen (die UI reagiert dabei auf Mausklicks)
 *
 * "Szenen": menu -> play <-> shop -> ... -> gameover
 */
import { sfx, toggleMute } from '../audio/sfx';
import { generateBackground, drawAmbient, W, H } from '../render/background';
import { CoinToss, LAND } from '../render/coinAnim';
import { Particles, Shake } from '../render/particles';
import { Screen } from '../render/renderer';
import { drawCollection, drawGameOver, drawMenu } from '../ui/menus';
import { drawPlay, handCardRect } from '../ui/hud';
import { drawShop } from '../ui/shopView';
import { C, UI, fmt, num } from '../ui/draw';
import { Input } from '../ui/input';
import { Popups } from '../ui/popups';
import { BALANCE } from '../data/balance';
import { resolveFlip } from './flip';
import { checkUnlocks, isUnlocked, loadMeta, recordFlip, recordRoundWon, recordRunEnd, saveMeta } from './meta';
import { bossDef, coinDef } from './registry';
import { dailySeed, randomSeed } from './rng';
import { openShop } from './shop';
import { newRun, payRoundRewards, roundStatus, startRound, tryPhoenix, type RewardLine } from './state';
import type { FlipOutcome, MetaStats, RunState } from './types';

export type Scene = 'menu' | 'play' | 'shop' | 'gameover' | 'collection';
export type PlayState = 'intro' | 'idle' | 'tossing' | 'ending' | 'roundWon';
export type ShopMode = 'none' | 'upgrade' | 'remove' | 'sell';

/** Was die HUD während eines Wurfs anzeigt (das Ergebnis steht ja schon fest!) */
interface Frozen {
  streak: number;
  luck: number;
  hand: number[];
}

export class Game {
  readonly screen: Screen;
  readonly input: Input;
  readonly ui: UI;
  readonly particles = new Particles();
  readonly shake = new Shake();
  readonly popups = new Popups();
  readonly bg: HTMLCanvasElement;

  meta: MetaStats = loadMeta();
  run: RunState | null = null;
  scene: Scene = 'menu';
  collectionBack: Scene = 'menu';
  play: PlayState = 'idle';
  toss: CoinToss | null = null;
  pending: FlipOutcome | null = null;
  frozen: Frozen | null = null;
  /** Angezeigte (hochzählende) Goldwerte */
  shown = { roundGold: 0, gold: 0 };
  selected = 0;
  speed = 1;
  rewardLines: RewardLine[] = [];
  unlockedNow: string[] = [];
  shopMode: ShopMode = 'none';
  message = '';
  messageTime = 0;
  time = 0;
  /** Letztes Ergebnis (für die Anzeige der Rechnung) */
  lastOutcome: FlipOutcome | null = null;

  private timers: { t: number; fn: () => void }[] = [];
  private lastNow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.screen = new Screen(canvas);
    this.input = new Input(this.screen);
    this.ui = new UI(this.screen.ctx, this.input);
    this.bg = generateBackground();
    try {
      this.speed = localStorage.getItem('cockflip.fast') === '1' ? 2 : 1;
    } catch {
      /* egal */
    }
  }

  /** Startet die Endlosschleife */
  start(): void {
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000);
      this.lastNow = now;
      this.update(dt);
      this.render(dt);
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Führt fn nach "sec" Sekunden aus */
  after(sec: number, fn: () => void): void {
    this.timers.push({ t: sec, fn });
  }

  unlockCheck = (id: string): boolean => isUnlocked(this.meta, id);

  /** Kurze Statusmeldung (z. B. "Nicht genug Gold") */
  say(msg: string): void {
    this.message = msg;
    this.messageTime = 2.2;
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    try {
      localStorage.setItem('cockflip.fast', this.speed === 2 ? '1' : '0');
    } catch {
      /* egal */
    }
  }

  // =================================================================== Ablauf

  startRun(seed?: string, daily = false): void {
    const s = seed ?? (daily ? dailySeed() : randomSeed());
    this.run = newRun(s, daily);
    this.shown = { roundGold: 0, gold: this.run.gold };
    this.unlockedNow = [];
    this.beginRound();
  }

  /** Neue Runde starten (Banner, Boss-Gong) */
  beginRound(): void {
    const run = this.run!;
    startRound(run);
    this.scene = 'play';
    this.play = 'intro';
    this.toss = null;
    this.lastOutcome = null;
    this.selected = 0;
    this.shown.roundGold = 0;
    this.popups.clear();
    if (run.boss) {
      const b = bossDef(run.boss);
      this.popups.banner(`BOSS: ${b.name.toUpperCase()}`, b.desc, C.red, 2.6);
      sfx.boss();
      this.shake.add(0.5);
      this.after(1.4, () => (this.play = 'idle'));
    } else {
      this.popups.banner(`RUNDE ${run.round}`, `Quota: ${fmt(run.quota)} Gold in ${run.flipsLeft} Würfen`, C.gold, 1.7);
      sfx.roundStart();
      this.after(0.7, () => (this.play = 'idle'));
    }
  }

  /** Münze an Position "index" der Hand werfen */
  flip(index: number): void {
    const run = this.run;
    if (!run || this.scene !== 'play' || (this.play !== 'idle' && this.play !== 'intro')) return;
    if (this.play === 'intro') this.play = 'idle';
    const uid = run.hand[index];
    if (uid === undefined) return;

    const from = handCardRect(run.hand.length, index);
    this.frozen = { streak: run.streak, luck: run.luck, hand: run.hand.filter((u) => u !== uid) };

    const outcome = resolveFlip(run, uid);
    recordFlip(this.meta, outcome);
    this.pending = outcome;
    this.toss = new CoinToss(outcome.defId, outcome.side, from.x + from.w / 2, from.y + 18, this.speed);
    this.play = 'tossing';
    this.selected = Math.min(this.selected, Math.max(0, run.hand.length - 1));
    sfx.flip();
  }

  /** Die Münze liegt – jetzt wird das Ergebnis gezeigt */
  private reveal(o: FlipOutcome): void {
    const run = this.run!;
    const t = this.toss!;
    this.frozen = null;
    this.pending = null;
    this.lastOutcome = o;
    const x = t.x;
    const y = LAND.y - 52; // Texte schweben ÜBER der Münze

    if (o.side === 'tails') {
      sfx.tails();
      this.particles.dust(x, LAND.y + 8, 10);
      this.popups.float('ZAHL', x, y, { color: C.muted, size: 16, pixel: true });
      if (o.gold !== 0) this.popups.float((o.gold > 0 ? '+' : '') + fmt(o.gold), x, y + 16, { color: o.gold > 0 ? C.gold : C.red, size: 10, delay: 0.15 });
    } else {
      const big = o.gold >= Math.max(25, run.quota * 0.5);
      if (o.side === 'edge') {
        sfx.jackpot();
        this.particles.coinRain(70);
        this.shake.add(0.9);
        this.popups.banner('RAND!', `Jackpot ×${BALANCE.edgeJackpotMult}: +${fmt(o.gold)} Gold`, C.gold, 2.6, 60);
      } else {
        sfx.heads(o.streak);
        this.shake.add(Math.min(0.75, 0.22 + o.gold / Math.max(1, run.quota)));
        if (big) {
          sfx.kaching();
          this.particles.coinRain(Math.min(50, 14 + Math.floor(o.gold / Math.max(1, run.quota) * 20)));
        }
      }
      this.particles.sparks(x, LAND.y, 18 + Math.min(30, o.streak * 4));
      if (o.side !== 'edge') this.popups.float('KOPF!', x, y, { color: C.gold, size: 16, pixel: true });
      this.popups.float('+' + fmt(o.gold), x, y + 17, { color: C.gold, size: 13, delay: 0.12, life: 1.6 });
      this.popups.float(`${fmt(o.chips)} × ${num(o.mult)}${o.xMult !== 1 ? ` × ${num(o.xMult)}` : ''}`, x, y + 30, { color: C.text, size: 7, delay: 0.22, life: 1.5 });
    }

    // Effekt-Meldungen nacheinander einblenden
    o.messages
      .filter((m) => !m.startsWith('RAND'))
      .forEach((m, i) => this.popups.float(m, x + (i % 2 ? 40 : -40), y - 10, { color: C.blue, size: 7, delay: 0.3 + i * 0.25, life: 1.4 }));

    if (o.broke) {
      sfx.shatter();
      this.particles.shards(x, LAND.y);
      this.toss = null;
    }

    if (o.luckEvent) {
      const ev = o.luckEvent;
      this.after(0.55, () => {
        if (ev.good) sfx.luckGood();
        else sfx.luckBad();
        this.popups.banner(ev.good ? 'GLÜCK GEHABT' : 'FLUCH!', ev.text, ev.good ? C.green : C.purple, 2.2, 132);
      });
    }

    // Rundenende?
    const status = roundStatus(run);
    if (status === 'playing') {
      this.play = 'idle';
    } else {
      this.play = 'ending';
      this.after(o.luckEvent ? 1.6 : 1.0, () => (status === 'won' ? this.roundWon() : this.roundLost()));
    }
  }

  private roundWon(): void {
    const run = this.run!;
    recordRoundWon(this.meta, run);
    this.rewardLines = payRoundRewards(run);
    this.unlockedNow.push(...checkUnlocks(this.meta));
    saveMeta(this.meta);
    sfx.roundWin();
    this.particles.coinRain(25);
    this.play = 'roundWon';
  }

  private roundLost(): void {
    const run = this.run!;
    if (tryPhoenix(run)) {
      sfx.luckGood();
      this.popups.banner('PHÖNIXFEDER!', 'Sie verbrennt – und du lebst weiter.', C.gold, 2.4);
      this.particles.sparks(240, 120, 60, ['#fff4c0', '#ffc45a', '#ff8c2a', '#e05a12']);
      this.rewardLines = [{ label: 'Gerettet durch die Phönixfeder', gold: 0 }];
      this.after(1.6, () => (this.play = 'roundWon'));
      return;
    }
    recordRunEnd(this.meta, run);
    this.unlockedNow.push(...checkUnlocks(this.meta));
    saveMeta(this.meta);
    sfx.gameOver();
    this.shake.add(0.4);
    this.scene = 'gameover';
  }

  goShop(): void {
    const run = this.run!;
    openShop(run, this.unlockCheck);
    this.shopMode = 'none';
    this.scene = 'shop';
    this.toss = null;
    this.popups.clear();
  }

  leaveShop(): void {
    this.beginRound();
  }

  backToMenu(): void {
    // Ein abgebrochener Run zählt als beendet
    if (this.run && (this.scene === 'play' || this.scene === 'shop')) {
      recordRunEnd(this.meta, this.run);
      this.unlockedNow.push(...checkUnlocks(this.meta));
      saveMeta(this.meta);
    }
    this.run = null;
    this.scene = 'menu';
    this.popups.clear();
    this.toss = null;
  }

  // =================================================================== Update

  private update(dt: number): void {
    this.time += dt;

    // Timer
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    due.forEach((t) => t.fn());

    // Animationen
    if (this.toss) {
      this.toss.update(dt);
      for (const e of this.toss.events) {
        if (e === 'land') {
          sfx.land();
          this.particles.dust(this.toss.x, LAND.y + 8, 6);
          this.shake.add(0.12);
        } else if (e === 'tick') sfx.tick();
        else if (e === 'done' && this.pending) this.reveal(this.pending);
      }
      if (this.toss) this.toss.events = [];
    }
    this.particles.update(dt);
    this.shake.update(dt);
    this.popups.update(dt);
    if (this.messageTime > 0) this.messageTime -= dt;

    // Gold-Zähler zählen sichtbar hoch
    if (this.run && !this.frozen) {
      const k = 1 - Math.pow(0.0005, dt);
      this.shown.roundGold += (this.run.roundGold - this.shown.roundGold) * k;
      this.shown.gold += (this.run.gold - this.shown.gold) * k;
      if (Math.abs(this.run.roundGold - this.shown.roundGold) < 0.5) this.shown.roundGold = this.run.roundGold;
      if (Math.abs(this.run.gold - this.shown.gold) < 0.5) this.shown.gold = this.run.gold;
    }

    this.handleKeys();
  }

  /** Tastatur-Steuerung */
  private handleKeys(): void {
    const k = (c: string) => this.input.key(c);
    if (k('KeyM')) toggleMute();
    if (k('KeyF')) this.toggleSpeed();

    if (this.scene === 'menu') {
      if (k('Enter') || k('Space')) this.startRun();
    } else if (this.scene === 'play' && this.run) {
      const n = this.run.hand.length;
      if (this.play === 'idle' || this.play === 'intro') {
        if (k('ArrowLeft')) this.selected = (this.selected + n - 1) % n;
        if (k('ArrowRight')) this.selected = (this.selected + 1) % n;
        for (let i = 0; i < 5; i++) if (k(`Digit${i + 1}`) && i < n) this.flip(i);
        if (k('Space') || k('Enter')) this.flip(Math.min(this.selected, n - 1));
      } else if (this.play === 'roundWon' && (k('Enter') || k('Space'))) {
        this.goShop();
      }
    } else if (this.scene === 'shop') {
      if (k('Escape')) this.shopMode = 'none';
      if (k('Enter')) this.leaveShop();
    } else if (this.scene === 'gameover') {
      if (k('Enter') || k('Space')) this.startRun();
    } else if (this.scene === 'collection') {
      if (k('Escape')) this.scene = this.collectionBack;
    }
  }

  // =================================================================== Render

  private render(dt: number): void {
    const s = this.screen;
    const lo = s.lctx;
    s.begin();

    // --- Pixel-Szene ---
    lo.drawImage(this.bg, 0, 0);
    drawAmbient(lo, this.time, dt);
    if (this.scene === 'play' || this.scene === 'gameover') {
      this.toss?.draw(lo, this.time);
    }
    if (this.scene === 'shop' || this.scene === 'collection' || this.scene === 'menu') {
      lo.fillStyle = this.scene === 'menu' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)';
      lo.fillRect(0, 0, W, H);
    }
    this.particles.draw(lo);

    const off = this.shake.offset(this.time);
    s.present(off.x, off.y);

    // --- Oberfläche (scharf, volle Auflösung) ---
    this.ui.beginFrame();
    switch (this.scene) {
      case 'menu':
        drawMenu(this);
        break;
      case 'play':
        drawPlay(this);
        break;
      case 'shop':
        drawShop(this);
        break;
      case 'gameover':
        drawPlay(this, true);
        drawGameOver(this);
        break;
      case 'collection':
        drawCollection(this);
        break;
    }
    this.popups.draw(this.ui);
    this.ui.endFrame(s.canvas);
  }

  /** Name der Münze für eine uid */
  coinName(uid: number): string {
    const c = this.run?.deck.find((d) => d.uid === uid);
    return c ? coinDef(c.defId).name : '?';
  }
}
