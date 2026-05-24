// ============================================================
// MiniCraft Browser – Tiefe Welt, Höhlen, Zombies, Schwert, HP
// ============================================================

var canvas = document.getElementById("gameCanvas");
var ctx    = canvas.getContext("2d");

var TILE       = 32;
var COLS       = Math.ceil(canvas.width  / TILE);
var ROWS       = Math.ceil(canvas.height / TILE);
var WORLD_COLS = 120;
var WORLD_ROWS = 32;   // 32 Zeilen tief (war 15)

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
var MAX_ZOMBIES      = 20;
var zombieSpawnTimer = Date.now();

// Einen einzelnen Zombie an einer bestimmten Position hinzufügen
function addZombieAt(col, row) {
  if (zombies.length >= MAX_ZOMBIES) return false;
  if (getTile(col, row)   !== AIR) return false;
  if (getTile(col, row+1) !== AIR) return false;
  if (!isSolid(getTile(col, row+2)))  return false;
  zombies.push({
    x:            col * TILE + (TILE - 22) / 2,
    y:            row * TILE,
    width:        22,
    height:       48,
    hp:           3,
    maxHp:        3,
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
    // Basis-Position muss gültig sein
    if (!addZombieAt(baseCol, baseRow)) continue;

    // Noch 1–3 weitere Zombies in der Nähe spawnen
    var extra = 1 + Math.floor(Math.random() * 3);
    for (var g = 0; g < extra; g++) {
      var dc = Math.floor(Math.random() * 7) - 3; // ±3 Spalten versetzt
      var c  = Math.max(1, Math.min(WORLD_COLS - 2, baseCol + dc));
      addZombieAt(c, baseRow);  // klappt nur wenn freier Platz
    }
    return;
  }
}

// Beim Start 2 Gruppen spawnen
spawnGroup();
spawnGroup();

// ------------------------------------------------------------
// Inventar + Block-Auswahl
// ------------------------------------------------------------
var inventory = {};
inventory[GRASS] = 0; inventory[DIRT] = 0; inventory[STONE] = 0;
inventory[WOOD]  = 0; inventory[LEAVES] = 0;
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
  if (e.key.toLowerCase() === "r" && player.dead) restartGame();
});
document.addEventListener("keyup", function(e) { keys[e.key.toLowerCase()] = false; });

// ------------------------------------------------------------
// Eingabe: Maus
// ------------------------------------------------------------
var mouse = { x: 0, y: 0, worldX: 0, worldY: 0, col: 0, row: 0, inRange: false };

canvas.addEventListener("mousemove", function(e) {
  var rect     = canvas.getBoundingClientRect();
  mouse.x      = e.clientX - rect.left;
  mouse.y      = e.clientY - rect.top;
  mouse.worldX = mouse.x + cameraX;
  mouse.worldY = mouse.y + cameraY;
  mouse.col    = Math.floor(mouse.worldX / TILE);
  mouse.row    = Math.floor(mouse.worldY / TILE);

  var px = player.x + player.width  / 2;
  var py = player.y + player.height / 2;
  var tx = mouse.col * TILE + TILE / 2;
  var ty = mouse.row * TILE + TILE / 2;
  mouse.inRange = Math.sqrt((px-tx)*(px-tx) + (py-ty)*(py-ty)) < REACH * TILE;
});

// Linksklick: erst Zombie treffen, dann Block abbauen
canvas.addEventListener("click", function(e) {
  if (player.dead) return;

  // Schwinganimation starten
  player.swingTimer = Date.now();

  // Treffer: Mauszeiger muss direkt auf dem Zombie sein
  var hitZombie = false;
  for (var i = 0; i < zombies.length; i++) {
    var z = zombies[i];

    // Ist der Mauszeiger innerhalb der Zombie-Fläche?
    var cursorOnZombie = mouse.worldX >= z.x && mouse.worldX <= z.x + z.width &&
                         mouse.worldY >= z.y && mouse.worldY <= z.y + z.height;

    // Ist der Spieler nah genug (Reichweite)?
    var px = player.x + player.width  / 2;
    var py = player.y + player.height / 2;
    var zx = z.x + z.width  / 2;
    var zy = z.y + z.height / 2;
    var playerDist = Math.sqrt((px-zx)*(px-zx) + (py-zy)*(py-zy));

    if (cursorOnZombie && playerDist < REACH * TILE) {
      z.hp--;
      hitZombie = true;
      if (z.hp <= 0) zombies.splice(i, 1);
      break;
    }
  }

  if (!hitZombie) {
    // Block abbauen
    if (!mouse.inRange) return;
    var type = getTile(mouse.col, mouse.row);
    if (type !== AIR && type !== WATER) {
      world[mouse.row][mouse.col] = AIR;
      if (inventory[type] !== undefined) inventory[type]++;
    }
  }
});

// Rechtsklick: Block setzen
canvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  if (player.dead) return;
  if (!mouse.inRange) return;
  if (getTile(mouse.col, mouse.row) !== AIR) return;
  if (inventory[selectedBlock] <= 0) return;
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
  zombieSpawnTimer = Date.now();
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
        player.hp -= 0.5;
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
}

