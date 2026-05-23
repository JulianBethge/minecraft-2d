// ============================================================
// MiniCraft Browser – scrollende, prozedural generierte Welt
// ============================================================

var canvas = document.getElementById("gameCanvas");
var ctx    = canvas.getContext("2d");

var TILE       = 32;
var COLS       = canvas.width  / TILE;   // 20 sichtbare Spalten
var ROWS       = canvas.height / TILE;   // 15 Zeilen (feste Höhe)
var WORLD_COLS = 120;                    // Welt ist 120 Tiles breit

var GRAVITY    = 0.5;
var JUMP_FORCE = -11;
var SPEED      = 4;
var REACH      = 4;

// ------------------------------------------------------------
// Block-Typen
// ------------------------------------------------------------
var AIR    = 0;
var GRASS  = 1;
var DIRT   = 2;
var STONE  = 3;
var WOOD   = 4;
var LEAVES = 5;
var WATER  = 6;

var COLORS = {};
COLORS[GRASS]  = "#6ab04c";
COLORS[DIRT]   = "#9b5e28";
COLORS[STONE]  = "#808080";
COLORS[WOOD]   = "#7a5230";
COLORS[LEAVES] = "#2e8b2e";
COLORS[WATER]  = "#2980b9";

var NAMES = {};
NAMES[GRASS]  = "Gras";
NAMES[DIRT]   = "Erde";
NAMES[STONE]  = "Stein";
NAMES[WOOD]   = "Holz";
NAMES[LEAVES] = "Blätter";

// ------------------------------------------------------------
// Welt generieren
// Jedes Mal anders dank Math.random()
// ------------------------------------------------------------
var world = [];

function generateWorld() {
  // Alles mit Luft füllen
  for (var row = 0; row < ROWS; row++) {
    world[row] = [];
    for (var col = 0; col < WORLD_COLS; col++) {
      world[row][col] = AIR;
    }
  }

  // Höhenkarte: für jede Spalte den Boden-Row berechnen
  // Zwei Sinuswellen + kleiner Zufallswert = natürliche Hügel
  var groundRow = [];
  var rand      = Math.random() * 10;  // zufälliger Startpunkt
  for (var col = 0; col < WORLD_COLS; col++) {
    var h = 9
      + Math.round(Math.sin(col * 0.15 + rand) * 2)
      + Math.round(Math.sin(col * 0.43 + rand) * 1);
    groundRow[col] = Math.max(7, Math.min(12, h));
  }

  // Wasser-Level: Tiles tiefer als Row 11 werden zu Seen
  var WATER_LEVEL = 11;

  // Terrain füllen
  for (var col = 0; col < WORLD_COLS; col++) {
    var surface = groundRow[col];
    var isWet   = surface >= WATER_LEVEL;

    for (var row = 0; row < ROWS; row++) {
      if (row < surface) {
        // Über dem Boden: Luft, oder Wasser wenn im See
        world[row][col] = (isWet && row >= WATER_LEVEL) ? WATER : AIR;
      } else if (row === surface) {
        world[row][col] = isWet ? WATER : GRASS;
      } else if (row <= surface + 2) {
        world[row][col] = isWet ? WATER : DIRT;
      } else {
        world[row][col] = STONE;
      }
    }
  }

  // Bäume zufällig auf Grasflächen setzen
  for (var col = 2; col < WORLD_COLS - 2; col++) {
    var s = groundRow[col];
    if (world[s][col] !== GRASS)  continue;  // kein Gras → kein Baum
    if (Math.random() > 0.10)     continue;  // nur 10% Chance
    // Kein Baum direkt neben einem anderen
    if (col > 0 && world[s][col - 1] === WOOD) continue;
    if (col < WORLD_COLS - 1 && world[s][col + 1] === WOOD) continue;

    // Stamm (2 Tiles)
    if (s - 1 >= 0) world[s - 1][col] = WOOD;
    if (s - 2 >= 0) world[s - 2][col] = WOOD;

    // Blätter-Krone (3 Zeilen, dreieckig)
    for (var dr = 3; dr <= 5; dr++) {
      if (s - dr < 0) continue;
      var spread = dr === 4 ? 1 : 0;  // mittlere Reihe breiter
      for (var dc = -spread - 1; dc <= spread + 1; dc++) {
        var tc = col + dc;
        if (tc >= 0 && tc < WORLD_COLS) world[s - dr][tc] = LEAVES;
      }
    }
  }
}

generateWorld();

// Startposition: Mitte der Welt, auf dem ersten Gras-Tile
var startCol = Math.floor(WORLD_COLS / 2);
var startRow = 10;  // Fallback
for (var r = 0; r < ROWS; r++) {
  var t = world[r][startCol];
  if (t === GRASS || t === DIRT || t === STONE) {
    startRow = r;
    break;
  }
}

