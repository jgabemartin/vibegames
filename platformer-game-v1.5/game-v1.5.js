const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const coinsEl = document.getElementById("coins");
const totalCoinsEl = document.getElementById("total-coins");
const livesEl = document.getElementById("lives");
const timerEl = document.getElementById("timer");
const bestTimeEl = document.getElementById("best-time");
const weatherEl = document.getElementById("weather");
const levelEl = document.getElementById("level");
const musicStatusEl = document.getElementById("music-status");
const messageEl = document.getElementById("message");

musicStatusEl.textContent = Music.isMuted() ? "Off" : "On";

const GRAVITY = 0.6;
const MOVE_SPEED = 3.5;
const JUMP_FORCE = -11;
const TILE_WIDTH = 2200;
const NUM_TILES = 5;
const TILES_END = TILE_WIDTH * NUM_TILES;
// Flat, clear-weather stretch after the last weather zone where the boss lives
const ARENA_WIDTH = 900;
const LEVEL_WIDTH = TILES_END + ARENA_WIDTH;
const LEVEL_HEIGHT = canvas.height;
const GROUND_Y = LEVEL_HEIGHT - 40;

const BEST_TIME_KEY = "farmBmxBestRunMs";
const LEVELS = [
  { name: "Day", time: "day", dogSpeed: 1, boss: "oak" },
  { name: "Sunset", time: "sunset", dogSpeed: 1.15, boss: "barrel" },
  { name: "Night", time: "night", dogSpeed: 1.3, boss: "warehouse" },
];
const LEVEL_TRANSITION_MS = 2500;
const WEATHER_SEQUENCE = ["clear", "cloudy", "rain", "snow", "fog"];
const FARM_TYPES = ["homestead", "dairy", "crops", "orchard"];

const keys = {};
const JUMP_KEYS = [" ", "ArrowUp", "w", "W"];
const SUPER_HOP_FORCE = -10;

// Set on a fresh press (not key-repeat) so a SuperHop needs a second tap
let jumpPressed = false;

window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (JUMP_KEYS.includes(e.key) && !e.repeat) jumpPressed = true;
  Music.start();
  if (e.key === "r" || e.key === "R") resetGame();
  if (e.key === "m" || e.key === "M") {
    musicStatusEl.textContent = Music.toggleMute() ? "Off" : "On";
  }
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

function makeLevel(config) {
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
        vx: e.vx * config.dogSpeed,
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

  // The warehouse arena has a pit in it, so it lays its own ground
  if (config.boss !== "warehouse") {
    platforms.push({ x: TILES_END, y: GROUND_Y, w: ARENA_WIDTH, h: 40, type: "ground" });
  }

  let boss = null;
  const ramps = [];
  if (config.boss === "oak") boss = makeOakBoss(platforms);
  else if (config.boss === "barrel") boss = makeBarrelBoss(platforms, ramps);
  else if (config.boss === "warehouse") boss = makeWarehouseBoss(platforms, ramps);

  const goal = boss && boss.goal ? boss.goal : { x: LEVEL_WIDTH - 80, y: GROUND_Y - 70, w: 30, h: 70 };

  return {
    platforms, ramps, coins, enemies, goal, farmsteads, boss,
    time: config.time,
    checkpointX: 40,
  };
}

// --- Boss: The Great Oak ---
// A trunk too tall to SuperHop over. Climb the limbs on its left side,
// go over the top, and drop down the right side, all while it drops apples.
const OAK_X = TILES_END + 520;
const OAK_TRUNK_W = 80;
const OAK_HEIGHT = 330;
const OAK_LIMBS = [
  { left: -320, rise: 90 },
  { left: -200, rise: 175 },
  { left: -95, rise: 260 },
];
const APPLE_R = 7;
const APPLE_GRAVITY = 0.22;

function makeOakBoss(platforms) {
  platforms.push({ x: OAK_X, y: GROUND_Y - OAK_HEIGHT, w: OAK_TRUNK_W, h: OAK_HEIGHT, type: "oakTrunk" });
  for (const limb of OAK_LIMBS) {
    platforms.push({ x: OAK_X + limb.left, y: GROUND_Y - limb.rise, w: -limb.left, h: 14, type: "oakLimb", oneWay: true });
  }
  return {
    type: "oak",
    name: "The Great Oak",
    intro: "The Great Oak blocks the way — climb up and over it!",
    active: false,
    defeated: false,
    apples: [],
    dropTimer: 40,
  };
}

// Shared by every boss: entering the arena wakes it and sets a checkpoint
function updateBoss(boss) {
  if (boss.defeated) {
    // Let leftover smoke drift away instead of vanishing
    if (boss.type === "barrel") updateSmokePuffs(boss, false);
    return;
  }
  if (!boss.active && player.x > TILES_END) {
    boss.active = true;
    level.checkpointX = TILES_END + 40;
    if (boss.type === "oak") Sfx.bossRoar();
    else Sfx.fireWhoosh();
    messageEl.textContent = `Checkpoint! ${boss.intro}`;
  }
  if (boss.type === "oak") updateOakBoss(boss);
  else if (boss.type === "barrel") updateBarrelBoss(boss);
  else if (boss.type === "warehouse") updateWarehouseBoss(boss);
}

// Drawn before the platforms
function drawBossBehind(boss, viewStart, viewEnd) {
  if (boss.type === "oak" && OAK_X + 450 > viewStart && OAK_X - 450 < viewEnd) drawOakTree(boss);
  if (boss.type === "barrel") drawBarrelArena(boss);
  if (boss.type === "warehouse") drawWarehouseArena(boss);
}

