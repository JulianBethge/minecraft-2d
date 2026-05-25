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
var DIAMOND_ORE = 7; // Neuer Block: Diamant-Erz (tief unten, braucht Spitzhacke)

var COLORS = {};
COLORS[GRASS]       = "#6ab04c"; COLORS[DIRT]       = "#9b5e28";
COLORS[STONE]       = "#808080"; COLORS[WOOD]       = "#7a5230";
COLORS[LEAVES]      = "#2e8b2e"; COLORS[WATER]      = "#2980b9";
COLORS[DIAMOND_ORE] = "#808080"; // Grau wie Stein, aber mit blauen Flecken

// ------------------------------------------------------------
// Sound-System (Web Audio API – keine Dateien nötig, alles generiert)
// ------------------------------------------------------------
var audioCtx = null;
function getAudio() {
  // AudioContext erst beim ersten Ton erstellen (Browser-Regel: erst nach Klick)
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return null; }
  }
  return audioCtx;
}

// Ton: Frequenz, Wellenform, Lautstärke, Dauer, Endfrequenz (optional)
function playTone(freq, wave, vol, dur, freqEnd) {
  var ac = getAudio(); if (!ac) return;
  var osc = ac.createOscillator();
  var gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = wave || "square";
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (freqEnd !== undefined)
    osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + dur);
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.start(); osc.stop(ac.currentTime + dur);
}

