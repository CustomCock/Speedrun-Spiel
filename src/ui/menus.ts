/**
 * Hauptmenü, Game-Over-Bildschirm und Sammlung (Meta-Progression).
 */
import { isMuted, toggleMute } from '../audio/sfx';
import type { Game } from '../core/game';
import { COINS, RELICS } from '../core/registry';
import { dailySeed } from '../core/rng';
import { isUnlocked } from '../core/meta';
import { drawCoin, drawRelicIcon } from '../render/assets';
import { C, RARITY_COLOR, fmt } from './draw';

export function drawMenu(g: Game): void {
  const ui = g.ui;
  const m = g.meta;

  // Titel mit pulsierendem Glanz
  const glow = 0.5 + 0.5 * Math.sin(g.time * 2);
  // dunkles Schild hinter dem Titel (die Lampe hängt genau dahinter)
  ui.panel(118, 52, 244, 44, { fill: 'rgba(10,6,4,0.88)', border: C.goldDeep });
  ui.text('COCKFLIP', 241.5, 81.5, { size: 32, pixel: true, color: '#5a3010', align: 'center', shadow: false });
  ui.text('COCKFLIP', 240, 80, { size: 32, pixel: true, color: glow > 0.8 ? '#fff0b0' : C.gold, align: 'center' });
  ui.text('Ein Münzwurf-Roguelike. Kopf gewinnt.', 240, 91, { size: 6.5, color: C.muted, align: 'center' });

  // Große, langsam drehende Münze
  drawCoin(ui.ctx, 'gold', 'big', g.time * 2.2, 240, 126, 1);

  const today = dailySeed();
  const dateStr = new Date().toLocaleDateString('de-DE');
  if (ui.button('new', 180, 158, 120, 22, 'Neuer Run', { primary: true, size: 8, sub: 'Enter' })) g.startRun();
  if (ui.button('daily', 180, 184, 120, 22, 'Tagesrun', { size: 8, sub: `${dateStr} · für alle gleich` })) g.startRun(undefined, true);
  if (ui.button('coll', 180, 210, 58, 18, 'Sammlung', { size: 6.5 })) {
    g.collectionBack = 'menu';
    g.scene = 'collection';
  }
  if (ui.button('mute', 242, 210, 58, 18, isMuted() ? 'Ton aus' : 'Ton an', { size: 6.5 })) toggleMute();

  const unlocked = [...COINS, ...RELICS].filter((d) => isUnlocked(m, d.id)).length;
  const total = COINS.length + RELICS.length;
  const best = m.dailyBest[today];
  ui.text(
    `Bester Run: Runde ${m.bestRound || '–'}  ·  Runs: ${m.runs}  ·  Sammlung: ${unlocked}/${total}${best ? `  ·  Heute: Runde ${best}` : ''}`,
    240,
    244,
    { size: 6, color: C.muted, align: 'center' },
  );
  ui.text('Steuerung: Klick oder 1–3 / Leertaste werfen · F = Tempo · M = Ton', 240, 258, { size: 5.5, color: C.dim, align: 'center' });
}

