// ============================================================
// MiniCraft Browser – Tiefe Welt, Höhlen, Zombies, Schwert, HP
// ============================================================

var canvas = document.getElementById("gameCanvas");
var ctx    = canvas.getContext("2d");

var TILE       = 32;
var COLS       = Math.ceil(canvas.width  / TILE);
var ROWS       = Math.ceil(canvas.height / TILE);
var WORLD_COLS = 240;  // doppelt so breit (war 120)
var WORLD_ROWS = 64;   // doppelt so tief  (war 32)

var GRAVITY    = 0.5;
var JUMP_FORCE = -11;
var SPEED      = 4;
var REACH      = 4;    // Reichweite in Tiles

// ------------------------------------------------------------
// Block-Typen
// ------------------------------------------------------------
var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, WATER = 6;

var COLORS = {};
COLORS[GRASS]  = "#6ab04c"; COLORS[DIRT]   = "#9b5e28";
COLORS[STONE]  = "#808080"; COLORS[WOOD]   = "#7a5230";
COLORS[LEAVES] = "#2e8b2e"; COLORS[WATER]  = "#2980b9";

var NAMES = {};
NAMES[GRASS]  = "Gras";  NAMES[DIRT]   = "Erde";
NAMES[STONE]  = "Stein"; NAMES[WOOD]   = "Holz";
NAMES[LEAVES] = "Blätter";

// ------------------------------------------------------------
// Welt generieren: Terrain + Höhlen
// ------------------------------------------------------------
var world = [];

