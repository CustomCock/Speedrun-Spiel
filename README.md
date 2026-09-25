# Speedrun-Spiel (3D / First-Person)

Ein First-Person-Parkour-Speedrun im Browser, gebaut mit Three.js. Einfach `index.html` öffnen (läuft auch offline, Three.js liegt unter `vendor/`).

## Steuerung

| Taste | Aktion |
|---|---|
| `W` `A` `S` `D` / Pfeiltasten | Laufen |
| Maus | Umsehen (Pointer Lock, Klick ins Spiel) |
| `SHIFT` | Sprinten |
| `SPACE` | Springen (kurz tippen = kleiner Sprung) |
| `C` | Ducken |
| `R` | Neustart |
| `ESC` | Pause (Maus freigeben) |

Ducken liegt bewusst auf `C` und nicht auf `STRG`, weil `STRG`+`W` im Browser den Tab schließt.

## Mechaniken

- **Ducken** geht nur ohne Sprint: halbe Höhe, aber nur 2 m/s.
- **Sprinten + Ducken = Rutschen**: du schießt mit Extra-Tempo unter Tunnel durch. Der Rutsch bremst nach ca. 8 m aus, danach bist du geduckt.
- **Beim Rutschen springen = Rutsch-Sprung**: deutlich höher (ca. 2 m statt 1,3 m) und weiter (bis ca. 9 m statt 4,8 m). Nötig für hohe Wände und weite Lücken.
- Rote Zonen oder Lava = zurück zum letzten Checkpoint. Die Uhr läuft weiter.
- Die Zeit startet mit deiner ersten Bewegung. Bestzeit und ein Geist deines besten Laufs werden lokal im Browser gespeichert.

Die Strecke ist rund 580 m lang und auf etwa 1½ Minuten für einen sauberen Lauf ausgelegt (ein Autopilot ohne Optimierung braucht ~85 s). Wer Rutsch-Sprünge aneinanderreiht, ist deutlich schneller unterwegs.

## Tuning

Alle Physik-Werte stehen oben in `index.html` als Konstanten (Gravitation, Geschwindigkeiten, Sprungkraft, Rutsch-Reibung). Die Strecke wird in `buildLevel()` aus Abschnitten zusammengesetzt; die Positionen sind Meter entlang des Korridors.
