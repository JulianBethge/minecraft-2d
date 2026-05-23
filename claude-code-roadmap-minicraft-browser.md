# Claude Code Roadmap: MiniCraft Browser

## Ziel

Wir bauen ein kleines **Minecraft-inspiriertes 2D-Browsergame** mit:

- HTML
- CSS
- JavaScript
- Canvas API
- Claude Code als Schritt-für-Schritt-Assistent

Das Projekt ist für einen 13-jährigen Anfänger gedacht. Ziel ist nicht Perfektion, sondern ein sichtbares Erfolgserlebnis: **eine kleine spielbare Blockwelt im Browser**.

---

## Grundprinzip

Wir bauen kein echtes Minecraft.

Wir bauen ein kleines Browsergame mit diesen Kernideen:

- Eine Welt aus Blöcken
- Spieler bewegt sich auf einem Raster
- Blöcke können abgebaut werden
- Ressourcen landen im Inventar
- Blöcke können wieder gesetzt werden
- Am Ende gibt es ein kleines Ziel oder eine kleine Bauaufgabe

---

## Arbeitsweise mit Claude Code

Claude Code soll nicht einfach alles auf einmal bauen.

Claude Code soll:

1. immer nur **einen kleinen Schritt** machen
2. vor größeren Entscheidungen **offene Fragen stellen**
3. Code verständlich erklären
4. nach jeder Änderung sagen, **wie wir testen**
5. keine unnötig komplizierte Architektur bauen
6. keine Frameworks am Anfang verwenden
7. keine npm-Abhängigkeiten verwenden
8. keinen TypeScript-Code verwenden
9. keine Klassen verwenden, solange Funktionen und Objekte ausreichen
10. Anfänger-Kommentare im Code schreiben

---

## Technischer Rahmen

```text
Projektname: MiniCraft Browser
Stack: HTML, CSS, JavaScript
Rendering: Canvas API
Framework: keines am Anfang
Dateien: index.html, style.css, game.js
Zielplattform: Browser auf Zorin OS / Linux
```

---

## Projektstruktur

```text
minicraft-browser/
├── index.html
├── style.css
├── game.js
├── README.md
├── ROADMAP.md
└── assets/
    ├── player.png
    ├── grass.png
    ├── water.png
    ├── stone.png
    ├── wood.png
    └── sand.png
```

Am Anfang brauchen wir nur:

```text
minicraft-browser/
├── index.html
├── style.css
└── game.js
```

---

## Setup auf Zorin OS

### Projektordner erstellen

```bash
mkdir -p ~/projects/minicraft-browser
cd ~/projects/minicraft-browser

touch index.html style.css game.js README.md ROADMAP.md
mkdir -p assets
```

### VS Code öffnen

```bash
code .
```

Falls `code .` nicht geht, VS Code über das Startmenü öffnen und den Ordner manuell öffnen.

### Lokalen Server starten

```bash
cd ~/projects/minicraft-browser
python3 -m http.server 8000
```

Dann im Browser öffnen:

```text
http://localhost:8000
```

---

# Master-Prompt für Claude Code

Diesen Prompt zuerst in Claude Code einfügen:

```markdown
Wir bauen zusammen ein kleines Browsergame namens "MiniCraft Browser".

Kontext:
- Das Projekt ist für einen 13-jährigen Anfänger.
- Er hat keine Programmiererfahrung.
- Wir nutzen Zorin OS / Linux.
- Wir wollen HTML, CSS und JavaScript lernen.
- Das Spiel soll Minecraft-inspiriert sein, aber bewusst klein bleiben.
- Wir bauen mit Canvas API.
- Keine Frameworks am Anfang.
- Kein npm.
- Kein TypeScript.
- Keine Klassen, solange es einfacher mit Funktionen und Objekten geht.

Deine Aufgabe:
- Führe uns Schritt für Schritt.
- Erkläre verständlich, was du machst.
- Stelle offene Fragen, wenn es um Design, Spielregeln oder Stil geht.
- Mache immer nur kleine Änderungen.
- Nach jeder Änderung sagst du:
  1. Was wurde geändert?
  2. Was sollen wir testen?
  3. Was ist der nächste sinnvolle Schritt?

Wichtig:
- Code soll einfach und anfängerfreundlich sein.
- Bitte viele kurze Kommentare im Code.
- Keine großen Umbauten ohne Nachfrage.
- Lieber ein kleines fertiges Spiel als ein großes halbfertiges Projekt.

Erstelle als ersten Schritt bitte eine minimale Version mit:
- index.html
- style.css
- game.js
- Canvas im Browser
- Titel "MiniCraft Browser"
- farbigem Hintergrund
- einer sichtbaren Spielfigur als Quadrat

Danach stoppst du und gibst uns einen Testschritt.
```

