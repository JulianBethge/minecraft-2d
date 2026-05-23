// ============================================================
// MiniCraft Browser – Phase 3: Blockwelt
// ============================================================

var canvas = document.getElementById("gameCanvas");
var ctx    = canvas.getContext("2d");

var TILE = 32;                        // jedes Tile ist 32x32 Pixel
var COLS = canvas.width  / TILE;      // 20 Spalten
var ROWS = canvas.height / TILE;      // 15 Zeilen

// Physik
var GRAVITY    = 0.5;
var JUMP_FORCE = -11;
var SPEED      = 4;
var REACH      = 4;   // Reichweite in Tiles: wie weit der Spieler abbauen darf

// ------------------------------------------------------------
// Block-Typen als Zahlen
// ------------------------------------------------------------
var AIR    = 0;
var GRASS  = 1;
var DIRT   = 2;
var STONE  = 3;
var WOOD   = 4;
var LEAVES = 5;
var WATER  = 6;

// Farbe für jeden Block-Typ
var COLORS = {};
COLORS[GRASS]  = "#6ab04c";
COLORS[DIRT]   = "#9b5e28";
COLORS[STONE]  = "#808080";
COLORS[WOOD]   = "#7a5230";
COLORS[LEAVES] = "#2e8b2e";
COLORS[WATER]  = "#2980b9";

// ------------------------------------------------------------
// Welt als 2D-Array  [Zeile][Spalte]
// Boden liegt bei Zeile 10, Bäume stehen bei Zeilen 6-9
// ------------------------------------------------------------
var world = [
//   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], // 0
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], // 1
  [  0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0 ], // 2 blätter
  [  0, 0, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 0 ], // 3 blätter
  [  0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0 ], // 4 blätter
  [  0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0 ], // 5 stamm
  [  0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0 ], // 6 stamm
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], // 7
  [  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0 ], // 8 plattform
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], // 9
  [  1, 1, 1, 1, 1, 6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // 10 boden + wasser
  [  2, 2, 2, 2, 2, 6, 6, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 ], // 11 erde
  [  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ], // 12 stein
  [  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ], // 13 stein
  [  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 ], // 14 stein
];

// ------------------------------------------------------------
// Spieler – startet auf dem Boden (Zeile 10, y=320 → 320-56=264)
// ------------------------------------------------------------
var player = {
  x:         TILE,          // Spalte 1
  y:         10 * TILE - 56,
  width:     28,
  height:    56,
  velocityY: 0,
  onGround:  false,
  color:     "#f0c040"
};

// ------------------------------------------------------------
// Tasten-Tracking
// ------------------------------------------------------------
var keys = {};
document.addEventListener("keydown", function(e) { keys[e.key.toLowerCase()] = true;  });
document.addEventListener("keyup",   function(e) { keys[e.key.toLowerCase()] = false; });

// ------------------------------------------------------------
// Maus-Tracking
// col/row = welches Tile die Maus gerade zeigt
// inRange = ist das Tile nah genug zum Abbauen?
// ------------------------------------------------------------
var mouse = { x: 0, y: 0, col: 0, row: 0, inRange: false };

canvas.addEventListener("mousemove", function(e) {
  var rect  = canvas.getBoundingClientRect();
  mouse.x   = e.clientX - rect.left;
  mouse.y   = e.clientY - rect.top;
  mouse.col = Math.floor(mouse.x / TILE);
  mouse.row = Math.floor(mouse.y / TILE);

  // Abstand vom Spieler-Mittelpunkt zur Tile-Mitte
  var px   = player.x + player.width  / 2;
  var py   = player.y + player.height / 2;
  var tx   = mouse.col * TILE + TILE / 2;
  var ty   = mouse.row * TILE + TILE / 2;
  var dist = Math.sqrt((px - tx) * (px - tx) + (py - ty) * (py - ty));
  mouse.inRange = dist < REACH * TILE;
});

// Linksklick = Block abbauen und ins Inventar legen
canvas.addEventListener("click", function(e) {
  if (!mouse.inRange) return;
  var type = getTile(mouse.col, mouse.row);
  // Wasser und Luft kann man nicht abbauen
  if (type !== AIR && type !== WATER) {
    world[mouse.row][mouse.col] = AIR;
    // Wenn dieser Block-Typ im Inventar ist, hochzählen
    if (inventory[type] !== undefined) {
      inventory[type]++;
    }
  }
});

// Rechtsklick: Standardmenü des Browsers verhindern
canvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
});

// ------------------------------------------------------------
// Inventar: wie viele Blöcke hat der Spieler gesammelt?
// Schlüssel = Block-Typ-Nummer, Wert = Anzahl
// ------------------------------------------------------------
var inventory = {};
inventory[GRASS]  = 0;
inventory[DIRT]   = 0;
inventory[STONE]  = 0;
inventory[WOOD]   = 0;
inventory[LEAVES] = 0;

