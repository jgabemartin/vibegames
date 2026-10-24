const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const coinsEl = document.getElementById("coins");
const totalCoinsEl = document.getElementById("total-coins");
const livesEl = document.getElementById("lives");
const timerEl = document.getElementById("timer");
const bestTimeEl = document.getElementById("best-time");
const weatherEl = document.getElementById("weather");
const messageEl = document.getElementById("message");

const GRAVITY = 0.6;
const MOVE_SPEED = 3.5;
const JUMP_FORCE = -11;
const TILE_WIDTH = 2200;
const NUM_TILES = 5;
const LEVEL_WIDTH = TILE_WIDTH * NUM_TILES;
const LEVEL_HEIGHT = canvas.height;
const GROUND_Y = LEVEL_HEIGHT - 40;

const BEST_TIME_KEY = "farmBmxBestTimeMs";
const WEATHER_SEQUENCE = ["clear", "cloudy", "rain", "snow", "fog"];
const FARM_TYPES = ["homestead", "dairy", "crops", "orchard"];

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === "r" || e.key === "R") resetGame();
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function formatTime(ms) {
  if (ms == null) return "--:--.--";
  const totalCenti = Math.floor(ms / 10);
  const centi = totalCenti % 100;
  const totalSec = Math.floor(totalCenti / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${min}:${String(sec).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
}

const DOG_BREEDS = {
  collie: { body: "#2b2b2b", patch: "#f4f1e8", ears: "pointed", w: 26, h: 20 },
  dachshund: { body: "#9a4b1e", patch: "#c97a3f", ears: "floppy", w: 36, h: 14 },
  dane: { body: "#cdab74", patch: "#5c4631", ears: "floppy", w: 36, h: 30 },
};

const BASE_PLATFORMS = [
  { x: 0, y: 0, w: 500, h: 40, type: "ground" },
  { x: 560, y: 0, w: 300, h: 40, type: "ground" },
  { x: 620, y: -110, w: 140, h: 20, type: "ground" },
  { x: 900, y: 0, w: 220, h: 40, type: "ground" },
  { x: 1000, y: -130, w: 140, h: 20, type: "ground" },
  { x: 1180, y: 0, w: 160, h: 40, type: "ground" },
  { x: 1400, y: 0, w: 360, h: 40, type: "ground" },
  { x: 1420, y: -120, w: 120, h: 20, type: "ground" },
  { x: 1620, y: -220, w: 120, h: 20, type: "ground" },
  { x: 1820, y: 0, w: 380, h: 40, type: "ground" },

  { x: 215, y: -20, w: 34, h: 20, type: "pumpkin" },
  { x: 275, y: -28, w: 36, h: 28, type: "pumpkin" },
  { x: 338, y: -22, w: 34, h: 22, type: "pumpkin" },

  { x: 562, y: -18, w: 38, h: 18, type: "hay" },
  { x: 606, y: -38, w: 38, h: 38, type: "hay" },

  { x: 1555, y: -58, w: 92, h: 50, type: "wagon" },

  { x: 1900, y: -24, w: 36, h: 24, type: "pumpkin" },
  { x: 1975, y: -20, w: 32, h: 20, type: "pumpkin" },
];

const BASE_COINS = [
  { x: 300, y: -40, r: 10 },
  { x: 660, y: -150, r: 10 },
  { x: 1040, y: -170, r: 10 },
  { x: 1220, y: -40, r: 10 },
  { x: 1460, y: -160, r: 10 },
  { x: 1660, y: -260, r: 10 },
  { x: 1950, y: -40, r: 10 },
];

const BASE_ENEMIES = [
  { breed: "collie", x: 600, minX: 560, maxX: 830, vx: 1.6 },
  { breed: "dachshund", x: 950, minX: 900, maxX: 1090, vx: 2.2 },
  { breed: "dane", x: 1850, minX: 1820, maxX: 2160, vx: 1.1 },
];

const BASE_FARMSTEADS = [90, 610, 1140, 1760];

function makeLevel() {
  const platforms = [];
  const coins = [];
  const enemies = [];
  const farmsteads = [];

  for (let t = 0; t < NUM_TILES; t++) {
    const offset = t * TILE_WIDTH;

    for (const p of BASE_PLATFORMS) {
      platforms.push({ ...p, x: p.x + offset, y: GROUND_Y + p.y });
    }

    for (const c of BASE_COINS) {
      coins.push({ x: c.x + offset, y: GROUND_Y + c.y, r: c.r, collected: false });
    }

    BASE_ENEMIES.forEach((e) => {
      const b = DOG_BREEDS[e.breed];
      enemies.push({
        breed: e.breed,
        x: e.x + offset,
        minX: e.minX + offset,
        maxX: e.maxX + offset,
        vx: e.vx,
        alive: true,
        w: b.w,
        h: b.h,
        y: GROUND_Y - b.h,
      });
    });

    BASE_FARMSTEADS.forEach((fx, slot) => {
      const type = FARM_TYPES[(t + slot) % FARM_TYPES.length];
      farmsteads.push({ x: fx + offset, type });
    });
  }

  const goal = { x: LEVEL_WIDTH - 80, y: GROUND_Y - 70, w: 30, h: 70 };

  return { platforms, coins, enemies, goal, farmsteads };
}

let level, player, camera, score, lives, state;
let startTime = 0;
let elapsedMs = 0;
let bestTime = null;
{
  const stored = localStorage.getItem(BEST_TIME_KEY);
  if (stored) bestTime = parseFloat(stored);
}

function resetGame() {
  level = makeLevel();
  player = {
    x: 40,
    y: GROUND_Y - 32,
    w: 28,
    h: 32,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    wheelPhase: 0,
  };
  camera = { x: 0 };
  score = 0;
  lives = 3;
  state = "playing";
  startTime = performance.now();
  elapsedMs = 0;
  totalCoinsEl.textContent = level.coins.length;
  coinsEl.textContent = score;
  livesEl.textContent = lives;
  timerEl.textContent = formatTime(0);
  bestTimeEl.textContent = formatTime(bestTime);
  messageEl.textContent = "";
}

function respawnPlayer() {
  player.x = 40;
  player.y = GROUND_Y - 32;
  player.vx = 0;
  player.vy = 0;
}

function loseLife() {
  lives -= 1;
  livesEl.textContent = lives;
  if (lives <= 0) {
    state = "gameover";
    messageEl.textContent = "Game Over — press R to restart";
  } else {
    respawnPlayer();
  }
}

function update() {
  if (state !== "playing") return;

  elapsedMs = performance.now() - startTime;
  timerEl.textContent = formatTime(elapsedMs);

  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  } else if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  if ((keys[" "] || keys["ArrowUp"] || keys["w"] || keys["W"]) && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  player.onGround = false;

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > LEVEL_WIDTH) player.x = LEVEL_WIDTH - player.w;

  for (const p of level.platforms) {
    if (rectsOverlap(player, p)) {
      const prevBottom = player.y + player.h - player.vy;
      if (player.vy >= 0 && prevBottom <= p.y + 1) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 1) {
        player.y = p.y + p.h;
        player.vy = 0;
      } else if (player.vx > 0) {
        player.x = p.x - player.w;
      } else if (player.vx < 0) {
        player.x = p.x + p.w;
      }
    }
  }

  if (player.y > LEVEL_HEIGHT) {
    loseLife();
  }

  for (const coin of level.coins) {
    if (!coin.collected) {
      const dx = player.x + player.w / 2 - coin.x;
      const dy = player.y + player.h / 2 - coin.y;
      if (Math.hypot(dx, dy) < coin.r + 16) {
        coin.collected = true;
        score += 1;
        coinsEl.textContent = score;
      }
    }
  }

  for (const enemy of level.enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.vx;
    if (enemy.x < enemy.minX || enemy.x + enemy.w > enemy.maxX) {
      enemy.vx *= -1;
    }
    if (rectsOverlap(player, enemy)) {
      const stomping = player.vy > 0 && player.y + player.h - player.vy <= enemy.y + 6;
      if (stomping) {
        enemy.alive = false;
        player.vy = JUMP_FORCE * 0.6;
      } else {
        loseLife();
      }
    }
  }

  if (rectsOverlap(player, level.goal)) {
    state = "won";
    if (bestTime === null || elapsedMs < bestTime) {
      bestTime = elapsedMs;
      localStorage.setItem(BEST_TIME_KEY, String(bestTime));
      bestTimeEl.textContent = formatTime(bestTime);
      messageEl.textContent = `New best time: ${formatTime(elapsedMs)}! Press R to play again`;
    } else {
      messageEl.textContent = `You win in ${formatTime(elapsedMs)}! Best: ${formatTime(bestTime)} — press R to play again`;
    }
  }

  camera.x = Math.max(0, Math.min(player.x - canvas.width / 2, LEVEL_WIDTH - canvas.width));

  player.wheelPhase += player.vx * 0.25;
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#8ec9f0");
  grad.addColorStop(0.75, "#cfe9ff");
  grad.addColorStop(1, "#e9f6e2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 244, 191, 0.9)";
  ctx.beginPath();
  ctx.arc(680, 70, 32, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds() {
  const clouds = [
    { x: 150, y: 60 }, { x: 520, y: 95 }, { x: 900, y: 50 },
    { x: 1350, y: 85 }, { x: 1750, y: 55 }, { x: 2100, y: 100 },
  ];
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const c of clouds) {
    const sx = c.x - camera.x * 0.15;
    ctx.beginPath();
    ctx.ellipse(sx, c.y, 28, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + 22, c.y + 4, 20, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - 22, c.y + 5, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHillLayer(factor, baseY, amplitude, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let sx = 0; sx <= canvas.width; sx += 20) {
    const worldX = sx + camera.x * factor;
    const y = baseY - Math.sin(worldX * 0.0045) * amplitude - amplitude;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function drawTree(x, y) {
  ctx.fillStyle = "#6b4226";
  ctx.fillRect(x - 3, y - 24, 6, 24);
  ctx.fillStyle = "#4e8b3a";
  ctx.beginPath();
  ctx.arc(x, y - 34, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c1292e";
  ctx.beginPath();
  ctx.arc(x - 6, y - 32, 2, 0, Math.PI * 2);
  ctx.arc(x + 7, y - 38, 2, 0, Math.PI * 2);
  ctx.arc(x + 2, y - 26, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHayBale(x, y) {
  ctx.fillStyle = "#d8b24a";
  ctx.beginPath();
  ctx.arc(x, y - 10, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a9842f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 10);
  ctx.lineTo(x + 11, y - 10);
  ctx.moveTo(x, y - 21);
  ctx.lineTo(x, y + 1);
  ctx.stroke();
}

function drawBarn(x, y) {
  ctx.fillStyle = "#a33c2b";
  ctx.fillRect(x, y - 60, 90, 60);
  ctx.fillStyle = "#7a2c20";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 60);
  ctx.lineTo(x + 45, y - 95);
  ctx.lineTo(x + 98, y - 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4e9d8";
  ctx.fillRect(x + 36, y - 30, 18, 30);
  ctx.strokeStyle = "#f4e9d8";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y - 45, 14, 14);
  ctx.strokeRect(x + 66, y - 45, 14, 14);

  const siloX = x + 112;
  ctx.fillStyle = "#c9ccd0";
  ctx.fillRect(siloX, y - 85, 26, 85);
  ctx.beginPath();
  ctx.ellipse(siloX + 13, y - 85, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9ea3a8";
  ctx.fillRect(siloX + 11, y - 85, 4, 85);
}

function drawBigHouse(x, y) {
  ctx.fillStyle = "#e9e6da";
  ctx.fillRect(x, y - 68, 76, 68);
  ctx.fillStyle = "#4a5a66";
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 68);
  ctx.lineTo(x + 38, y - 100);
  ctx.lineTo(x + 86, y - 68);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4a5a66";
  ctx.fillRect(x + 56, y - 96, 8, 20);
  ctx.fillStyle = "#7a93a1";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  for (const wx of [10, 48]) {
    ctx.fillRect(x + wx, y - 52, 16, 16);
    ctx.beginPath();
    ctx.moveTo(x + wx + 8, y - 52);
    ctx.lineTo(x + wx + 8, y - 36);
    ctx.moveTo(x + wx, y - 44);
    ctx.lineTo(x + wx + 16, y - 44);
    ctx.stroke();
  }
  ctx.fillStyle = "#faf6ec";
  ctx.fillRect(x + 4, y - 22, 68, 22);
  ctx.strokeStyle = "#c9a24b";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y - 22, 68, 10);
  ctx.fillStyle = "#6b4226";
  ctx.fillRect(x + 32, y - 18, 12, 18);
}

function drawSmallHouse(x, y) {
  ctx.fillStyle = "#5b7fa6";
  ctx.fillRect(x, y - 40, 46, 40);
  ctx.fillStyle = "#8a3b32";
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 40);
  ctx.lineTo(x + 23, y - 60);
  ctx.lineTo(x + 52, y - 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#cfe3ef";
  ctx.fillRect(x + 7, y - 30, 12, 12);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 7, y - 30, 12, 12);
  ctx.fillStyle = "#4a2c18";
  ctx.fillRect(x + 28, y - 20, 12, 20);
}

function drawGrainElevator(x, y) {
  const heights = [70, 95, 78];
  ctx.fillStyle = "#9db2bc";
  heights.forEach((h, i) => {
    const sx = x + i * 24;
    ctx.fillRect(sx, y - h, 20, h);
    ctx.beginPath();
    ctx.ellipse(sx + 10, y - h, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#6f8893";
  ctx.fillRect(x - 6, y - 112, 24 * heights.length - 4, 14);
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 112);
  ctx.lineTo(x + 6, y - 126);
  ctx.lineTo(x + 24 * heights.length - 16, y - 126);
  ctx.lineTo(x + 24 * heights.length - 4, y - 112);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  heights.forEach((h, i) => {
    const sx = x + i * 24;
    ctx.beginPath();
    ctx.moveTo(sx + 5, y - h + 8);
    ctx.lineTo(sx + 5, y - 4);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawCow(x, y, phase) {
  const bob = Math.max(0, Math.sin(performance.now() / 900 + phase)) * 6;
  ctx.fillStyle = "#f4f1e8";
  ctx.beginPath();
  ctx.ellipse(x, y - 14, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.ellipse(x - 6, y - 17, 5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 7, y - 11, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(x - 15, y - 6, 3, 7);
  ctx.fillRect(x + 11, y - 6, 3, 7);
  ctx.save();
  ctx.translate(x + 16, y - 16 + bob);
  ctx.rotate(bob * 0.03);
  ctx.fillStyle = "#f4f1e8";
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.ellipse(-3, -5, 2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(3, -5, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPasture(x, y, width) {
  ctx.strokeStyle = "#8a6a46";
  ctx.lineWidth = 3;
  for (let fx = x; fx <= x + width; fx += 30) {
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx, y - 18);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + width, y - 14);
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + width, y - 6);
  ctx.stroke();
}

function drawTractor(x, y) {
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(x + 12, y - 2, 15, 0, Math.PI * 2);
  ctx.arc(x + 54, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6f6f6f";
  ctx.beginPath();
  ctx.arc(x + 12, y - 2, 5, 0, Math.PI * 2);
  ctx.arc(x + 54, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f8f3f";
  ctx.fillRect(x, y - 30, 34, 20);
  ctx.fillRect(x + 30, y - 46, 20, 36);
  ctx.fillStyle = "#cfe9ff";
  ctx.fillRect(x + 33, y - 43, 14, 14);
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(x + 48, y - 54, 4, 14);
}

function drawWindmill(x, y) {
  ctx.strokeStyle = "#8a8a8a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x, y - 95);
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x, y - 95);
  ctx.moveTo(x - 6, y - 40);
  ctx.lineTo(x + 6, y - 55);
  ctx.moveTo(x + 6, y - 40);
  ctx.lineTo(x - 6, y - 55);
  ctx.stroke();

  const angle = performance.now() / 500;
  ctx.save();
  ctx.translate(x, y - 95);
  ctx.rotate(angle);
  ctx.fillStyle = "#c9ccd0";
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * i);
    ctx.fillRect(-3, 0, 6, 26);
    ctx.restore();
  }
  ctx.fillStyle = "#6f6f6f";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFencePost(x, y) {
  ctx.fillStyle = "#8a6a46";
  ctx.fillRect(x, y - 26, 5, 26);
  ctx.fillRect(x - 10, y - 20, 25, 4);
  ctx.fillRect(x - 10, y - 9, 25, 4);
}

const FARMSTEAD_CLEARANCE = 180;

const goose = { active: false, x: 0, y: 60, speed: 0, spawnTimer: 150 };

function drawGooseFormation(x, y) {
  const t = performance.now() / 120;
  const offsets = [
    [0, 0], [20, 7], [20, -7], [40, 14], [40, -14], [60, 21], [60, -21],
  ];
  offsets.forEach(([dx, dy], i) => {
    const gx = x + dx;
    const gy = y + dy;
    const flap = Math.sin(t + i * 0.7) * 0.6;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.fillStyle = "#6b6459";
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.ellipse(-7, -2, 3.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-8, -1, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6b6459";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7, -6 - flap * 4);
    ctx.moveTo(0, 0);
    ctx.lineTo(7, 6 + flap * 4);
    ctx.stroke();
    ctx.restore();
  });
}

function updateAndDrawGeese() {
  if (!goose.active) {
    goose.spawnTimer -= 1;
    if (goose.spawnTimer <= 0) {
      goose.active = true;
      goose.x = canvas.width + 80;
      goose.y = 45 + Math.random() * 55;
      goose.speed = 0.7 + Math.random() * 0.4;
    }
    return;
  }
  goose.x -= goose.speed;
  drawGooseFormation(goose.x, goose.y);
  if (goose.x < -140) {
    goose.active = false;
    goose.spawnTimer = 400 + Math.random() * 500;
  }
}

function drawBackground() {
  drawSky();
  drawHillLayer(0.2, GROUND_Y - 40, 22, "#a9cf7f");
  drawHillLayer(0.4, GROUND_Y - 10, 18, "#86bb5e");
  drawClouds();
  updateAndDrawGeese();

  ctx.save();
  ctx.translate(-camera.x * 0.5, 0);

  for (const f of level.farmsteads) {
    if (f.x < camera.x * 0.5 - 200 || f.x > camera.x * 0.5 + canvas.width + 200) continue;
    if (f.type === "homestead") {
      drawBigHouse(f.x, GROUND_Y);
      drawWindmill(f.x + 100, GROUND_Y);
    } else if (f.type === "dairy") {
      drawBarn(f.x, GROUND_Y);
      drawPasture(f.x + 150, GROUND_Y, 90);
      drawCow(f.x + 180, GROUND_Y, 0);
      drawCow(f.x + 210, GROUND_Y, 1.8);
    } else if (f.type === "crops") {
      drawGrainElevator(f.x, GROUND_Y);
      drawTractor(f.x + 110, GROUND_Y);
    } else if (f.type === "orchard") {
      drawSmallHouse(f.x, GROUND_Y);
      drawHayBale(f.x + 70, GROUND_Y);
      drawHayBale(f.x + 90, GROUND_Y);
    }
  }

  const viewStart = camera.x * 0.5 - 300;
  const viewEnd = camera.x * 0.5 + canvas.width + 300;
  for (let x = Math.max(40, Math.floor(viewStart / 210) * 210); x < Math.min(LEVEL_WIDTH + 300, viewEnd); x += 210) {
    if (level.farmsteads.every((f) => Math.abs(x - f.x) > FARMSTEAD_CLEARANCE)) {
      drawTree(x, GROUND_Y);
    }
  }
  for (let x = Math.max(150, Math.floor(viewStart / 260) * 260); x < Math.min(LEVEL_WIDTH + 300, viewEnd); x += 260) {
    if (level.farmsteads.every((f) => Math.abs(x - f.x) > FARMSTEAD_CLEARANCE)) {
      drawHayBale(x, GROUND_Y);
    }
  }
  ctx.restore();
}

function getWeatherBlend(worldX) {
  const tilePos = worldX / TILE_WIDTH;
  const idx = Math.max(0, Math.min(WEATHER_SEQUENCE.length - 1, Math.floor(tilePos)));
  const frac = tilePos - idx;
  const blendZone = 0.12;
  const nextIdx = Math.min(WEATHER_SEQUENCE.length - 1, idx + 1);
  let blend = 0;
  if (frac > 1 - blendZone && idx < WEATHER_SEQUENCE.length - 1) {
    blend = (frac - (1 - blendZone)) / blendZone;
  }
  return { current: WEATHER_SEQUENCE[idx], next: WEATHER_SEQUENCE[nextIdx], blend };
}

const RAIN_COUNT = 110;
const rainDrops = Array.from({ length: RAIN_COUNT }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  len: 8 + Math.random() * 10,
  speed: 6 + Math.random() * 4,
}));

const SNOW_COUNT = 80;
const snowFlakes = Array.from({ length: SNOW_COUNT }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: 1 + Math.random() * 2.5,
  speed: 1 + Math.random() * 1.5,
  drift: Math.random() * 2 - 1,
}));

function updateAndDrawRain(alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(180,200,230,0.8)";
  ctx.lineWidth = 1.5;
  for (const d of rainDrops) {
    d.y += d.speed;
    d.x -= 1.5;
    if (d.y > canvas.height) {
      d.y = -10;
      d.x = Math.random() * canvas.width;
    }
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - 4, d.y + d.len);
    ctx.stroke();
  }
  ctx.restore();
}

function updateAndDrawSnow(alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  for (const s of snowFlakes) {
    s.y += s.speed;
    s.x += Math.sin(s.y * 0.02) * s.drift * 0.6;
    if (s.y > canvas.height) {
      s.y = -10;
      s.x = Math.random() * canvas.width;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function applyWeather(type, alpha) {
  if (type === "clear" || alpha <= 0) return;
  if (type === "cloudy") {
    ctx.save();
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = "#4b5560";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else if (type === "rain") {
    ctx.save();
    ctx.globalAlpha = alpha * 0.32;
    ctx.fillStyle = "#333f4d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    updateAndDrawRain(alpha);
  } else if (type === "snow") {
    ctx.save();
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = "#cfe3f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    updateAndDrawSnow(alpha);
  } else if (type === "fog") {
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = "#dfe6e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function drawWeatherEffects() {
  const worldXRef = camera.x + canvas.width / 2;
  const { current, next, blend } = getWeatherBlend(worldXRef);
  applyWeather(current, 1 - blend);
  if (blend > 0) applyWeather(next, blend);
  const label = blend > 0.5 ? next : current;
  weatherEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function drawDog(enemy) {
  const b = DOG_BREEDS[enemy.breed];
  const facing = enemy.vx >= 0 ? 1 : -1;
  const t = performance.now() / 150 + enemy.x;
  const tailWag = Math.sin(t) * 0.5;

  ctx.save();
  ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
  ctx.scale(facing, 1);

  ctx.fillStyle = "#000";
  const legW = 3;
  const legH = enemy.h * 0.35;
  ctx.fillRect(-enemy.w / 2 + 3, enemy.h / 2 - 2, legW, legH);
  ctx.fillRect(enemy.w / 2 - 6, enemy.h / 2 - 2, legW, legH);

  ctx.fillStyle = b.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = b.patch;
  ctx.beginPath();
  ctx.ellipse(-enemy.w * 0.08, enemy.h * 0.12, enemy.w * 0.28, enemy.h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  const headX = enemy.w / 2 - 2;
  ctx.fillStyle = b.body;
  ctx.beginPath();
  ctx.ellipse(headX, -enemy.h * 0.1, enemy.h * 0.42, enemy.h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = b.body;
  if (b.ears === "pointed") {
    ctx.beginPath();
    ctx.moveTo(headX - 4, -enemy.h * 0.4);
    ctx.lineTo(headX - 2, -enemy.h * 0.75);
    ctx.lineTo(headX + 4, -enemy.h * 0.42);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(headX - 2, -enemy.h * 0.05, 4, enemy.h * 0.32, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(headX + enemy.h * 0.2, -enemy.h * 0.14, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = b.body;
  ctx.lineWidth = Math.max(2, enemy.h * 0.12);
  ctx.beginPath();
  ctx.moveTo(-enemy.w / 2 + 2, -enemy.h * 0.05);
  ctx.quadraticCurveTo(
    -enemy.w / 2 - 8,
    -enemy.h * 0.3 + tailWag * 6,
    -enemy.w / 2 - 12,
    -enemy.h * 0.5 + tailWag * 10
  );
  ctx.stroke();

  ctx.restore();
}

function drawLimbVec(px, py, dx, dy, width, color) {
  const len = Math.hypot(dx, dy) || 0.001;
  const angle = Math.atan2(dy, dx) - Math.PI / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, 0, width, len);
  ctx.restore();
  return { x: px + dx, y: py + dy };
}

const SHIRT = "#a63d40";
const SHIRT_DARK = "#7e2d30";
const SKIN = "#e8b98a";
const HELMET = "#2e86ab";
const HELMET_DARK = "#1f5e78";
const BIKE_FRAME = "#2b2b2b";
const BIKE_TIRE = "#1a1a1a";
const BIKE_RIM = "#c9ccd0";

function drawWheel(cx, cy, r, angle) {
  ctx.fillStyle = BIKE_TIRE;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BIKE_RIM;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BIKE_RIM;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const a = angle + (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
    ctx.stroke();
  }
}

function drawPlayer(p) {
  const cx = p.x + p.w / 2;
  const feetY = p.y + p.h;
  const wheelR = 9;
  const wheelCenterY = feetY - wheelR;
  const rearX = cx - 13;
  const frontX = cx + 13;

  const airborne = !p.onGround;
  const tilt = airborne ? (p.vy < 0 ? -0.22 : 0.12) : 0;

  const bb = { x: cx, y: wheelCenterY - 4 };
  const seatTop = { x: cx - 8, y: wheelCenterY - 22 };
  const headTop = { x: cx + 9, y: wheelCenterY - 20 };
  const handlebar = { x: cx + 14, y: wheelCenterY - 27 };

  const wheelAngle = p.wheelPhase * 2.4;
  const crankAngle = p.wheelPhase;

  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(p.facing, 1);
  ctx.translate(-cx, 0);
  ctx.translate(rearX, wheelCenterY);
  ctx.rotate(tilt);
  ctx.translate(-rearX, -wheelCenterY);

  drawWheel(rearX, wheelCenterY, wheelR, wheelAngle);
  drawWheel(frontX, wheelCenterY, wheelR, wheelAngle);

  ctx.strokeStyle = BIKE_FRAME;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rearX, wheelCenterY);
  ctx.lineTo(seatTop.x, seatTop.y);
  ctx.lineTo(headTop.x, headTop.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.lineTo(rearX, wheelCenterY);
  ctx.moveTo(headTop.x, headTop.y);
  ctx.lineTo(frontX, wheelCenterY);
  ctx.moveTo(headTop.x, headTop.y);
  ctx.lineTo(handlebar.x, handlebar.y);
  ctx.stroke();

  ctx.fillStyle = BIKE_FRAME;
  ctx.fillRect(seatTop.x - 5, seatTop.y - 2, 10, 3);

  for (const off of [0, Math.PI]) {
    const a = crankAngle + off;
    const px = bb.x + Math.cos(a) * 7;
    const py = bb.y + Math.sin(a) * 7;
    ctx.strokeStyle = "#6f6f6f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bb.x, bb.y);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = "#6f6f6f";
    ctx.fillRect(px - 2, py - 1.5, 4, 3);
  }
  ctx.fillStyle = "#6f6f6f";
  ctx.beginPath();
  ctx.arc(bb.x, bb.y, 3, 0, Math.PI * 2);
  ctx.fill();

  const hip = { x: seatTop.x, y: seatTop.y - 2 };
  const shoulder = { x: hip.x + 11, y: hip.y - 15 };
  const headCenter = { x: shoulder.x + 1, y: shoulder.y - 9 };
  const headR = 6;

  for (const off of [0, Math.PI]) {
    const a = crankAngle + off;
    const footX = bb.x + Math.cos(a) * 7;
    const footY = bb.y + Math.sin(a) * 7;
    drawLimbVec(hip.x, hip.y, footX - hip.x, footY - hip.y, 5, SHIRT_DARK);
  }

  ctx.fillStyle = SHIRT;
  ctx.beginPath();
  ctx.moveTo(hip.x - 5, hip.y + 4);
  ctx.lineTo(hip.x + 4, hip.y + 2);
  ctx.lineTo(shoulder.x + 4, shoulder.y);
  ctx.lineTo(shoulder.x - 5, shoulder.y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = SHIRT_DARK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hip.x - 2, hip.y + 2);
  ctx.lineTo(shoulder.x - 1, shoulder.y + 1);
  ctx.stroke();

  drawLimbVec(shoulder.x, shoulder.y, handlebar.x - shoulder.x, handlebar.y - shoulder.y, 4, SHIRT);
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(handlebar.x, handlebar.y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(headCenter.x, headCenter.y, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(headCenter.x + 3, headCenter.y - 1, 1.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = HELMET;
  ctx.beginPath();
  ctx.arc(headCenter.x, headCenter.y - 1, headR + 2, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(headCenter.x - headR - 2, headCenter.y - 1, (headR + 2) * 2, 3);
  ctx.fillStyle = HELMET_DARK;
  ctx.fillRect(headCenter.x - headR - 2, headCenter.y - 3, headR * 2 + 4, 2);
  ctx.fillStyle = HELMET;
  ctx.beginPath();
  ctx.ellipse(headCenter.x + headR, headCenter.y + 1, 3, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGroundPlatform(p) {
  ctx.fillStyle = "#4b3621";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#5fa83a";
  ctx.fillRect(p.x, p.y, p.w, 6);
}

function drawPumpkinPlatform(p) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h;
  ctx.fillStyle = "#c96a1f";
  ctx.beginPath();
  ctx.ellipse(cx, cy - p.h * 0.55, p.w / 2, p.h * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9e4f14";
  ctx.lineWidth = 1.5;
  for (const f of [-0.45, -0.15, 0.15, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(cx + f * p.w, cy - p.h * 1.08);
    ctx.quadraticCurveTo(cx + f * p.w * 1.3, cy - p.h * 0.55, cx + f * p.w, cy - 1);
    ctx.stroke();
  }
  ctx.fillStyle = "#4e7d33";
  ctx.fillRect(cx - 2, cy - p.h * 1.18, 4, p.h * 0.22);
}

function drawHayPlatform(p) {
  ctx.fillStyle = "#d8b24a";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#c49c3a";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.h / 2, 5, p.h / 2, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + p.w, p.y + p.h / 2, 5, p.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a9842f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + p.w * 0.3, p.y);
  ctx.lineTo(p.x + p.w * 0.3, p.y + p.h);
  ctx.moveTo(p.x + p.w * 0.7, p.y);
  ctx.lineTo(p.x + p.w * 0.7, p.y + p.h);
  ctx.stroke();
}

function drawWagonPlatform(p) {
  const wheelR = 11;
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(p.x + 16, p.y + p.h + 2, wheelR, 0, Math.PI * 2);
  ctx.arc(p.x + p.w - 16, p.y + p.h + 2, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a8a8a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x + 16 - wheelR, p.y + p.h + 2);
  ctx.lineTo(p.x + 16 + wheelR, p.y + p.h + 2);
  ctx.moveTo(p.x + 16, p.y + p.h + 2 - wheelR);
  ctx.lineTo(p.x + 16, p.y + p.h + 2 + wheelR);
  ctx.moveTo(p.x + p.w - 16 - wheelR, p.y + p.h + 2);
  ctx.lineTo(p.x + p.w - 16 + wheelR, p.y + p.h + 2);
  ctx.moveTo(p.x + p.w - 16, p.y + p.h + 2 - wheelR);
  ctx.lineTo(p.x + p.w - 16, p.y + p.h + 2 + wheelR);
  ctx.stroke();

  ctx.fillStyle = "#6b4226";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = "#4a2c18";
  ctx.lineWidth = 1.5;
  for (let lx = p.x + 10; lx < p.x + p.w; lx += 14) {
    ctx.beginPath();
    ctx.moveTo(lx, p.y + 2);
    ctx.lineTo(lx, p.y + p.h - 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#8a5a32";
  ctx.fillRect(p.x, p.y, p.w, 5);
  ctx.fillStyle = "#d8b24a";
  ctx.fillRect(p.x + 8, p.y - 10, p.w - 16, 10);
}

function drawPlatform(p) {
  if (p.type === "pumpkin") drawPumpkinPlatform(p);
  else if (p.type === "hay") drawHayPlatform(p);
  else if (p.type === "wagon") drawWagonPlatform(p);
  else drawGroundPlatform(p);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  ctx.save();
  ctx.translate(-camera.x, 0);

  const viewStart = camera.x - 100;
  const viewEnd = camera.x + canvas.width + 100;

  for (let x = Math.max(10, Math.floor(viewStart / 42) * 42); x < Math.min(LEVEL_WIDTH, viewEnd); x += 42) {
    drawFencePost(x, GROUND_Y);
  }

  for (const p of level.platforms) {
    if (p.x + p.w < viewStart || p.x > viewEnd) continue;
    drawPlatform(p);
  }

  ctx.fillStyle = "#ffd166";
  for (const coin of level.coins) {
    if (coin.collected) continue;
    if (coin.x < viewStart || coin.x > viewEnd) continue;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of level.enemies) {
    if (!enemy.alive) continue;
    if (enemy.x + enemy.w < viewStart || enemy.x > viewEnd) continue;
    drawDog(enemy);
  }

  const g = level.goal;
  ctx.fillStyle = "#555";
  ctx.fillRect(g.x, g.y, 6, g.h);
  ctx.fillStyle = "#06d6a0";
  ctx.fillRect(g.x + 6, g.y, 24, 18);

  drawPlayer(player);

  ctx.restore();

  drawWeatherEffects();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

resetGame();
loop();