---

# Offene Entscheidungen vor dem Start

Diese Fragen nicht alle theoretisch beantworten. Sie dienen als Entscheidungsboard während des Projekts.

## Spielname

Mögliche Namen:

- MiniCraft Browser
- Block Island
- Pixel Builder
- Tiny Blocks
- Crafty Island
- Island Builder

**Unsere Entscheidung:**

```text
Spielname: ____________________________
```

---

## Perspektive

Optionen:

1. Top-down wie eine Karte
2. Seitlich wie ein 2D-Plattformer
3. Isometrisch, also schräg von oben

Empfehlung für den Anfang:

```text
Top-down
```

**Unsere Entscheidung:**

```text
Perspektive: ____________________________
```

---

## Welt-Thema

Optionen:

1. Insel
2. Wald
3. Höhle
4. Dorf
5. Fortnite-artige Arena von oben
6. Fantasie-Welt

Empfehlung für den Anfang:

```text
Insel oder Wald
```

**Unsere Entscheidung:**

```text
Welt-Thema: ____________________________
```

---

## Blöcke

Startblöcke:

- Gras
- Wasser
- Stein
- Holz
- Sand

Optionale spätere Blöcke:

- Lava
- Erde
- Gold
- Diamant
- Tür
- Hauswand
- Dach

**Unsere Startblöcke:**

```text
1. ____________________________
2. ____________________________
3. ____________________________
4. ____________________________
5. ____________________________
```

---

## Spielerfigur

Optionen:

1. Einfaches Quadrat
2. Pixel-Figur
3. Minecraft-artiger Block-Charakter
4. Eigene Figur mit KI-generiertem Sprite

Empfehlung:

```text
Erst Quadrat, später Sprite
```

**Unsere Entscheidung:**

```text
Spielerfigur: ____________________________
```

---

## Ziel des Spiels

Optionen:

1. Sammle 10 Holz und 10 Stein
2. Baue eine kleine Hütte
3. Erreiche den Schatz
4. Überlebe 60 Sekunden
5. Sammle 5 seltene Kristalle
6. Kein festes Ziel, nur Sandbox

Empfehlung für 4 bis 5 Stunden:

```text
Sammle 10 Holz und 10 Stein
```

**Unsere Entscheidung:**

```text
Spielziel: ____________________________
```

---

## Steuerung

Empfohlene Steuerung:

```text
WASD       bewegen
SPACE      Block abbauen
1          Holz auswählen
2          Stein auswählen
3          Sand auswählen
ENTER      Block setzen
R          Neustart
```

**Unsere Anpassungen:**

```text
Steuerung: ____________________________
```

---

# Roadmap

## Phase 1: Grundgerüst

### Ziel

Eine Webseite mit sichtbarem Canvas und einer Spielfigur.

### Offene Fragen

1. Wie soll der Spieltitel lauten?
2. Welche Hintergrundfarbe soll die Seite haben?
3. Soll die Figur am Anfang gelb, blau oder grün sein?

### Claude-Code-Prompt

```markdown
Phase 1: Grundgerüst.

Bitte erstelle oder bearbeite:
- index.html
- style.css
- game.js

Anforderungen:
1. Webseite mit Titel.
2. Canvas mit 640x480 Pixeln.
3. Dunkler Hintergrund.
4. Spielfigur als farbiges Quadrat.
5. JavaScript zeichnet die Figur auf den Canvas.
6. Code sehr einfach kommentieren.

Bitte danach erklären:
- Was macht index.html?
- Was macht style.css?
- Was macht game.js?
- Wie testen wir das im Browser?
```