// Name für jeden Block-Typ (für die Anzeige)
var NAMES = {};
NAMES[GRASS]  = "Gras";
NAMES[DIRT]   = "Erde";
NAMES[STONE]  = "Stein";
NAMES[WOOD]   = "Holz";
NAMES[LEAVES] = "Blätter";

// ------------------------------------------------------------
// Aktuell ausgewählter Block zum Setzen (1=Holz, 2=Stein, 3=Erde)
// ------------------------------------------------------------
var selectedBlock = WOOD;

// Taste 1/2/3 → Block auswählen
document.addEventListener("keydown", function(e) {
  if (e.key === "1") selectedBlock = WOOD;
  if (e.key === "2") selectedBlock = STONE;
  if (e.key === "3") selectedBlock = DIRT;
});

// Rechtsklick = Block setzen
canvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  if (!mouse.inRange) return;

  // Nur auf Luft setzen
  if (getTile(mouse.col, mouse.row) !== AIR) return;

  // Nicht setzen, wenn der Spieler dieses Tile gerade besetzt
  var playerColLeft  = Math.floor(player.x / TILE);
  var playerColRight = Math.floor((player.x + player.width  - 1) / TILE);
  var playerRowTop   = Math.floor(player.y / TILE);
  var playerRowBot   = Math.floor((player.y + player.height - 1) / TILE);
  var inPlayer = mouse.col >= playerColLeft && mouse.col <= playerColRight &&
                 mouse.row >= playerRowTop  && mouse.row <= playerRowBot;
  if (inPlayer) return;

  // Nur setzen wenn genug im Inventar
  if (inventory[selectedBlock] <= 0) return;

  world[mouse.row][mouse.col] = selectedBlock;
  inventory[selectedBlock]--;
});

// ------------------------------------------------------------
// isSolid: Welche Blöcke stoppen den Spieler?
// Wasser und Luft sind nicht fest.
// ------------------------------------------------------------
function isSolid(type) {
  return type === GRASS || type === DIRT || type === STONE || type === WOOD;
}

// ------------------------------------------------------------
// getTile: Block-Typ an einer Gitter-Position zurückgeben
// Außerhalb der Welt = Stein (damit der Spieler nicht rausfällt)
// ------------------------------------------------------------
function getTile(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return STONE;
  return world[row][col];
}

// ------------------------------------------------------------
// update: Bewegung + Physik + Kollision
// Erst x bewegen und kollidieren, dann y.
// ------------------------------------------------------------
function update() {

  // --- Horizontale Bewegung ---
  var dx = 0;
  if (keys["a"]) dx = -SPEED;
  if (keys["d"]) dx =  SPEED;

  player.x += dx;

  if (dx !== 0) {
    // Welche zwei Zeilen belegt der Spieler gerade (oben/unten)?
    var rowTop = Math.floor(player.y / TILE);
    var rowBot = Math.floor((player.y + player.height - 1) / TILE);

    if (dx > 0) {
      // nach rechts → rechte Kante prüfen
      var col = Math.floor((player.x + player.width - 1) / TILE);
      if (isSolid(getTile(col, rowTop)) || isSolid(getTile(col, rowBot))) {
        player.x = col * TILE - player.width;
      }
    } else {
      // nach links → linke Kante prüfen
      var col = Math.floor(player.x / TILE);
      if (isSolid(getTile(col, rowTop)) || isSolid(getTile(col, rowBot))) {
        player.x = (col + 1) * TILE;
      }
    }
  }

  // Bildschirm-Rand
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

  // --- Springen (nur vom Boden aus) ---
  if ((keys["w"] || keys[" "]) && player.onGround) {
    player.velocityY = JUMP_FORCE;
    player.onGround  = false;
  }

  // --- Schwerkraft + vertikale Bewegung ---
  player.velocityY += GRAVITY;
  player.y         += player.velocityY;
  player.onGround   = false;

  var colLeft  = Math.floor(player.x / TILE);
  var colRight = Math.floor((player.x + player.width - 1) / TILE);

  if (player.velocityY >= 0) {
    // fällt nach unten → Bodenkollision
    var row = Math.floor((player.y + player.height) / TILE);
    if (isSolid(getTile(colLeft, row)) || isSolid(getTile(colRight, row))) {
      player.y         = row * TILE - player.height;
      player.velocityY = 0;
      player.onGround  = true;
    }
  } else {
    // springt nach oben → Deckenkollision
    var row = Math.floor(player.y / TILE);
    if (isSolid(getTile(colLeft, row)) || isSolid(getTile(colRight, row))) {
      player.y         = (row + 1) * TILE;
      player.velocityY = 0;
    }
  }
}