// ------------------------------------------------------------
// Spieler
// ------------------------------------------------------------
var player = {
  x:         startCol * TILE,
  y:         startRow * TILE - 56,
  width:     28,
  height:    56,
  velocityY: 0,
  onGround:  false,
  color:     "#f0c040"
};

// ------------------------------------------------------------
// Kamera – folgt dem Spieler horizontal
// cameraX = wie viele Pixel die Welt nach links gescrollt ist
// ------------------------------------------------------------
var cameraX = 0;

function updateCamera() {
  // Spieler soll in der Mitte des Bildschirms bleiben
  cameraX = player.x - canvas.width / 2 + player.width / 2;
  // Nicht über den linken oder rechten Rand hinaus
  if (cameraX < 0) cameraX = 0;
  var maxCam = WORLD_COLS * TILE - canvas.width;
  if (cameraX > maxCam) cameraX = maxCam;
}

// Sofort auf Startposition setzen
updateCamera();

// ------------------------------------------------------------
// Inventar
// ------------------------------------------------------------
var inventory = {};
inventory[GRASS]  = 0;
inventory[DIRT]   = 0;
inventory[STONE]  = 0;
inventory[WOOD]   = 0;
inventory[LEAVES] = 0;

var selectedBlock = WOOD;

// ------------------------------------------------------------
// Eingabe: Tasten
// ------------------------------------------------------------
var keys = {};
document.addEventListener("keydown", function(e) {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "1") selectedBlock = WOOD;
  if (e.key === "2") selectedBlock = STONE;
  if (e.key === "3") selectedBlock = DIRT;
});
document.addEventListener("keyup", function(e) {
  keys[e.key.toLowerCase()] = false;
});

// ------------------------------------------------------------
// Eingabe: Maus
// WICHTIG: Maus-Welt-X = Maus-Screen-X + cameraX
// ------------------------------------------------------------
var mouse = { x: 0, y: 0, col: 0, row: 0, inRange: false };

canvas.addEventListener("mousemove", function(e) {
  var rect  = canvas.getBoundingClientRect();
  mouse.x   = e.clientX - rect.left;
  mouse.y   = e.clientY - rect.top;
  // Welt-Spalte: Maus-X versetzt um Kamera
  mouse.col = Math.floor((mouse.x + cameraX) / TILE);
  mouse.row = Math.floor(mouse.y / TILE);

  // Reichweite: Abstand Spieler-Mitte ↔ Tile-Mitte
  var px   = player.x + player.width  / 2;
  var py   = player.y + player.height / 2;
  var tx   = mouse.col * TILE + TILE / 2;
  var ty   = mouse.row * TILE + TILE / 2;
  var dist = Math.sqrt((px - tx) * (px - tx) + (py - ty) * (py - ty));
  mouse.inRange = dist < REACH * TILE;
});

// Linksklick = abbauen
canvas.addEventListener("click", function(e) {
  if (!mouse.inRange) return;
  var type = getTile(mouse.col, mouse.row);
  if (type !== AIR && type !== WATER) {
    world[mouse.row][mouse.col] = AIR;
    if (inventory[type] !== undefined) inventory[type]++;
  }
});

// Rechtsklick = setzen
canvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  if (!mouse.inRange) return;
  if (getTile(mouse.col, mouse.row) !== AIR) return;
  if (inventory[selectedBlock] <= 0) return;

  // Nicht setzen wo der Spieler steht
  var pCL = Math.floor(player.x / TILE);
  var pCR = Math.floor((player.x + player.width  - 1) / TILE);
  var pRT = Math.floor(player.y / TILE);
  var pRB = Math.floor((player.y + player.height - 1) / TILE);
  if (mouse.col >= pCL && mouse.col <= pCR &&
      mouse.row >= pRT && mouse.row <= pRB) return;

  world[mouse.row][mouse.col] = selectedBlock;
  inventory[selectedBlock]--;
});

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------
function isSolid(type) {
  return type === GRASS || type === DIRT || type === STONE || type === WOOD;
}

function getTile(col, row) {
  if (col < 0 || col >= WORLD_COLS || row < 0 || row >= ROWS) return STONE;
  return world[row][col];
}