function generateWorld() {
  for (var row = 0; row < WORLD_ROWS; row++) {
    world[row] = [];
    for (var col = 0; col < WORLD_COLS; col++) world[row][col] = AIR;
  }

  // Höhenkarte: Mischung aus Sinuswellen = organische Hügel
  var seed     = Math.random() * 10;
  var groundRow = [];
  for (var col = 0; col < WORLD_COLS; col++) {
    var h = 9
      + Math.round(Math.sin(col * 0.15 + seed) * 2)
      + Math.round(Math.sin(col * 0.43 + seed) * 1);
    groundRow[col] = Math.max(7, Math.min(12, h));
  }

  var WATER_LEVEL = 11;

  // Terrain füllen (Gras, Erde, Stein, Wasser)
  for (var col = 0; col < WORLD_COLS; col++) {
    var surface = groundRow[col];
    var isWet   = surface >= WATER_LEVEL;
    for (var row = 0; row < WORLD_ROWS; row++) {
      if (row < surface) {
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

  // Bäume zufällig platzieren
  for (var col = 2; col < WORLD_COLS - 2; col++) {
    var s = groundRow[col];
    if (world[s][col] !== GRASS) continue;
    if (Math.random() > 0.10)   continue;
    if (col > 0 && world[s][col-1] === WOOD) continue;
    if (col < WORLD_COLS-1 && world[s][col+1] === WOOD) continue;
    if (s-1 >= 0) world[s-1][col] = WOOD;
    if (s-2 >= 0) world[s-2][col] = WOOD;
    for (var dr = 3; dr <= 5; dr++) {
      if (s-dr < 0) continue;
      var sp = (dr === 4) ? 1 : 0;
      for (var dc = -sp-1; dc <= sp+1; dc++) {
        var tc = col+dc;
        if (tc >= 0 && tc < WORLD_COLS) world[s-dr][tc] = LEAVES;
      }
    }
  }

  // -------------------------------------------------------
  // HÖHLEN: ab Zeile 14 mit drei überlagerten Sinuswellen
  // Wo der Noise-Wert hoch genug ist → Luft = Höhle
  // -------------------------------------------------------
  for (var row = 14; row < WORLD_ROWS - 2; row++) {
    for (var col = 1; col < WORLD_COLS - 1; col++) {
      if (world[row][col] !== STONE) continue;
      var noise = Math.sin(col * 0.28 + seed)   * Math.cos(row * 0.38 + seed) +
                  Math.sin(col * 0.63 + row * 0.21 + seed) * 0.7 +
                  Math.sin(col * 0.12 + row * 0.55 + seed * 0.3) * 0.5;
      if (noise > 0.55) world[row][col] = AIR;
    }
  }

  // Ränder immer Stein (damit niemand rausfällt)
  for (var row = 0; row < WORLD_ROWS; row++) {
    world[row][0]             = STONE;
    world[row][WORLD_COLS-1]  = STONE;
  }
  // Unterste 2 Zeilen immer Stein (Bedrock)
  for (var col = 0; col < WORLD_COLS; col++) {
    world[WORLD_ROWS-1][col] = STONE;
    world[WORLD_ROWS-2][col] = STONE;
  }
}

generateWorld();

// ------------------------------------------------------------
// Wasser-Füll-Niveau: wLevel[row][col] = 0 (kein Wasser) oder 1–8
// 8 = voller Block, 4 = halb, 2 = Viertel, 1 = Achtel
// ------------------------------------------------------------
var wLevel = [];
function initWaterLevels() {
  for (var r = 0; r < WORLD_ROWS; r++) {
    if (!wLevel[r]) wLevel[r] = [];
    for (var c = 0; c < WORLD_COLS; c++) {
      // Jedes neu generierte Wasser-Tile fängt voll (8) an
      wLevel[r][c] = (world[r][c] === WATER) ? 8 : 0;
    }
  }
}
initWaterLevels();

// Startposition in der Mitte der Welt finden
function findStart() {
  var col = Math.floor(WORLD_COLS / 2);
  for (var r = 0; r < WORLD_ROWS; r++) {
    var t = world[r][col];
    if (t === GRASS || t === DIRT || t === STONE) return { col: col, row: r };
  }
  return { col: col, row: 10 };
}
var start = findStart();

// ------------------------------------------------------------
// Spieler
// ------------------------------------------------------------
var player = {
  x:         start.col * TILE,
  y:         start.row * TILE - 56,
  width:     28,
  height:    56,
  velocityY: 0,
  onGround:  false,
  color:     "#f0c040",
  hp:            10,
  maxHp:         10,
  lastRegen:     Date.now(),
  dead:          false,
  swingTimer:    0,       // Zeitpunkt des letzten Angriffs (ms)
  swingDuration: 250,     // wie lange die Schwinganimation dauert (ms)
  facing:        1        // Blickrichtung: 1 = rechts, -1 = links
};

// ------------------------------------------------------------
// Kamera – folgt dem Spieler horizontal UND vertikal
// ------------------------------------------------------------
var cameraX = 0, cameraY = 0;

function updateCamera() {
  cameraX = player.x - canvas.width  / 2 + player.width  / 2;
  cameraY = player.y - canvas.height / 2 + player.height / 2;
  if (cameraX < 0) cameraX = 0;
  if (cameraY < 0) cameraY = 0;
  if (cameraX > WORLD_COLS * TILE - canvas.width)  cameraX = WORLD_COLS * TILE - canvas.width;
  if (cameraY > WORLD_ROWS * TILE - canvas.height) cameraY = WORLD_ROWS * TILE - canvas.height;
}
updateCamera();

// ------------------------------------------------------------
// Zombies
// ------------------------------------------------------------
var zombies          = [];
var MAX_ZOMBIES      = 35;  // mehr Zombies für die größere Welt (war 20)
var zombieSpawnTimer = Date.now();

// Einen einzelnen Zombie an einer bestimmten Position hinzufügen
// maxLimit ist optional: wird für Oberflächen-Spawn höher gesetzt
// strong = true → großer, starker Zombie (seltener)
function addZombieAt(col, row, maxLimit, strong) {
  var limit = (maxLimit !== undefined) ? maxLimit : MAX_ZOMBIES;
  if (zombies.length >= limit) return false;
  if (getTile(col, row)   !== AIR) return false;
  if (getTile(col, row+1) !== AIR) return false;
  if (!isSolid(getTile(col, row+2)))  return false;

  // Starker Zombie: größer, mehr HP, mehr Schaden
  var w      = strong ? 30 : 22;
  var h      = strong ? 62 : 48;
  var hp     = strong ? 5  : 3;
  var damage = strong ? 2.5 : 0.5;

  zombies.push({
    x:            col * TILE + (TILE - w) / 2,
    y:            row * TILE,
    width:        w,
    height:       h,
    hp:           hp,
    maxHp:        hp,
    damage:       damage,   // Schaden pro Treffer
    strong:       !!strong, // true = starker Zombie
    velocityY:    0,
    onGround:     false,
    lastHit:      0,         // wann hat dieser Zombie zuletzt den Spieler getroffen
    jumpCooldown: 0,         // wann hat er zuletzt gesprungen
    dir:          1
  });
  return true;
}

// Sucht eine gültige Höhlen-Position und spawnt dort eine Gruppe (2–4 Zombies)
function spawnGroup() {
  for (var attempt = 0; attempt < 150; attempt++) {
    var baseCol = Math.floor(1 + Math.random() * (WORLD_COLS - 2));
    var baseRow = Math.floor(14 + Math.random() * (WORLD_ROWS - 18));
    // 20% Chance auf einen starken Zombie als Gruppen-Anführer
    var strong = Math.random() < 0.20;
    if (!addZombieAt(baseCol, baseRow, undefined, strong)) continue;

    // Noch 1–3 weitere normale Zombies in der Nähe spawnen
    var extra = 1 + Math.floor(Math.random() * 3);
    for (var g = 0; g < extra; g++) {
      var dc = Math.floor(Math.random() * 7) - 3; // ±3 Spalten versetzt
      var c  = Math.max(1, Math.min(WORLD_COLS - 2, baseCol + dc));
      addZombieAt(c, baseRow);  // klappt nur wenn freier Platz
    }
    return;
  }
}

// Zombies an der Oberfläche spawnen (nachts)
function spawnGroupSurface() {
  // Nachts dürfen mehr Zombies als normal auf der Oberfläche sein
  var surfaceLimit = MAX_ZOMBIES + 20;

  // Alle gültigen Oberflächen-Spawnadressen sammeln (zuverlässiger als Zufalls-Versuche)
  var spots = [];
  for (var c = 2; c < WORLD_COLS - 2; c++) {
    for (var r = 1; r < 16; r++) {
      // Brauche: row=AIR, row+1=AIR, row+2=solid (Boden)
      if (world[r][c]   === AIR &&
          world[r+1][c] === AIR &&
          isSolid(world[r+2][c])) {
        spots.push({ col: c, row: r });
        break; // nur oberste gültige Zeile pro Spalte
      }
    }
  }

  console.log("[Nacht] Oberflächen-Spots:", spots.length, "| Zombies:", zombies.length, "/ Limit:", surfaceLimit);

  if (spots.length === 0) return;

  // Zufälligen Spot wählen
  var spot = spots[Math.floor(Math.random() * spots.length)];
  // 20% Chance auf starken Zombie als Gruppen-Anführer
  var strong = Math.random() < 0.20;
  if (!addZombieAt(spot.col, spot.row, surfaceLimit, strong)) return;

  // Noch 3–6 weitere Zombies daneben (größere Gruppe als tagsüber)
  var extra = 3 + Math.floor(Math.random() * 4);
  for (var g = 0; g < extra; g++) {
    var dc = Math.floor(Math.random() * 11) - 5; // bis ±5 Spalten versetzt
    var nc = Math.max(1, Math.min(WORLD_COLS - 2, spot.col + dc));
    addZombieAt(nc, spot.row, surfaceLimit);
  }
}

// Beim Start 2 Gruppen spawnen
spawnGroup();
spawnGroup();

// ------------------------------------------------------------
// Tag-Nacht-Zyklus
// ------------------------------------------------------------
var DAY_MS        = 60000;      // 1 Minute = 60 000 ms
var dayStartTime  = Date.now(); // Spielstart = Tagesbeginn
var nightSpawnTimer = Date.now();

// Wie weit sind wir im Zyklus? 0.0 = Tagesbeginn, 0.5 = Nachtbeginn, 1.0 = nächster Tag
function getDayProgress() {
  var elapsed = (Date.now() - dayStartTime) % (DAY_MS * 2);
  return elapsed / (DAY_MS * 2);
}

// Ist gerade Nacht?
function isNight() {
  return getDayProgress() >= 0.5;
}

// Helligkeit: 1.0 = voller Tag, 0.0 = Mitternacht
function getSkyBrightness() {
  var p = getDayProgress();
  // Übergang Tag→Nacht: p = 0.4..0.5 (letzte 6 Sek des Tags)
  if (p < 0.4)  return 1.0;
  if (p < 0.5)  return 1 - (p - 0.4) / 0.1;
  // Übergang Nacht→Tag: p = 0.9..1.0 (letzte 6 Sek der Nacht)
  if (p < 0.9)  return 0.0;
  return (p - 0.9) / 0.1;
}

// ------------------------------------------------------------
// Inventar + Block-Auswahl
// ------------------------------------------------------------
var inventory = {};
inventory[GRASS] = 0; inventory[DIRT] = 0; inventory[STONE] = 0;
inventory[WOOD]  = 0; inventory[LEAVES] = 0;
var selectedBlock = WOOD;

// ------------------------------------------------------------
// Handy-Erkennung
// ------------------------------------------------------------
// Wir gucken: ist der Bildschirm schmal, höher als breit oder gibt es Touch?
function isMobile() {
  return window.innerWidth <= 800
      || window.innerHeight > window.innerWidth
      || ("ontouchstart" in window);
}

// Modus auf dem Handy: "fight" = schlagen/abbauen, "build" = bauen
var mobileMode = "fight";

// ------------------------------------------------------------
// Eingabe: Tasten
// ------------------------------------------------------------
var keys = {};
document.addEventListener("keydown", function(e) {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "1") selectedBlock = WOOD;
  if (e.key === "2") selectedBlock = STONE;
  if (e.key === "3") selectedBlock = DIRT;
  if (e.key.toLowerCase() === "r" && player.dead) restartGame();
});
document.addEventListener("keyup", function(e) { keys[e.key.toLowerCase()] = false; });

// ------------------------------------------------------------
// Eingabe: Maus / Touch
// ------------------------------------------------------------
var mouse = { x: 0, y: 0, worldX: 0, worldY: 0, col: 0, row: 0, inRange: false };

// Klick/Touch-Position in Canvas-Koordinaten umrechnen
// (wichtig wenn das Canvas per CSS skaliert ist, z.B. auf dem Handy)
function getCanvasPos(e) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = canvas.width  / rect.width;
  var scaleY = canvas.height / rect.height;
  var x = (e.clientX - rect.left) * scaleX;
  var y = (e.clientY - rect.top)  * scaleY;
  var wx = x + cameraX;
  var wy = y + cameraY;
  return {
    x: x, y: y,
    worldX: wx, worldY: wy,
    col: Math.floor(wx / TILE),
    row: Math.floor(wy / TILE)
  };
}

// Ist diese Tile-Position in Spieler-Reichweite?
function isPosInRange(col, row) {
  var px = player.x + player.width  / 2;
  var py = player.y + player.height / 2;
  var tx = col * TILE + TILE / 2;
  var ty = row * TILE + TILE / 2;
  return Math.sqrt((px-tx)*(px-tx) + (py-ty)*(py-ty)) < REACH * TILE;
}

// Tap auf die Hotbar-Felder? (nur für Handy, damit man Material wählen kann)
function tapOnHotbar(x, y) {
  var slots = [WOOD, STONE, DIRT];
  var size  = 36, gap = 6;
  var total = slots.length * (size + gap) - gap;
  var sx = Math.floor((canvas.width - total) / 2);
  var hy = canvas.height - size - 8;
  if (y < hy || y > hy + size) return false;
  for (var i = 0; i < slots.length; i++) {
    var bx = sx + i * (size + gap);
    if (x >= bx && x <= bx + size) {
      selectedBlock = slots[i];
      return true;
    }
  }
  return false;
}

// Aktion: schlagen / Block abbauen
function attackAt(pos) {
  if (player.dead) return;
  player.swingTimer = Date.now();

  // Zuerst gucken ob ein Zombie getroffen wird
  var hitZombie = false;
  for (var i = 0; i < zombies.length; i++) {
    var z = zombies[i];
    var cursorOnZombie = pos.worldX >= z.x && pos.worldX <= z.x + z.width &&
                         pos.worldY >= z.y && pos.worldY <= z.y + z.height;
    var px = player.x + player.width  / 2;
    var py = player.y + player.height / 2;
    var zx = z.x + z.width  / 2;
    var zy = z.y + z.height / 2;
    var dist = Math.sqrt((px-zx)*(px-zx) + (py-zy)*(py-zy));
    if (cursorOnZombie && dist < REACH * TILE) {
      z.hp--;
      hitZombie = true;
      if (z.hp <= 0) zombies.splice(i, 1);
      break;
    }
  }

  if (!hitZombie) {
    if (!isPosInRange(pos.col, pos.row)) return;
    var type = getTile(pos.col, pos.row);
    if (type !== AIR && type !== WATER) {
      world[pos.row][pos.col] = AIR;
      if (inventory[type] !== undefined) inventory[type]++;
    }
  }
}

// Aktion: Block setzen
function buildAt(pos) {
  if (player.dead) return;
  if (!isPosInRange(pos.col, pos.row)) return;
  if (getTile(pos.col, pos.row) !== AIR) return;
  if (inventory[selectedBlock] <= 0) return;
  var pCL = Math.floor(player.x / TILE);
  var pCR = Math.floor((player.x + player.width  - 1) / TILE);
  var pRT = Math.floor(player.y / TILE);
  var pRB = Math.floor((player.y + player.height - 1) / TILE);
  if (pos.col >= pCL && pos.col <= pCR &&
      pos.row >= pRT && pos.row <= pRB) return;
  world[pos.row][pos.col] = selectedBlock;
  inventory[selectedBlock]--;
}

// Maus-Bewegung: Zielfeld aktualisieren (Desktop)
canvas.addEventListener("mousemove", function(e) {
  var pos = getCanvasPos(e);
  mouse.x       = pos.x;
  mouse.y       = pos.y;
  mouse.worldX  = pos.worldX;
  mouse.worldY  = pos.worldY;
  mouse.col     = pos.col;
  mouse.row     = pos.row;
  mouse.inRange = isPosInRange(pos.col, pos.row);
});

// Linksklick (Desktop): schlagen / abbauen
canvas.addEventListener("click", function(e) {
  var pos = getCanvasPos(e);
  // Auf Handy: erst Hotbar-Tap prüfen, dann je nach Modus
  if (isMobile()) {
    if (tapOnHotbar(pos.x, pos.y)) return;
    // Maus-Position für drawTarget aktualisieren
    mouse.worldX = pos.worldX; mouse.worldY = pos.worldY;
    mouse.col = pos.col; mouse.row = pos.row;
    mouse.inRange = isPosInRange(pos.col, pos.row);
    if (mobileMode === "build") { buildAt(pos); return; }
  }
  attackAt(pos);
});

// Rechtsklick (Desktop): Block setzen
canvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  var pos = getCanvasPos(e);
  buildAt(pos);
});