// ------------------------------------------------------------
// drawWorld: Alle Tiles zeichnen
// ------------------------------------------------------------
function drawWorld() {
  for (var row = 0; row < ROWS; row++) {
    for (var col = 0; col < COLS; col++) {
      var type = world[row][col];
      if (type === AIR) continue;

      var x = col * TILE;
      var y = row * TILE;

      // Grundfarbe
      ctx.fillStyle = COLORS[type];
      ctx.fillRect(x, y, TILE, TILE);

      // Gras: hellerer Streifen oben
      if (type === GRASS) {
        ctx.fillStyle = "#90e050";
        ctx.fillRect(x, y, TILE, 5);
      }

      // Stein: leichte Textur
      if (type === STONE) {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      }

      // Blätter: dunklere Punkte für Tiefe
      if (type === LEAVES) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(x + 6, y + 6, 8, 8);
        ctx.fillRect(x + 18, y + 14, 6, 6);
      }

      // Wasser: Wellen-Streifen
      if (type === WATER) {
        ctx.fillStyle = "rgba(100,200,255,0.35)";
        ctx.fillRect(x, y, TILE, 8);
        ctx.fillRect(x, y + 18, TILE, 8);
      }

      // Rand für jeden Block
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
}

// ------------------------------------------------------------
// drawBackground: Himmel
// ------------------------------------------------------------
function drawBackground() {
  ctx.fillStyle = "#87ceeb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ------------------------------------------------------------
// drawTarget: Markiert das Tile unter der Maus mit einem Rahmen
// ------------------------------------------------------------
function drawTarget() {
  if (!mouse.inRange) return;
  var type = getTile(mouse.col, mouse.row);
  if (type === AIR || type === WATER) return;  // nichts markieren

  var x = mouse.col * TILE;
  var y = mouse.row * TILE;

  // Weißer Rahmen innen
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth   = 2;
  ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);

  // Leichtes helles Overlay
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, y, TILE, TILE);

  ctx.lineWidth = 1;  // zurücksetzen
}

// ------------------------------------------------------------
// drawPlayer
// ------------------------------------------------------------
function drawPlayer() {
  var px = player.x;
  var py = player.y;

  // Körper
  ctx.fillStyle = player.color;
  ctx.fillRect(px, py + 20, player.width, 36);

  // Kopf
  ctx.fillStyle = "#f5d88a";
  ctx.fillRect(px + 4, py, 20, 20);

  // Augen
  ctx.fillStyle = "#333";
  ctx.fillRect(px + 7,  py + 6, 4, 4);
  ctx.fillRect(px + 15, py + 6, 4, 4);
}

// ------------------------------------------------------------
// drawInventory: Inventar oben links anzeigen
// Jede Ressource = kleines farbiges Quadrat + Name + Zahl
// ------------------------------------------------------------
function drawInventory() {
  var slots = [WOOD, STONE, DIRT, GRASS, LEAVES];
  var startX = 8;
  var startY = 8;
  var slotH  = 22;

  // Halbtransparenter Hintergrund
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(startX - 4, startY - 4, 120, slots.length * slotH + 8);

  for (var i = 0; i < slots.length; i++) {
    var type = slots[i];
    var y    = startY + i * slotH;

    // Farbiges Block-Symbol
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(startX, y, 14, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(startX, y, 14, 14);

    // Name und Anzahl
    ctx.fillStyle   = "#ffffff";
    ctx.font        = "12px monospace";
    ctx.fillText(NAMES[type] + ": " + inventory[type], startX + 18, y + 11);
  }
}

// ------------------------------------------------------------
// drawHotbar: Zeigt unten die 3 platzierbaren Blöcke + Auswahl
// ------------------------------------------------------------
function drawHotbar() {
  var slots   = [WOOD, STONE, DIRT];
  var labels  = ["1", "2", "3"];
  var size    = 36;   // Slot-Größe
  var gap     = 6;
  var total   = slots.length * (size + gap) - gap;
  var startX  = Math.floor((canvas.width - total) / 2);
  var y       = canvas.height - size - 8;

  for (var i = 0; i < slots.length; i++) {
    var type = slots[i];
    var x    = startX + i * (size + gap);

    // Hintergrund des Slots
    ctx.fillStyle = (type === selectedBlock)
      ? "rgba(255,255,255,0.35)"   // ausgewählt = heller
      : "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, size, size);

    // Block-Farbe
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);

    // Auswahl-Rahmen
    if (type === selectedBlock) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth   = 2;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
      ctx.lineWidth = 1;
    }

    // Tastenbezeichnung oben links
    ctx.fillStyle = "#fff";
    ctx.font      = "bold 10px monospace";
    ctx.fillText(labels[i], x + 4, y + 12);

    // Inventar-Anzahl unten rechts
    var count = inventory[type];
    ctx.fillStyle = count > 0 ? "#fff" : "#f66";
    ctx.font      = "11px monospace";
    ctx.fillText(count, x + size - 14, y + size - 4);
  }
}

// ------------------------------------------------------------
// Game Loop
// ------------------------------------------------------------
function gameLoop() {
  drawBackground();
  drawWorld();
  drawTarget();
  drawPlayer();
  drawInventory();
  drawHotbar();
  update();
  requestAnimationFrame(gameLoop);
}

gameLoop();
