/**
 * HUD während einer Runde:
 *   oben         Runde, Quota-Balken, Würfe, Geldbeutel
 *   links        Kopf-Chance, Serie, Pech-Meter
 *   rechts       Relikte (+ Boss-Info)
 *   unten        Münzen auf der Hand, Werfen-Button, Seed
 */
import { isMuted, toggleMute } from '../audio/sfx';
import { previewChance, relicsActive, streakMult, effectiveDef } from '../core/flip';
import type { Game } from '../core/game';
import { bossDef, coinDef, relicDef } from '../core/registry';
import { BALANCE } from '../data/balance';
import { drawCoin, drawRelicIcon } from '../render/assets';
import { C, RARITY_COLOR, RARITY_NAME, fmt, num, pct } from './draw';

/** Position einer Handkarte (wird auch für den Startpunkt des Wurfs benutzt) */
export function handCardRect(n: number, i: number): { x: number; y: number; w: number; h: number } {
  const w = 70;
  const h = 60;
  const gap = 8;
  const total = n * w + (n - 1) * gap;
  const x0 = Math.round(240 - total / 2);
  return { x: x0 + i * (w + gap), y: 204, w, h };
}

let menuConfirm = 0;

export function drawPlay(g: Game, passive = false): void {
  const run = g.run!;
  const ui = g.ui;
  const interactive = !passive && (g.play === 'idle' || g.play === 'intro');
  const streak = g.frozen?.streak ?? run.streak;
  const luck = g.frozen?.luck ?? run.luck;
  const hand = g.frozen?.hand ?? run.hand;
  const boss = run.boss ? bossDef(run.boss) : null;
  if (g.selected >= hand.length) g.selected = Math.max(0, hand.length - 1);

  // ------------------------------------------------------------ oben
  ui.panel(6, 4, 468, 20);
  ui.text(`RUNDE ${run.round}`, 14, 17.5, { size: 8, pixel: true, color: C.gold });
  if (boss) ui.text('BOSS', 82, 17.5, { size: 8, pixel: true, color: C.red });

  const qx = 160;
  const qw = 170;
  const frac = g.shown.roundGold / run.quota;
  ui.text('QUOTA', qx - 5, 16.5, { size: 6, weight: 700, color: C.muted, align: 'right' });
  ui.bar(qx, 8, qw, 12, frac, frac >= 1 ? C.green : C.goldDeep);
  ui.text(`${fmt(g.shown.roundGold)} / ${fmt(run.quota)}`, qx + qw / 2, 14.5, { size: 7, weight: 700, align: 'center', baseline: 'middle' });

  ui.text('WÜRFE', 352, 16.5, { size: 6, weight: 700, color: C.muted, align: 'right' });
  ui.text(String(run.flipsLeft), 356, 17, { size: 9, weight: 800, color: run.flipsLeft <= 2 ? C.red : C.text });
  drawCoin(ui.ctx, 'gold', 'small', 0, 392, 14, 0.5);
  ui.text(fmt(g.shown.gold), 400, 17, { size: 9, weight: 800, color: C.gold });
  ui.text('Beutel', 468, 16.5, { size: 5.5, color: C.dim, align: 'right' });

  // ------------------------------------------------------------ links
  const lx = 6;
  const ly = 28;
  ui.panel(lx, ly, 104, 170);
  const selUid = hand[g.selected];
  let chance = 0.5;
  let edge: number = BALANCE.edgeChance;
  let guaranteed = false;
  let coinMult = 0;
  if (g.pending) {
    chance = g.pending.chance;
  } else if (selUid !== undefined) {
    const p = previewChance(run, selUid);
    chance = p.heads;
    edge = p.edge;
    guaranteed = p.guaranteed;
    const c = run.deck.find((d) => d.uid === selUid);
    if (c) coinMult = effectiveDef(run, c.defId).mult ?? 0;
  }
  ui.text('KOPF-CHANCE', lx + 52, ly + 12, { size: 6, weight: 700, color: C.muted, align: 'center' });
  const hidden = boss?.hideChance && !guaranteed;
  const chanceStr = hidden ? '??' : guaranteed ? '100%' : pct(chance).replace(' ', '');
  const chanceCol = hidden ? C.purple : guaranteed ? C.green : chance >= 0.5 ? C.gold : '#ff9a6a';
  ui.text(chanceStr, lx + 52, ly + 34, { size: 16, pixel: true, color: chanceCol, align: 'center' });
  ui.bar(lx + 10, ly + 40, 84, 4, hidden ? 0 : guaranteed ? 1 : chance, chanceCol);
  ui.text(`Rand: ${hidden ? '?' : pct(edge, 1)}`, lx + 52, ly + 52, { size: 5.5, color: C.dim, align: 'center' });

  ui.ctx.fillStyle = C.border;
  ui.ctx.fillRect(lx + 8, ly + 58, 88, 1);

  ui.text('SERIE', lx + 8, ly + 70, { size: 6, weight: 700, color: C.muted });
  ui.text(`${streak}×`, lx + 96, ly + 70.5, { size: 9, weight: 800, color: streak > 0 ? C.gold : C.dim, align: 'right' });
  // Serien-Flammen
  for (let i = 0; i < 10; i++) {
    const on = i < streak;
    ui.ctx.fillStyle = on ? (i >= 6 ? '#ff6a2a' : i >= 3 ? '#ffb040' : C.gold) : 'rgba(255,255,255,0.08)';
    ui.ctx.fillRect(lx + 8 + i * 9, ly + 75, 7, 4);
  }
  ui.text('Mult beim nächsten Kopf', lx + 8, ly + 89, { size: 5.5, color: C.dim });
  ui.text(num(streakMult(streak + 1) + coinMult), lx + 96, ly + 89.5, { size: 7, weight: 800, color: C.blue, align: 'right' });

  ui.ctx.fillStyle = C.border;
  ui.ctx.fillRect(lx + 8, ly + 96, 88, 1);

  ui.text('PECH-METER', lx + 8, ly + 108, { size: 6, weight: 700, color: C.muted });
  ui.text(`${luck}/${run.luckMax}`, lx + 96, ly + 108, { size: 6.5, weight: 700, color: C.purple, align: 'right' });
  const segW = (88 - (run.luckMax - 1) * 2) / run.luckMax;
  for (let i = 0; i < run.luckMax; i++) {
    const on = i < luck;
    const pulse = luck >= run.luckMax - 1 && on ? 0.15 * Math.sin(g.time * 8) : 0;
    ui.ctx.fillStyle = on ? `rgba(197,140,255,${0.85 + pulse})` : 'rgba(255,255,255,0.08)';
    ui.ctx.fillRect(lx + 8 + i * (segW + 2), ly + 112, segW, 6);
  }
  ui.text('Zahl füllt es. Voll: Glück oder Fluch.', lx + 8, ly + 126, { size: 5, color: C.dim });

  ui.ctx.fillStyle = C.border;
  ui.ctx.fillRect(lx + 8, ly + 132, 88, 1);
  const o = g.lastOutcome;
  if (o) {
    ui.text('LETZTER WURF', lx + 8, ly + 143, { size: 5.5, weight: 700, color: C.muted });
    const calc = o.side === 'tails' ? `Zahl → ${fmt(o.gold)}` : `${fmt(o.chips)} × ${num(o.mult)} × ${num(o.xMult)} = ${fmt(o.gold)}`;
    ui.text(calc, lx + 8, ly + 153, { size: 6, weight: 700, color: o.side === 'tails' ? C.muted : C.gold, maxWidth: 88 });
  }
  ui.text(`Deck ${run.deck.length} · Stapel ${run.drawPile.length}`, lx + 8, ly + 165, { size: 5.5, color: C.dim });

  // ------------------------------------------------------------ rechts: Relikte
  const rx = 370;
  const ry = 28;
  ui.panel(rx, ry, 104, 170);
  ui.text('RELIKTE', rx + 8, ry + 12, { size: 6, weight: 700, color: C.muted });
  ui.text(`${run.relics.length}/${run.maxRelics}`, rx + 96, ry + 12, { size: 6, weight: 700, color: C.dim, align: 'right' });
  const active = relicsActive(run);
  for (let i = 0; i < run.maxRelics; i++) {
    const y = ry + 18 + i * 19;
    const r = run.relics[i];
    if (!r) {
      ui.ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ui.ctx.fillRect(rx + 6, y, 92, 16);
      continue;
    }
    const def = relicDef(r.defId);
    const over = !passive && ui.hot('relic' + i, rx + 6, y, 92, 16);
    ui.ctx.fillStyle = over ? 'rgba(255,210,120,0.12)' : 'rgba(255,255,255,0.05)';
    ui.ctx.fillRect(rx + 6, y, 92, 16);
    ui.ctx.globalAlpha = active ? 1 : 0.35;
    drawRelicIcon(ui.ctx, r.defId, rx + 14, y + 8);
    ui.text(def.name, rx + 24, y + 10.5, { size: 6, weight: 600, color: RARITY_COLOR[def.rarity], maxWidth: 72 });
    ui.ctx.globalAlpha = 1;
    if (over) ui.tooltip(def.name, def.desc + (active ? '' : ' (Gerade stumm – Pantomime!)'), RARITY_COLOR[def.rarity]);
  }
  if (boss) {
    const by = ry + 118;
    ui.panel(rx + 4, by, 96, 48, { fill: 'rgba(60,10,10,0.6)', border: '#8a2a24' });
    ui.text('BOSS', rx + 10, by + 10, { size: 5.5, weight: 800, color: C.red });
    ui.text(boss.name, rx + 10, by + 19, { size: 6.5, weight: 700, color: C.text, maxWidth: 86 });
    ui.paragraph(boss.desc, rx + 10, by + 27, 86, { size: 5, color: C.muted });
  }

  // ------------------------------------------------------------ Hand
  hand.forEach((uid, i) => {
    const coin = run.deck.find((d) => d.uid === uid);
    if (!coin) return;
    const def = coinDef(coin.defId);
    const r = handCardRect(hand.length, i);
    const over = interactive && ui.hot('card' + i, r.x, r.y, r.w, r.h);
    if (over) g.selected = i;
    const sel = i === g.selected && interactive;
    const lift = over ? -4 : sel ? -2 : 0;
    ui.panel(r.x, r.y + lift, r.w, r.h, { fill: over ? C.panelHi : C.panel, border: sel ? C.borderHi : C.border, glow: over });
    ui.text(String(i + 1), r.x + 5, r.y + lift + 9, { size: 6, weight: 700, color: C.dim });
    for (let l = 0; l < coin.level; l++) {
      ui.ctx.fillStyle = C.gold;
      ui.ctx.fillRect(r.x + r.w - 7 - l * 4, r.y + lift + 4, 3, 3);
    }
    const bob = over ? Math.sin(g.time * 5) * 0.4 : 0;
    drawCoin(ui.ctx, coin.defId, 'small', over ? Math.sin(g.time * 3) * 0.35 : 0, r.x + r.w / 2, r.y + lift + 18 + bob);
    ui.text(def.name, r.x + r.w / 2, r.y + lift + 40, { size: 6, weight: 700, align: 'center', color: RARITY_COLOR[def.rarity], maxWidth: r.w - 6 });
    const p = previewChance(run, uid);
    const ch = boss?.hideChance && !p.guaranteed ? '??' : p.guaranteed ? '100 %' : pct(p.heads);
    ui.text(ch, r.x + 6, r.y + lift + 52, { size: 6.5, weight: 700, color: C.text });
    ui.text(`${coinDef(effectiveDef(run, coin.defId).id).value + coin.level * BALANCE.upgradeValue} G`, r.x + r.w - 6, r.y + lift + 52, { size: 6.5, weight: 700, color: C.gold, align: 'right' });
    if (over) {
      ui.tooltip(def.name, `${def.desc} — Wert ${def.value} Gold${coin.level ? `, Stufe ${coin.level}` : ''}. ${RARITY_NAME[def.rarity]}.`, RARITY_COLOR[def.rarity]);
      if (g.input.clicked) g.flip(i);
    }
  });

  // ------------------------------------------------------------ unten links
  if (!passive) {
    if (ui.button('flip', 6, 204, 104, 34, 'WERFEN', { primary: true, size: 9, enabled: interactive && hand.length > 0, sub: 'Leertaste · 1–3' })) g.flip(g.selected);
    if (ui.button('speed', 6, 242, 50, 22, g.speed === 2 ? 'Tempo 2×' : 'Tempo 1×', { size: 6, sub: 'F' })) g.toggleSpeed();
    if (ui.button('mute', 60, 242, 50, 22, isMuted() ? 'Ton aus' : 'Ton an', { size: 6, sub: 'M' })) toggleMute();
  }

  // ------------------------------------------------------------ unten rechts
  ui.panel(370, 204, 104, 60);
  ui.text(run.daily ? 'TAGESRUN' : 'SEED', 378, 216, { size: 5.5, weight: 700, color: run.daily ? C.green : C.muted });
  ui.text(run.seed, 378, 226, { size: 7, weight: 700, color: C.text, maxWidth: 90 });
  if (!passive) {
    menuConfirm = Math.max(0, menuConfirm - 1 / 60);
    if (ui.button('menu', 376, 236, 92, 22, menuConfirm > 0 ? 'Run aufgeben?' : 'Menü', { size: 6.5, danger: menuConfirm > 0 })) {
      if (menuConfirm > 0) {
        menuConfirm = 0;
        g.backToMenu();
        return;
      }
      menuConfirm = 2.5;
    }
  }

  // ------------------------------------------------------------ Runde geschafft
  if (g.play === 'roundWon' && !passive) drawRoundWon(g);

  if (g.messageTime > 0) ui.text(g.message, 240, 198, { size: 7, weight: 700, color: C.red, align: 'center' });
}