// ------------------------------------------------------------
// Handy-Steuerung: D-Pad, Spring-Button, Modus-Schalter
// ------------------------------------------------------------
function setupMobileControls() {
  var btnLeft  = document.getElementById("btnLeft");
  var btnRight = document.getElementById("btnRight");
  var btnJump  = document.getElementById("btnJump");
  var modeBtn  = document.getElementById("modeBtn");
  if (!btnLeft || !btnRight || !btnJump || !modeBtn) return;

  // Bindet einen Button an eine Taste (sowohl Touch als auch Maus)
  function bindKey(btn, key) {
    function down(e) { e.preventDefault(); keys[key] = true; }
    function up(e)   { e.preventDefault(); keys[key] = false; }
    btn.addEventListener("touchstart", down, { passive: false });
    btn.addEventListener("touchend",   up,   { passive: false });
    btn.addEventListener("touchcancel",up,   { passive: false });
    btn.addEventListener("mousedown",  down);
    btn.addEventListener("mouseup",    up);
    btn.addEventListener("mouseleave", up);
  }

  bindKey(btnLeft,  "a");
  bindKey(btnRight, "d");
  bindKey(btnJump,  "w");

  // Modus-Schalter: zwischen "fight" (Schwert) und "build" (Spitzhacke)
  function toggleMode(e) {
    if (e) e.preventDefault();
    mobileMode = (mobileMode === "fight") ? "build" : "fight";
    modeBtn.textContent = (mobileMode === "fight") ? "⚔" : "⛏";
  }
  modeBtn.addEventListener("click", toggleMode);
  modeBtn.addEventListener("touchend", toggleMode, { passive: false });

  // Neustart-Button per Tap aufs Game-Over (Handy hat kein "R")
  canvas.addEventListener("touchstart", function(e) {
    if (player.dead) {
      e.preventDefault();
      restartGame();
    }
  }, { passive: false });
}
setupMobileControls();

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------
function isSolid(type) {
  return type === GRASS || type === DIRT || type === STONE || type === WOOD;
}
function getTile(col, row) {
  if (col < 0 || col >= WORLD_COLS || row < 0 || row >= WORLD_ROWS) return STONE;
  return world[row][col];
}

