/**
 * SHOP-ANSICHT ("Der Hehler")
 *   oben     5 Angebote (3 Münzen, 2 Relikte)
 *   Mitte    Aktionen: Neu würfeln, Aufwerten, Entfernen, Relikt verkaufen, Weiter
 *   unten    dein Deck und deine Relikte (anklickbar beim Aufwerten/Entfernen/Verkaufen)
 */
import { sfx } from '../audio/sfx';
import type { Game } from '../core/game';
import { coinDef, relicDef } from '../core/registry';
import { buy, removeCoin, reroll, sellRelic, upgradeCoin, type ShopResult } from '../core/shop';
import { BALANCE, RELIC_PRICE } from '../data/balance';
import { drawCoin, drawRelicIcon } from '../render/assets';
import { C, RARITY_COLOR, RARITY_NAME, fmt } from './draw';

function feedback(g: Game, res: ShopResult): void {
  if (res.ok) sfx.buy();
  else {
    sfx.error();
    if (res.reason) g.say(res.reason);
  }
}

export function drawShop(g: Game): void {
  const run = g.run!;
  const shop = run.shop!;
  const ui = g.ui;

  // Kopfzeile
  ui.text('DER HEHLER', 240, 18, { size: 16, pixel: true, color: C.gold, align: 'center' });
  ui.text(`Runde ${run.round} geschafft – nächste Runde: ${run.round + 1}${(run.round + 1) % BALANCE.bossEvery === 0 ? ' (BOSS!)' : ''}`, 240, 27, { size: 6, color: C.muted, align: 'center' });
  drawCoin(ui.ctx, 'gold', 'small', 0, 430, 15, 0.6);
  ui.text(fmt(g.shown.gold), 440, 18.5, { size: 10, weight: 800, color: C.gold });

  // ------------------------------------------------------------ Angebote
  const cw = 84;
  const gap = 6;
  const x0 = Math.round(240 - (5 * cw + 4 * gap) / 2);
  shop.offers.forEach((o, i) => {
    const x = x0 + i * (cw + gap);
    const y = 34;
    const h = 104;
    const isCoin = o.kind === 'coin';
    const def = isCoin ? coinDef(o.defId) : relicDef(o.defId);
    const over = !o.sold && ui.hot('offer' + i, x, y, cw, h);
    ui.panel(x, y, cw, h, { fill: over ? C.panelHi : C.panel, border: over ? C.borderHi : C.border, glow: over });
    if (o.sold) {
      ui.text('VERKAUFT', x + cw / 2, y + h / 2, { size: 8, pixel: true, color: C.dim, align: 'center' });
      return;
    }
    ui.text(isCoin ? 'MÜNZE' : 'RELIKT', x + 6, y + 9, { size: 5, weight: 800, color: C.dim });
    ui.text(RARITY_NAME[def.rarity], x + cw - 6, y + 9, { size: 5, weight: 700, color: RARITY_COLOR[def.rarity], align: 'right' });
    if (isCoin) drawCoin(ui.ctx, o.defId, 'big', Math.sin(g.time * 1.4 + i) * 0.5, x + cw / 2, y + 32);
    else drawRelicIcon(ui.ctx, o.defId, x + cw / 2, y + 32, 2);
    ui.text(def.name, x + cw / 2, y + 62, { size: 6.5, weight: 700, color: RARITY_COLOR[def.rarity], align: 'center', maxWidth: cw - 6 });
    ui.paragraph(def.desc, x + 5, y + 71, cw - 10, { size: 5, color: C.muted });
    const afford = run.gold >= o.price;
    if (ui.button('buy' + i, x + 6, y + h - 18, cw - 12, 14, `${fmt(o.price)} Gold`, { size: 6.5, primary: afford, enabled: afford })) {
      feedback(g, buy(run, i));
    }
  });

  // ------------------------------------------------------------ Aktionen
  const ay = 144;
  if (ui.button('reroll', 18, ay, 84, 22, 'Neu würfeln', { sub: `${shop.rerollCost} Gold`, enabled: run.gold >= shop.rerollCost })) {
    feedback(g, reroll(run, g.unlockCheck));
  }
  const modeBtn = (id: string, x: number, label: string, cost: string, mode: 'upgrade' | 'remove' | 'sell', enabled: boolean) => {
    const on = g.shopMode === mode;
    if (ui.button(id, x, ay, 84, 22, on ? 'Abbrechen' : label, { sub: on ? 'Esc' : cost, enabled: enabled || on, danger: on })) {
      g.shopMode = on ? 'none' : mode;
    }
  };
  modeBtn('upg', 108, 'Aufwerten', `${shop.upgradeCost} Gold`, 'upgrade', run.gold >= shop.upgradeCost);
  modeBtn('rem', 198, 'Entfernen', `${shop.removeCost} Gold`, 'remove', run.gold >= shop.removeCost && run.deck.length > BALANCE.minDeckSize);
  modeBtn('sell', 288, 'Relikt verkaufen', 'halber Preis', 'sell', run.relics.length > 0);
  if (ui.button('next', 378, ay, 84, 22, 'Weiter →', { primary: true, sub: 'Enter' })) g.leaveShop();

  const hint =
    g.shopMode === 'upgrade'
      ? `Wähle eine Münze: +${BALANCE.upgradeValue} Gold-Wert und +${BALANCE.upgradeChance * 100} % Kopf-Chance (max. Stufe ${BALANCE.maxCoinLevel})`
      : g.shopMode === 'remove'
        ? 'Wähle eine Münze, die du loswerden willst'
        : g.shopMode === 'sell'
          ? 'Wähle ein Relikt zum Verkaufen'
          : '';
  if (g.messageTime > 0) ui.text(g.message, 240, 175, { size: 7, weight: 700, color: C.red, align: 'center' });
  else if (hint) ui.text(hint, 240, 175, { size: 6.5, weight: 600, color: C.blue, align: 'center' });

  // ------------------------------------------------------------ Deck
  ui.panel(6, 180, 330, 86);
  ui.text(`DEIN DECK (${run.deck.length})`, 14, 191, { size: 6, weight: 700, color: C.muted });
  const sorted = [...run.deck].sort((a, b) => a.defId.localeCompare(b.defId) || b.level - a.level);
  sorted.forEach((coin, i) => {
    const col = i % 11;
    const row = Math.floor(i / 11);
    const x = 14 + col * 29;
    const y = 196 + row * 34;
    const def = coinDef(coin.defId);
    const selectable = g.shopMode === 'upgrade' || g.shopMode === 'remove';
    const over = ui.hot('deck' + coin.uid, x, y, 27, 32);
    if (over || selectable) {
      ui.ctx.fillStyle = over ? (selectable ? (g.shopMode === 'remove' ? 'rgba(255,90,80,0.25)' : 'rgba(255,210,120,0.22)') : 'rgba(255,255,255,0.06)') : 'rgba(255,210,120,0.06)';
      ui.ctx.fillRect(x, y, 27, 32);
    }
    drawCoin(ui.ctx, coin.defId, 'small', 0, x + 13.5, y + 14);
    for (let l = 0; l < coin.level; l++) {
      ui.ctx.fillStyle = C.gold;
      ui.ctx.fillRect(x + 4 + l * 4, y + 28, 3, 2);
    }
    if (over) {
      ui.tooltip(def.name, `${def.desc}${coin.level ? ` (Stufe ${coin.level})` : ''}`, RARITY_COLOR[def.rarity]);
      if (g.input.clicked && g.shopMode === 'upgrade') {
        const res = upgradeCoin(run, coin.uid);
        feedback(g, res);
        if (res.ok) g.shopMode = 'none';
      } else if (g.input.clicked && g.shopMode === 'remove') {
        const res = removeCoin(run, coin.uid);
        feedback(g, res);
        if (res.ok) g.shopMode = 'none';
      }
    }
  });

  // ------------------------------------------------------------ Relikte
  ui.panel(342, 180, 132, 86);
  ui.text(`RELIKTE ${run.relics.length}/${run.maxRelics}`, 350, 191, { size: 6, weight: 700, color: C.muted });
  run.relics.forEach((r, i) => {
    const def = relicDef(r.defId);
    const y = 196 + i * 14;
    const over = ui.hot('srelic' + i, 348, y, 120, 13);
    if (over) {
      ui.ctx.fillStyle = g.shopMode === 'sell' ? 'rgba(255,90,80,0.25)' : 'rgba(255,255,255,0.06)';
      ui.ctx.fillRect(348, y, 120, 13);
    }
    drawRelicIcon(ui.ctx, r.defId, 356, y + 6.5, 0.85);
    ui.text(def.name, 366, y + 9, { size: 6, weight: 600, color: RARITY_COLOR[def.rarity], maxWidth: 80 });
    if (g.shopMode === 'sell') ui.text(`+${Math.floor(RELIC_PRICE[def.rarity] / 2)}`, 466, y + 9, { size: 6, weight: 700, color: C.gold, align: 'right' });
    if (over) {
      ui.tooltip(def.name, def.desc, RARITY_COLOR[def.rarity]);
      if (g.input.clicked && g.shopMode === 'sell') {
        feedback(g, sellRelic(run, i));
        g.shopMode = 'none';
      }
    }
  });
}