export function drawGameOver(g: Game): void {
  const ui = g.ui;
  const run = g.run!;
  ui.ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ui.ctx.fillRect(0, 0, 480, 270);
  const h = 150 + (g.unlockedNow.length ? 12 + g.unlockedNow.length * 9 : 0);
  const y = Math.round(135 - h / 2);
  ui.panel(130, y, 220, h, { fill: 'rgba(16,10,6,0.97)', border: '#8a2a24' });
  ui.text('PLEITE!', 240, y + 28, { size: 24, pixel: true, color: C.red, align: 'center' });
  ui.text(`Quota verfehlt in Runde ${run.round}: ${fmt(run.roundGold)} / ${fmt(run.quota)}`, 240, y + 42, { size: 7, color: C.text, align: 'center' });

  const stats: [string, string][] = [
    ['Gold gesamt', fmt(run.stats.totalGold)],
    ['Kopf / Zahl / Rand', `${run.stats.heads} / ${run.stats.tails} / ${run.stats.edges}`],
    ['Beste Serie', `${run.stats.bestStreak}×`],
    ['Bester Wurf', `${fmt(run.stats.bestFlip)} Gold`],
    ['Seed', run.seed],
  ];
  stats.forEach(([k, v], i) => {
    ui.text(k, 146, y + 58 + i * 10, { size: 6.5, color: C.muted });
    ui.text(v, 334, y + 58 + i * 10, { size: 6.5, weight: 700, color: C.text, align: 'right' });
  });
  let yy = y + 112;
  if (g.unlockedNow.length) {
    ui.text('Neu freigeschaltet:', 146, yy, { size: 6.5, weight: 700, color: C.blue });
    g.unlockedNow.forEach((n, i) => ui.text('★ ' + n, 152, yy + 9 + i * 9, { size: 6.5, color: C.blue }));
    yy += 12 + g.unlockedNow.length * 9;
  }
  const by = y + h - 30;
  if (ui.button('again', 140, by, 64, 20, 'Neuer Run', { primary: true, size: 6.5 })) g.startRun();
  if (ui.button('same', 208, by, 64, 20, 'Gleicher Seed', { size: 6.5 })) g.startRun(run.seed, run.daily);
  if (ui.button('menu', 276, by, 64, 20, 'Menü', { size: 6.5 })) {
    g.run = null;
    g.unlockedNow = [];
    g.scene = 'menu';
  }
}

export function drawCollection(g: Game): void {
  const ui = g.ui;
  const m = g.meta;
  ui.text('SAMMLUNG', 240, 20, { size: 16, pixel: true, color: C.gold, align: 'center' });
  ui.text('Spiele, um gesperrte Münzen und Relikte freizuschalten. Sie tauchen dann im Shop auf.', 240, 31, { size: 6, color: C.muted, align: 'center' });

  const cell = (id: string, name: string, desc: string, rarity: string, hint: string | undefined, x: number, y: number, isCoin: boolean) => {
    const open = isUnlocked(m, id);
    const over = ui.hot('col' + id, x, y, 34, 34);
    ui.panel(x, y, 34, 34, { fill: over ? C.panelHi : C.panel, border: over ? C.borderHi : open ? C.border : '#2e2418' });
    if (!open) ui.ctx.filter = 'brightness(0) opacity(0.6)';
    if (isCoin) drawCoin(ui.ctx, id, 'small', 0, x + 17, y + 17);
    else drawRelicIcon(ui.ctx, id, x + 17, y + 17, 1.4);
    ui.ctx.filter = 'none';
    if (!open) ui.text('?', x + 17, y + 20, { size: 8, pixel: true, color: C.dim, align: 'center' });
    if (over) {
      if (open) ui.tooltip(name, desc, RARITY_COLOR[rarity]);
      else ui.tooltip('Gesperrt', hint ?? '', C.dim);
    }
  };

  ui.text('MÜNZEN', 24, 48, { size: 6.5, weight: 700, color: C.muted });
  COINS.forEach((c, i) => cell(c.id, c.name, c.desc, c.rarity, c.unlock?.hint, 24 + (i % 12) * 36, 52, true));
  ui.text('RELIKTE', 24, 100, { size: 6.5, weight: 700, color: C.muted });
  RELICS.forEach((r, i) => cell(r.id, r.name, r.desc, r.rarity, r.unlock?.hint, 24 + (i % 12) * 36, 104 + Math.floor(i / 12) * 38, false));

  const stats: [string, string][] = [
    ['Runs', String(m.runs)],
    ['Beste Runde', String(m.bestRound)],
    ['Kopf insgesamt', fmt(m.totalHeads)],
    ['Rand-Landungen', String(m.totalEdges)],
    ['Beste Serie', `${m.bestStreak}×`],
    ['Bester Wurf', fmt(m.bestFlip)],
    ['Bosse besiegt', String(m.bossesBeaten)],
  ];
  stats.forEach(([k, v], i) => {
    const x = 24 + (i % 4) * 110;
    const y = 200 + Math.floor(i / 4) * 12;
    ui.text(k, x, y, { size: 6, color: C.muted });
    ui.text(v, x + 100, y, { size: 6, weight: 700, color: C.text, align: 'right' });
  });
  if (ui.button('back', 200, 236, 80, 20, '← Zurück', { sub: 'Esc' })) g.scene = g.collectionBack;
}