function restartGame() {
  generateWorld();
  initWaterLevels();    // Füll-Niveaus für neue Welt zurücksetzen
  var s = findStart();
  player.x = s.col * TILE; player.y = s.row * TILE - 56;
  player.velocityY = 0; player.onGround = false;
  player.hp = 10; player.dead = false; player.lastRegen = Date.now();
  for (var k in inventory) inventory[k] = 0;
  zombies = [];
  spawnGroup();
  spawnGroup();
  zombieSpawnTimer  = Date.now();
  dayStartTime      = Date.now(); // neuer Tag nach Neustart
  nightSpawnTimer   = Date.now();
  updateCamera();
}

// ------------------------------------------------------------
// Update: Spieler-Physik + Zombie-KI + Schaden + Regen
// ------------------------------------------------------------
function update() {
  if (player.dead) return;

  // --- Spieler horizontal ---
  var dx = 0;
  if (keys["a"]) dx = -SPEED;
  if (keys["d"]) dx =  SPEED;
  player.x += dx;

  // Blickrichtung immer zur Maus hin (damit das Schwert korrekt schwingt)
  player.facing = (mouse.worldX >= player.x + player.width / 2) ? 1 : -1;

  if (dx !== 0) {
    var rT = Math.floor(player.y / TILE);
    var rB = Math.floor((player.y + player.height - 1) / TILE);
    if (dx > 0) {
      var col = Math.floor((player.x + player.width - 1) / TILE);
      if (isSolid(getTile(col, rT)) || isSolid(getTile(col, rB)))
        player.x = col * TILE - player.width;
    } else {
      var col = Math.floor(player.x / TILE);
      if (isSolid(getTile(col, rT)) || isSolid(getTile(col, rB)))
        player.x = (col + 1) * TILE;
    }
  }
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > WORLD_COLS * TILE)
    player.x = WORLD_COLS * TILE - player.width;

  // --- Springen ---
  if ((keys["w"] || keys[" "]) && player.onGround) {
    player.velocityY = JUMP_FORCE;
    player.onGround  = false;
  }

  // --- Spieler vertikal ---
  player.velocityY += GRAVITY;
  player.y         += player.velocityY;
  player.onGround   = false;
  var cL = Math.floor(player.x / TILE);
  var cR = Math.floor((player.x + player.width - 1) / TILE);
  if (player.velocityY >= 0) {
    var row = Math.floor((player.y + player.height) / TILE);
    if (isSolid(getTile(cL, row)) || isSolid(getTile(cR, row))) {
      player.y = row * TILE - player.height;
      player.velocityY = 0; player.onGround = true;
    }
  } else {
    var row = Math.floor(player.y / TILE);
    if (isSolid(getTile(cL, row)) || isSolid(getTile(cR, row))) {
      player.y = (row + 1) * TILE; player.velocityY = 0;
    }
  }

  // --- HP Regeneration: +1 alle 15 Sekunden ---
  var now = Date.now();
  if (now - player.lastRegen >= 15000) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    player.lastRegen = now;
  }

  // --- Zombies: Bewegung + Schwerkraft + Schaden ---
  for (var i = 0; i < zombies.length; i++) {
    var z = zombies[i];

    // Zombie bewegt sich auf den Spieler zu wenn er nah genug ist
    var zCX    = z.x + z.width  / 2;
    var pCX    = player.x + player.width / 2;
    var distPX = Math.abs(zCX - pCX);

    if (distPX < 320) {
      z.dir = (zCX < pCX) ? 1 : -1;

      // Horizontale Bewegung
      z.x += z.dir * 1.5;

      // Welche Zeilen belegt der Zombie (oben und unten)?
      var zRowTop = Math.floor(z.y / TILE);
      var zRowBot = Math.floor((z.y + z.height - 1) / TILE);
      var hitWall = false;

      if (z.dir > 0) {
        var wallCol = Math.floor((z.x + z.width - 1) / TILE);
        if (isSolid(getTile(wallCol, zRowTop)) || isSolid(getTile(wallCol, zRowBot))) {
          z.x     = wallCol * TILE - z.width;
          hitWall = true;
        }
      } else {
        var wallCol = Math.floor(z.x / TILE);
        if (isSolid(getTile(wallCol, zRowTop)) || isSolid(getTile(wallCol, zRowBot))) {
          z.x     = (wallCol + 1) * TILE;
          hitWall = true;
        }
      }

      if (hitWall) {
        if (z.onGround && Date.now() - z.jumpCooldown > 900) {
          // Auf dem Boden + Wand → drüber springen
          z.velocityY    = JUMP_FORCE * 0.88;
          z.onGround     = false;
          z.jumpCooldown = Date.now();
        } else if (!z.onGround) {
          // In der Luft + Wand → abprallen (Richtung umkehren)
          z.dir *= -1;
          z.x   += z.dir * 4;  // kleiner Schubs weg von der Wand
        }
      }

      // Auch springen wenn das Tile direkt vor ihm auf Bodenhöhe eine Wand ist
      // (damit er schon vor dem Aufprall abspringt, nicht erst danach)
      if (!hitWall && z.onGround && Date.now() - z.jumpCooldown > 900) {
        var feetRow    = Math.floor((z.y + z.height) / TILE);
        var lookCol    = (z.dir > 0)
          ? Math.floor((z.x + z.width + 2) / TILE)
          : Math.floor((z.x - 2) / TILE);
        if (isSolid(getTile(lookCol, feetRow - 1))) {
          z.velocityY    = JUMP_FORCE * 0.88;
          z.onGround     = false;
          z.jumpCooldown = Date.now();
        }
      }
    }

    // Zombie-Schwerkraft
    z.velocityY += GRAVITY;
    z.y         += z.velocityY;
    z.onGround   = false;
    var zCL = Math.floor(z.x / TILE);
    var zCR = Math.floor((z.x + z.width - 1) / TILE);
    if (z.velocityY >= 0) {
      // Fällt nach unten → Bodenkollision
      var zRow = Math.floor((z.y + z.height) / TILE);
      if (isSolid(getTile(zCL, zRow)) || isSolid(getTile(zCR, zRow))) {
        z.y = zRow * TILE - z.height; z.velocityY = 0; z.onGround = true;
      }
    } else {
      // Springt nach oben → Deckenkollision (war vorher nicht vorhanden!)
      var zRow = Math.floor(z.y / TILE);
      if (isSolid(getTile(zCL, zRow)) || isSolid(getTile(zCR, zRow))) {
        z.y         = (zRow + 1) * TILE;
        z.velocityY = 0;   // Aufprall stoppen, danach fällt der Zombie wieder
      }
    }

    // Berührt der Zombie den Spieler? → alle 2 Sekunden 0,5 HP Schaden
    var ox = player.x < z.x + z.width  && player.x + player.width  > z.x;
    var oy = player.y < z.y + z.height && player.y + player.height > z.y;
    if (ox && oy) {
      var t2 = Date.now();
      if (t2 - z.lastHit >= 2000) {
        player.hp -= z.damage;  // normaler Zombie: 0.5, starker: 2.5
        z.lastHit  = t2;
        if (player.hp <= 0) { player.hp = 0; player.dead = true; }
      }
    }
  }

  // --- Neue Zombie-Gruppe spawnen (alle 4 Sek, max 20) ---
  if (zombies.length < MAX_ZOMBIES && Date.now() - zombieSpawnTimer > 4000) {
    spawnGroup();
    zombieSpawnTimer = Date.now();
  }

  // --- Zombies blockieren den Spieler (wie Wände) ──────────────────────────
  // Läuft NACH allen Zombie-Bewegungen, damit die Auflösung immer stimmt.
  // Statt den Zombie wegzuschieben (→ Wand-Bug), wird jetzt der SPIELER geblockt.
  for (var zi = 0; zi < zombies.length; zi++) {
    var z = zombies[zi];
    var zox = player.x < z.x + z.width  && player.x + player.width  > z.x;
    var zoy = player.y < z.y + z.height && player.y + player.height > z.y;
    if (!zox || !zoy) continue;

    // Wie weit überlappt der Spieler in jede Richtung?
    var pushL = (player.x + player.width)  - z.x;       // Spieler ragt von links rein
    var pushR = (z.x + z.width) - player.x;             // Spieler ragt von rechts rein
    var pushD = (player.y + player.height) - z.y;       // Spieler ragt von oben rein
    var pushU = (z.y + z.height) - player.y;            // Spieler ragt von unten rein
    var minP  = Math.min(pushL, pushR, pushD, pushU);

    if (minP === pushD && player.velocityY >= 0) {
      // Spieler fällt von oben auf den Zombie → landet drauf (wie auf einem Block)
      player.y         = z.y - player.height;
      player.velocityY = 0;
      player.onGround  = true;

      // Decke direkt über dem Spieler prüfen (falls Zombie unter Decke steht)
      var pcL = Math.floor(player.x / TILE);
      var pcR = Math.floor((player.x + player.width - 1) / TILE);
      var prt = Math.floor(player.y / TILE);
      if (isSolid(getTile(pcL, prt)) || isSolid(getTile(pcR, prt))) {
        player.y = (prt + 1) * TILE;
      }

    } else if (minP === pushU && player.velocityY <= 0) {
      // Spieler springt von unten gegen den Zombie → Sprung gestoppt
      player.y         = z.y + z.height;
      player.velocityY = 0;

      // Boden unter dem Spieler prüfen
      var pcL = Math.floor(player.x / TILE);
      var pcR = Math.floor((player.x + player.width - 1) / TILE);
      var prb = Math.floor((player.y + player.height) / TILE);
      if (isSolid(getTile(pcL, prb)) || isSolid(getTile(pcR, prb))) {
        player.y = prb * TILE - player.height;
        player.velocityY = 0;
        player.onGround  = true;
      }

    } else if (minP === pushL) {
      // Zombie schiebt Spieler nach links → Wand links prüfen
      player.x = z.x - player.width;
      var prT = Math.floor(player.y / TILE);
      var prB = Math.floor((player.y + player.height - 1) / TILE);
      var pcL = Math.floor(player.x / TILE);
      if (isSolid(getTile(pcL, prT)) || isSolid(getTile(pcL, prB)))
        player.x = (pcL + 1) * TILE;  // Wand stoppt Spieler

    } else {
      // Zombie schiebt Spieler nach rechts → Wand rechts prüfen
      player.x = z.x + z.width;
      var prT = Math.floor(player.y / TILE);
      var prB = Math.floor((player.y + player.height - 1) / TILE);
      var pcR = Math.floor((player.x + player.width - 1) / TILE);
      if (isSolid(getTile(pcR, prT)) || isSolid(getTile(pcR, prB)))
        player.x = pcR * TILE - player.width;  // Wand stoppt Spieler
    }

    // Weltgrenzen nach Verschiebung einhalten
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > WORLD_COLS * TILE)
      player.x = WORLD_COLS * TILE - player.width;
  }

  updateCamera();

  // --- Zombies an der Oberfläche verbrennen bei Tag ---
  // (Zombies in Zeile < 14 sind an der Oberfläche, nicht in Höhlen)
  var bright = getSkyBrightness();
  if (bright > 0.5) {
    for (var bi = zombies.length - 1; bi >= 0; bi--) {
      var bz = zombies[bi];
      var zMidRow = Math.floor((bz.y + bz.height * 0.5) / TILE);
      if (zMidRow < 14) {
        // Zombie verbrennt: 3 HP → stirbt in ca. 1,5 Sekunden bei vollem Tag
        bz.hp -= 0.03 * bright;
        if (bz.hp <= 0) zombies.splice(bi, 1);
      }
    }
  }

  // --- Nachts: Zombies auch an der Oberfläche spawnen ---
  // (kein zombies.length < MAX_ZOMBIES – das prüft spawnGroupSurface selbst mit eigenem Limit)
  if (isNight() && Date.now() - nightSpawnTimer > 3000) {
    spawnGroupSurface();
    nightSpawnTimer = Date.now();
  }
}