// ------------------------------------------------------------
// Zeichnen
// ------------------------------------------------------------
function drawBackground() {
  // Je tiefer, desto dunkler (Himmel → Höhle)
  var depth = Math.min(1, cameraY / (WORLD_ROWS * TILE * 0.6));
  var r = Math.round(135 * (1 - depth));
  var g = Math.round(185 * (1 - depth));
  var b = Math.round(235 * (1 - depth));
  ctx.fillStyle = "rgb(" + Math.max(5,r) + "," + Math.max(5,g) + "," + Math.max(10,b) + ")";
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

    // Körperfarbe wird dunkler je mehr Schaden
    var bodyColor = z.hp === 3 ? "#2e7d32" : z.hp === 2 ? "#1b5e20" : "#0a2e0a";
    var headColor = z.hp === 3 ? "#388e3c" : z.hp === 2 ? "#2e5e30" : "#1a3a1a";

    // Körper
    ctx.fillStyle = bodyColor;
    ctx.fillRect(zx, zy+16, z.width, 32);
    // Kopf
    ctx.fillStyle = headColor;
    ctx.fillRect(zx+1, zy, z.width-2, 18);

    // Augen – bei 1 HP ein Auge "zu" (X-Auge)
    ctx.fillStyle = "#e53935";
    ctx.fillRect(zx+3,  zy+5, 5, 5);
    if (z.hp > 1) {
      ctx.fillRect(zx+14, zy+5, 5, 5);
    } else {
      // Auge zu: kleines X
      ctx.strokeStyle = "#e53935";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(zx+13, zy+5); ctx.lineTo(zx+19, zy+10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(zx+19, zy+5); ctx.lineTo(zx+13, zy+10); ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Arme ausgestreckt
    ctx.fillStyle = bodyColor;
    if (z.dir >= 0) {
      ctx.fillRect(zx + z.width, zy+18, 10, 6);
    } else {
      ctx.fillRect(zx - 10, zy+18, 10, 6);
    }

    // --- Wunden als rote Schnitte ---
    ctx.strokeStyle = "#cc0000";
    ctx.lineWidth   = 2;

    if (z.hp <= 2) {
      // Erste Wunde: Schnitt quer über den Körper
      ctx.beginPath();
      ctx.moveTo(zx + 2,  zy + 20);
      ctx.lineTo(zx + 16, zy + 32);
      ctx.stroke();
      // Blutfleck
      ctx.fillStyle = "rgba(180,0,0,0.55)";
      ctx.fillRect(zx + 5, zy + 22, 7, 4);
    }

    if (z.hp <= 1) {
      // Zweite Wunde: Schnitt über den Kopf
      ctx.beginPath();
      ctx.moveTo(zx + 4,  zy + 2);
      ctx.lineTo(zx + 17, zy + 13);
      ctx.stroke();
      // Dritte Wunde: zweiter Körperschnitt
      ctx.beginPath();
      ctx.moveTo(zx + 14, zy + 26);
      ctx.lineTo(zx + 3,  zy + 38);
      ctx.stroke();
      // Blutflecken
      ctx.fillStyle = "rgba(180,0,0,0.6)";
      ctx.fillRect(zx + 7,  zy + 4,  6, 3);
      ctx.fillRect(zx + 4,  zy + 34, 8, 3);
      // Dunkle Überlagerung – sieht schwer verletzt aus
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(zx, zy, z.width, z.height);
    }

    ctx.lineWidth = 1;

    // HP-Balken über dem Zombie
    ctx.fillStyle = "#333";
    ctx.fillRect(zx, zy-8, z.width, 5);
    ctx.fillStyle = "#e53935";
    ctx.fillRect(zx, zy-8, Math.floor(z.width * z.hp / z.maxHp), 5);
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

  // ── Schritt 2: Niveau ausgleichen (alle 4 Frames, 8 Durchläufe) ─────────────
  // Wasser gleicht sich mit direkten Nachbarn aus → flache Oberfläche
  // 8 Durchläufe pro Tick → Wasser kann bis zu 8 Tiles weit pro Tick fließen
  if (waterTick % 4 !== 0) return;

  for (var pass = 0; pass < 8; pass++) {
    // Bewegungs-Merker zurücksetzen (jeder Durchlauf ist unabhängig)
    for (var r = 0; r < WORLD_ROWS; r++)
      for (var c = 0; c < WORLD_COLS; c++)
        waterMoved[r][c] = false;

    for (var row = WORLD_ROWS - 2; row >= 0; row--) {
      for (var col = 1; col < WORLD_COLS - 1; col++) {
        if (world[row][col] !== WATER) continue;
        if (waterMoved[row][col]) continue;        // schon in diesem Durchlauf bewegt
        if (world[row + 1][col] === AIR) continue; // fällt noch → Schritt 1 kümmert sich

        var L = wLevel[row][col];
        if (L <= 0) { removeWater(row, col); continue; }

        // Füll-Niveau der direkten Nachbarn (999 = Wand blockiert)
        var leftL  = (world[row][col - 1] === WATER) ? wLevel[row][col - 1]
                   : (world[row][col - 1] === AIR   ? 0 : 999);
        var rightL = (world[row][col + 1] === WATER) ? wLevel[row][col + 1]
                   : (world[row][col + 1] === AIR   ? 0 : 999);

        // Fließt nur wenn Unterschied ≥ 2 → kein ewiges Hin-und-Her
        var canLeft  = leftL  !== 999 && leftL  <= L - 2;
        var canRight = rightL !== 999 && rightL <= L - 2;

        var flowDir = 0;
        if      (canLeft && canRight) flowDir = (leftL <= rightL) ? -1 : 1;
        else if (canLeft)             flowDir = -1;
        else if (canRight)            flowDir =  1;

        if (flowDir !== 0) {
          var nc = col + flowDir;
          var neighborL = (flowDir === -1) ? leftL : rightL;
          // Halbe Differenz übertragen → [8,0]→[4,4] in 1 Durchlauf, kein Hin-und-Her
          var flowAmount = Math.floor((L - neighborL) / 2);
          if (flowAmount < 1) flowAmount = 1;
          wLevel[row][col] -= flowAmount;
          addWater(row, nc, flowAmount);
          waterMoved[row][nc] = true;
          if (wLevel[row][col] <= 0) removeWater(row, col);
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
  drawBackground();
  drawWorld();
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
