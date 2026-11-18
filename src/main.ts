/**
 * EINSTIEGSPUNKT – hier startet alles.
 * 1. Schriften laden (Inter für UI/Zahlen, Silkscreen als Pixel-Schrift für Titel)
 * 2. Grafiken erzeugen/laden
 * 3. Spiel starten
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/silkscreen/400.css';
import { Game } from './core/game';
import { loadAssets } from './render/assets';

async function boot(): Promise<void> {
  // Canvas kennt Schriften erst, wenn sie geladen sind – deshalb vorher anfordern.
  await Promise.all(
    ['500 10px Inter', '600 10px Inter', '700 10px Inter', '800 10px Inter', '10px Silkscreen'].map((f) => document.fonts.load(f).catch(() => null)),
  );
  await loadAssets();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  game.start();
  // Für Neugierige: in der Browser-Konsole ist das Spiel als "cockflip" erreichbar.
  (window as unknown as { cockflip: Game }).cockflip = game;
}

void boot();