// ------------------------------------------------------------
// Zeichnen
// ------------------------------------------------------------
function drawBackground() {
  var bright = getSkyBrightness();
  // Je tiefer die Kamera → dunkler (Höhle), außerdem Tag/Nacht-Helligkeit
  var depth  = Math.min(1, cameraY / (WORLD_ROWS * TILE * 0.6));
  var sky    = 1 - depth;  // 1 = oben, 0 = ganz unten

  // Tag: hellblau (135, 185, 235) — Nacht: fast schwarz (5, 5, 20)
  var cr = Math.round((135 * bright +  5 * (1 - bright)) * sky);
  var cg = Math.round((185 * bright +  5 * (1 - bright)) * sky);
  var cb = Math.round((235 * bright + 20 * (1 - bright)) * sky);
  ctx.fillStyle = "rgb(" + Math.max(5,cr) + "," + Math.max(5,cg) + "," + Math.max(10,cb) + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sterne: nur bei Nacht, wenn Kamera oben ist
  if (bright < 0.8 && cameraY < WORLD_ROWS * TILE * 0.2) {
    var starAlpha = (1 - bright) * 0.9;
    ctx.fillStyle = "rgba(255,255,255," + starAlpha + ")";
    // Feste Sterne (mit seed damit sie nicht flackern)
    for (var si = 0; si < 40; si++) {
      var sx2 = ((si * 137 + 31) % canvas.width);
      var sy2 = ((si * 89  + 17) % (canvas.height * 0.55));
      ctx.fillRect(sx2, sy2, si % 3 === 0 ? 2 : 1, si % 3 === 0 ? 2 : 1);
    }
  }
}