### Test

```bash
python3 -m http.server 8000
```

Browser:

```text
http://localhost:8000
```

### Fertig, wenn

- Seite öffnet sich
- Canvas ist sichtbar
- Figur ist sichtbar
- nichts crasht

---

## Phase 2: Bewegung

### Ziel

Der Spieler bewegt sich mit WASD.

### Offene Fragen

1. Soll sich der Spieler feldweise bewegen oder weich Pixel für Pixel?
2. Soll er schnell oder langsam sein?
3. Soll er den Bildschirm verlassen können?

Empfehlung:

```text
Feldweise Bewegung auf einem Raster
```

Das passt besser zu Minecraft-ähnlichen Blöcken.

### Claude-Code-Prompt

```markdown
Phase 2: Bewegung.

Bitte erweitere game.js.

Anforderungen:
1. Spieler bewegt sich mit WASD.
2. Bewegung soll feldweise auf einem Raster funktionieren.
3. Ein Feld ist 32x32 Pixel groß.
4. Spieler darf den sichtbaren Bereich nicht verlassen.
5. Code anfängerfreundlich kommentieren.
6. Bitte erklären, was Koordinaten, x, y und tileSize bedeuten.

Nach der Änderung bitte sagen:
- Wie testen wir die Bewegung?
- Welche Taste macht was?
```

### Fertig, wenn

- W bewegt nach oben
- A bewegt nach links
- S bewegt nach unten
- D bewegt nach rechts
- Spieler bleibt im Spielfeld

---

## Phase 3: Blockwelt

### Ziel

Aus dem leeren Spielfeld wird eine kleine Welt aus Blöcken.

### Offene Fragen

1. Welche Blöcke wollen wir zuerst?
2. Soll Wasser blockieren?
3. Soll die Welt eher Insel, Wald oder Höhle sein?
4. Wie groß soll die Welt am Anfang sein?

Empfehlung:

```text
10 x 8 Felder
Gras, Wasser, Holz, Stein, Sand
Wasser blockiert
```

### Claude-Code-Prompt

```markdown
Phase 3: Blockwelt.

Bitte erweitere das Spiel um eine kleine Tile-Welt.

Anforderungen:
1. Welt als 2D-Array.
2. Jedes Feld enthält einen Block-Typ.
3. Block-Typen:
   - grass
   - water
   - wood
   - stone
   - sand
4. Jedes Tile ist 32x32 Pixel.
5. Jeder Block bekommt zuerst nur eine Farbe.
6. Die Welt wird auf dem Canvas gezeichnet.
7. Der Spieler wird über der Welt gezeichnet.
8. Wasser blockiert Bewegung.
9. Bitte verständlich erklären, was ein Array und ein 2D-Array ist.

Bitte keine Assets verwenden. Nur Farben.
```

### Fertig, wenn

- Welt aus farbigen Blöcken sichtbar ist
- Spieler bewegt sich auf der Welt
- Wasser blockiert Bewegung

---

## Phase 4: Blickrichtung

### Ziel

Das Spiel merkt sich, wohin der Spieler zuletzt geschaut oder gelaufen ist.

### Warum?

Damit wir wissen, welcher Block abgebaut oder gesetzt werden soll.

### Offene Fragen

1. Soll der Zielblock sichtbar markiert werden?
2. Soll der Spieler automatisch in Bewegungsrichtung schauen?
3. Soll man auch mit Pfeiltasten spielen können?

Empfehlung:

```text
Blickrichtung = letzte Bewegungsrichtung
Zielblock markieren
```

### Claude-Code-Prompt

```markdown
Phase 4: Blickrichtung.

Bitte erweitere das Spiel.

Anforderungen:
1. Speichere die letzte Bewegungsrichtung des Spielers.
2. Wenn der Spieler W drückt, schaut er nach oben.
3. Wenn er A drückt, schaut er nach links.
4. Wenn er S drückt, schaut er nach unten.
5. Wenn er D drückt, schaut er nach rechts.
6. Markiere den Block direkt vor dem Spieler mit einem hellen Rahmen.
7. Erkläre im Code, warum wir lastDirection brauchen.

Bitte nur kleine Änderungen machen.
```