// Drawn over the player
function drawBossFront(boss) {
  if (boss.type === "oak") drawApples(boss);
  if (boss.type === "barrel") drawSmoke(boss);
  if (boss.type === "warehouse") drawRivals(boss);
}

function updateOakBoss(boss) {
  if (!boss.active) return;

  if (player.x > OAK_X + OAK_TRUNK_W) {
    boss.defeated = true;
    boss.apples = [];
    Sfx.bossDefeat();
    messageEl.textContent = "You got over The Great Oak! Ride to the flag!";
    return;
  }

  boss.dropTimer -= 1;
  if (boss.dropTimer <= 0) {
    // Aim near the player, but only from under the crown
    const target = player.x + player.w / 2 + (Math.random() * 120 - 60);
    const x = Math.max(OAK_X - 340, Math.min(OAK_X + OAK_TRUNK_W + 40, target));
    boss.apples.push({ x, y: GROUND_Y - OAK_HEIGHT - 50, vy: 0 });
    boss.dropTimer = 45 + Math.random() * 35;
  }

  for (const apple of boss.apples) {
    apple.vy += APPLE_GRAVITY;
    apple.y += apple.vy;
    const nearestX = Math.max(player.x, Math.min(apple.x, player.x + player.w));
    const nearestY = Math.max(player.y, Math.min(apple.y, player.y + player.h));
    if (Math.hypot(apple.x - nearestX, apple.y - nearestY) < APPLE_R) {
      apple.done = true;
      Sfx.hurt();
      loseLife();
      boss.apples = [];
      return;
    }
    if (apple.y + APPLE_R >= GROUND_Y) {
      apple.done = true;
      Sfx.applePlop();
    }
  }
  boss.apples = boss.apples.filter((a) => !a.done);
}