// Sonne bei Tag, Mond bei Nacht zeichnen
function drawSunMoon() {
  var p = getDayProgress();  // 0..1 im Zyklus

  if (!isNight()) {
    // ── Sonne ──────────────────────────────────────────
    var sunPhase = p * 2;          // 0 = Tagesanfang, 1 = Tagesende
    var sunX = sunPhase * (canvas.width + 80) - 40;
    // Bogen: links unten → oben Mitte → rechts unten
    var sunY = canvas.height * 0.18 - Math.sin(sunPhase * Math.PI) * (canvas.height * 0.22);

    // Leuchtschein
    ctx.fillStyle = "rgba(255, 230, 80, 0.25)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
    ctx.fill();
    // Sonne selbst
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
    ctx.fill();
    // Helles Zentrum
    ctx.fillStyle = "#FFF9C4";
    ctx.beginPath();
    ctx.arc(sunX - 6, sunY - 6, 10, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // ── Mond ───────────────────────────────────────────
    var moonPhase = (p - 0.5) * 2; // 0 = Nachtanfang, 1 = Nachtende
    var moonX = moonPhase * (canvas.width + 80) - 40;
    var moonY = canvas.height * 0.18 - Math.sin(moonPhase * Math.PI) * (canvas.height * 0.22);

    // Mond (voller Kreis)
    ctx.fillStyle = "#D0D0B0";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Sichelschatten (lässt Mond wie eine Sichel aussehen)
    var skyColor = getSkyBrightness() < 0.3
      ? "rgb(5,5,20)" : "rgb(15,15,40)";
    ctx.fillStyle = skyColor;
    ctx.beginPath();
    ctx.arc(moonX + 10, moonY - 3, 21, 0, Math.PI * 2);
    ctx.fill();
    // Krater
    ctx.fillStyle = "rgba(160,160,130,0.6)";
    ctx.beginPath(); ctx.arc(moonX - 6, moonY + 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(moonX + 3, moonY - 8, 4, 0, Math.PI * 2); ctx.fill();
  }
}

// Dunkles Overlay über die Welt legen (macht Tag/Nacht-Effekt)
function drawNightOverlay() {
  var b = getSkyBrightness();
  if (b >= 1) return;           // voller Tag → kein Overlay nötig
  var alpha = (1 - b) * 0.70;  // max 70% dunkel bei Mitternacht
  ctx.fillStyle = "rgba(0, 0, 30, " + alpha + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWorld() {
  var sc = Math.max(0, Math.floor(cameraX / TILE));
  var ec = Math.min(WORLD_COLS - 1, sc + COLS + 1);
  var sr = Math.max(0, Math.floor(cameraY / TILE));
  var er = Math.min(WORLD_ROWS - 1, sr + ROWS + 1);

  for (var row = sr; row <= er; row++) {
    for (var col = sc; col <= ec; col++) {
      var type = world[row][col];
      if (type === AIR) continue;

      var x = Math.floor(col * TILE - cameraX);
      var y = Math.floor(row * TILE - cameraY);

      // Wasser: Höhe hängt vom Füll-Niveau ab (wLevel 1–8), immer von unten
      if (type === WATER) {
        var lvl = wLevel[row][col] || 8;                    // Füllstand (1–8)
        var h   = Math.max(2, Math.round(lvl / 8 * TILE)); // Pixel-Höhe
        var wy  = y + TILE - h;                             // Startpunkt von unten
        ctx.fillStyle = COLORS[WATER];
        ctx.fillRect(x, wy, TILE, h);
        ctx.fillStyle = "rgba(100,200,255,0.4)";
        ctx.fillRect(x, wy, TILE, Math.min(5, h));          // Wellen-Streifen oben
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.strokeRect(x + 0.5, wy + 0.5, TILE - 1, h - 1);
        continue;
      }

      ctx.fillStyle = COLORS[type];
      ctx.fillRect(x, y, TILE, TILE);
      if (type === GRASS)  { ctx.fillStyle="rgba(144,224,80,1)";  ctx.fillRect(x,y,TILE,5); }
      if (type === STONE)  { ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x+4,y+4,TILE-8,TILE-8); }
      if (type === LEAVES) { ctx.fillStyle="rgba(0,0,0,0.15)"; ctx.fillRect(x+5,y+5,9,9); ctx.fillRect(x+17,y+15,7,7); }
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(x+0.5, y+0.5, TILE-1, TILE-1);
    }
  }
}

function drawTarget() {
  if (!mouse.inRange) return;
  var type = getTile(mouse.col, mouse.row);
  if (type === AIR || type === WATER) return;
  var x = Math.floor(mouse.col * TILE - cameraX);
  var y = Math.floor(mouse.row * TILE - cameraY);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth   = 2;
  ctx.strokeRect(x+2, y+2, TILE-4, TILE-4);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.lineWidth = 1;
}

function drawPlayer() {
  if (player.dead) return;
  var px = Math.floor(player.x - cameraX);
  var py = Math.floor(player.y - cameraY);

  // Körper
  ctx.fillStyle = player.color;
  ctx.fillRect(px, py+20, player.width, 36);
  // Kopf
  ctx.fillStyle = "#f5d88a";
  ctx.fillRect(px+4, py, 20, 20);
  // Augen: je nach Blickrichtung auf der richtigen Seite
  ctx.fillStyle = "#333";
  if (player.facing >= 0) {
    // Schaut nach rechts
    ctx.fillRect(px+7,  py+6, 4, 4);
    ctx.fillRect(px+15, py+6, 4, 4);
  } else {
    // Schaut nach links (gespiegelt)
    ctx.fillRect(px+9,  py+6, 4, 4);
    ctx.fillRect(px+17, py+6, 4, 4);
  }

  // --- Schwertanimation ---
  // Fortschritt: 0 = Angriff gerade gestartet, 1 = fertig
  var elapsed  = Date.now() - player.swingTimer;
  var progress = Math.min(1, elapsed / player.swingDuration);

  // Drehpunkt: Schulter auf der Seite, in die der Spieler schaut
  var facingRight = (player.facing >= 0);
  var pivotX = facingRight ? px + player.width + 2 : px - 2;
  var pivotY = py + 26;

  // Winkel: von -100° (Schwert oben) bis +50° (Schwert unten)
  var startAngle = -100 * Math.PI / 180;
  var endAngle   =   50 * Math.PI / 180;
  // Ruhehaltung (kein Angriff): leicht nach unten
  var restAngle  =    8 * Math.PI / 180;

  var angle = progress >= 1
    ? restAngle
    : startAngle + progress * (endAngle - startAngle);

  // Halbtransparenter Schwungbogen während der Animation
  if (progress < 1) {
    ctx.save();
    ctx.translate(pivotX, pivotY);
    if (!facingRight) ctx.scale(-1, 1);  // nach links spiegeln
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth   = 8;
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 20, startAngle, angle);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap   = "butt";
    ctx.restore();
  }

  // Schwert zeichnen (rotiert um den Drehpunkt, gespiegelt wenn links)
  ctx.save();
  ctx.translate(pivotX, pivotY);
  if (!facingRight) ctx.scale(-1, 1);  // nach links spiegeln
  ctx.rotate(angle);

  // Klinge (lang, hellgrau, vom Drehpunkt nach rechts)
  ctx.fillStyle = "#d4d4d4";
  ctx.fillRect(2, -3, 20, 5);
  // Spitze etwas heller
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(19, -2, 5, 3);
  // Parierstange (quer zum Griff)
  ctx.fillStyle = "#888";
  ctx.fillRect(-1, -7, 4, 14);
  // Griff (nach links vom Drehpunkt)
  ctx.fillStyle = "#7a5230";
  ctx.fillRect(-12, -3, 12, 5);
  // Knauf am Ende
  ctx.fillStyle = "#a0703a";
  ctx.beginPath();
  ctx.arc(-13, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawZombies() {
  for (var i = 0; i < zombies.length; i++) {
    var z  = zombies[i];
    var zx = Math.floor(z.x - cameraX);
    var zy = Math.floor(z.y - cameraY);

    // Farbschema: grün = normal, dunkelrot = stark
    var ratio = z.hp / z.maxHp; // 1.0 = voll, 0.0 = fast tot

    var bodyColor, headColor;
    if (z.strong) {
      // Starker Zombie: dunkelrot, wird schwärzer bei Schaden
      bodyColor = ratio > 0.6 ? "#7f0000" : ratio > 0.3 ? "#5c0000" : "#2a0000";
      headColor = ratio > 0.6 ? "#b71c1c" : ratio > 0.3 ? "#880000" : "#4a0000";
    } else {
      // Normaler Zombie: grün, wird schwärzer bei Schaden
      bodyColor = ratio > 0.6 ? "#2e7d32" : ratio > 0.3 ? "#1b5e20" : "#0a2e0a";
      headColor = ratio > 0.6 ? "#388e3c" : ratio > 0.3 ? "#2e5e30" : "#1a3a1a";
    }

    // Kopfhöhe und Körper-Startpunkt proportional zur Zombie-Größe
    var headH  = Math.round(z.height * 0.35); // ~35% Kopf
    var bodyY  = Math.round(z.height * 0.30); // Körper startet bei 30%

    // Körper
    ctx.fillStyle = bodyColor;
    ctx.fillRect(zx, zy + bodyY, z.width, z.height - bodyY);
    // Kopf
    ctx.fillStyle = headColor;
    ctx.fillRect(zx + 1, zy, z.width - 2, headH);

    // Augen (immer 2, bei letztem Viertel HP ein X-Auge)
    var eyeSize = z.strong ? 6 : 5;
    ctx.fillStyle = z.strong ? "#ff1744" : "#e53935"; // starker Zombie leuchtet heller
    ctx.fillRect(zx + 3, zy + 5, eyeSize, eyeSize);
    if (ratio > 0.25) {
      ctx.fillRect(zx + z.width - eyeSize - 3, zy + 5, eyeSize, eyeSize);
    } else {
      // Auge zu: X
      ctx.strokeStyle = z.strong ? "#ff1744" : "#e53935";
      ctx.lineWidth = 2;
      var ex = zx + z.width - eyeSize - 3;
      ctx.beginPath(); ctx.moveTo(ex, zy+5); ctx.lineTo(ex+eyeSize, zy+5+eyeSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex+eyeSize, zy+5); ctx.lineTo(ex, zy+5+eyeSize); ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Starker Zombie: kleine Hörner auf dem Kopf
    if (z.strong) {
      ctx.fillStyle = "#4a0000";
      ctx.fillRect(zx + 5,           zy - 5, 4, 6); // linkes Horn
      ctx.fillRect(zx + z.width - 9, zy - 5, 4, 6); // rechtes Horn
    }

    // Arme ausgestreckt
    var armW = z.strong ? 13 : 10;
    var armH = z.strong ? 8  : 6;
    ctx.fillStyle = bodyColor;
    if (z.dir >= 0) {
      ctx.fillRect(zx + z.width, zy + bodyY + 2, armW, armH);
    } else {
      ctx.fillRect(zx - armW, zy + bodyY + 2, armW, armH);
    }

    // --- Wunden als rote Schnitte ---
    ctx.strokeStyle = "#cc0000";
    ctx.lineWidth   = 2;

    if (ratio <= 0.65) {
      // Erste Wunde: Schnitt quer über den Körper
      ctx.beginPath();
      ctx.moveTo(zx + 2,           zy + bodyY + 4);
      ctx.lineTo(zx + z.width - 4, zy + bodyY + 16);
      ctx.stroke();
      ctx.fillStyle = "rgba(180,0,0,0.55)";
      ctx.fillRect(zx + 5, zy + bodyY + 6, 7, 4);
    }
    if (ratio <= 0.30) {
      // Zweite Wunde: Schnitt über den Kopf
      ctx.beginPath();
      ctx.moveTo(zx + 4,           zy + 2);
      ctx.lineTo(zx + z.width - 3, zy + headH - 2);
      ctx.stroke();
      // Dritte Wunde
      ctx.beginPath();
      ctx.moveTo(zx + z.width - 4, zy + bodyY + 18);
      ctx.lineTo(zx + 3,           zy + z.height - 8);
      ctx.stroke();
      ctx.fillStyle = "rgba(180,0,0,0.6)";
      ctx.fillRect(zx + 6, zy + 3, 6, 3);
      // Dunkle Überlagerung – sieht schwer verletzt aus
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(zx, zy, z.width, z.height);
    }

    ctx.lineWidth = 1;

    // HP-Balken über dem Zombie (starker Zombie: orangefarbener Balken)
    ctx.fillStyle = "#333";
    ctx.fillRect(zx, zy - 8, z.width, 5);
    ctx.fillStyle = z.strong ? "#ff6d00" : "#e53935";
    ctx.fillRect(zx, zy - 8, Math.floor(z.width * ratio), 5);
  }
}

function drawHpBar() {
  var bx = canvas.width - 164, by = 10, bw = 150, bh = 16;
  // Hintergrund
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(bx-4, by-4, bw+8, bh+24);
  // Leerer Balken
  ctx.fillStyle = "#333";
  ctx.fillRect(bx, by, bw, bh);
  // Gefüllter Balken (Farbe je nach HP)
  var ratio = player.hp / player.maxHp;
  ctx.fillStyle = ratio > 0.5 ? "#4caf50" : ratio > 0.25 ? "#ff9800" : "#f44336";
  ctx.fillRect(bx, by, Math.floor(bw * ratio), bh);
  // Rahmen
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeRect(bx, by, bw, bh);
  // Text
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.fillText("HP: " + player.hp.toFixed(1) + " / " + player.maxHp, bx, by + bh + 14);
}

function drawInventory() {
  var slots = [WOOD, STONE, DIRT, GRASS, LEAVES];
  var sx = 8, sy = 8, sh = 22;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(sx-4, sy-4, 120, slots.length * sh + 8);
  for (var i = 0; i < slots.length; i++) {
    var type = slots[i], y = sy + i * sh;
    ctx.fillStyle = COLORS[type];  ctx.fillRect(sx, y, 14, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.strokeRect(sx, y, 14, 14);
    ctx.fillStyle = "#fff"; ctx.font = "12px monospace";
    ctx.fillText(NAMES[type] + ": " + inventory[type], sx+18, y+11);
  }
}

function drawHotbar() {
  var slots = [WOOD, STONE, DIRT], labels = ["1","2","3"];
  var size = 36, gap = 6;
  var total = slots.length * (size+gap) - gap;
  var sx = Math.floor((canvas.width-total)/2), y = canvas.height-size-8;
  for (var i = 0; i < slots.length; i++) {
    var type = slots[i], x = sx + i*(size+gap);
    ctx.fillStyle = (type===selectedBlock) ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = COLORS[type]; ctx.fillRect(x+4, y+4, size-8, size-8);
    if (type === selectedBlock) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.strokeRect(x+1, y+1, size-2, size-2); ctx.lineWidth = 1;
    }
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px monospace";
    ctx.fillText(labels[i], x+4, y+12);
    ctx.fillStyle = inventory[type] > 0 ? "#fff" : "#f66";
    ctx.font = "11px monospace";
    ctx.fillText(inventory[type], x+size-14, y+size-4);
  }
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f44336";
  ctx.font = "bold 52px monospace";
  ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 24);
  ctx.fillStyle = "#fff";
  ctx.font = "20px monospace";
  ctx.fillText("R drücken zum Neustart", canvas.width/2, canvas.height/2 + 20);
  ctx.textAlign = "left";
}

// ------------------------------------------------------------
// updateWater: Wasser-Physik mit Füll-Niveau (wLevel 1–8)
//
// Jedes Wasser-Tile hat ein Füll-Niveau von 1 (Achtel) bis 8 (voll).
// Schritt 1: Wasser fällt + füllt von unten auf (jeden Frame)
// Schritt 2: Wasser gleicht Niveaus aus → gerade Oberfläche (alle 4 Frames)
//   Unterschied ≥ 2 → 1 Einheit fließt zum niedrigeren Nachbarn
//   Tiles mit Level 0 werden zu Luft, neue Tiles starten bei Level 1
// ------------------------------------------------------------
var waterTick = 0;

// Merkt sich welche Tiles schon diesen Tick bewegt wurden (verhindert Doppel-Bewegung)
var waterMoved = [];
for (var _r2 = 0; _r2 < WORLD_ROWS; _r2++) {
  waterMoved[_r2] = [];
  for (var _c2 = 0; _c2 < WORLD_COLS; _c2++) waterMoved[_r2][_c2] = false;
}

// Hilfsfunktion: entfernt Wasser aus einer Zelle
function removeWater(r, c) {
  world[r][c]  = AIR;
  wLevel[r][c] = 0;
}

// Hilfsfunktion: fügt Wasser zu einer Zelle hinzu (erzeugt sie falls nötig)
// Gibt zurück wie viel tatsächlich hinzugefügt wurde
function addWater(r, c, amount) {
  if (world[r][c] === AIR) {
    world[r][c]  = WATER;
    wLevel[r][c] = 0;
  }
  var space = 8 - wLevel[r][c];
  var added  = Math.min(space, amount);
  wLevel[r][c] += added;
  return added;
}

function updateWater() {
  waterTick++;

  // ── Schritt 1: Fallen (jeden Frame, von unten nach oben) ─────────────────
  // Wasser fällt nach unten und füllt Tiles von unten auf
  for (var row = WORLD_ROWS - 2; row >= 0; row--) {
    for (var col = 1; col < WORLD_COLS - 1; col++) {
      if (world[row][col] !== WATER) continue;
      var L = wLevel[row][col];
      if (L <= 0) { removeWater(row, col); continue; }

      // Wenn das Tile darunter nicht voll ist → Wasser hineinfüllen
      if (world[row + 1][col] === WATER && wLevel[row + 1][col] < 8) {
        var moved = addWater(row + 1, col, L);
        wLevel[row][col] -= moved;
        if (wLevel[row][col] <= 0) { removeWater(row, col); continue; }
        L = wLevel[row][col];
      }

      // Wenn das Tile darunter Luft ist → zum tiefsten Punkt fallen
      if (world[row + 1][col] === AIR) {
        var deepest = row + 1;
        while (deepest + 1 < WORLD_ROWS - 1 && world[deepest + 1][col] === AIR) deepest++;
        // Tiefste Position: evtl. nicht-volles Wasser darunter auffüllen
        if (world[deepest][col] === WATER && wLevel[deepest][col] < 8) {
          var moved2 = addWater(deepest, col, L);
          wLevel[row][col] -= moved2;
          if (wLevel[row][col] <= 0) removeWater(row, col);
        } else if (world[deepest][col] === AIR) {
          removeWater(row, col);
          world[deepest][col]  = WATER;
          wLevel[deepest][col] = L;
        }
      }
    }
  }

  // ── Schritt 2: Sofort-Ausgleich (alle 4 Frames) ──────────────────────────
  // Zusammenhängende Wasserfläche in einer Zeile wird SOFORT auf gleiches Niveau gebracht.
  // Statt 8 Einzel-Schritte: das ganze Segment auf einmal berechnen → keine Treppe mehr!
  if (waterTick % 4 !== 0) return;

  // waterMoved als "bereits verarbeitet"-Merker nutzen
  for (var r = 0; r < WORLD_ROWS; r++)
    for (var c = 0; c < WORLD_COLS; c++)
      waterMoved[r][c] = false;

  for (var row = WORLD_ROWS - 2; row >= 0; row--) {
    for (var col = 1; col < WORLD_COLS - 1; col++) {
      if (waterMoved[row][col]) continue;        // schon verarbeitet
      if (world[row][col] !== WATER) continue;   // kein Wasser hier
      if (world[row + 1][col] === AIR) continue; // fällt noch → Schritt 1

      // ── Segment-Grenzen ermitteln ─────────────────────────────────────────
      // Wie weit geht das zusammenhängende Wasser/Luft-Gebiet in dieser Zeile?
      // Wir gehen so weit, bis eine Wand (fester Block) kommt.
      // Luft-Tiles über einem Abgrund werden auch mitgenommen → das Wasser
      // läuft seitlich raus und fällt dann mit Schritt 1 nach unten (Wasserfall!)
      var segStart = col;
      while (segStart > 1 &&
             (world[row][segStart - 1] === WATER || world[row][segStart - 1] === AIR)) {
        segStart--;
      }
      var segEnd = col;
      while (segEnd < WORLD_COLS - 2 &&
             (world[row][segEnd + 1] === WATER || world[row][segEnd + 1] === AIR)) {
        segEnd++;
      }

      // ── Alle Tiles im Segment sammeln + Gesamtmenge zählen ───────────────
      var tiles = [];
      var total = 0;
      for (var sc = segStart; sc <= segEnd; sc++) {
        waterMoved[row][sc] = true;
        tiles.push(sc);
        if (world[row][sc] === WATER) total += wLevel[row][sc];
      }

      if (total === 0) continue; // leeres Segment, nichts zu tun

      // ── Wasser gleichmäßig verteilen ─────────────────────────────────────
      // Beispiel: 7 Tiles mit insgesamt 28 Wasser → jedes Tile bekommt 4
      var avg = Math.floor(total / tiles.length);
      var rem = total - avg * tiles.length; // Rest: erste rem Tiles bekommen 1 mehr
      for (var ti = 0; ti < tiles.length; ti++) {
        var lvl = avg + (ti < rem ? 1 : 0);
        var tc  = tiles[ti];
        if (lvl > 0) {
          world[row][tc]  = WATER;
          wLevel[row][tc] = Math.min(8, lvl);
        } else {
          if (world[row][tc] === WATER) removeWater(row, tc);
        }
      }
    }
  }
}

// ------------------------------------------------------------
// Game Loop
// ------------------------------------------------------------
function gameLoop() {
  updateWater();
  drawBackground();   // Himmel (Farbe je nach Tag/Nacht)
  drawSunMoon();      // Sonne oder Mond zeichnen
  drawWorld();        // Blöcke zeichnen
  drawNightOverlay(); // Dunkel-Overlay bei Nacht
  drawTarget();
  drawZombies();
  drawPlayer();
  drawInventory();
  drawHotbar();
  drawHpBar();
  if (player.dead) drawGameOver();
  update();
  requestAnimationFrame(gameLoop);
}

gameLoop();