### Fertig, wenn

- Zielblock vor dem Spieler sichtbar ist
- Zielblock ändert sich mit der Bewegungsrichtung

---

## Phase 5: Blöcke abbauen

### Ziel

Der Spieler kann Blöcke abbauen.

### Offene Fragen

1. Welche Blöcke darf man abbauen?
2. Soll Gras abgebaut werden können?
3. Wird ein abgebauter Block zu Gras oder zu leerem Boden?
4. Soll Wasser abbaubar sein?

Empfehlung:

```text
Holz, Stein und Sand sind abbaubar.
Wasser ist nicht abbaubar.
Gras bleibt erstmal einfach Boden.
Abgebaute Blöcke werden zu Gras.
```

### Claude-Code-Prompt

```markdown
Phase 5: Blöcke abbauen.

Bitte füge Abbauen hinzu.

Anforderungen:
1. SPACE baut den Block direkt vor dem Spieler ab.
2. Abbaubar sind:
   - wood
   - stone
   - sand
3. Nicht abbaubar sind:
   - water
   - grass
4. Wenn ein Block abgebaut wird, wird das Feld zu grass.
5. Bitte im Code einfach erklären:
   - wie wir den Zielblock berechnen
   - warum manche Blöcke nicht abbaubar sind

Noch kein Inventar. Nur Abbauen.
```

### Fertig, wenn

- SPACE entfernt Holz, Stein oder Sand
- Wasser bleibt bestehen
- Gras bleibt bestehen

---

## Phase 6: Inventar

### Ziel

Abgebaute Ressourcen werden gezählt.

### Offene Fragen

1. Welche Ressourcen sollen gezählt werden?
2. Soll Gras auch gesammelt werden?
3. Wie soll das Inventar aussehen?
4. Soll es oben links oder unter dem Spiel stehen?

Empfehlung:

```text
Holz, Stein, Sand zählen.
Inventar oben links im Canvas anzeigen.
```

### Claude-Code-Prompt

```markdown
Phase 6: Inventar.

Bitte füge ein einfaches Inventar hinzu.

Anforderungen:
1. inventory ist ein Objekt mit:
   - wood
   - stone
   - sand
2. Wenn wood abgebaut wird, steigt inventory.wood um 1.
3. Wenn stone abgebaut wird, steigt inventory.stone um 1.
4. Wenn sand abgebaut wird, steigt inventory.sand um 1.
5. Inventar wird oben links im Canvas angezeigt.
6. Bitte erklären, was ein JavaScript-Objekt ist.

Code bitte einfach halten.
```

### Fertig, wenn

- Abbauen erhöht Inventar
- Inventar ist sichtbar
- Zahlen ändern sich korrekt

---

## Phase 7: Blöcke setzen

### Ziel

Der Spieler kann gesammelte Blöcke wieder setzen.

### Offene Fragen

1. Welche Blöcke darf man setzen?
2. Wie wählt man einen Block aus?
3. Darf man auf Wasser setzen?
4. Darf man auf den Spieler setzen?
5. Soll Setzen Inventar verbrauchen?

Empfehlung:

```text
1 = Holz
2 = Stein
3 = Sand
ENTER setzt Block vor Spieler
Setzen nur auf Gras
Setzen verbraucht Inventar
```

### Claude-Code-Prompt

```markdown
Phase 7: Blöcke setzen.

Bitte füge Bauen hinzu.

Anforderungen:
1. Taste 1 wählt wood.
2. Taste 2 wählt stone.
3. Taste 3 wählt sand.
4. ENTER setzt den ausgewählten Block direkt vor den Spieler.
5. Setzen ist nur möglich, wenn das Zielfeld grass ist.
6. Setzen ist nur möglich, wenn der Spieler mindestens 1 Stück davon im Inventar hat.
7. Beim Setzen wird das Inventar um 1 reduziert.
8. Zeige im UI an, welcher Block aktuell ausgewählt ist.

Bitte erkläre:
- was selectedBlock ist
- warum wir Inventar prüfen
- warum wir nur auf grass setzen
```