// Rauschen: für Schlag- und Abbau-Geräusche
function playNoise(vol, dur, filterHz) {
  var ac = getAudio(); if (!ac) return;
  var frames = Math.floor(ac.sampleRate * dur);
  var buf = ac.createBuffer(1, frames, ac.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  var src = ac.createBufferSource(); src.buffer = buf;
  var flt = ac.createBiquadFilter(); flt.type = "bandpass";
  flt.frequency.value = filterHz || 1000;
  var gain = ac.createGain();
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  src.connect(flt); flt.connect(gain); gain.connect(ac.destination);
  src.start(); src.stop(ac.currentTime + dur);
}

// Konkrete Sound-Funktionen
function sndJump()        { playTone(200, "sine",     0.10, 0.12, 320); }
function sndBlockBreak()  { playNoise(0.20, 0.10, 600); playTone(110, "square", 0.06, 0.07); }
function sndBlockPlace()  { playNoise(0.14, 0.06, 2200); playTone(200, "square", 0.07, 0.04); }
function sndSwing()       { playNoise(0.08, 0.09, 3500); }
function sndHitZombie()   { playTone(140, "sawtooth", 0.12, 0.09, 70); }
function sndHitSkeleton() { playTone(260, "square",   0.10, 0.08, 160); }
function sndHitPlayer()   { playTone(80,  "sawtooth", 0.18, 0.18, 45); }
function sndArrowHit()    { playNoise(0.10, 0.06, 4000); playTone(180, "sine", 0.07, 0.07, 90); }
function sndDeath()       { playTone(100, "sawtooth", 0.18, 0.5, 35); playTone(55, "sine", 0.10, 0.7, 25); }
function sndShoot()       { playNoise(0.07, 0.07, 5000); playTone(300, "sine", 0.05, 0.06, 250); }

var NAMES = {};
NAMES[GRASS]       = "Gras";    NAMES[DIRT]       = "Erde";
NAMES[STONE]       = "Stein";   NAMES[WOOD]       = "Holz";
NAMES[LEAVES]      = "Blätter"; NAMES[DIAMOND_ORE]= "Diamant-Erz";

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

  // Diamant-Erz: selten, nur tief unter der Erde (ab Zeile 28)
  for (var row = 28; row < WORLD_ROWS - 3; row++) {
    for (var col = 2; col < WORLD_COLS - 2; col++) {
      if (world[row][col] === STONE && Math.random() < 0.012) {
        world[row][col] = DIAMOND_ORE;
      }
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
// Skelette (schießen Pfeile auf den Spieler)
// ------------------------------------------------------------
var skeletons          = [];
var MAX_SKELETONS      = 15;
var skeletonSpawnTimer = Date.now();
var arrows             = []; // alle fliegenden Pfeile

// Einen Skelett-Gegner an Position hinzufügen
// strong = true → Boss-Skelett (größer, mehr HP, mehr Schaden)
function addSkeletonAt(col, row, maxLimit, strong) {
  var limit = (maxLimit !== undefined) ? maxLimit : MAX_SKELETONS;
  if (skeletons.length >= limit) return false;
  if (getTile(col, row)   !== AIR) return false;
  if (getTile(col, row+1) !== AIR) return false;
  if (!isSolid(getTile(col, row+2)))  return false;

  // Boss-Skelett: größer, mehr HP, mehr Schaden pro Pfeil
  var w      = strong ? 30 : 22;
  var h      = strong ? 62 : 48;
  var hp     = strong ? 5  : 3;
  var damage = strong ? 2.5 : 0.5;

  skeletons.push({
    x:            col * TILE + (TILE - w) / 2,
    y:            row * TILE,
    width:        w,
    height:       h,
    hp:           hp,
    maxHp:        hp,
    damage:       damage,    // wird auf jeden Pfeil gegeben
    strong:       !!strong,
    velocityY:    0,
    onGround:     false,
    jumpCooldown: 0,
    shootCooldown: Date.now() + 1000, // 1s Aufwärm-Zeit nach Spawn
    dir:          1
  });
  return true;
}

// Skelett-Gruppe in Höhle spawnen (kleiner als Zombie-Gruppe)
function spawnSkeletonGroup() {
  for (var attempt = 0; attempt < 150; attempt++) {
    var baseCol = Math.floor(1 + Math.random() * (WORLD_COLS - 2));
    var baseRow = Math.floor(14 + Math.random() * (WORLD_ROWS - 18));
    // 15% Chance auf Boss-Skelett (seltener als bei Zombies)
    var strong = Math.random() < 0.15;
    if (!addSkeletonAt(baseCol, baseRow, undefined, strong)) continue;

    // Noch 0–2 weitere Skelette daneben (kleinere Gruppen als Zombies)
    var extra = Math.floor(Math.random() * 3);
    for (var g = 0; g < extra; g++) {
      var dc = Math.floor(Math.random() * 7) - 3;
      var c  = Math.max(1, Math.min(WORLD_COLS - 2, baseCol + dc));
      addSkeletonAt(c, baseRow);
    }
    return;
  }
}

// Skelette an der Oberfläche spawnen (nachts)
function spawnSkeletonGroupSurface() {
  var surfaceLimit = MAX_SKELETONS + 10;

  var spots = [];
  for (var c = 2; c < WORLD_COLS - 2; c++) {
    for (var r = 1; r < 16; r++) {
      if (world[r][c]   === AIR &&
          world[r+1][c] === AIR &&
          isSolid(world[r+2][c])) {
        spots.push({ col: c, row: r });
        break;
      }
    }
  }
  if (spots.length === 0) return;

  var spot = spots[Math.floor(Math.random() * spots.length)];
  var strong = Math.random() < 0.15;
  if (!addSkeletonAt(spot.col, spot.row, surfaceLimit, strong)) return;

  // Noch 1–3 weitere daneben
  var extra = 1 + Math.floor(Math.random() * 3);
  for (var g = 0; g < extra; g++) {
    var dc = Math.floor(Math.random() * 11) - 5;
    var nc = Math.max(1, Math.min(WORLD_COLS - 2, spot.col + dc));
    addSkeletonAt(nc, spot.row, surfaceLimit);
  }
}

// Beim Start eine Skelett-Gruppe spawnen
spawnSkeletonGroup();

// ------------------------------------------------------------
// Creeper (laufen lautlos ran, zünden sich an und explodieren)
// ------------------------------------------------------------
var creepers          = [];
var MAX_CREEPERS      = 10;
var creeperSpawnTimer = Date.now();
var explosions        = []; // Visuelle Explosions-Effekte

function addCreeperAt(col, row, maxLimit, strong) {
  var limit = (maxLimit !== undefined) ? maxLimit : MAX_CREEPERS;
  if (creepers.length >= limit) return false;
  if (getTile(col, row)   !== AIR) return false;
  if (getTile(col, row+1) !== AIR) return false;
  if (!isSolid(getTile(col, row+2))) return false;

  var w  = strong ? 28 : 20;
  var h  = strong ? 60 : 46;
  var hp = strong ? 5  : 3;

  creepers.push({
    x:            col * TILE + (TILE - w) / 2,
    y:            row * TILE,
    width:        w,
    height:       h,
    hp:           hp,
    maxHp:        hp,
    strong:       !!strong,
    velocityY:    0,
    onGround:     false,
    jumpCooldown: 0,
    dir:          1,
    fuse:         0,        // 0 = Lunte nicht gezündet
    fuseStart:    0         // Zeitstempel wann Lunte angezündet wurde
  });
  return true;
}

function spawnCreeperGroup() {
  for (var attempt = 0; attempt < 150; attempt++) {
    var baseCol = Math.floor(1 + Math.random() * (WORLD_COLS - 2));
    var baseRow = Math.floor(14 + Math.random() * (WORLD_ROWS - 18));
    var strong  = Math.random() < 0.12; // 12% Boss-Creeper
    if (!addCreeperAt(baseCol, baseRow, undefined, strong)) continue;
    var extra = Math.floor(Math.random() * 2); // kleine Gruppen
    for (var g = 0; g < extra; g++) {
      var dc = Math.floor(Math.random() * 7) - 3;
      addCreeperAt(Math.max(1, Math.min(WORLD_COLS-2, baseCol+dc)), baseRow);
    }
    return;
  }
}

function spawnCreeperGroupSurface() {
  var surfaceLimit = MAX_CREEPERS + 8;
  var spots = [];
  for (var c = 2; c < WORLD_COLS - 2; c++) {
    for (var r = 1; r < 16; r++) {
      if (world[r][c] === AIR && world[r+1][c] === AIR && isSolid(world[r+2][c])) {
        spots.push({ col: c, row: r }); break;
      }
    }
  }
  if (spots.length === 0) return;
  var spot   = spots[Math.floor(Math.random() * spots.length)];
  var strong = Math.random() < 0.12;
  if (!addCreeperAt(spot.col, spot.row, surfaceLimit, strong)) return;
  var extra = 1 + Math.floor(Math.random() * 3);
  for (var g = 0; g < extra; g++) {
    var dc = Math.floor(Math.random() * 9) - 4;
    addCreeperAt(Math.max(1, Math.min(WORLD_COLS-2, spot.col+dc)), spot.row, surfaceLimit);
  }
}

// Sound für Explosion und Zischen
function sndFuse()      { playTone(600, "sawtooth", 0.08, 0.1, 900); }
function sndExplosion() {
  playNoise(0.35, 0.4, 200);
  playTone(80, "sawtooth", 0.25, 0.3, 30);
}

// Beim Start eine Creeper-Gruppe spawnen
spawnCreeperGroup();

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
inventory[GRASS]  = 0; inventory[DIRT]   = 0; inventory[STONE] = 0;
inventory[WOOD]   = 0; inventory[LEAVES] = 0;
// Neue Items (kein Block, nur gezählt im Inventar)
inventory["diamond"]  = 0;  // Diamanten
inventory["pickaxe"]  = 0;  // Spitzhacke (0=nicht gebaut, 1=gebaut)
inventory["sword_up"] = 0;  // Schwert-Upgrade
inventory["bow"]      = 0;  // Bogen
inventory["arrow"]    = 0;  // Pfeile (Anzahl)

// Hotbar: 6 Slots — 3 Blöcke + 3 Werkzeuge
// Slot 0–2: Blöcke zum Bauen (WOOD, STONE, DIRT)
// Slot 3: Spitzhacke  Slot 4: Schwert (/ Schwert+)  Slot 5: Bogen
var selectedSlot  = 0;  // aktuell ausgewählter Hotbar-Slot
var selectedBlock = WOOD; // für Blöcke (Slots 0-2)

// Crafting-Menü
var craftingOpen = false;

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
  // Hotbar-Slots mit Tasten 1–6 wählen
  if (e.key === "1") { selectedSlot = 0; selectedBlock = WOOD; }
  if (e.key === "2") { selectedSlot = 1; selectedBlock = STONE; }
  if (e.key === "3") { selectedSlot = 2; selectedBlock = DIRT; }
  if (e.key === "4") { selectedSlot = 3; } // Spitzhacke
  if (e.key === "5") { selectedSlot = 4; } // Schwert
  if (e.key === "6") { selectedSlot = 5; } // Bogen
  // E = Crafting-Menü öffnen/schließen
  if (e.key.toLowerCase() === "e") craftingOpen = !craftingOpen;
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
  var slotBlocks = [WOOD, STONE, DIRT];
  var size = 36, gap = 5;
  var total = 6 * (size + gap) - gap;
  var sx = Math.floor((canvas.width - total) / 2);
  var hy = canvas.height - size - 8;
  if (y < hy || y > hy + size) return false;
  for (var i = 0; i < 6; i++) {
    var bx = sx + i * (size + gap);
    if (x >= bx && x <= bx + size) {
      selectedSlot = i;
      if (i < 3) selectedBlock = slotBlocks[i];
      return true;
    }
  }
  return false;
}

// Aktion: schlagen / Block abbauen / Pfeil schießen
function attackAt(pos) {
  if (player.dead) return;

  // Bogen-Slot: Pfeil schießen statt schlagen
  if (selectedSlot === 5 && inventory["bow"] > 0 && inventory["arrow"] > 0) {
    var aFromX = player.x + player.width  / 2;
    var aFromY = player.y + player.height * 0.35;
    var aToX   = pos.worldX, aToY = pos.worldY;
    var ddx = aToX - aFromX, ddy = aToY - aFromY;
    var len = Math.sqrt(ddx*ddx + ddy*ddy); if (len < 1) len = 1;
    arrows.push({ x: aFromX, y: aFromY,
      vx: (ddx/len)*8, vy: (ddy/len)*8 - 1.5,
      damage: 2, strong: false, life: 200, fromPlayer: true });
    inventory["arrow"]--;
    sndShoot();
    return;
  }

  player.swingTimer = Date.now();
  sndSwing(); // Schwingen-Geräusch immer

  // Schwert-Schaden: normal=1, mit Upgrade=3
  var swordDmg = inventory["sword_up"] > 0 ? 3 : 1;

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
      z.hp -= swordDmg;
      sndHitZombie();
      hitZombie = true;
      if (z.hp <= 0) zombies.splice(i, 1);
      break;
    }
  }

  // Wenn kein Zombie getroffen: gucken ob ein Skelett getroffen wird
  var hitSkeleton = false;
  if (!hitZombie) {
    for (var si = 0; si < skeletons.length; si++) {
      var s = skeletons[si];
      var cursorOnSk = pos.worldX >= s.x && pos.worldX <= s.x + s.width &&
                       pos.worldY >= s.y && pos.worldY <= s.y + s.height;
      var pxS = player.x + player.width  / 2;
      var pyS = player.y + player.height / 2;
      var sxC = s.x + s.width  / 2;
      var syC = s.y + s.height / 2;
      var distS = Math.sqrt((pxS-sxC)*(pxS-sxC) + (pyS-syC)*(pyS-syC));
      if (cursorOnSk && distS < REACH * TILE) {
        s.hp -= swordDmg;
        sndHitSkeleton();
        hitSkeleton = true;
        if (s.hp <= 0) skeletons.splice(si, 1);
        break;
      }
    }
  }

  // Creeper treffen?
  var hitCreeper = false;
  if (!hitZombie && !hitSkeleton) {
    for (var ci = 0; ci < creepers.length; ci++) {
      var cr = creepers[ci];
      var cursorOnCr = pos.worldX >= cr.x && pos.worldX <= cr.x + cr.width &&
                       pos.worldY >= cr.y && pos.worldY <= cr.y + cr.height;
      var pxC = player.x + player.width  / 2;
      var pyC = player.y + player.height / 2;
      var cxC = cr.x + cr.width  / 2;
      var cyC = cr.y + cr.height / 2;
      var distC = Math.sqrt((pxC-cxC)*(pxC-cxC) + (pyC-cyC)*(pyC-cyC));
      if (cursorOnCr && distC < REACH * TILE) {
        cr.hp -= swordDmg;
        hitCreeper = true;
        if (cr.hp <= 0) creepers.splice(ci, 1);
        else sndHitZombie();
        break;
      }
    }
  }

  if (!hitZombie && !hitSkeleton && !hitCreeper) {
    if (!isPosInRange(pos.col, pos.row)) return;
    var type = getTile(pos.col, pos.row);
    if (type !== AIR && type !== WATER) {
      // Diamant-Erz braucht eine Spitzhacke!
      if (type === DIAMOND_ORE) {
        if (inventory["pickaxe"] < 1) {
          // Kurzes visuelles Feedback: Ziel blinkt (keinen Block abbauen)
          player.noPickaxeFlash = Date.now();
          return;
        }
        // Mit Spitzhacke: 1 Diamant bekommen
        world[pos.row][pos.col] = AIR;
        sndBlockBreak();
        inventory["diamond"]++;
      } else {
        world[pos.row][pos.col] = AIR;
        sndBlockBreak();
        if (inventory[type] !== undefined) inventory[type]++;
      }
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
  sndBlockPlace();
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

  // Crafting-Menü offen? → Klick auf Rezept-Buttons prüfen
  if (craftingOpen) {
    tryCraftClick(pos.x, pos.y);
    return;
  }

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

// Rechtsklick (Desktop): Block setzen (nur wenn Block-Slot gewählt)
canvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  if (craftingOpen) { craftingOpen = false; return; }
  if (selectedSlot <= 2) {
    var pos = getCanvasPos(e);
    buildAt(pos);
  }
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
  return type === GRASS || type === DIRT || type === STONE || type === WOOD || type === DIAMOND_ORE;
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
  selectedSlot = 0;
  craftingOpen = false;
  zombies = [];
  spawnGroup();
  spawnGroup();
  zombieSpawnTimer  = Date.now();
  // Skelette + Pfeile auch zurücksetzen
  skeletons = [];
  arrows    = [];
  spawnSkeletonGroup();
  skeletonSpawnTimer = Date.now();
  creepers   = [];
  explosions = [];
  spawnCreeperGroup();
  creeperSpawnTimer = Date.now();
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
    sndJump();
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
        if (player.hp <= 0) { player.hp = 0; player.dead = true; sndDeath(); }
        else sndHitPlayer();
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

  // --- Skelette: Bewegung + Schwerkraft + Schießen ---
  for (var si = 0; si < skeletons.length; si++) {
    var s = skeletons[si];

    // Blickrichtung zum Spieler
    var sCX    = s.x + s.width  / 2;
    var pCXS   = player.x + player.width / 2;
    var distSP = Math.abs(sCX - pCXS);
    s.dir = (sCX < pCXS) ? 1 : -1;

    // Skelett bewegt sich, wenn Spieler nah genug ist
    // Zwischen 120–320px → ranlaufen; unter 120px → wegrennen (Abstand halten)
    // moveDir = echte Bewegungsrichtung (wichtig für Wand-Checks!)
    var moveDir = 0;
    if (distSP < 320 && distSP > 120) {
      moveDir = s.dir;       // ranlaufen: Richtung zum Spieler
    } else if (distSP < 120) {
      moveDir = -s.dir;      // wegrennen: entgegengesetzte Richtung
    }

    if (moveDir !== 0) {
      s.x += moveDir * 1.0;

      // Wand-Kollision mit der ECHTEN Bewegungsrichtung prüfen
      var sRowTop  = Math.floor(s.y / TILE);
      var sRowBot  = Math.floor((s.y + s.height - 1) / TILE);
      var hitWallS = false;

      if (moveDir > 0) {
        // Läuft nach rechts → rechte Seite prüfen
        var wcS = Math.floor((s.x + s.width - 1) / TILE);
        if (isSolid(getTile(wcS, sRowTop)) || isSolid(getTile(wcS, sRowBot))) {
          s.x = wcS * TILE - s.width;
          hitWallS = true;
        }
      } else {
        // Läuft nach links → linke Seite prüfen
        var wcS = Math.floor(s.x / TILE);
        if (isSolid(getTile(wcS, sRowTop)) || isSolid(getTile(wcS, sRowBot))) {
          s.x = (wcS + 1) * TILE;
          hitWallS = true;
        }
      }

      if (hitWallS) {
        if (s.onGround && Date.now() - s.jumpCooldown > 900) {
          // Auf dem Boden + Wand → drüber springen
          s.velocityY    = JUMP_FORCE * 0.88;
          s.onGround     = false;
          s.jumpCooldown = Date.now();
        } else if (!s.onGround) {
          // In der Luft + Wand → abprallen
          s.dir *= -1;
          s.x   += s.dir * 4;
        }
      }

      // Schon vor der Wand abspringen (look-ahead) – mit echter Bewegungsrichtung
      if (!hitWallS && s.onGround && Date.now() - s.jumpCooldown > 900) {
        var sFeetRow = Math.floor((s.y + s.height) / TILE);
        var sLookCol = (moveDir > 0)
          ? Math.floor((s.x + s.width + 2) / TILE)
          : Math.floor((s.x - 2) / TILE);
        if (isSolid(getTile(sLookCol, sFeetRow - 1))) {
          s.velocityY    = JUMP_FORCE * 0.88;
          s.onGround     = false;
          s.jumpCooldown = Date.now();
        }
      }
    }

    // Schwerkraft
    s.velocityY += GRAVITY;
    s.y         += s.velocityY;
    s.onGround   = false;
    var sCL = Math.floor(s.x / TILE);
    var sCR = Math.floor((s.x + s.width - 1) / TILE);
    if (s.velocityY >= 0) {
      var sRow = Math.floor((s.y + s.height) / TILE);
      if (isSolid(getTile(sCL, sRow)) || isSolid(getTile(sCR, sRow))) {
        s.y = sRow * TILE - s.height; s.velocityY = 0; s.onGround = true;
      }
    } else {
      var sRow = Math.floor(s.y / TILE);
      if (isSolid(getTile(sCL, sRow)) || isSolid(getTile(sCR, sRow))) {
        s.y = (sRow + 1) * TILE; s.velocityY = 0;
      }
    }

    // ── Sicherheits-Check: Skelett darf niemals in einer Wand stecken ────────
    // Prüft BEIDE Seiten nach jeder Bewegung und schiebt das Skelett raus.
    // Das verhindert das Einbuggen in Wände beim Fliehen oder nach dem Springen.
    var ssRT = Math.floor(s.y / TILE);
    var ssRB = Math.floor((s.y + s.height - 1) / TILE);
    // Linke Seite in Wand? → nach rechts schieben
    var ssLeft = Math.floor(s.x / TILE);
    if (isSolid(getTile(ssLeft, ssRT)) || isSolid(getTile(ssLeft, ssRB))) {
      s.x = (ssLeft + 1) * TILE;
    }
    // Rechte Seite in Wand? → nach links schieben
    var ssRight = Math.floor((s.x + s.width - 1) / TILE);
    if (isSolid(getTile(ssRight, ssRT)) || isSolid(getTile(ssRight, ssRB))) {
      s.x = ssRight * TILE - s.width;
    }
    // Weltgrenzen einhalten
    if (s.x < 0) s.x = 0;
    if (s.x + s.width > WORLD_COLS * TILE) s.x = WORLD_COLS * TILE - s.width;

    // Schießen: alle 2 Sekunden, wenn Spieler in Sicht und nah genug
    if (distSP < 360 && Date.now() - s.shootCooldown > 2000) {
      var aFromX = s.x + s.width / 2;
      var aFromY = s.y + s.height * 0.35; // aus dem Oberkörper raus
      var aToX   = player.x + player.width  / 2;
      var aToY   = player.y + player.height / 2;
      var ddx = aToX - aFromX;
      var ddy = aToY - aFromY;
      var len = Math.sqrt(ddx*ddx + ddy*ddy);
      if (len < 1) len = 1;
      var arrowSpeed = s.strong ? 7 : 6;
      arrows.push({
        x:  aFromX,
        y:  aFromY,
        vx: (ddx / len) * arrowSpeed,
        vy: (ddy / len) * arrowSpeed - 1.5, // leichter Bogen nach oben
        damage: s.damage,
        strong: s.strong,
        life:   180  // verschwindet nach 180 Frames (~3 Sek)
      });
      sndShoot();
      s.shootCooldown = Date.now();
    }
  }

  // --- Skelette blockieren den Spieler (wie Wände) ---
  for (var ski = 0; ski < skeletons.length; ski++) {
    var s = skeletons[ski];
    var sox = player.x < s.x + s.width  && player.x + player.width  > s.x;
    var soy = player.y < s.y + s.height && player.y + player.height > s.y;
    if (!sox || !soy) continue;

    var pushLs = (player.x + player.width)  - s.x;
    var pushRs = (s.x + s.width) - player.x;
    var pushDs = (player.y + player.height) - s.y;
    var pushUs = (s.y + s.height) - player.y;
    var minPs  = Math.min(pushLs, pushRs, pushDs, pushUs);

    if (minPs === pushDs && player.velocityY >= 0) {
      player.y = s.y - player.height; player.velocityY = 0; player.onGround = true;
    } else if (minPs === pushUs && player.velocityY <= 0) {
      player.y = s.y + s.height; player.velocityY = 0;
    } else if (minPs === pushLs) {
      player.x = s.x - player.width;
    } else {
      player.x = s.x + s.width;
    }
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > WORLD_COLS * TILE)
      player.x = WORLD_COLS * TILE - player.width;
  }

  // --- Pfeile bewegen + Kollision ---
  for (var ai = arrows.length - 1; ai >= 0; ai--) {
    var a = arrows[ai];
    a.vy += 0.15;          // leichte Schwerkraft auf Pfeile
    a.x  += a.vx;
    a.y  += a.vy;
    a.life--;

    // Spieler-Pfeile (fromPlayer=true) treffen Gegner, nicht den Spieler selbst
    if (a.fromPlayer) {
      var arrowHit = false;
      // Zombies treffen
      for (var azi = zombies.length-1; azi >= 0; azi--) {
        var az = zombies[azi];
        if (a.x >= az.x && a.x <= az.x+az.width && a.y >= az.y && a.y <= az.y+az.height) {
          az.hp -= a.damage; sndHitZombie();
          if (az.hp <= 0) zombies.splice(azi, 1);
          arrows.splice(ai, 1); arrowHit = true; break;
        }
      }
      if (arrowHit) continue;
      // Skelette treffen
      for (var asi = skeletons.length-1; asi >= 0; asi--) {
        var ask = skeletons[asi];
        if (a.x >= ask.x && a.x <= ask.x+ask.width && a.y >= ask.y && a.y <= ask.y+ask.height) {
          ask.hp -= a.damage; sndHitSkeleton();
          if (ask.hp <= 0) skeletons.splice(asi, 1);
          arrows.splice(ai, 1); arrowHit = true; break;
        }
      }
      if (arrowHit) continue;
      // Creeper treffen
      for (var aci = creepers.length-1; aci >= 0; aci--) {
        var acr = creepers[aci];
        if (a.x >= acr.x && a.x <= acr.x+acr.width && a.y >= acr.y && a.y <= acr.y+acr.height) {
          acr.hp -= a.damage; sndHitZombie();
          if (acr.hp <= 0) creepers.splice(aci, 1);
          arrows.splice(ai, 1); arrowHit = true; break;
        }
      }
      if (arrowHit) continue;
    } else {
      // Gegner-Pfeile treffen den Spieler
      if (a.x >= player.x && a.x <= player.x + player.width &&
          a.y >= player.y && a.y <= player.y + player.height) {
        player.hp -= a.damage;
        if (player.hp <= 0) { player.hp = 0; player.dead = true; sndDeath(); }
        else sndArrowHit();
        arrows.splice(ai, 1);
        continue;
      }
    }

    // Treffer Wand?
    var ac = Math.floor(a.x / TILE);
    var ar = Math.floor(a.y / TILE);
    if (isSolid(getTile(ac, ar))) {
      arrows.splice(ai, 1);
      continue;
    }

    // Aus der Welt geflogen oder Lebenszeit vorbei?
    if (a.life <= 0 || a.x < 0 || a.x > WORLD_COLS * TILE ||
        a.y < 0 || a.y > WORLD_ROWS * TILE) {
      arrows.splice(ai, 1);
    }
  }

  // --- Neue Skelett-Gruppe spawnen (alle 6 Sek, seltener als Zombies) ---
  if (skeletons.length < MAX_SKELETONS && Date.now() - skeletonSpawnTimer > 6000) {
    spawnSkeletonGroup();
    skeletonSpawnTimer = Date.now();
  }

  // --- Creeper: Bewegung + Lunte + Explosion ---
  for (var ci = creepers.length - 1; ci >= 0; ci--) {
    var cr = creepers[ci];
    var crCX  = cr.x + cr.width  / 2;
    var crPCX = player.x + player.width  / 2;
    var crDist = Math.abs(crCX - crPCX);
    cr.dir = (crCX < crPCX) ? 1 : -1;

    // Lunte-Radius: normal 56px, Boss 72px
    var fuseRadius = cr.strong ? 72 : 56;

    if (cr.fuse === 0) {
      // ── Keine Lunte: Creeper läuft auf Spieler zu (wie Zombie) ───────────
      if (crDist < 320) {
        cr.x += cr.dir * 1.2;

        var crRowTop = Math.floor(cr.y / TILE);
        var crRowBot = Math.floor((cr.y + cr.height - 1) / TILE);
        var crHitWall = false;
        if (cr.dir > 0) {
          var crWC = Math.floor((cr.x + cr.width - 1) / TILE);
          if (isSolid(getTile(crWC, crRowTop)) || isSolid(getTile(crWC, crRowBot))) {
            cr.x = crWC * TILE - cr.width; crHitWall = true;
          }
        } else {
          var crWC = Math.floor(cr.x / TILE);
          if (isSolid(getTile(crWC, crRowTop)) || isSolid(getTile(crWC, crRowBot))) {
            cr.x = (crWC + 1) * TILE; crHitWall = true;
          }
        }
        if (crHitWall) {
          if (cr.onGround && Date.now() - cr.jumpCooldown > 900) {
            cr.velocityY = JUMP_FORCE * 0.88; cr.onGround = false; cr.jumpCooldown = Date.now();
          } else if (!cr.onGround) { cr.dir *= -1; cr.x += cr.dir * 4; }
        }
        if (!crHitWall && cr.onGround && Date.now() - cr.jumpCooldown > 900) {
          var crFR = Math.floor((cr.y + cr.height) / TILE);
          var crLC = (cr.dir > 0) ? Math.floor((cr.x + cr.width + 2) / TILE) : Math.floor((cr.x - 2) / TILE);
          if (isSolid(getTile(crLC, crFR - 1))) {
            cr.velocityY = JUMP_FORCE * 0.88; cr.onGround = false; cr.jumpCooldown = Date.now();
          }
        }

        // Spieler nah genug → Lunte anzünden!
        if (crDist < fuseRadius) {
          cr.fuse = 1;
          cr.fuseStart = Date.now();
          sndFuse();
        }
      }
    } else {
      // ── Lunte brennt: Creeper steht still und blinkt ─────────────────────
      var fuseTime = cr.strong ? 1500 : 2000; // Boss explodiert schneller

      // Spieler weggegangen? → Lunte erlischt
      if (crDist > fuseRadius + 20) {
        cr.fuse = 0;
      }

      // Zeit abgelaufen → EXPLOSION!
      if (Date.now() - cr.fuseStart >= fuseTime) {
        var expRadius = cr.strong ? 5 : 3; // Explosionsradius in Tiles
        var expCCol   = Math.floor(crCX / TILE);
        var expCRow   = Math.floor((cr.y + cr.height * 0.5) / TILE);

        // Blöcke zerstören (runder Bereich)
        for (var er2 = -expRadius; er2 <= expRadius; er2++) {
          for (var ec2 = -expRadius; ec2 <= expRadius; ec2++) {
            if (er2*er2 + ec2*ec2 <= expRadius*expRadius) {
              var tr = expCRow + er2, tc = expCCol + ec2;
              if (tr >= 0 && tr < WORLD_ROWS && tc >= 0 && tc < WORLD_COLS)
                if (world[tr][tc] !== AIR) world[tr][tc] = AIR;
            }
          }
        }

        // Spieler-Schaden abhängig von Entfernung
        var pDist = Math.sqrt(
          (player.x + player.width/2  - crCX) * (player.x + player.width/2  - crCX) +
          (player.y + player.height/2 - (cr.y + cr.height*0.5)) * (player.y + player.height/2 - (cr.y + cr.height*0.5))
        );
        var maxExpDist = expRadius * TILE;
        if (pDist < maxExpDist) {
          var dmg = cr.strong ? 8 : 4;
          player.hp -= dmg * (1 - pDist / maxExpDist);
          if (player.hp <= 0) { player.hp = 0; player.dead = true; sndDeath(); }
        }

        // Explosions-Effekt hinzufügen
        explosions.push({ x: crCX, y: cr.y + cr.height * 0.5,
          r: 0, maxR: expRadius * TILE * 1.2,
          alpha: 1.0, strong: cr.strong });

        sndExplosion();
        creepers.splice(ci, 1); // Creeper verschwindet
        continue;
      }
    }

    // Schwerkraft
    cr.velocityY += GRAVITY;
    cr.y += cr.velocityY;
    cr.onGround = false;
    var crCL = Math.floor(cr.x / TILE), crCR = Math.floor((cr.x + cr.width - 1) / TILE);
    if (cr.velocityY >= 0) {
      var crRow = Math.floor((cr.y + cr.height) / TILE);
      if (isSolid(getTile(crCL, crRow)) || isSolid(getTile(crCR, crRow))) {
        cr.y = crRow * TILE - cr.height; cr.velocityY = 0; cr.onGround = true;
      }
    } else {
      var crRow = Math.floor(cr.y / TILE);
      if (isSolid(getTile(crCL, crRow)) || isSolid(getTile(crCR, crRow))) {
        cr.y = (crRow + 1) * TILE; cr.velocityY = 0;
      }
    }
    // Wand-Sicherheits-Check
    var crRT = Math.floor(cr.y / TILE), crRB = Math.floor((cr.y + cr.height - 1) / TILE);
    var crLeft = Math.floor(cr.x / TILE);
    if (isSolid(getTile(crLeft, crRT)) || isSolid(getTile(crLeft, crRB))) cr.x = (crLeft + 1) * TILE;
    var crRight = Math.floor((cr.x + cr.width - 1) / TILE);
    if (isSolid(getTile(crRight, crRT)) || isSolid(getTile(crRight, crRB))) cr.x = crRight * TILE - cr.width;
    if (cr.x < 0) cr.x = 0;
    if (cr.x + cr.width > WORLD_COLS * TILE) cr.x = WORLD_COLS * TILE - cr.width;
  }

  // Explosions-Effekte updaten (wachsen + verblassen)
  for (var ei = explosions.length - 1; ei >= 0; ei--) {
    var ex = explosions[ei];
    ex.r     += ex.maxR * 0.08;
    ex.alpha -= 0.06;
    if (ex.alpha <= 0) explosions.splice(ei, 1);
  }

  // --- Creeper blockieren den Spieler ---
  for (var cbi = 0; cbi < creepers.length; cbi++) {
    var cr = creepers[cbi];
    var cox = player.x < cr.x + cr.width  && player.x + player.width  > cr.x;
    var coy = player.y < cr.y + cr.height && player.y + player.height > cr.y;
    if (!cox || !coy) continue;
    var cpL = (player.x + player.width) - cr.x;
    var cpR = (cr.x + cr.width) - player.x;
    var cpD = (player.y + player.height) - cr.y;
    var cpU = (cr.y + cr.height) - player.y;
    var cpMin = Math.min(cpL, cpR, cpD, cpU);
    if (cpMin === cpD && player.velocityY >= 0) {
      player.y = cr.y - player.height; player.velocityY = 0; player.onGround = true;
    } else if (cpMin === cpU && player.velocityY <= 0) {
      player.y = cr.y + cr.height; player.velocityY = 0;
    } else if (cpMin === cpL) {
      player.x = cr.x - player.width;
    } else {
      player.x = cr.x + cr.width;
    }
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > WORLD_COLS * TILE) player.x = WORLD_COLS * TILE - player.width;
  }

  // --- Neue Creeper-Gruppe spawnen (alle 8 Sek) ---
  if (creepers.length < MAX_CREEPERS && Date.now() - creeperSpawnTimer > 8000) {
    spawnCreeperGroup();
    creeperSpawnTimer = Date.now();
  }

  updateCamera();

  // --- Skelette an der Oberfläche verbrennen bei Tag ---
  var brightSk = getSkyBrightness();
  if (brightSk > 0.5) {
    for (var bsi = skeletons.length - 1; bsi >= 0; bsi--) {
      var bs = skeletons[bsi];
      var sMidRow = Math.floor((bs.y + bs.height * 0.5) / TILE);
      if (sMidRow < 14) {
        bs.hp -= 0.03 * brightSk;
        if (bs.hp <= 0) skeletons.splice(bsi, 1);
      }
    }
  }
  // --- Nachts: Skelette an der Oberfläche spawnen ---
  if (isNight() && Date.now() - nightSpawnTimer > 5000) {
    spawnSkeletonGroupSurface();
  }
  // --- Nachts: Creeper an der Oberfläche spawnen ---
  if (isNight() && Date.now() - creeperSpawnTimer > 7000) {
    spawnCreeperGroupSurface();
    creeperSpawnTimer = Date.now();
  }

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
      if (type === GRASS)       { ctx.fillStyle="rgba(144,224,80,1)";  ctx.fillRect(x,y,TILE,5); }
      if (type === STONE)       { ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x+4,y+4,TILE-8,TILE-8); }
      if (type === LEAVES)      { ctx.fillStyle="rgba(0,0,0,0.15)"; ctx.fillRect(x+5,y+5,9,9); ctx.fillRect(x+17,y+15,7,7); }
      if (type === DIAMOND_ORE) {
        // Diamant-Erz: Stein-Basis + leuchtende blaue Kristalle
        ctx.fillStyle="rgba(255,255,255,0.06)"; ctx.fillRect(x+4,y+4,TILE-8,TILE-8);
        ctx.fillStyle="#29b6f6";
        ctx.fillRect(x+4,  y+5,  6, 6);
        ctx.fillRect(x+18, y+14, 5, 5);
        ctx.fillRect(x+9,  y+20, 6, 6);
        ctx.fillRect(x+22, y+6,  5, 5);
        ctx.fillStyle="rgba(180,240,255,0.7)";
        ctx.fillRect(x+5,  y+6,  2, 2);
        ctx.fillRect(x+19, y+15, 2, 2);
      }
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

  // --- Waffe zeichnen (je nach ausgewähltem Slot) ---
  var elapsed   = Date.now() - player.swingTimer;
  var progress  = Math.min(1, elapsed / player.swingDuration);
  var facingRight = (player.facing >= 0);
  var pivotX = facingRight ? px + player.width + 2 : px - 2;
  var pivotY = py + 26;

  var startAngle = -100 * Math.PI / 180;
  var endAngle   =   50 * Math.PI / 180;
  var restAngle  =    8 * Math.PI / 180;
  var angle = progress >= 1 ? restAngle : startAngle + progress * (endAngle - startAngle);

  if (selectedSlot === 5 && inventory["bow"] > 0) {
    // ── BOGEN ────────────────────────────────────────────────────────────────
    // Bogen wird seitlich gehalten, leicht nach vorne gestreckt
    var bowPulled = progress < 1; // wird gerade geschossen
    ctx.save();
    ctx.translate(pivotX, pivotY);
    if (!facingRight) ctx.scale(-1, 1);

    // Bogen-Bogen (gebogener Holzstab)
    ctx.strokeStyle = "#8b5e2a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(12, 0, 18, -1.3, 1.3); // Halbkreis nach vorne
    ctx.stroke();

    // Sehne (gespannt = mehr gebogen beim Schuss)
    var pullBack = bowPulled ? -8 : 0;
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12 + 18 * Math.cos(-1.3), 18 * Math.sin(-1.3)); // oberes Ende
    ctx.lineTo(12 + pullBack, 0);                               // Mitte (gespannt)
    ctx.lineTo(12 + 18 * Math.cos(1.3),  18 * Math.sin(1.3));  // unteres Ende
    ctx.stroke();

    // Pfeil auf der Sehne (wenn Pfeile vorhanden)
    if (inventory["arrow"] > 0) {
      ctx.strokeStyle = "#8d6e63";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pullBack, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();
      // Pfeilspitze
      ctx.fillStyle = "#78909c";
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.lineTo(20, -3);
      ctx.lineTo(20, 3);
      ctx.fill();
    }

    ctx.lineWidth = 1; ctx.lineCap = "butt";
    ctx.restore();

  } else if (selectedSlot === 3 && inventory["pickaxe"] > 0) {
    // ── SPITZHACKE ────────────────────────────────────────────────────────────
    // Schwung-Bogen während der Animation
    if (progress < 1) {
      ctx.save();
      ctx.translate(pivotX, pivotY);
      if (!facingRight) ctx.scale(-1, 1);
      ctx.strokeStyle = "rgba(180,120,60,0.3)";
      ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 20, startAngle, angle);
      ctx.stroke();
      ctx.lineWidth = 1; ctx.lineCap = "butt";
      ctx.restore();
    }

    ctx.save();
    ctx.translate(pivotX, pivotY);
    if (!facingRight) ctx.scale(-1, 1);
    ctx.rotate(angle);

    // Stiel (langer Holzgriff)
    ctx.fillStyle = "#8b5e2a";
    ctx.fillRect(-15, -2, 27, 4);
    // Holzmaserung
    ctx.fillStyle = "#6b4018";
    ctx.fillRect(-15, 0, 27, 1);

    // Kopf-Verbindungsstück (Metall, wo Stiel auf Klingen trifft)
    ctx.fillStyle = "#787878";
    ctx.fillRect(9, -5, 5, 10);
    ctx.fillStyle = "#909090";
    ctx.fillRect(10, -4, 3, 3);

    // Obere Klinge (schräg nach oben-vorne, ~40°)
    ctx.save();
    ctx.translate(11, -3);
    ctx.rotate(-0.65);           // ~37° nach oben
    ctx.fillStyle = "#a0a0a0";
    ctx.fillRect(0, -2, 16, 5);  // Klingenblatt
    ctx.fillStyle = "#c8c8c8";   // Highlight oben
    ctx.fillRect(0, -2, 16, 2);
    ctx.fillStyle = "#d8d8d8";   // Spitze ganz hell
    ctx.fillRect(13, -2, 3, 2);
    ctx.restore();

    // Untere Klinge (schräg nach unten-vorne, ~40°)
    ctx.save();
    ctx.translate(11, 3);
    ctx.rotate(0.65);            // ~37° nach unten
    ctx.fillStyle = "#a0a0a0";
    ctx.fillRect(0, -2, 14, 5);  // Klingenblatt
    ctx.fillStyle = "#c0c0c0";   // Highlight
    ctx.fillRect(0, -2, 14, 2);
    ctx.fillStyle = "#d0d0d0";   // Spitze
    ctx.fillRect(11, -2, 3, 2);
    ctx.restore();

    ctx.restore();

  } else {
    // ── SCHWERT (Slots 0–2 und 4) ───────────────────────────────────────────
    var upgraded = inventory["sword_up"] > 0;

    // Schwung-Bogen während der Animation
    if (progress < 1) {
      ctx.save();
      ctx.translate(pivotX, pivotY);
      if (!facingRight) ctx.scale(-1, 1);
      ctx.strokeStyle = upgraded ? "rgba(255,220,0,0.35)" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 20, startAngle, angle);
      ctx.stroke();
      ctx.lineWidth = 1; ctx.lineCap = "butt";
      ctx.restore();
    }

    ctx.save();
    ctx.translate(pivotX, pivotY);
    if (!facingRight) ctx.scale(-1, 1);
    ctx.rotate(angle);

    if (upgraded) {
      // Gold-Schwert: goldene Klinge
      ctx.fillStyle = "#ffd700"; // Gold
      ctx.fillRect(2, -3, 20, 5);
      ctx.fillStyle = "#fff9c4"; // Helle Spitze
      ctx.fillRect(19, -2, 5, 3);
      ctx.fillStyle = "#ff8f00"; // Orangegold Parierstange
      ctx.fillRect(-1, -7, 4, 14);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(-12, -3, 12, 5);
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(-13, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      // Glanz-Punkt auf der Klinge
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(8, -2, 4, 2);
    } else {
      // Normal-Schwert: silber-grau
      ctx.fillStyle = "#d4d4d4";
      ctx.fillRect(2, -3, 20, 5);
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(19, -2, 5, 3);
      ctx.fillStyle = "#888";
      ctx.fillRect(-1, -7, 4, 14);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(-12, -3, 12, 5);
      ctx.fillStyle = "#a0703a";
      ctx.beginPath();
      ctx.arc(-13, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
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

// Skelette zeichnen: knochenweiß, schmaler als Zombies, mit Bogen
function drawSkeletons() {
  for (var i = 0; i < skeletons.length; i++) {
    var s  = skeletons[i];
    var sx = Math.floor(s.x - cameraX);
    var sy = Math.floor(s.y - cameraY);
    var ratio = s.hp / s.maxHp;

    // Farbschema: weiß für normal, gelblich-grau für Boss
    var bodyColor, headColor;
    if (s.strong) {
      // Boss-Skelett: gelblich, leuchtende Augen
      bodyColor = ratio > 0.5 ? "#d7c290" : "#9c8a5e";
      headColor = ratio > 0.5 ? "#ede0b8" : "#b8a878";
    } else {
      // Normales Skelett: weiß-grau
      bodyColor = ratio > 0.5 ? "#e0e0e0" : "#a0a0a0";
      headColor = ratio > 0.5 ? "#f5f5f5" : "#bfbfbf";
    }

    var headH = Math.round(s.height * 0.35);
    var bodyY = Math.round(s.height * 0.30);

    // Körper (schmaler als Zombie → Rippen-Effekt)
    ctx.fillStyle = bodyColor;
    ctx.fillRect(sx + 2, sy + bodyY, s.width - 4, s.height - bodyY);

    // Rippen als dunkle Streifen
    ctx.fillStyle = "rgba(60,60,60,0.4)";
    for (var rib = 0; rib < 3; rib++) {
      ctx.fillRect(sx + 3, sy + bodyY + 4 + rib * 6, s.width - 6, 2);
    }

    // Kopf (Totenkopf)
    ctx.fillStyle = headColor;
    ctx.fillRect(sx + 1, sy, s.width - 2, headH);

    // Augenhöhlen (schwarz, oder rot beim Boss)
    var eyeSize = s.strong ? 6 : 5;
    ctx.fillStyle = s.strong ? "#ff1744" : "#000";
    ctx.fillRect(sx + 3, sy + 5, eyeSize, eyeSize);
    ctx.fillRect(sx + s.width - eyeSize - 3, sy + 5, eyeSize, eyeSize);

    // Nasenloch (kleines schwarzes Dreieck/Quadrat in der Mitte)
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + s.width / 2 - 1, sy + headH - 6, 2, 4);

    // Zähne als kleine vertikale Linien am unteren Kopfrand
    ctx.fillStyle = "#000";
    for (var t = 0; t < 4; t++) {
      ctx.fillRect(sx + 4 + t * 4, sy + headH - 2, 1, 2);
    }

    // Boss: Hörner aus Knochen auf dem Kopf
    if (s.strong) {
      ctx.fillStyle = headColor;
      ctx.fillRect(sx + 5,           sy - 6, 4, 7);
      ctx.fillRect(sx + s.width - 9, sy - 6, 4, 7);
    }

    // Bogen in Blickrichtung (gebogener Strich)
    ctx.strokeStyle = "#5d4037"; // Holzbraun
    ctx.lineWidth   = 2;
    var bowY = sy + bodyY + 4;
    if (s.dir >= 0) {
      ctx.beginPath();
      ctx.arc(sx + s.width + 4, bowY + 6, 9, -Math.PI/2.2, Math.PI/2.2);
      ctx.stroke();
      // Bogensehne
      ctx.strokeStyle = "#fafafa";
      ctx.beginPath();
      ctx.moveTo(sx + s.width + 4, bowY - 2);
      ctx.lineTo(sx + s.width + 4, bowY + 14);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(sx - 4, bowY + 6, 9, Math.PI - Math.PI/2.2, Math.PI + Math.PI/2.2);
      ctx.stroke();
      ctx.strokeStyle = "#fafafa";
      ctx.beginPath();
      ctx.moveTo(sx - 4, bowY - 2);
      ctx.lineTo(sx - 4, bowY + 14);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // HP-Balken über dem Skelett
    ctx.fillStyle = "#333";
    ctx.fillRect(sx, sy - 8, s.width, 5);
    ctx.fillStyle = s.strong ? "#ff6d00" : "#bdbdbd";
    ctx.fillRect(sx, sy - 8, Math.floor(s.width * ratio), 5);
  }
}

// Pfeile zeichnen
function drawArrows() {
  for (var i = 0; i < arrows.length; i++) {
    var a  = arrows[i];
    var ax = Math.floor(a.x - cameraX);
    var ay = Math.floor(a.y - cameraY);
    // Pfeilrichtung aus Geschwindigkeit
    var ang = Math.atan2(a.vy, a.vx);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);

    // Schaft (heller bei Boss-Pfeil)
    ctx.fillStyle = a.strong ? "#ff5722" : "#8d6e63";
    ctx.fillRect(-10, -1, 14, 2);
    // Spitze
    ctx.fillStyle = a.strong ? "#ffeb3b" : "#cfd8dc";
    ctx.beginPath();
    ctx.moveTo(4, -3);
    ctx.lineTo(8, 0);
    ctx.lineTo(4, 3);
    ctx.closePath();
    ctx.fill();
    // Federn am Ende
    ctx.fillStyle = a.strong ? "#fff59d" : "#eceff1";
    ctx.fillRect(-10, -3, 3, 2);
    ctx.fillRect(-10,  1, 3, 2);
    ctx.restore();
  }
}

function drawCreepers() {
  var now = Date.now();
  for (var i = 0; i < creepers.length; i++) {
    var cr = creepers[i];
    var cx = Math.floor(cr.x - cameraX);
    var cy = Math.floor(cr.y - cameraY);
    var ratio = cr.hp / cr.maxHp;
    var T = cr.width;

    // Blinken wenn Lunte brennt (schneller je näher zur Explosion)
    if (cr.fuse === 1) {
      var fuseTime = cr.strong ? 1500 : 2000;
      var progress = (now - cr.fuseStart) / fuseTime; // 0 → 1
      var blinkSpeed = 100 + (1 - progress) * 300;    // fängt langsam an, wird schneller
      var blink = Math.floor(now / blinkSpeed) % 2 === 0;
      if (blink) {
        // Weißer Blitz
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 3, cy - 3, cr.width + 6, cr.height + 6);
        continue; // Rest überspringen wenn weiß
      }
    }

    // Körper (grün, dunkler bei Schaden)
    var bodyColor = cr.strong
      ? (ratio > 0.5 ? "#1a6b1a" : "#0f4010")
      : (ratio > 0.5 ? "#3a9e3a" : "#1f6b1f");
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx, cy, cr.width, cr.height);

    // Typisches Creeper-Gesicht
    var headH = Math.round(cr.height * 0.38);
    // Augen (zwei dunkle Quadrate)
    var eyeS = Math.round(T * 0.22);
    ctx.fillStyle = cr.strong ? "#001a00" : "#1a1a00";
    ctx.fillRect(cx + Math.round(T * 0.12), cy + Math.round(headH * 0.2), eyeS, eyeS);
    ctx.fillRect(cx + Math.round(T * 0.65), cy + Math.round(headH * 0.2), eyeS, eyeS);

    // Mund: das typische "M"-förmige Creeper-Maul
    var mY  = cy + Math.round(headH * 0.55);
    var mW  = Math.round(T * 0.18);
    var mH  = Math.round(headH * 0.2);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx + Math.round(T*0.12), mY,      mW, mH);        // links oben
    ctx.fillRect(cx + Math.round(T*0.12), mY + mH, mW, mH);        // links unten
    ctx.fillRect(cx + Math.round(T*0.38), mY + mH, mW, mH);        // mitte unten
    ctx.fillRect(cx + Math.round(T*0.62), mY,      mW, mH);        // rechts oben
    ctx.fillRect(cx + Math.round(T*0.62), mY + mH, mW, mH);        // rechts unten

    // Boss: dunkle Dornen an den Schultern
    if (cr.strong) {
      ctx.fillStyle = "#0a3a0a";
      ctx.fillRect(cx - 4, cy + headH,     4, 8);
      ctx.fillRect(cx + cr.width, cy + headH, 4, 8);
    }

    // HP-Balken
    ctx.fillStyle = "#333";
    ctx.fillRect(cx, cy - 8, cr.width, 5);
    ctx.fillStyle = cr.strong ? "#ff6d00" : "#4caf50";
    ctx.fillRect(cx, cy - 8, Math.floor(cr.width * ratio), 5);
  }
}

