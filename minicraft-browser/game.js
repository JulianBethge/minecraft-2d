// ============================================================
// MiniCraft Browser – Phase 2: Bewegung + Schwerkraft
// ============================================================

var canvas = document.getElementById("gameCanvas");
var ctx    = canvas.getContext("2d");

// ------------------------------------------------------------
// Physik-Einstellungen
// ------------------------------------------------------------
var GRAVITY    = 0.5;   // Wie stark die Schwerkraft zieht (Pixel pro Frame²)
var JUMP_FORCE = -11;   // Wie hoch der Spieler springt (negativ = nach oben)
var SPEED      = 4;     // Wie schnell er sich links/rechts bewegt
var GROUND_Y   = canvas.height - 32; // Y-Position des Bodens

// ------------------------------------------------------------
// Spieler-Objekt
// velocityY = aktuelle Fallgeschwindigkeit
// onGround  = steht der Spieler gerade auf dem Boden?
// ------------------------------------------------------------
var player = {
  x:         64,
  y:         GROUND_Y - 56,  // startet direkt auf dem Boden
  width:     28,
  height:    56,   // Körper (36) + Kopf (20)
  velocityY: 0,    // Fallgeschwindigkeit, startet bei 0
  onGround:  false,
  color:     "#f0c040"
};

// ------------------------------------------------------------
// Welche Tasten gerade gedrückt werden
// keys["a"] = true, solange A gedrückt ist
// ------------------------------------------------------------
var keys = {};

document.addEventListener("keydown", function(e) {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", function(e) {
  keys[e.key.toLowerCase()] = false;
});

// ------------------------------------------------------------
// update: Physik und Steuerung berechnen (läuft ~60x pro Sekunde)
// ------------------------------------------------------------
function update() {
  // --- Links / Rechts ---
  if (keys["a"]) {
    player.x -= SPEED;
  }
  if (keys["d"]) {
    player.x += SPEED;
  }

  // --- Springen (nur wenn auf dem Boden) ---
  if ((keys["w"] || keys[" "]) && player.onGround) {
    player.velocityY = JUMP_FORCE;
    player.onGround  = false;
  }

  // --- Schwerkraft: zieht den Spieler jedes Frame nach unten ---
  player.velocityY += GRAVITY;
  player.y         += player.velocityY;

  // --- Boden-Kollision: Spieler darf nicht durchfallen ---
  if (player.y >= GROUND_Y - player.height) {
    player.y        = GROUND_Y - player.height;
    player.velocityY = 0;
    player.onGround  = true;
  }

  // --- Seitenränder: Spieler bleibt im Canvas ---
  if (player.x < 0) {
    player.x = 0;
  }
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }
}

// ------------------------------------------------------------
// drawBackground: Himmel + Boden
// ------------------------------------------------------------
function drawBackground() {
  // Himmel
  ctx.fillStyle = "#87ceeb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Boden (grüner Streifen)
  ctx.fillStyle = "#5a8f3c";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

  // Boden-Oberfläche (heller Streifen obendrauf)
  ctx.fillStyle = "#7ac44f";
  ctx.fillRect(0, GROUND_Y, canvas.width, 6);
}

// ------------------------------------------------------------
// drawPlayer: Körper + Kopf + Augen
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
// draw: Alles zeichnen
// ------------------------------------------------------------
function draw() {
  drawBackground();
  drawPlayer();
}

// ------------------------------------------------------------
// gameLoop: update + draw, läuft 60x pro Sekunde
// requestAnimationFrame sorgt dafür, dass es flüssig läuft
// ------------------------------------------------------------
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Spiel starten
gameLoop();