### Fertig, wenn

- 1/2/3 wählen Material
- ENTER setzt Material
- Inventar sinkt
- ohne Material kann nichts gesetzt werden

---

## Phase 8: Spielziel

### Ziel

Das Spiel bekommt ein klares Ziel.

### Offene Fragen

1. Sammelziel oder Bauziel?
2. Wie viel Holz/Stein soll man brauchen?
3. Soll es eine Zeitbegrenzung geben?
4. Was passiert beim Sieg?

Empfehlung für Version 1:

```text
Sammle 5 Holz und 5 Stein.
Dann erscheint: YOU WIN.
```

### Claude-Code-Prompt

```markdown
Phase 8: Spielziel.

Bitte füge ein einfaches Spielziel hinzu.

Anforderungen:
1. Ziel: Sammle mindestens 5 wood und 5 stone.
2. Ziel wird oben rechts angezeigt.
3. Wenn Ziel erreicht ist, erscheint groß "YOU WIN!".
4. Mit R kann man das Spiel zurücksetzen.
5. Mit ESC passiert nichts im Browser, aber bitte keine Sonderlogik dafür.
6. Code einfach halten.

Bitte erkläre:
- wo die Siegbedingung geprüft wird
- was beim Neustart zurückgesetzt wird
```

### Fertig, wenn

- Ziel sichtbar ist
- Sieg erscheint bei 5 Holz und 5 Stein
- R startet neu

---

## Phase 9: Optik verbessern

### Ziel

Das Spiel wird schöner.

### Offene Fragen

1. Wollen wir Pixel-Art-Bilder oder Farben behalten?
2. Soll die Figur ein Sprite bekommen?
3. Soll Wasser animiert werden?
4. Soll es einen Titelbildschirm geben?
5. Soll es Sounds geben?

Empfehlung:

```text
Erst Farben fertig.
Dann optional Pixel-Art-Sprites.
```

### Claude-Code-Prompt für bessere Farben

```markdown
Phase 9A: Optik verbessern ohne Assets.

Bitte verbessere die Optik nur mit Canvas-Farben.

Anforderungen:
1. Blöcke sollen etwas schöner aussehen.
2. Jedes Tile bekommt einen leichten Rand.
3. Wasser soll etwas heller oder lebendiger aussehen.
4. Spieler soll klar sichtbar bleiben.
5. UI soll gut lesbar sein.

Bitte keine Bilddateien verwenden.
```

### Claude-Code-Prompt für Assets

```markdown
Phase 9B: Assets einbauen.

Wir haben Bilddateien im Ordner assets:

- player.png
- grass.png
- water.png
- wood.png
- stone.png
- sand.png

Bitte baue die Assets optional ein.

Anforderungen:
1. Wenn ein Asset existiert, wird es genutzt.
2. Wenn ein Asset fehlt, wird weiter die Farbe genutzt.
3. Bilder werden auf 32x32 Pixel skaliert.
4. Das Spiel darf nicht kaputtgehen, wenn ein Bild fehlt.
5. Code verständlich kommentieren.
```

### Fertig, wenn

- Spiel sieht besser aus
- Spiel bleibt stabil
- fehlende Assets crashen nicht

---

## Phase 10: Content-Creator-Output

### Ziel

Am Ende entsteht etwas, das man zeigen kann.

### Offene Fragen

1. Screenshot oder kurzes Video?
2. Soll ein Titelbild erstellt werden?
3. Soll der Sohn eine kurze Erklärung aufnehmen?
4. Soll das Projekt später auf GitHub Pages veröffentlicht werden?

### Möglicher Reel-Ablauf

```text
0-2 Sek: "I built my first game on Linux"
2-5 Sek: Zorin Desktop + Code
5-15 Sek: Gameplay
15-22 Sek: Block abbauen und bauen
22-30 Sek: YOU WIN Screen
```

### README-Prompt

```markdown
Bitte erstelle eine README.md für unser Projekt.

Inhalt:
1. Projektname
2. Kurze Beschreibung
3. Was man im Spiel macht
4. Steuerung
5. Wie man es startet
6. Was wir gelernt haben
7. Ideen für spätere Erweiterungen
8. Kurzer Hinweis: Vater-Sohn-Lernprojekt
```