function drawExplosions() {
  for (var i = 0; i < explosions.length; i++) {
    var ex = explosions[i];
    var ex2 = Math.floor(ex.x - cameraX);
    var ey2 = Math.floor(ex.y - cameraY);
    // Äußerer Ring: orange
    ctx.beginPath();
    ctx.arc(ex2, ey2, ex.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,120,0," + (ex.alpha * 0.5) + ")";
    ctx.fill();
    // Innerer Ring: gelb-weiß
    ctx.beginPath();
    ctx.arc(ex2, ey2, ex.r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,240,100," + (ex.alpha * 0.7) + ")";
    ctx.fill();
    // Kern: weiß
    ctx.beginPath();
    ctx.arc(ex2, ey2, ex.r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255," + ex.alpha + ")";
    ctx.fill();
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

// Crafting-Rezepte definieren
var RECIPES = [
  { name: "Spitzhacke",    key: "pickaxe",  max: 1,
    cost: { 3: 10, 4: 4 },          // 10 Stein + 4 Holz
    desc: "10 Stein + 4 Holz",      icon: "⛏" },
  { name: "Schwert-Upgrade", key: "sword_up", max: 1,
    cost: { diamond: 3 },           // 3 Diamanten
    desc: "3 Diamanten",            icon: "⚔+" },
  { name: "Bogen",         key: "bow",      max: 1,
    cost: { 3: 5, diamond: 3 },     // 5 Stein + 3 Diamanten
    desc: "5 Stein + 3 Diamanten",  icon: "🏹" },
  { name: "5 Pfeile",      key: "arrow",    max: 999,
    cost: { 4: 2, diamond: 1 },     // 2 Holz + 1 Diamant
    desc: "2 Holz + 1 Diamant",     icon: "➶",  amount: 5 }
];

// Prüft ob genug Materialien vorhanden sind und führt Craft aus
function canCraft(recipe) {
  for (var k in recipe.cost) {
    var have = (k === "diamond") ? inventory["diamond"] : inventory[parseInt(k)];
    if (have < recipe.cost[k]) return false;
  }
  if (recipe.max === 1 && inventory[recipe.key] >= 1) return false;
  return true;
}

function doCraft(recipe) {
  if (!canCraft(recipe)) return;
  for (var k in recipe.cost) {
    var amount = recipe.cost[k];
    if (k === "diamond") inventory["diamond"] -= amount;
    else inventory[parseInt(k)] -= amount;
  }
  inventory[recipe.key] += recipe.amount || 1;
  sndBlockPlace(); // Erfolgs-Sound
}

// Crafting-Klick: welchen Button hat der Spieler gedrückt?
var _craftBtnY = []; // wird beim Zeichnen gefüllt
function tryCraftClick(mx, my) {
  var cx = Math.floor(canvas.width / 2) - 140;
  for (var i = 0; i < RECIPES.length; i++) {
    var by = _craftBtnY[i];
    if (by && mx >= cx + 240 && mx <= cx + 310 && my >= by && my <= by + 26) {
      doCraft(RECIPES[i]);
    }
  }
  // Klick außerhalb → Menü schließen
  var panelW = 320, panelH = RECIPES.length * 60 + 80;
  var panelX = Math.floor(canvas.width  / 2) - panelW / 2;
  var panelY = Math.floor(canvas.height / 2) - panelH / 2;
  if (mx < panelX || mx > panelX + panelW || my < panelY || my > panelY + panelH) {
    craftingOpen = false;
  }
}

function drawCrafting() {
  if (!craftingOpen) return;
  var panelW = 320, panelH = RECIPES.length * 60 + 80;
  var px = Math.floor(canvas.width  / 2) - panelW / 2;
  var py = Math.floor(canvas.height / 2) - panelH / 2;

  // Hintergrund
  ctx.fillStyle = "rgba(20,20,30,0.93)";
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = "#7ec8e3"; ctx.lineWidth = 2;
  ctx.strokeRect(px+1, py+1, panelW-2, panelH-2);
  ctx.lineWidth = 1;

  // Titel
  ctx.fillStyle = "#7ec8e3"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center";
  ctx.fillText("⚒ CRAFTING (E schließen)", px + panelW/2, py + 28);

  // Aktuelles Inventar kurz anzeigen
  ctx.font = "11px monospace"; ctx.fillStyle = "#aaa";
  ctx.fillText(
    "Stein:" + inventory[STONE] + "  Holz:" + inventory[WOOD] +
    "  Diamant:" + inventory["diamond"],
    px + panelW/2, py + 48
  );

  // Rezepte
  for (var i = 0; i < RECIPES.length; i++) {
    var r = RECIPES[i];
    var ry = py + 65 + i * 60;
    _craftBtnY[i] = ry + 16;

    // Zeile
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(px + 8, ry + 6, panelW - 16, 46);

    // Icon + Name
    ctx.font = "22px monospace"; ctx.textAlign = "left"; ctx.fillStyle = "#fff";
    ctx.fillText(r.icon, px + 16, ry + 36);
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#eee";
    ctx.fillText(r.name, px + 46, ry + 24);
    ctx.font = "11px monospace"; ctx.fillStyle = "#aaa";
    ctx.fillText(r.desc, px + 46, ry + 40);

    // Button
    var canDo = canCraft(r);
    ctx.fillStyle = canDo ? "#2e7d32" : "#555";
    ctx.fillRect(px + 240, ry + 16, 70, 26);
    ctx.fillStyle = canDo ? "#fff" : "#999";
    ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
    ctx.fillText(canDo ? "Bauen!" : "Fehlt", px + 275, ry + 33);

    // Bereits gebaut?
    if (r.max === 1 && inventory[r.key] >= 1) {
      ctx.fillStyle = "#4caf50"; ctx.font = "11px monospace"; ctx.textAlign = "right";
      ctx.fillText("✓ Gebaut", px + panelW - 10, ry + 52);
    }
    if (r.key === "arrow") {
      ctx.fillStyle = "#fff"; ctx.font = "11px monospace"; ctx.textAlign = "right";
      ctx.fillText("Pfeile: " + inventory["arrow"], px + panelW - 10, ry + 52);
    }
  }
  ctx.textAlign = "left";
}

function drawInventory() {
  var blocks = [WOOD, STONE, DIRT, GRASS, LEAVES];
  var sx = 8, sy = 8, sh = 22;
  var totalH = (blocks.length + 2) * sh + 8; // +2 für Diamant-Zeile
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(sx-4, sy-4, 138, totalH);
  for (var i = 0; i < blocks.length; i++) {
    var type = blocks[i], iy = sy + i * sh;
    ctx.fillStyle = COLORS[type];  ctx.fillRect(sx, iy, 14, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.strokeRect(sx, iy, 14, 14);
    ctx.fillStyle = "#fff"; ctx.font = "12px monospace";
    ctx.fillText(NAMES[type] + ": " + inventory[type], sx+18, iy+11);
  }
  // Diamanten extra anzeigen (blau)
  var dy = sy + blocks.length * sh;
  ctx.fillStyle = "#29b6f6"; ctx.fillRect(sx, dy, 14, 14);
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.strokeRect(sx, dy, 14, 14);
  ctx.fillStyle = "#29b6f6"; ctx.font = "12px monospace";
  ctx.fillText("Diamant: " + inventory["diamond"], sx+18, dy+11);
  // E-Hint
  ctx.fillStyle = "#aaa"; ctx.font = "10px monospace";
  ctx.fillText("[E] Crafting", sx, dy + sh + 8);
}

function drawHotbar() {
  // 6 Slots: WOOD, STONE, DIRT, Spitzhacke, Schwert, Bogen
  var slotDefs = [
    { label:"1", type:"block",   block: WOOD,      icon:null,   color: COLORS[WOOD]  },
    { label:"2", type:"block",   block: STONE,     icon:null,   color: COLORS[STONE] },
    { label:"3", type:"block",   block: DIRT,       icon:null,   color: COLORS[DIRT]  },
    { label:"4", type:"pickaxe", block: null,       icon:"⛏",   color: "#8d6e63"     },
    { label:"5", type:"sword",   block: null,       icon:null,   color: "#9e9e9e"     },
    { label:"6", type:"bow",     block: null,       icon:"🏹",   color: "#795548"     }
  ];
  var size = 36, gap = 5;
  var total = slotDefs.length * (size + gap) - gap;
  var sx = Math.floor((canvas.width - total) / 2);
  var sy = canvas.height - size - 8;

  for (var i = 0; i < slotDefs.length; i++) {
    var sd = slotDefs[i];
    var x  = sx + i * (size + gap);
    var sel = (i === selectedSlot);

    // Slot-Hintergrund
    ctx.fillStyle = sel ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.55)";
    ctx.fillRect(x, sy, size, size);

    if (sd.type === "block") {
      // Block-Vorschau
      ctx.fillStyle = sd.color;
      ctx.fillRect(x+4, sy+4, size-8, size-8);
      // Anzahl
      ctx.fillStyle = inventory[sd.block] > 0 ? "#fff" : "#f66";
      ctx.font = "11px monospace";
      ctx.fillText(inventory[sd.block], x+size-14, sy+size-4);
    } else if (sd.type === "sword") {
      // Schwert (immer verfügbar)
      var upgraded = inventory["sword_up"] > 0;
      ctx.fillStyle = upgraded ? "#ffeb3b" : "#bdbdbd";
      ctx.fillRect(x+4, sy+4, size-8, size-8);
      ctx.fillStyle = upgraded ? "#f57f17" : "#555";
      ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
      ctx.fillText(upgraded ? "⚔+" : "⚔", x+size/2, sy+size/2+5);
      ctx.textAlign = "left";
    } else {
      // Werkzeug (Spitzhacke / Bogen)
      var owned = inventory[sd.type] > 0;
      ctx.fillStyle = owned ? sd.color : "#333";
      ctx.fillRect(x+4, sy+4, size-8, size-8);
      ctx.font = "18px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = owned ? "#fff" : "#666";
      ctx.fillText(sd.icon, x+size/2, sy+size/2+6);
      ctx.textAlign = "left";
      // Pfeilanzahl beim Bogen
      if (sd.type === "bow" && owned) {
        ctx.fillStyle = inventory["arrow"] > 0 ? "#fff" : "#f66";
        ctx.font = "10px monospace";
        ctx.fillText(inventory["arrow"], x+size-14, sy+size-4);
      }
    }

    // Auswahl-Rahmen
    if (sel) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.strokeRect(x+1, sy+1, size-2, size-2);
      ctx.lineWidth = 1;
    }
    // Slot-Nummer
    ctx.fillStyle = "#ccc"; ctx.font = "bold 9px monospace";
    ctx.fillText(sd.label, x+4, sy+11);
  }

  // Keine-Spitzhacke-Warnung
  if (player.noPickaxeFlash && Date.now() - player.noPickaxeFlash < 1500) {
    ctx.fillStyle = "rgba(255,0,0,0.7)";
    ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
    ctx.fillText("⛏ Brauchst eine Spitzhacke! (Taste 4)", canvas.width/2, canvas.height - size - 28);
    ctx.textAlign = "left";
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
  drawSkeletons();
  drawCreepers();
  drawArrows();
  drawExplosions();
  drawPlayer();
  drawInventory();
  drawHotbar();
  drawCrafting();
  drawHpBar();
  if (player.dead) drawGameOver();
  update();
  requestAnimationFrame(gameLoop);
}

gameLoop();