function drawRoundWon(g: Game): void {
  const ui = g.ui;
  const run = g.run!;
  const lines = g.rewardLines;
  const h = 78 + lines.length * 11 + (g.unlockedNow.length ? 12 + g.unlockedNow.length * 9 : 0);
  const x = 140;
  const y = Math.round(118 - h / 2);
  ui.ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ui.ctx.fillRect(0, 0, 480, 270);
  ui.panel(x, y, 200, h, { fill: 'rgba(16,10,6,0.96)', border: C.borderHi });
  ui.text('QUOTA ERFÜLLT!', 240, y + 18, { size: 16, pixel: true, color: C.green, align: 'center' });
  let yy = y + 34;
  for (const l of lines) {
    ui.text(l.label, x + 14, yy, { size: 6.5, color: C.text });
    ui.text(l.gold ? `+${fmt(l.gold)}` : '', x + 186, yy, { size: 6.5, weight: 700, color: C.gold, align: 'right' });
    yy += 11;
  }
  ui.ctx.fillStyle = C.border;
  ui.ctx.fillRect(x + 12, yy - 6, 176, 1);
  ui.text('Beutel', x + 14, yy + 4, { size: 7, weight: 700, color: C.muted });
  ui.text(`${fmt(run.gold)} Gold`, x + 186, yy + 4, { size: 8, weight: 800, color: C.gold, align: 'right' });
  yy += 14;
  if (g.unlockedNow.length) {
    ui.text('Freigeschaltet:', x + 14, yy, { size: 6, weight: 700, color: C.blue });
    g.unlockedNow.forEach((n, i) => ui.text('★ ' + n, x + 20, yy + 9 + i * 9, { size: 6, color: C.blue }));
    yy += 12 + g.unlockedNow.length * 9;
  }
  if (ui.button('toShop', 190, y + h - 26, 100, 20, 'Zum Hehler →', { primary: true })) {
    g.unlockedNow = [];
    g.goShop();
  }
}