function drawOakTree(boss) {
  const trunkTop = GROUND_Y - OAK_HEIGHT;
  const midX = OAK_X + OAK_TRUNK_W / 2;

  // Crown sits behind the limbs so you can see where to land
  const crown = [
    [-150, 10, 120], [-30, -40, 120], [110, 0, 110], [-260, 60, 80],
    [200, 60, 80], [-200, 140, 70], [-60, 120, 80], [40, 60, 90],
  ];
  ctx.fillStyle = "#2f6b2a";
  for (const [dx, dy, r] of crown) {
    ctx.beginPath();
    ctx.arc(midX + dx, trunkTop + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3f8a35";
  for (const [dx, dy, r] of crown) {
    ctx.beginPath();
    ctx.arc(midX + dx - r * 0.2, trunkTop + dy - r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trunk with bark lines and roots
  ctx.fillStyle = "#5a3a20";
  ctx.fillRect(OAK_X, trunkTop, OAK_TRUNK_W, OAK_HEIGHT);
  ctx.beginPath();
  ctx.moveTo(OAK_X - 30, GROUND_Y);
  ctx.quadraticCurveTo(OAK_X, GROUND_Y - 10, OAK_X, GROUND_Y - 50);
  ctx.lineTo(OAK_X + OAK_TRUNK_W, GROUND_Y - 50);
  ctx.quadraticCurveTo(OAK_X + OAK_TRUNK_W, GROUND_Y - 10, OAK_X + OAK_TRUNK_W + 30, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#432a16";
  ctx.lineWidth = 2;
  for (const bx of [14, 34, 58]) {
    ctx.beginPath();
    ctx.moveTo(OAK_X + bx, trunkTop + 40);
    ctx.bezierCurveTo(OAK_X + bx + 6, trunkTop + 120, OAK_X + bx - 6, trunkTop + 200, OAK_X + bx, GROUND_Y - 10);
    ctx.stroke();
  }
  // Walkable top of the trunk
  ctx.fillStyle = "#4e8b3a";
  ctx.fillRect(OAK_X - 4, trunkTop, OAK_TRUNK_W + 8, 6);

  // Face: angry while awake, dizzy once you've beaten it
  const faceY = GROUND_Y - 150;
  ctx.fillStyle = "#2a1a0c";
  if (boss.defeated) {
    ctx.strokeStyle = "#2a1a0c";
    ctx.lineWidth = 3;
    for (const ex of [midX - 18, midX + 18]) {
      ctx.beginPath();
      ctx.moveTo(ex - 6, faceY - 6);
      ctx.lineTo(ex + 6, faceY + 6);
      ctx.moveTo(ex + 6, faceY - 6);
      ctx.lineTo(ex - 6, faceY + 6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(midX, faceY + 34, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const look = Math.max(-4, Math.min(4, (player.x - midX) / 60));
    for (const ex of [midX - 18, midX + 18]) {
      ctx.fillStyle = "#2a1a0c";
      ctx.beginPath();
      ctx.ellipse(ex, faceY, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = boss.active ? "#ffcf3f" : "#c9b37a";
      ctx.beginPath();
      ctx.arc(ex + look, faceY + 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#2a1a0c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(midX - 30, faceY - 16);
    ctx.lineTo(midX - 8, faceY - 9);
    ctx.moveTo(midX + 30, faceY - 16);
    ctx.lineTo(midX + 8, faceY - 9);
    ctx.stroke();
    ctx.fillStyle = "#2a1a0c";
    ctx.beginPath();
    ctx.moveTo(midX - 16, faceY + 38);
    ctx.quadraticCurveTo(midX, faceY + 24, midX + 16, faceY + 38);
    ctx.closePath();
    ctx.fill();
  }
}

function drawOakLimb(p) {
  ctx.fillStyle = "#5a3a20";
  ctx.beginPath();
  ctx.moveTo(p.x + p.w, p.y - 4);
  ctx.lineTo(p.x + 6, p.y);
  ctx.quadraticCurveTo(p.x - 4, p.y + p.h / 2, p.x + 6, p.y + p.h);
  ctx.lineTo(p.x + p.w, p.y + p.h + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4e8b3a";
  ctx.beginPath();
  ctx.ellipse(p.x + 4, p.y - 2, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawApples(boss) {
  for (const apple of boss.apples) {
    // Shadow on the ground grows as the apple gets closer
    const closeness = Math.max(0, Math.min(1, 1 - (GROUND_Y - apple.y) / OAK_HEIGHT));
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + closeness * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(apple.x, GROUND_Y + 2, 4 + closeness * 6, 2 + closeness * 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d62828";
    ctx.beginPath();
    ctx.arc(apple.x, apple.y, APPLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(apple.x - 2.5, apple.y - 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a2c18";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(apple.x, apple.y - APPLE_R);
    ctx.lineTo(apple.x + 2, apple.y - APPLE_R - 4);
    ctx.stroke();
  }
}

// --- Boss: The Burn Barrel ---
// Hop onto the pallet stack, then time a jump over the barrel's smoke
// column onto the down ramp. Touching smoke or the barrel starts you over.
const PALLET_X = TILES_END + 330;
const PALLET_W = 140;
const PALLET_H = 100;
const BARREL_X = PALLET_X + PALLET_W;
const BARREL_W = 60;
const BARREL_H = 80;
const RAMP_X = BARREL_X + BARREL_W + 20;
const RAMP_W = 220;
const RAMP_H = 100;
const SMOKE_ON_FRAMES = 100;
const SMOKE_OFF_FRAMES = 120;
const SMOKE_WARN_FRAMES = 40;
const SMOKE_CYCLE = SMOKE_ON_FRAMES + SMOKE_OFF_FRAMES;
const SMOKE_LIFE = 110;

function makeBarrelBoss(platforms, ramps) {
  platforms.push({ x: PALLET_X - 80, y: GROUND_Y - 45, w: 40, h: 45, type: "hay" });
  platforms.push({ x: PALLET_X, y: GROUND_Y - PALLET_H, w: PALLET_W, h: PALLET_H, type: "pallets" });
  platforms.push({ x: BARREL_X, y: GROUND_Y - BARREL_H, w: BARREL_W, h: BARREL_H, type: "barrel" });
  ramps.push({ x: RAMP_X, y: GROUND_Y - RAMP_H, w: RAMP_W, drop: RAMP_H });
  return {
    type: "barrel",
    name: "The Burn Barrel",
    intro: "Hop up on the pallets and time your jump over The Burn Barrel's smoke!",
    active: false,
    defeated: false,
    puffs: [],
    cycle: 0,
  };
}

function updateSmokePuffs(boss, emitting) {
  boss.cycle = (boss.cycle + 1) % SMOKE_CYCLE;
  if (emitting && boss.cycle < SMOKE_ON_FRAMES && boss.cycle % 5 === 0) {
    boss.puffs.push({
      x: BARREL_X + BARREL_W / 2 + (Math.random() * 16 - 8),
      y: GROUND_Y - BARREL_H - 6,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(2.2 + Math.random() * 0.6),
      r: 14,
      age: 0,
    });
  }
  for (const puff of boss.puffs) {
    puff.x += puff.vx;
    puff.y += puff.vy;
    puff.r += 0.3;
    puff.age += 1;
  }
  boss.puffs = boss.puffs.filter((p) => p.age < SMOKE_LIFE);
}

function updateBarrelBoss(boss) {
  updateSmokePuffs(boss, true);
  if (!boss.active) return;

  // Warning flare a moment before the next burst of smoke
  if (boss.cycle === SMOKE_CYCLE - SMOKE_WARN_FRAMES) Sfx.fireWhoosh();

  // Slightly larger than the barrel so bumping its side or top counts as touching
  const barrelZone = { x: BARREL_X - 2, y: GROUND_Y - BARREL_H - 2, w: BARREL_W + 4, h: BARREL_H + 2 };
  let hit = rectsOverlap(player, barrelZone);
  for (const puff of boss.puffs) {
    if (hit) break;
    // Thin, high smoke is harmless; only the thick part counts
    if (puff.age / SMOKE_LIFE > 0.65) continue;
    const nearestX = Math.max(player.x, Math.min(puff.x, player.x + player.w));
    const nearestY = Math.max(player.y, Math.min(puff.y, player.y + player.h));
    if (Math.hypot(puff.x - nearestX, puff.y - nearestY) < puff.r * 0.6) hit = true;
  }
  if (hit) {
    Sfx.cough();
    messageEl.textContent = "Cough! Too much smoke — back to the start. Wait for the smoke to clear, then jump!";
    respawnPlayer();
    return;
  }

  if (player.onGround && player.x > BARREL_X + BARREL_W) {
    boss.defeated = true;
    Sfx.bossDefeat();
    messageEl.textContent = "You cleared The Burn Barrel! Ride to the flag!";
  }
}

function drawBarrelArena(boss) {
  // Down ramp: a sloped plank on posts
  ctx.fillStyle = "#6b4a2b";
  for (const fx of [0.15, 0.5, 0.8]) {
    const px = RAMP_X + RAMP_W * fx;
    const top = GROUND_Y - RAMP_H + RAMP_H * fx;
    ctx.fillRect(px - 3, top, 6, GROUND_Y - top);
  }
  ctx.fillStyle = "#a0703f";
  ctx.beginPath();
  ctx.moveTo(RAMP_X, GROUND_Y - RAMP_H);
  ctx.lineTo(RAMP_X + RAMP_W, GROUND_Y);
  ctx.lineTo(RAMP_X + RAMP_W, GROUND_Y + 4);
  ctx.lineTo(RAMP_X, GROUND_Y - RAMP_H + 9);
  ctx.closePath();
  ctx.fill();

  // Steel drum with ribs and rust
  const top = GROUND_Y - BARREL_H;
  ctx.fillStyle = "#4d4f52";
  ctx.fillRect(BARREL_X, top, BARREL_W, BARREL_H);
  ctx.fillStyle = "#8a4b26";
  ctx.fillRect(BARREL_X + 8, top + 30, 14, 20);
  ctx.fillRect(BARREL_X + 36, top + 52, 12, 16);
  ctx.fillStyle = "#333538";
  for (const ry of [6, 40, 72]) ctx.fillRect(BARREL_X - 2, top + ry, BARREL_W + 4, 5);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(BARREL_X + 18, top + 58, 7, 7);
  ctx.fillRect(BARREL_X + 34, top + 20, 7, 7);

  if (boss.defeated) {
    // Just embers once it's beaten
    ctx.fillStyle = "#c2410c";
    for (const ex of [12, 26, 40, 50]) ctx.fillRect(BARREL_X + ex, top - 3, 5, 3);
    return;
  }

  // Flames: low while quiet, a big flare as a warning, dark and smoky while puffing
  const warning = boss.cycle >= SMOKE_CYCLE - SMOKE_WARN_FRAMES;
  const smoking = boss.cycle < SMOKE_ON_FRAMES;
  const flameH = warning ? 46 : smoking ? 28 : 16;
  const t = performance.now() / 90;
  for (let i = 0; i < 5; i++) {
    const fx = BARREL_X + 8 + i * 11;
    const h = flameH * (0.7 + 0.3 * Math.sin(t + i * 1.7));
    ctx.fillStyle = smoking ? "#b45309" : "#f97316";
    ctx.beginPath();
    ctx.moveTo(fx - 7, top);
    ctx.quadraticCurveTo(fx, top - h * 1.2, fx + 7, top);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(fx - 3, top);
    ctx.quadraticCurveTo(fx, top - h * 0.6, fx + 3, top);
    ctx.fill();
  }
  if (warning) {
    ctx.fillStyle = "#fde047";
    for (let i = 0; i < 6; i++) {
      const sx = BARREL_X + BARREL_W / 2 + Math.sin(t * 1.3 + i * 2.1) * 26;
      const sy = top - 20 - ((t * 9 + i * 17) % 60);
      ctx.fillRect(sx, sy, 3, 3);
    }
  }
}

function drawPalletPlatform(p) {
  const layer = 20;
  for (let y = p.y; y < p.y + p.h; y += layer) {
    ctx.fillStyle = "#b08a5a";
    ctx.fillRect(p.x, y, p.w, 6);
    ctx.fillRect(p.x, y + layer - 5, p.w, 5);
    ctx.fillStyle = "#8a6a46";
    for (const bx of [4, p.w / 2 - 6, p.w - 16]) ctx.fillRect(p.x + bx, y + 6, 12, layer - 11);
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(p.x, y + 6, 4, layer - 11);
  }
  ctx.fillStyle = "#c9a06a";
  ctx.fillRect(p.x, p.y, p.w, 3);
}

function drawSmoke(boss) {
  for (const puff of boss.puffs) {
    const alpha = (1 - puff.age / SMOKE_LIFE) * 0.8;
    ctx.fillStyle = `rgba(70, 70, 76, ${alpha})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(130, 130, 136, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(puff.x - puff.r * 0.3, puff.y - puff.r * 0.3, puff.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Boss: The Warehouse ---
// Rival BMX kids launch off the roof, ride down the ramp, and drop into a pit.
// Jump the pit, hop the oncoming riders, and ride the ramp up to the roof.
const WH_PIT_X = TILES_END + 260;
const WH_PIT_W = 100;
const WH_RAMP_X = TILES_END + 450;
const WH_RAMP_W = 200;
const WH_X = WH_RAMP_X + WH_RAMP_W;
const WH_H = 150;
const WH_ROOF_Y = GROUND_Y - WH_H;
const BURST_FRAMES = [0, 18, 34, 48, 62, 76, 92, 110];
const FIREWORK_COLORS = ["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7", "#da77f2", "#ffffff", "#ff922b"];

function makeWarehouseBoss(platforms, ramps) {
  platforms.push({ x: TILES_END, y: GROUND_Y, w: WH_PIT_X - TILES_END, h: 40, type: "ground" });
  platforms.push({ x: WH_PIT_X + WH_PIT_W, y: GROUND_Y, w: LEVEL_WIDTH - WH_PIT_X - WH_PIT_W, h: 40, type: "ground" });
  platforms.push({ x: WH_X, y: WH_ROOF_Y, w: LEVEL_WIDTH - WH_X, h: 12, type: "roof", oneWay: true });
  ramps.push({ x: WH_RAMP_X, y: GROUND_Y, w: WH_RAMP_W, drop: -WH_H });
  return {
    type: "warehouse",
    name: "The Warehouse Crew",
    intro: "Jump the pit, hop the oncoming riders, and ride up to the warehouse roof!",
    active: false,
    defeated: false,
    riders: [],
    spawnTimer: 30,
    particles: [],
    celebrationFrame: -1,
    flash: 0,
    goal: { x: LEVEL_WIDTH - 80, y: WH_ROOF_Y - 70, w: 30, h: 70 },
  };
}

// Height of the riding surface under a rival at x, or null over the pit
function warehouseSurfaceAt(x) {
  if (x >= WH_X) return WH_ROOF_Y;
  if (x >= WH_RAMP_X) return GROUND_Y - ((x - WH_RAMP_X) / WH_RAMP_W) * WH_H;
  if (x >= WH_PIT_X + WH_PIT_W) return GROUND_Y;
  if (x >= WH_PIT_X) return null;
  return GROUND_Y;
}

// Riders and fireworks keep moving even after the level is won
function updateWarehouseAmbient(boss) {
  if (!boss.defeated) {
    boss.spawnTimer -= 1;
    if (boss.spawnTimer <= 0) {
      boss.riders.push({
        x: LEVEL_WIDTH - 40, y: WH_ROOF_Y - 32, w: 28, h: 32,
        vx: -(2.4 + Math.random() * 0.8), vy: 0,
        onGround: true, facing: -1, wheelPhase: 0,
        colors: RIVAL_COLORS[Math.floor(Math.random() * RIVAL_COLORS.length)],
        falling: false,
      });
      boss.spawnTimer = 100 + Math.random() * 60;
    }
  }

  for (const r of boss.riders) {
    r.wheelPhase += r.vx * 0.25;
    if (r.falling) {
      r.vy += GRAVITY;
      r.y += r.vy;
      r.x = Math.max(WH_PIT_X + 2, r.x + r.vx * 0.5);
      continue;
    }
    r.x += r.vx;
    const surface = warehouseSurfaceAt(r.x + r.w / 2);
    if (surface === null) {
      r.falling = true;
      r.onGround = false;
      if (Math.abs(r.x - (camera.x + canvas.width / 2)) < canvas.width) Sfx.rivalFall();
    } else {
      r.y = surface - r.h;
    }
  }
  boss.riders = boss.riders.filter((r) => r.y < LEVEL_HEIGHT + 80);

  if (boss.celebrationFrame >= 0) {
    const i = BURST_FRAMES.indexOf(boss.celebrationFrame);
    if (i === 0) addFireworkBurst(boss, player.x + player.w / 2, player.y, true);
    else if (i > 0) addFireworkBurst(boss, camera.x + 120 + Math.random() * 560, 60 + Math.random() * 140, false);
    boss.celebrationFrame += 1;
  }
  for (const p of boss.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + 0.05;
    p.life -= 1;
  }
  boss.particles = boss.particles.filter((p) => p.life > 0);
  boss.flash *= 0.9;
}

function addFireworkBurst(boss, x, y, big) {
  const count = big ? 140 : 60;
  const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (big ? 2 : 1) + Math.random() * (big ? 7 : 4);
    const life = 50 + Math.random() * 40;
    boss.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life, maxLife: life,
      color: big ? FIREWORK_COLORS[i % FIREWORK_COLORS.length] : color,
    });
  }
  if (big) boss.flash = 1;
}

function updateWarehouseBoss(boss) {
  updateWarehouseAmbient(boss);
  if (!boss.active) return;

  for (const r of boss.riders) {
    if (r.falling || !rectsOverlap(player, r)) continue;
    const stomping = player.vy > 0 && player.y + player.h - player.vy <= r.y + 8;
    if (stomping) {
      // Bounce off their helmet and knock them into a wipeout
      player.vy = JUMP_FORCE * 0.6;
      r.falling = true;
      r.vy = -3;
      Sfx.stomp();
    } else {
      Sfx.hurt();
      loseLife();
      return;
    }
  }

  const onRoof = player.onGround && player.x + player.w / 2 >= WH_X && player.y + player.h <= WH_ROOF_Y + 1;
  if (onRoof) {
    boss.defeated = true;
    boss.celebrationFrame = 0;
    Sfx.celebration();
    completeLevel(false);
  }
}

function drawWarehouseArena(boss) {
  // Pit: a dark hole dropping below ground
  const pitGrad = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height);
  pitGrad.addColorStop(0, "#3a2a1a");
  pitGrad.addColorStop(1, "#050302");
  ctx.fillStyle = pitGrad;
  ctx.fillRect(WH_PIT_X, GROUND_Y, WH_PIT_W, canvas.height - GROUND_Y);

  // Ramp up to the roof
  ctx.fillStyle = "#4a4f57";
  for (const fx of [0.3, 0.6, 0.9]) {
    const px = WH_RAMP_X + WH_RAMP_W * fx;
    const top = GROUND_Y - WH_H * fx;
    ctx.fillRect(px - 3, top, 6, GROUND_Y - top);
  }
  ctx.fillStyle = "#8d6e4c";
  ctx.beginPath();
  ctx.moveTo(WH_RAMP_X, GROUND_Y);
  ctx.lineTo(WH_X, WH_ROOF_Y);
  ctx.lineTo(WH_X, WH_ROOF_Y + 9);
  ctx.lineTo(WH_RAMP_X + 10, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Corrugated metal warehouse
  const w = LEVEL_WIDTH - WH_X;
  ctx.fillStyle = "#5b6470";
  ctx.fillRect(WH_X, WH_ROOF_Y, w, WH_H);
  ctx.fillStyle = "#4b535e";
  for (let x = WH_X + 4; x < LEVEL_WIDTH; x += 10) ctx.fillRect(x, WH_ROOF_Y + 10, 3, WH_H - 10);
  ctx.fillStyle = "#3d434b";
  ctx.fillRect(WH_X - 4, WH_ROOF_Y - 2, w + 4, 12);
  ctx.fillStyle = "#7b8592";
  ctx.fillRect(WH_X + 70, GROUND_Y - 80, 90, 80);
  ctx.fillStyle = "#6a7380";
  for (let y = GROUND_Y - 76; y < GROUND_Y; y += 8) ctx.fillRect(WH_X + 70, y, 90, 2);
  ctx.fillStyle = "#e9ecef";
  ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BMX DEPOT", WH_X + w / 2, WH_ROOF_Y + 36);
  ctx.textAlign = "start";
}

function drawRivals(boss) {
  for (const r of boss.riders) {
    if (r.falling) {
      // Riders that drop into the pit disappear below ground
      ctx.save();
      ctx.beginPath();
      ctx.rect(WH_PIT_X, -1000, WH_PIT_W, 3000);
      if (r.y + r.h > GROUND_Y) ctx.clip();
      drawPlayer(r, r.colors);
      ctx.restore();
    } else {
      drawPlayer(r, r.colors);
    }
  }
}

// Drawn after the night tint so they glow: rival headlights, lit windows, fireworks
function drawWarehouseLights(boss) {
  ctx.fillStyle = "rgba(255, 212, 59, 0.85)";
  for (const wx of [WH_X + 20, WH_X + 190]) ctx.fillRect(wx, WH_ROOF_Y + 50, 24, 16);
  if (level.time === "night") {
    for (const r of boss.riders) if (!r.falling) drawHeadlight(r);
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of boss.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBossBanner(boss) {
  if (!boss.active || boss.defeated) return;
  ctx.save();
  ctx.fillStyle = "rgba(20, 12, 4, 0.7)";
  ctx.fillRect(canvas.width / 2 - 150, 10, 300, 30);
  ctx.fillStyle = "#ffcf3f";
  ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`BOSS: ${boss.name}`, canvas.width / 2, 25);
  ctx.restore();
}

let level, player, camera, score, lives, state;
let levelIndex = 0;
let startTime = 0;
let elapsedMs = 0;
let timeBeforeLevel = 0;
let bestTime = null;
{
  const stored = localStorage.getItem(BEST_TIME_KEY);
  if (stored) bestTime = parseFloat(stored);
}

function resetGame() {
  lives = 3;
  timeBeforeLevel = 0;
  elapsedMs = 0;
  livesEl.textContent = lives;
  timerEl.textContent = formatTime(0);
  bestTimeEl.textContent = formatTime(bestTime);
  loadLevel(0);
}

function loadLevel(index) {
  levelIndex = index;
  const config = LEVELS[index];
  level = makeLevel(config);
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
    superHopUsed: false,
    hopPuff: null,
  };
  camera = { x: 0 };
  score = 0;
  state = "playing";
  startTime = performance.now();
  totalCoinsEl.textContent = level.coins.length;
  coinsEl.textContent = score;
  levelEl.textContent = `${index + 1} — ${config.name}`;
  messageEl.textContent = "";
}

function completeLevel(playFanfare = true) {
  timeBeforeLevel = elapsedMs;
  if (levelIndex < LEVELS.length - 1) {
    state = "levelComplete";
    if (playFanfare) Sfx.levelUp();
    const next = levelIndex + 1;
    messageEl.textContent = `Level ${levelIndex + 1} complete! Get ready for Level ${next + 1} — ${LEVELS[next].name}`;
    setTimeout(() => {
      // Skip if the player restarted during the pause
      if (state === "levelComplete" && levelIndex === next - 1) loadLevel(next);
    }, LEVEL_TRANSITION_MS);
    return;
  }

  state = "won";
  if (playFanfare) Sfx.levelUp();
  if (bestTime === null || elapsedMs < bestTime) {
    bestTime = elapsedMs;
    localStorage.setItem(BEST_TIME_KEY, String(bestTime));
    bestTimeEl.textContent = formatTime(bestTime);
    messageEl.textContent = `All 3 levels done — new best time: ${formatTime(elapsedMs)}! Press R to play again`;
  } else {
    messageEl.textContent = `All 3 levels done in ${formatTime(elapsedMs)}! Best: ${formatTime(bestTime)} — press R to play again`;
  }
}

function respawnPlayer() {
  player.x = level.checkpointX;
  player.y = GROUND_Y - 32;
  player.vx = 0;
  player.superHopUsed = false;
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
  if (state !== "playing") {
    jumpPressed = false;
    // Keep the victory fireworks going after the final level is won
    if (level.boss && level.boss.type === "warehouse") updateWarehouseAmbient(level.boss);
    return;
  }

  elapsedMs = timeBeforeLevel + (performance.now() - startTime);
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

  if (JUMP_KEYS.some((k) => keys[k]) && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    Sfx.jump();
  } else if (jumpPressed && !player.onGround && !player.superHopUsed) {
    player.vy = SUPER_HOP_FORCE;
    player.superHopUsed = true;
    player.hopPuff = { x: player.x + player.w / 2, y: player.y + player.h, age: 0 };
    Sfx.superHop();
  }
  jumpPressed = false;

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  player.onGround = false;
  let blockedSideways = false;

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > LEVEL_WIDTH) player.x = LEVEL_WIDTH - player.w;

  for (const p of level.platforms) {
    if (rectsOverlap(player, p)) {
      const prevBottom = player.y + player.h - player.vy;
      // One-way platforms get a few pixels of slack so you can roll onto them off a ramp
      const landingOnTop = player.vy >= 0 && prevBottom <= p.y + (p.oneWay ? 4 : 1);
      // One-way platforms (tree limbs) can be hopped up through from below
      if (p.oneWay && !landingOnTop) continue;
      if (landingOnTop) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.superHopUsed = false;
      } else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 1) {
        player.y = p.y + p.h;
        player.vy = 0;
      } else if (player.vx > 0) {
        player.x = p.x - player.w;
        blockedSideways = true;
      } else if (player.vx < 0) {
        player.x = p.x + p.w;
        blockedSideways = true;
      }
    }
  }

  // Ramps: land on the sloped surface and stay stuck to it while riding down
  const wasOnRamp = player.onRamp;
  player.onRamp = false;
  for (const r of level.ramps) {
    const cx = player.x + player.w / 2;
    if (cx < r.x || cx > r.x + r.w) continue;
    const surface = r.y + ((cx - r.x) / r.w) * r.drop;
    const bottom = player.y + player.h;
    const prevBottom = bottom - player.vy;
    const sticking = wasOnRamp && bottom < surface && surface - bottom < 12;
    if (player.vy >= 0 && (bottom >= surface || sticking) && prevBottom <= surface + 12) {
      player.y = surface - player.h;
      player.vy = 0;
      player.onGround = true;
      player.superHopUsed = false;
      player.onRamp = true;
    }
  }

  // Only thud on first contact, not every frame while pushing against it
  if (blockedSideways && !player.wasBlocked) Sfx.bump();
  player.wasBlocked = blockedSideways;

  if (player.y > LEVEL_HEIGHT) {
    Sfx.fall();
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
        Sfx.coin();
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
        Sfx.stomp();
      } else {
        Sfx.hurt();
        loseLife();
      }
    }
  }

  if (state === "playing" && level.boss) updateBoss(level.boss);

  if (state === "playing" && rectsOverlap(player, level.goal)) {
    completeLevel();
  }

  camera.x = Math.max(0, Math.min(player.x - canvas.width / 2, LEVEL_WIDTH - canvas.width));

  player.wheelPhase += player.vx * 0.25;

  if (player.hopPuff) {
    player.hopPuff.age += 1;
    if (player.hopPuff.age > HOP_PUFF_FRAMES) player.hopPuff = null;
  }
}

const HOP_PUFF_FRAMES = 18;

// Expanding ring of air left behind where the SuperHop kicked off
function drawHopPuff(puff) {
  const t = puff.age / HOP_PUFF_FRAMES;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3 * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(puff.x, puff.y + t * 6, 10 + t * 22, 3 + t * 6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const SKY_GRADIENTS = {
  day: [[0, "#8ec9f0"], [0.75, "#cfe9ff"], [1, "#e9f6e2"]],
  sunset: [[0, "#3b2a63"], [0.4, "#b4507a"], [0.7, "#f28c4b"], [1, "#ffd27f"]],
  night: [[0, "#050a1c"], [0.7, "#13224d"], [1, "#2a3a66"]],
};

// Tint applied over the scenery so farms and hills match the sky
const SCENE_TINTS = {
  day: null,
  sunset: "rgba(200, 80, 60, 0.22)",
  night: "rgba(6, 12, 40, 0.58)",
};

const STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height * 0.6,
  r: 0.5 + Math.random() * 1.2,
  phase: Math.random() * Math.PI * 2,
}));

const skyCanvas = document.createElement("canvas");
skyCanvas.width = canvas.width;
skyCanvas.height = canvas.height;
const skyCtx = skyCanvas.getContext("2d");

function drawSky() {
  const grad = skyCtx.createLinearGradient(0, 0, 0, canvas.height);
  for (const [stop, color] of SKY_GRADIENTS[level.time]) grad.addColorStop(stop, color);
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, canvas.width, canvas.height);

  if (level.time === "day") {
    skyCtx.fillStyle = "rgba(255, 244, 191, 0.9)";
    skyCtx.beginPath();
    skyCtx.arc(680, 70, 32, 0, Math.PI * 2);
    skyCtx.fill();
  } else if (level.time === "sunset") {
    // Big low sun sinking behind the hills
    const glow = skyCtx.createRadialGradient(560, 330, 20, 560, 330, 200);
    glow.addColorStop(0, "rgba(255, 220, 140, 0.8)");
    glow.addColorStop(1, "rgba(255, 140, 80, 0)");
    skyCtx.fillStyle = glow;
    skyCtx.fillRect(0, 0, canvas.width, canvas.height);
    skyCtx.fillStyle = "#ffcf6e";
    skyCtx.beginPath();
    skyCtx.arc(560, 330, 55, 0, Math.PI * 2);
    skyCtx.fill();
  } else if (level.time === "night") {
    const t = performance.now() / 600;
    skyCtx.fillStyle = "#ffffff";
    for (const s of STARS) {
      skyCtx.globalAlpha = 0.5 + 0.5 * Math.sin(t + s.phase);
      skyCtx.beginPath();
      skyCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      skyCtx.fill();
    }
    skyCtx.globalAlpha = 1;
    skyCtx.fillStyle = "#f2efdc";
    skyCtx.beginPath();
    skyCtx.arc(680, 70, 26, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.fillStyle = "rgba(180, 175, 155, 0.5)";
    skyCtx.beginPath();
    skyCtx.arc(672, 62, 5, 0, Math.PI * 2);
    skyCtx.arc(690, 78, 4, 0, Math.PI * 2);
    skyCtx.arc(684, 58, 2.5, 0, Math.PI * 2);
    skyCtx.fill();
  }
}

function drawHeadlight(p) {
  const cx = p.x + p.w / 2;
  const lampX = cx + p.facing * 16;
  const lampY = p.y + p.h - 34;
  const reach = 220;
  const beam = ctx.createRadialGradient(lampX, lampY, 4, lampX, lampY, reach);
  beam.addColorStop(0, "rgba(255, 240, 180, 0.45)");
  beam.addColorStop(1, "rgba(255, 240, 180, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(lampX, lampY);
  ctx.lineTo(lampX + p.facing * reach, lampY - 50);
  ctx.lineTo(lampX + p.facing * reach, lampY + 70);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCoins(viewStart, viewEnd) {
  ctx.fillStyle = "#ffd166";
  for (const coin of level.coins) {
    if (coin.collected) continue;
    if (coin.x < viewStart || coin.x > viewEnd) continue;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();
  }
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

// The boss arena after the last tile clears up so falling apples are easy to see
const WEATHER_ZONES = [...WEATHER_SEQUENCE, "clear"];

function getWeatherBlend(worldX) {
  const tilePos = worldX / TILE_WIDTH;
  const idx = Math.max(0, Math.min(WEATHER_ZONES.length - 1, Math.floor(tilePos)));
  const frac = tilePos - idx;
  const blendZone = 0.12;
  const nextIdx = Math.min(WEATHER_ZONES.length - 1, idx + 1);
  let blend = 0;
  if (frac > 1 - blendZone && idx < WEATHER_ZONES.length - 1) {
    blend = (frac - (1 - blendZone)) / blendZone;
  }
  return { current: WEATHER_ZONES[idx], next: WEATHER_ZONES[nextIdx], blend };
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

const PLAYER_COLORS = { shirt: SHIRT, shirtDark: SHIRT_DARK, helmet: HELMET, helmetDark: HELMET_DARK };
const RIVAL_COLORS = [
  { shirt: "#2f9e44", shirtDark: "#21702f", helmet: "#f59f00", helmetDark: "#b87500" },
  { shirt: "#7048e8", shirtDark: "#5230b3", helmet: "#e03131", helmetDark: "#a32020" },
  { shirt: "#f08c00", shirtDark: "#b56900", helmet: "#212529", helmetDark: "#000000" },
];

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

function drawPlayer(p, colors = PLAYER_COLORS) {
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
    drawLimbVec(hip.x, hip.y, footX - hip.x, footY - hip.y, 5, colors.shirtDark);
  }

  ctx.fillStyle = colors.shirt;
  ctx.beginPath();
  ctx.moveTo(hip.x - 5, hip.y + 4);
  ctx.lineTo(hip.x + 4, hip.y + 2);
  ctx.lineTo(shoulder.x + 4, shoulder.y);
  ctx.lineTo(shoulder.x - 5, shoulder.y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = colors.shirtDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hip.x - 2, hip.y + 2);
  ctx.lineTo(shoulder.x - 1, shoulder.y + 1);
  ctx.stroke();

  drawLimbVec(shoulder.x, shoulder.y, handlebar.x - shoulder.x, handlebar.y - shoulder.y, 4, colors.shirt);
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

  ctx.fillStyle = colors.helmet;
  ctx.beginPath();
  ctx.arc(headCenter.x, headCenter.y - 1, headR + 2, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(headCenter.x - headR - 2, headCenter.y - 1, (headR + 2) * 2, 3);
  ctx.fillStyle = colors.helmetDark;
  ctx.fillRect(headCenter.x - headR - 2, headCenter.y - 3, headR * 2 + 4, 2);
  ctx.fillStyle = colors.helmet;
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
  else if (p.type === "oakLimb") drawOakLimb(p);
  else if (p.type === "pallets") drawPalletPlatform(p);
  else if (p.type === "oakTrunk" || p.type === "barrel" || p.type === "roof") return; // drawn with their boss
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

  // The crown is much wider than the trunk, so cull on the whole tree
  if (level.boss) drawBossBehind(level.boss, viewStart, viewEnd);

  for (const p of level.platforms) {
    if (p.x + p.w < viewStart || p.x > viewEnd) continue;
    drawPlatform(p);
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

  if (player.hopPuff) drawHopPuff(player.hopPuff);
  drawPlayer(player);
  if (level.boss) drawBossFront(level.boss);

  ctx.restore();

  // Scenery was drawn onto a transparent canvas: tint only those pixels,
  // then slide the sky in behind them.
  const tint = SCENE_TINTS[level.time];
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  drawSky();
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.drawImage(skyCanvas, 0, 0);
  ctx.restore();

  // Coins and the headlight go on top of the tint so they stay bright
  ctx.save();
  ctx.translate(-camera.x, 0);
  drawCoins(viewStart, viewEnd);
  if (level.time === "night") drawHeadlight(player);
  if (level.boss && level.boss.type === "warehouse") drawWarehouseLights(level.boss);
  ctx.restore();

  drawWeatherEffects();
  if (level.boss) drawBossBanner(level.boss);

  // White flash from the big celebration explosion
  if (level.boss && level.boss.flash > 0.02) {
    ctx.fillStyle = `rgba(255, 255, 255, ${level.boss.flash * 0.6})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

resetGame();
loop();