---

# 3-Tage-Plan

## Tag 1: Setup und sichtbares Ergebnis

### Ziel

Eine spielbare Mini-Welt im Browser.

### Aufgaben

1. Projektordner erstellen
2. HTML/CSS/JS-Grundgerüst
3. Canvas anzeigen
4. Spieler zeichnen
5. WASD-Bewegung
6. Erste Blockwelt zeichnen

### Ergebnis

```text
Wir sehen eine Blockwelt und können eine Figur bewegen.
```

### Offene Entscheidungen an Tag 1

- Spielname
- Welt-Thema
- Spielerfarbe
- Grundblöcke

---

## Tag 2: Interaktion

### Ziel

Der Spieler kann mit der Welt arbeiten.

### Aufgaben

1. Wasser blockiert Bewegung
2. Blickrichtung speichern
3. Zielblock markieren
4. Blöcke abbauen
5. Inventar anzeigen

### Ergebnis

```text
Wir können Holz, Stein und Sand abbauen und sammeln.
```

### Offene Entscheidungen an Tag 2

- Welche Blöcke sind abbaubar?
- Wird Gras gezählt?
- Wo steht das Inventar?
- Soll der Zielblock markiert werden?

---

## Tag 3: Bauen und Abschluss

### Ziel

Ein kleines fertiges Mini-Spiel.

### Aufgaben

1. Blockauswahl mit 1/2/3
2. Blöcke setzen mit ENTER
3. Spielziel einbauen
4. YOU WIN Screen
5. README schreiben
6. Screenshot oder kurzes Video aufnehmen

### Ergebnis

```text
Wir haben ein kleines Minecraft-inspiriertes Browsergame gebaut.
```

### Offene Entscheidungen an Tag 3

- Sammelziel oder Bauziel?
- Wie viele Ressourcen braucht man?
- Soll das Spiel später online veröffentlicht werden?
- Welche Erweiterung wäre als nächstes cool?

---

# Erweiterungsideen nach dem ersten Erfolg

## Leicht

- Größere Welt
- Mehr Blöcke
- Bessere Farben
- Sounds
- Startscreen
- Punkteanzeige

## Mittel

- Kamera, die dem Spieler folgt
- zufällig generierte Welt
- Gegner
- Lebenspunkte
- Tag-Nacht-Wechsel
- Werkzeuge wie Axt oder Spitzhacke

## Schwer

- Speichern und Laden
- Crafting-System
- Mobile Steuerung
- GitHub Pages Veröffentlichung
- Multiplayer
- 3D-Version

---

# Was wir bewusst nicht bauen

Für Version 1 nicht bauen:

```text
- echtes 3D-Minecraft
- Multiplayer
- Crafting mit vielen Rezepten
- unendliche Welt
- Chunk-System
- Gegner-KI
- Login-System
- Account-System
- npm/Vite/Webpack
- TypeScript
- komplexe Engine-Struktur
```

Diese Dinge sind nicht schlecht. Sie sind nur für das erste Projekt zu groß.

---

# Entscheidungsregel

Wenn wir uns nicht sicher sind, gilt:

```text
Die einfachere Option gewinnt.
```

Wenn zwei Ideen cool sind, gilt:

```text
Erst die kleine Version bauen.
Dann erweitern.
```

Wenn ein Feature länger als 20 Minuten blockiert:

```text
Feature kleiner machen oder überspringen.
```

---

# Definition of Done

Das Projekt ist erfolgreich, wenn:

- die Seite im Browser öffnet
- eine Blockwelt sichtbar ist
- der Spieler sich bewegen kann
- mindestens ein Block abgebaut werden kann
- Inventar sichtbar ist
- mindestens ein Block gesetzt werden kann
- ein kleines Ziel erreichbar ist
- dein Sohn das Ergebnis zeigen kann

Perfektion ist nicht das Ziel.

Das Ziel ist:

```text
Ich habe mit Papa mein erstes eigenes Spiel gebaut.
```