// ------------------------------------------------------------
// Update: Physik + Steuerung + Kollision
// ------------------------------------------------------------
function update() {
  // Horizontal
  var dx = 0;
  if (keys["a"]) dx = -SPEED;
  if (keys["d"]) dx =  SPEED;
  player.x += dx;

  if (dx !== 0) {
    var rTop = Math.floor(player.y / TILE);
    var rBot = Math.floor((player.y + player.height - 1) / TILE);
    if (dx > 0) {
      var col = Math.floor((player.x + player.width - 1) / TILE);
      if (isSolid(getTile(col, rTop)) || isSolid(getTile(col, rBot)))
        player.x = col * TILE - player.width;
    } else {
      var col = Math.floor(player.x / TILE);
      if (isSolid(getTile(col, rTop)) || isSolid(getTile(col, rBot)))
        player.x = (col + 1) * TILE;
    }
  }

  // Weltgrenzen
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > WORLD_COLS * TILE)
    player.x = WORLD_COLS * TILE - player.width;

  // Springen
  if ((keys["w"] || keys[" "]) && player.onGround) {
    player.velocityY = JUMP_FORCE;
    player.onGround  = false;
  }

  // Vertikal
  player.velocityY += GRAVITY;
  player.y         += player.velocityY;
  player.onGround   = false;

  var cL = Math.floor(player.x / TILE);
  var cR = Math.floor((player.x + player.width - 1) / TILE);

  if (player.velocityY >= 0) {
    var row = Math.floor((player.y + player.height) / TILE);
    if (isSolid(getTile(cL, row)) || isSolid(getTile(cR, row))) {
      player.y         = row * TILE - player.height;
      player.velocityY = 0;
      player.onGround  = true;
    }
  } else {
    var row = Math.floor(player.y / TILE);
    if (isSolid(getTile(cL, row)) || isSolid(getTile(cR, row))) {
      player.y         = (row + 1) * TILE;
      player.velocityY = 0;
    }
  }

  updateCamera();
}

// ------------------------------------------------------------
// Zeichnen
// Alle x-Positionen: col * TILE - cameraX (Welt → Bildschirm)
// ------------------------------------------------------------
function drawBackground() {
  ctx.fillStyle = "#87ceeb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWorld() {
  // Nur sichtbare Spalten zeichnen (Performance)
  var startCol = Math.max(0, Math.floor(cameraX / TILE));
  var endCol   = Math.min(WORLD_COLS - 1, startCol + COLS + 1);

  for (var row = 0; row < ROWS; row++) {
    for (var col = startCol; col <= endCol; col++) {
      var type = world[row][col];
      if (type === AIR) continue;

      var x = Math.floor(col * TILE - cameraX);
      var y = row * TILE;

      ctx.fillStyle = COLORS[type];
      ctx.fillRect(x, y, TILE, TILE);

      if (type === GRASS) {
        ctx.fillStyle = "#90e050";
        ctx.fillRect(x, y, TILE, 5);
      }
      if (type === STONE) {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      }
      if (type === LEAVES) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(x + 5, y + 5, 9, 9);
        ctx.fillRect(x + 17, y + 15, 7, 7);
      }
      if (type === WATER) {
        ctx.fillStyle = "rgba(100,200,255,0.35)";
        ctx.fillRect(x, y, TILE, 8);
        ctx.fillRect(x, y + 18, TILE, 8);
      }

      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawTarget() {
  if (!mouse.inRange) return;
  var type = getTile(mouse.col, mouse.row);
  if (type === AIR || type === WATER) return;

  var x = Math.floor(mouse.col * TILE - cameraX);
  var y = mouse.row * TILE;

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth   = 2;
  ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.lineWidth = 1;
}

function drawPlayer() {
  var px = Math.floor(player.x - cameraX);
  var py = Math.floor(player.y);

  ctx.fillStyle = player.color;
  ctx.fillRect(px, py + 20, player.width, 36);
  ctx.fillStyle = "#f5d88a";
  ctx.fillRect(px + 4, py, 20, 20);
  ctx.fillStyle = "#333";
  ctx.fillRect(px + 7,  py + 6, 4, 4);
  ctx.fillRect(px + 15, py + 6, 4, 4);
}

function drawInventory() {
  var slots  = [WOOD, STONE, DIRT, GRASS, LEAVES];
  var sx = 8, sy = 8, slotH = 22;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(sx - 4, sy - 4, 120, slots.length * slotH + 8);

  for (var i = 0; i < slots.length; i++) {
    var type = slots[i];
    var y    = sy + i * slotH;
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(sx, y, 14, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(sx, y, 14, 14);
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(NAMES[type] + ": " + inventory[type], sx + 18, y + 11);
  }
}

function drawHotbar() {
  var slots  = [WOOD, STONE, DIRT];
  var labels = ["1", "2", "3"];
  var size   = 36, gap = 6;
  var total  = slots.length * (size + gap) - gap;
  var sx     = Math.floor((canvas.width - total) / 2);
  var y      = canvas.height - size - 8;

  for (var i = 0; i < slots.length; i++) {
    var type = slots[i];
    var x    = sx + i * (size + gap);

    ctx.fillStyle = (type === selectedBlock) ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);

    if (type === selectedBlock) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth   = 2;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
      ctx.lineWidth = 1;
    }

    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px monospace";
    ctx.fillText(labels[i], x + 4, y + 12);

    ctx.fillStyle = inventory[type] > 0 ? "#fff" : "#f66";
    ctx.font = "11px monospace";
    ctx.fillText(inventory[type], x + size - 14, y + size - 4);
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
