(() => {
  const VERSION = "1.2"; // keep in step with the folder and file names and the README change log

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const S = Sprites;

  // Hidden test flags: ?autostart skips the title, &t=30 jumps ahead in the run,
  // ?demo flies and bombs on its own, &seed=123 fixes the map,
  // &sim=5 plays 5 seconds instantly before the first frame (for screenshots),
  // &hp=1 starts each plane with only 1 hit left (to see the damage smoke)
  const params = new URLSearchParams(location.search);
  const DEMO = params.has("demo");
  const AUTOSTART = params.has("autostart") || DEMO;
  const JUMP_T = Math.max(0, Math.min(55, parseFloat(params.get("t")) || 0));
  const SEED = params.has("seed") ? parseInt(params.get("seed"), 10) : null;
  const SIM = Math.max(0, Math.min(70, parseFloat(params.get("sim")) || 0));
  const START_HP = parseInt(params.get("hp"), 10) || 99; // capped at PLANE_HITS when a plane is made

  // ---- Tuning (units: pixels and seconds) ----
  const RUN_TIME = 60;
  const SCROLL = 42; // ground speed
  const TRAVEL = RUN_TIME * SCROLL;
  const TAIL = 150; // ground past the end, for the fly-off
  const STRIP_H = TRAVEL + H + TAIL;
  const PLANE_Y = 300; // where each plane starts on screen
  const PLANE_Y_MIN = 110; // furthest forward the plane can fly
  const PLANE_Y_MAX = 340; // and furthest back
  const PLANES_PER_RUN = 2;
  const PLANE_HITS = 2; // flak hits a plane takes before it goes down
  const HIT_IMMUNE = 1; // seconds a plane can't be hit again after a flak hit
  const STEER_ACCEL = 380;
  const STEER_MAX = 90;
  const STEER_DRAG = 4;
  const FLY_ACCEL = 300; // Up/Down: flying forward and back up the screen
  const FLY_MAX = 70;
  const FLY_DRAG = 4;
  const ALT = 0.5; // the plane's height, for its size and shadow: it no longer changes
  const WIND_MAX = 30;
  const WIND_PUSH = 0.15; // how much the wind nudges the plane
  const BOMB_LOAD = 5; // bombs per load, dropped as fast as Space is pressed
  const BOMB_RELOAD = 3; // seconds after the last drop until the load is full again
  const FALL_T = 1.4; // seconds a bomb takes to reach the ground
  const BOMB_DRAG = 0.25; // bombs slowly lose the plane's forward speed
  const BOMB_SIDE_K = 1.3; // how fast a bomb picks up the wind
  const BOMB_INHERIT = 0.5; // share of the plane's sideways and forward-and-back speed a bomb keeps
  const BLAST_R = 9;
  const CHAIN_R = 24; // ammo dump secondary explosion
  const SHADOW_X = 9;
  const SHADOW_Y = 14;
  const CABLE_X = 12; // blimp offset from its winch
  const CABLE_Y = 34;
  const BLIMP_FALL_T = 2.2;
  const BLIMP_SHELL_T = 0.6; // flak shell flight time from a blimp
  const GROUND_SHELL_T = 0.85; // and from an AA gun on the ground
  const CRASH_T = 1.3;
  const SIREN_AHEAD = 40; // the siren starts when a village is this close ahead of the plane (about 1 s)
  const VILLAGE_HALF = 52; // how far a village's houses spread from its center
  const PLANE_BONUS = 200;
  const BEST_KEY = "skyRaiderBest";

  // Map bands, as distance from the start (the bottom of the strip)
  const FARM_END = 1000;
  const FRONT_END = 1900;
  const RIVER_D = 940;
  const RIVER_HALF = 7;
  const LINE1_D = 1230;
  const LINE2_D = 1570;

  const POINTS = { trench: 25, truck: 50, tent: 75, gun: 100, aa: 125, ammo: 150, bridge: 200, winch: 250, house: -100 };

  // Award levels by final score: the highest rank whose minimum the score beats
  const RANKS = [
    { min: 3001, name: "SUPREME AIR MARSHAL", color: "#f2d16b" },
    { min: 2001, name: "WING COMMANDER", color: "#f2d16b" },
    { min: 1001, name: "SQUADRON LEADER", color: "#9fe07a" },
    { min: 501, name: "COURAGEOUS CAPTAIN", color: "#9fe07a" },
    { min: -Infinity, name: "MERITORIOUS AIRMAN", color: "#f2efe4" },
  ];
  const rankFor = (s) => RANKS.find((r) => s >= r.min);

  // ---- Helpers ----
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random; // seeded while the map is built
  const rr = (a, b) => a + rnd() * (b - a);
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);

  function pixCircle(g, cx, cy, r, color) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    r = Math.max(0, Math.round(r));
    g.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
      g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }

  function pixLine(x0, y0, x1, y1, color) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = color;
    for (let n = 0; n < 400; n++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // ---- State ----
  let state = "title"; // title | playing | paused | over
  let showOrders = false; // title screen: false shows the game's name, true the mission orders
  let world = null;
  let animT = 0;
  let time = 0;
  let scroll = 0;
  let score = 0;
  let planesLeft = 0;
  let plane = null;
  let bombs = [];
  let flak = [];
  let particles = [];
  let fires = []; // bomb craters still burning
  let popups = [];
  let chains = [];
  let wind = 0;
  let windTarget = 0;
  let windTimer = 0;
  let bombsLeft = BOMB_LOAD;
  let reload = 0; // counts down while reloading
  let dropRequested = false;
  let stats = null;
  let overT = 0;
  let timeUp = false;
  let planeBonus = 0;
  let newBest = false;
  let soundMsgT = 0;
  let baseAlertT = 0; // counts down while "ENEMY BASE AHEAD!" flashes
  let jumpUsed = false;
  let best = 0;
  try {
    best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {
    // storage blocked: best score starts at 0
  }
  const keys = {};
  const clouds = [];

  const viewTop = () => STRIP_H - H - scroll;
  const toStrip = (screenY) => screenY + viewTop();
  const heightOf = (alt) => 0.35 + 0.65 * alt;
  // A bomb's forward speed over the ground: the scroll, plus part of the plane's own speed up the screen
  const bombFwd = (p) => SCROLL - p.vy * BOMB_INHERIT;

  // ============================================================
  // World generation: the whole map is painted once per run onto a tall strip
  // ============================================================
  function buildWorld(seed) {
    rnd = mulberry32(seed);
    const strip = document.createElement("canvas");
    strip.width = W;
    strip.height = STRIP_H;
    const g = strip.getContext("2d");
    const ph = [rr(0, 6.3), rr(0, 6.3), rr(0, 6.3)];
    const w = {
      strip,
      g,
      targets: [],
      blimps: [],
      camps: [], // fenced army camps, to sound the alarm as each comes into view
      villages: [], // village centers, for the air-raid siren
      flags: [],
      blocked: [],
      roadX: (d) => Math.round(128 + 48 * Math.sin(d / 240 + ph[0]) + 16 * Math.sin(d / 85 + ph[1])),
      riverY: (x) => STRIP_H - RIVER_D + 6 * Math.sin(x / 34 + ph[2]) + 3 * Math.sin(x / 13 + ph[0]),
    };
    w.inRiver = (x, y) => Math.abs(y - w.riverY(x)) < RIVER_HALF;

    paintGround(w);
    paintFields(w);
    paintFront(w);
    placeVillages(w);
    paintCamps(w);
    paintRoad(w);
    paintRiver(w);
    placeFarmTargets(w);
    placeTrucks(w);
    placeBlimps(w);
    placeAAGuns(w);
    paintTrees(w);
    speckle(w);
    rnd = Math.random;
    return w;
  }

  function isFree(w, x, y, hw, hh, roadGap = 6) {
    if (x - hw < 3 || x + hw > W - 3) return false;
    const d = STRIP_H - y;
    for (let dd = -hh; dd <= hh; dd += 4) if (Math.abs(x - w.roadX(d + dd)) < hw + roadGap) return false;
    if (Math.abs(y - w.riverY(x)) < RIVER_HALF + hh + 3) return false;
    for (const b of w.blocked) if (Math.abs(x - b.x) < hw + b.hw + 2 && Math.abs(y - b.y) < hh + b.hh + 2) return false;
    return true;
  }

  function addTarget(w, kind, x, y, art, extra = {}) {
    const t = {
      kind,
      x,
      y,
      art,
      hw: art ? art.img.width / 2 : 0,
      hh: art ? art.img.height / 2 : 0,
      alive: true,
      burn: 0,
      emit: rr(0, 0.6),
      pts: POINTS[kind],
      ...extra,
    };
    w.targets.push(t);
    if (!t.moving) w.blocked.push({ x, y, hw: t.hw, hh: t.hh });
    return t;
  }

  function paintGround(w) {
    const img = w.g.createImageData(W, STRIP_H);
    const a = img.data;
    const grass = [[93, 140, 58], [85, 127, 53], [102, 151, 63]];
    const mud = [[107, 84, 52], [95, 74, 46], [117, 96, 62]];
    const dusty = [[122, 138, 70], [111, 127, 64], [132, 146, 90]];
    for (let y = 0; y < STRIP_H; y++) {
      const d = STRIP_H - y;
      const tFront = clamp01((d - FARM_END + 30) / 90) * (1 - clamp01((d - FRONT_END + 30) / 90));
      const tCamp = clamp01((d - FRONT_END + 30) / 90);
      for (let x = 0; x < W; x++) {
        let base = grass;
        if (rnd() < tFront) base = mud;
        else if (rnd() < tCamp) base = dusty;
        const n = rnd();
        const c = base[n < 0.75 ? 0 : n < 0.9 ? 1 : 2];
        const i = (y * W + x) * 4;
        a[i] = c[0];
        a[i + 1] = c[1];
        a[i + 2] = c[2];
        a[i + 3] = 255;
      }
    }
    w.g.putImageData(img, 0, 0);
  }

  function paintFields(w) {
    const g = w.g;
    const HEDGE = "#3d6a2c";
    const kinds = [
      { base: "#c9b25a", stripe: "#b39b47" }, // wheat
      { base: "#7e5f3a", stripe: "#69502f" }, // ploughed
      { base: "#7aa84a", stripe: "#6c9a40" }, // young crop
      null, // pasture keeps the grass
      { base: "#d1bc66", stripe: "#bea852" },
      { base: "#8a6a42", stripe: "#76593a" },
    ];
    let d = 16;
    while (d < FARM_END - 70) {
      const rowH = ri(34, 64);
      const y0 = STRIP_H - d - rowH;
      let x = -ri(0, 30);
      while (x < W) {
        const fw = ri(48, 104);
        const k = pick(kinds);
        if (k) {
          g.fillStyle = k.base;
          g.fillRect(x + 2, y0 + 2, fw - 2, rowH - 2);
          g.fillStyle = k.stripe;
          if (rnd() < 0.5) for (let yy = y0 + 3; yy < y0 + rowH; yy += 3) g.fillRect(x + 2, yy, fw - 2, 1);
          else for (let xx = x + 3; xx < x + fw; xx += 3) g.fillRect(xx, y0 + 2, 1, rowH - 2);
        }
        g.fillStyle = HEDGE;
        g.fillRect(x, y0, 2, rowH);
        x += fw;
      }
      g.fillStyle = HEDGE;
      g.fillRect(0, y0, W, 2);
      d += rowH;
    }
  }

  function bakeCraterOn(g, x, y, r, wet) {
    pixCircle(g, x, y + 1, r + 1, "rgba(52,38,24,0.5)");
    pixCircle(g, x, y, r, "#4b3a26");
    if (r >= 3) pixCircle(g, x - 1, y - 1, r - 2, wet ? "#5d7380" : "#3a2b1b");
    for (let i = 0; i < r * 3; i++) {
      const a = Math.random() * 6.28;
      const dd = r + 1 + Math.random() * 4;
      g.fillStyle = Math.random() < 0.5 ? "#6b5434" : "#3e3022";
      g.fillRect(Math.round(x + Math.cos(a) * dd), Math.round(y + Math.sin(a) * dd), 1, 1);
    }
  }

  function bakeCrater(x, y, r) {
    bakeCraterOn(world.g, x, y, r, false);
  }

  function paintFront(w) {
    const g = w.g;
    // Shell craters, thickest in no man's land
    for (let i = 0; i < 170; i++) {
      const d = rnd() < 0.55 ? rr(LINE1_D, LINE2_D) : rr(FARM_END + 40, FRONT_END - 30);
      bakeCraterOn(g, rr(0, W), STRIP_H - d, ri(2, 6), rnd() < 0.2);
    }
    // Shattered tree stumps
    for (let i = 0; i < 40; i++) {
      const x = Math.round(rr(4, W - 4));
      const y = Math.round(STRIP_H - rr(FARM_END + 40, FRONT_END - 40));
      g.fillStyle = "#2e2216";
      g.fillRect(x, y, 2, 2);
      g.fillRect(x + (rnd() < 0.5 ? -1 : 2), y - 1, 1, 1);
    }
    // Two lines of zig-zag trenches with barbed wire facing no man's land
    for (const ld of [LINE1_D, LINE2_D]) {
      const baseY = Math.round(STRIP_H - ld);
      const wireY = ld === LINE1_D ? baseY - 14 : baseY + 20;
      for (let x = 0; x < W; x++) {
        g.fillStyle = "#9a978a";
        g.fillRect(x, wireY + ((x >> 1) % 2), 1, 1);
        if (x % 9 === 0) {
          g.fillStyle = "#3e3022";
          g.fillRect(x, wireY - 1, 1, 3);
        }
      }
      let i = 0;
      for (let x = -ri(0, 15); x < W; x += 16, i++) {
        const yy = baseY + (i % 2) * 7;
        g.fillStyle = "#9a8558";
        g.fillRect(x, yy - 1, 16, 6);
        g.fillStyle = "#33261a";
        g.fillRect(x, yy, 16, 4);
        g.fillRect(x, baseY, 4, 11);
        g.fillStyle = "#6b5434";
        for (let k = x + 1; k < x + 16; k += 3) g.fillRect(k, yy + 1, 1, 2);
        if (x + 8 > 4 && x + 8 < W - 4) addTarget(w, "trench", x + 8, yy + 2, null, { hw: 8, hh: 3 });
      }
      // Communication trenches lead back from each line
      const back = ld === LINE1_D ? 1 : -1;
      for (let k = 0; k < 3; k++) {
        let x = rr(20, W - 20);
        g.fillStyle = "#33261a";
        for (let s = 8; s < 80; s++) {
          x += Math.sin(s / 6 + k) * 0.6;
          g.fillRect(Math.round(x), baseY + 2 + back * s, 2, 1);
        }
      }
    }
    // Artillery behind the second line, in sandbagged gun pits
    for (let b = 0; b < 2; b++) {
      const d0 = rr(1690, 1840);
      const x0 = rr(30, W - 80);
      for (let k = 0; k < 3; k++) {
        const x = Math.round(x0 + k * 24);
        const y = Math.round(STRIP_H - d0 + rr(-4, 4));
        if (!isFree(w, x, y, 9, 10, 6)) continue;
        pixCircle(g, x, y + 1, 10, "#a08a5a");
        pixCircle(g, x, y + 1, 8, "#5a4630");
        addTarget(w, "gun", x, y, S.gun);
      }
    }
  }

  function placeVillages(w) {
    const g = w.g;
    const centers = [ri(240, 300), ri(520, 600), ri(780, 860)];
    centers.forEach((dv, vi) => {
      w.villages.push({ y: STRIP_H - dv });
      pixCircle(g, w.roadX(dv), STRIP_H - dv, 18, "#9c8a62");
      if (vi === 1) {
        for (let tries = 0; tries < 60; tries++) {
          const side = rnd() < 0.5 ? -1 : 1;
          const x = Math.round(w.roadX(dv) + side * rr(16, 30));
          const y = Math.round(STRIP_H - dv + rr(-10, 10));
          if (!isFree(w, x, y, 6, 14, 3)) continue;
          addTarget(w, "house", x, y, S.church);
          break;
        }
      }
      const want = ri(5, 8);
      for (let placed = 0, tries = 0; placed < want && tries < 200; tries++) {
        const d = dv + rr(-46, 46);
        const art = pick(S.houses);
        const side = rnd() < 0.5 ? -1 : 1;
        const x = Math.round(w.roadX(d) + side * rr(art.img.width / 2 + 7, 42));
        const y = Math.round(STRIP_H - d);
        if (!isFree(w, x, y, art.img.width / 2, art.img.height / 2, 3)) continue;
        // a garden behind the house
        g.fillStyle = "#4f7f34";
        g.fillRect(x - 4, y + art.img.height / 2 + 1, 8, 4);
        addTarget(w, "house", x, y, art);
        placed++;
      }
    });
    // Lone farmhouses out in the fields
    for (let placed = 0, tries = 0; placed < 5 && tries < 200; tries++) {
      const art = pick(S.houses);
      const x = Math.round(rr(20, W - 20));
      const y = Math.round(STRIP_H - rr(150, FARM_END - 120));
      if (!isFree(w, x, y, art.img.width / 2 + 2, art.img.height / 2 + 2, 10)) continue;
      addTarget(w, "house", x, y, art);
      placed++;
    }
  }

  function paintCamps(w) {
    const g = w.g;
    for (const dc of [ri(2020, 2080), ri(2300, 2370), ri(2580, 2640)]) {
      const cw = ri(104, 128);
      const ch = ri(76, 92);
      const rx = w.roadX(dc);
      const x0 = clamp(rx < W / 2 ? rx + 10 : rx - 10 - cw, 4, W - 4 - cw);
      const y0 = Math.round(STRIP_H - dc - ch / 2);
      g.fillStyle = "#a8956a";
      g.fillRect(x0, y0, cw, ch);
      g.fillStyle = "#958259";
      for (let i = 0; i < (cw * ch) / 10; i++) g.fillRect(x0 + ri(0, cw - 1), y0 + ri(0, ch - 1), 1, 1);
      g.fillStyle = "#5a3a22";
      for (let x = x0; x < x0 + cw; x += 3) {
        g.fillRect(x, y0, 1, 1);
        g.fillRect(x, y0 + ch - 1, 1, 1);
      }
      for (let y = y0; y < y0 + ch; y += 3) {
        g.fillRect(x0, y, 1, 1);
        g.fillRect(x0 + cw - 1, y, 1, 1);
      }
      w.camps.push({ top: y0, bottom: y0 + ch, alarmed: false });
      const fx = Math.round(x0 + cw / 2);
      const fy = Math.round(y0 + ch / 2);
      w.flags.push({ x: fx, y: fy });
      w.blocked.push({ x: fx, y: fy, hw: 4, hh: 4 });

      const cells = [];
      for (let gy = y0 + 10; gy < y0 + ch - 8; gy += 18) for (let gx = x0 + 12; gx < x0 + cw - 10; gx += 22) cells.push([gx, gy]);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      let dumps = 0;
      for (const [gx, gy] of cells) {
        const r = rnd();
        let kind;
        let art;
        if (dumps < 2 && r < 0.2) {
          kind = "ammo";
          art = S.ammo;
        } else if (r < 0.55) {
          kind = "tent";
          art = rnd() < 0.5 ? S.tent : S.bell;
        } else if (r < 0.72) {
          kind = "truck";
          art = S.truck;
        } else if (r < 0.86) {
          kind = "gun";
          art = S.gun;
        } else continue;
        if (!isFree(w, gx, gy, art.img.width / 2, art.img.height / 2, 4)) continue;
        if (kind === "ammo") dumps++;
        addTarget(w, kind, gx, gy, art, kind === "truck" ? { dir: rnd() < 0.5 ? 1 : -1 } : {});
      }
    }
  }

  function paintRoad(w) {
    const g = w.g;
    for (let d = 0; d < STRIP_H; d++) {
      // No road through no man's land, and a broken one either side of it
      if (d > LINE1_D - 40 && d < LINE2_D + 40) continue;
      if (d > LINE1_D - 90 && d < LINE2_D + 90 && d % 20 < 9) continue;
      const y = STRIP_H - d;
      const x = w.roadX(d);
      const muddy = d > FARM_END + 40 && d < FRONT_END;
      g.fillStyle = muddy ? "#7d6744" : "#8f7a52";
      g.fillRect(x - 5, y, 10, 1);
      g.fillStyle = muddy ? "#94805a" : "#b09a6c";
      g.fillRect(x - 4, y, 8, 1);
      if (d % 3 !== 0) {
        g.fillStyle = muddy ? "#6b5434" : "#9c8760";
        g.fillRect(x - 2, y, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
      }
    }
  }

  function paintRiver(w) {
    const g = w.g;
    for (let x = 0; x < W; x++) {
      const cy = w.riverY(x);
      const top = Math.round(cy - RIVER_HALF);
      const bot = Math.round(cy + RIVER_HALF);
      g.fillStyle = "#8a7a4e";
      g.fillRect(x, top - 1, 1, 1);
      g.fillRect(x, bot, 1, 1);
      g.fillStyle = "#3d6c9e";
      g.fillRect(x, top, 1, bot - top);
      if ((x * 7) % 11 < 3) {
        g.fillStyle = "#6c9ccc";
        g.fillRect(x, Math.round(cy - 1 + Math.sin(x / 5) * 3), 1, 1);
      }
    }
  }

  function placeFarmTargets(w) {
    const g = w.g;
    const bx = w.roadX(RIVER_D);
    addTarget(w, "bridge", bx, Math.round(w.riverY(bx)), S.bridge);
    // Two supply depots in the fields: tents and a field gun
    for (let i = 0; i < 2; i++) {
      for (let tries = 0; tries < 120; tries++) {
        const x = Math.round(rr(30, W - 30));
        const y = Math.round(STRIP_H - rr(330 + i * 300, 560 + i * 300));
        if (!isFree(w, x, y, 22, 16, 10)) continue;
        pixCircle(g, x, y, 17, "#9c8a62");
        addTarget(w, "tent", x - 9, y - 4, S.tent);
        addTarget(w, "gun", x + 11, y, S.gun);
        if (rnd() < 0.7) addTarget(w, "tent", x - 8, y + 9, S.bell);
        break;
      }
    }
  }

  function positionTruck(t) {
    t.y = STRIP_H - t.d;
    t.x = world.roadX(t.d) + (t.speed > 0 ? 2 : -2);
  }

  function placeTrucks(w) {
    const groups = [
      { d: rr(320, 420), n: 3, lo: 100, hi: FARM_END - 40 },
      { d: rr(640, 780), n: 2, lo: 100, hi: FARM_END - 40 },
      { d: rr(1700, 1790), n: 2, lo: LINE2_D + 100, hi: FRONT_END + 80 },
      { d: rr(2150, 2240), n: 2, lo: FRONT_END + 60, hi: 2780 },
      { d: rr(2440, 2540), n: 3, lo: FRONT_END + 60, hi: 2780 },
    ];
    for (const gr of groups) {
      const speed = rr(7, 12) * (rnd() < 0.5 ? -1 : 1);
      for (let i = 0; i < gr.n; i++) {
        const d = gr.d - i * 16 * Math.sign(speed);
        const t = addTarget(w, "truck", 0, 0, S.truck, { moving: true, d, speed, lo: gr.lo, hi: gr.hi });
        t.y = STRIP_H - d;
        t.x = w.roadX(d) + (speed > 0 ? 2 : -2);
      }
    }
  }

  function placeBlimps(w) {
    const ds = [rr(520, 600), rr(840, 900), rr(1180, 1260), rr(1420, 1500), rr(1700, 1780), rr(2080, 2160), rr(2280, 2360), rr(2470, 2550), rr(2660, 2740)];
    for (const d of ds) {
      for (let tries = 0; tries < 60; tries++) {
        const x = Math.round(rr(26, W - 26));
        const y = Math.round(STRIP_H - d);
        if (!isFree(w, x, y, 5, 5, 8)) continue;
        const b = {
          wx: x,
          wy: y,
          x: x - CABLE_X,
          y: y - CABLE_Y,
          drift: 0,
          fallDx: 0,
          k: 1,
          phase: rr(0, 6.3),
          falling: 0,
          gone: false,
          flash: 0,
          cd: rr(0.8, 2),
          band: d < FARM_END ? 0 : d < FRONT_END ? 1 : 2,
        };
        b.winch = addTarget(w, "winch", x, y, S.winch, { blimp: b });
        w.blimps.push(b);
        break;
      }
    }
  }

  // Anti-aircraft guns: a couple in the farmland, more at the front and in the camps
  function placeAAGuns(w) {
    const ds = [rr(380, 520), rr(700, 880), rr(1060, 1180), rr(1600, 1700), rr(1780, 1880), rr(2100, 2400), rr(2450, 2750)];
    for (const d of ds) {
      for (let tries = 0; tries < 60; tries++) {
        const x = Math.round(rr(20, W - 20));
        const y = Math.round(STRIP_H - d + rr(-20, 20));
        if (!isFree(w, x, y, 8, 8, 6)) continue;
        pixCircle(w.g, x + 1, y + 1, 8, "rgba(52,38,24,0.5)");
        addTarget(w, "aa", x, y, S.aa, { cd: rr(1, 2.5), aim: -Math.PI / 2, flash: 0 });
        break;
      }
    }
  }

  function drawTreeOn(g, img, x, y) {
    pixCircle(g, x + 2, y + 2, img.width / 2 - 1, "rgba(20,40,16,0.35)");
    g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }

  function paintTrees(w) {
    const g = w.g;
    const scatter = (n, dLo, dHi) => {
      for (let placed = 0, tries = 0; placed < n && tries < n * 8; tries++) {
        const img = pick(S.trees);
        const x = rr(4, W - 4);
        const y = STRIP_H - rr(dLo, dHi);
        if (!isFree(w, x, y, img.width / 2 - 1, img.height / 2 - 1, 3)) continue;
        drawTreeOn(g, img, x, y);
        placed++;
      }
    };
    scatter(110, 20, FARM_END - 30);
    // A couple of woods
    for (let k = 0; k < 2; k++) {
      const cx = rr(30, W - 30);
      const cd = rr(150, FARM_END - 150);
      for (let i = 0; i < 26; i++) {
        const img = pick(S.trees);
        const x = cx + rr(-30, 30);
        const y = STRIP_H - cd + rr(-24, 24);
        if (isFree(w, x, y, img.width / 2 - 1, img.height / 2 - 1, 3)) drawTreeOn(g, img, x, y);
      }
    }
    scatter(45, FRONT_END + 20, STRIP_H - 10);
  }

  // Fine grain over the whole map, for a hand-pixelled look
  function speckle(w) {
    const img = w.g.getImageData(0, 0, W, STRIP_H);
    const a = img.data;
    for (let i = 0; i < a.length; i += 4) {
      const r = rnd();
      if (r < 0.06) {
        a[i] *= 0.88;
        a[i + 1] *= 0.88;
        a[i + 2] *= 0.88;
      } else if (r < 0.1) {
        a[i] *= 1.08;
        a[i + 1] *= 1.08;
        a[i + 2] *= 1.08;
      }
    }
    w.g.putImageData(img, 0, 0);
  }

  // ============================================================
  // Runs
  // ============================================================
  function newPlane(first) {
    return {
      x: W / 2,
      y: first ? PLANE_Y : H + 24,
      vx: 0,
      vy: 0,
      alt: ALT,
      bank: 0,
      pitch: 0,
      prop: 0,
      alive: true,
      entering: !first,
      invuln: first ? 1.5 : 2.5,
      dying: 0,
      spin: 0,
      crashed: false,
      smokeT: 0,
      hp: clamp(START_HP, 1, PLANE_HITS),
    };
  }

  function startRun() {
    Sfx.musicOff();
    world =buildWorld(SEED !== null ? SEED : (Math.random() * 1e9) | 0);
    time = 0;
    scroll = 0;
    score = 0;
    planesLeft = PLANES_PER_RUN;
    bombs = [];
    flak = [];
    particles = [];
    fires = [];
    popups = [];
    baseAlertT = 0;
    chains = [];
    bombsLeft = BOMB_LOAD;
    reload = 0;
    dropRequested = false;
    wind = (8 + Math.random() * (WIND_MAX - 8)) * (Math.random() < 0.5 ? -1 : 1);
    windTarget = wind;
    windTimer = 4 + Math.random() * 4;
    stats = { hits: 0, houses: 0, blimps: 0, bombs: 0, bombHits: 0 };
    plane = newPlane(true);
    state = "playing";
    if (JUMP_T && !jumpUsed) {
      jumpUsed = true;
      time = JUMP_T;
      scroll = time * SCROLL;
    }
    Sfx.start();
    Sfx.engineOn();
  }

  function endRun(isTimeUp) {
    if (state === "over") return;
    state = "over";
    overT = 0;
    Sfx.sirenOff();
    timeUp = isTimeUp;
    planeBonus = planesLeft * PLANE_BONUS;
    score += planeBonus;
    newBest = score > best;
    if (newBest) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (e) {
        // not saved
      }
    }
    Sfx.engineOff();
    Sfx.end();
  }

  function pause() {
    state = "paused";
    Sfx.engineOff();
    Sfx.sirenOff();
  }

  function resume() {
    state = "playing";
    if (plane.alive) Sfx.engineOn();
  }

  // ============================================================
  // Input
  // ============================================================
  const held = (...codes) => codes.some((c) => keys[c]);

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    Sfx.init();
    if (e.repeat) return;
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      if (state === "title" && !showOrders) {
        // The key press lets the browser start the music
        showOrders = true;
        Sfx.musicOn();
      } else if (state === "title") startRun(); // mission accepted
      else if (state === "over" && overT > 1.6) startRun();
    } else if (e.code === "KeyM") {
      Sfx.toggleMute();
      soundMsgT = 1.2;
    } else if (e.code === "KeyP") {
      if (state === "playing") pause();
      else if (state === "paused") resume();
    } else if (e.code === "Space") {
      if (state === "over" && overT > 1.6) startRun();
      else if (state === "playing") dropRequested = true;
      else if (state === "paused") resume();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  window.addEventListener("blur", () => {
    if (state === "playing") pause();
    for (const k in keys) keys[k] = false;
  });

  // ============================================================
  // Plane
  // ============================================================
  function updatePlane(dt) {
    const p = plane;
    p.prop += dt * 30;
    if (p.invuln > 0) p.invuln -= dt;
    if (reload > 0) {
      reload -= dt;
      if (reload <= 0) bombsLeft = BOMB_LOAD;
    }

    if (!p.alive) {
      updateDying(p, dt);
      return;
    }
    damageSmoke(p, dt);
    if (p.entering) {
      p.y += (PLANE_Y - p.y) * Math.min(1, dt * 3);
      if (Math.abs(p.y - PLANE_Y) < 0.5) {
        p.y = PLANE_Y;
        p.entering = false;
      }
    }
    if (state === "over") {
      // Fly off the top of the screen
      p.y -= 70 * dt;
      p.alt = Math.min(1, p.alt + dt * 0.3);
      p.bank = 0;
      p.pitch = 1;
      return;
    }

    let dir = (held("ArrowRight", "KeyD") ? 1 : 0) - (held("ArrowLeft", "KeyA") ? 1 : 0);
    // Up flies forward (up the screen), Down drops back
    let fwd = (held("ArrowUp", "KeyW") ? 1 : 0) - (held("ArrowDown", "KeyS") ? 1 : 0);
    if (DEMO) {
      dir = Math.sin(animT * 0.9) > 0 ? 1 : -1;
      fwd = Math.sin(animT * 0.4) > 0 ? 1 : -1;
      if (bombsLeft > 0 && Math.random() < dt * 2) dropRequested = true;
    }
    if (dir) p.vx += dir * STEER_ACCEL * dt;
    else p.vx -= p.vx * Math.min(1, STEER_DRAG * dt);
    p.vx = clamp(p.vx, -STEER_MAX, STEER_MAX);
    p.x += (p.vx + wind * WIND_PUSH) * dt;
    if (p.x < 14) {
      p.x = 14;
      p.vx = Math.max(0, p.vx);
    } else if (p.x > W - 14) {
      p.x = W - 14;
      p.vx = Math.min(0, p.vx);
    }
    if (!p.entering) {
      if (fwd) p.vy -= fwd * FLY_ACCEL * dt;
      else p.vy -= p.vy * Math.min(1, FLY_DRAG * dt);
      p.vy = clamp(p.vy, -FLY_MAX, FLY_MAX);
      p.y += p.vy * dt;
      if (p.y < PLANE_Y_MIN) {
        p.y = PLANE_Y_MIN;
        p.vy = Math.max(0, p.vy);
      } else if (p.y > PLANE_Y_MAX) {
        p.y = PLANE_Y_MAX;
        p.vy = Math.min(0, p.vy);
      }
    }
    // Pose: bank by sideways speed; nose down speeding forward, nose up dropping back
    const speed = Math.abs(p.vx);
    p.bank = Math.sign(p.vx) * (speed > 60 ? 2 : speed > 22 ? 1 : 0);
    p.pitch = p.vy < -25 ? -1 : p.vy > 25 ? 1 : 0;
    Sfx.setEngine(0.5 - (p.vy / FLY_MAX) * 0.4, fwd);

    if (dropRequested) {
      dropRequested = false;
      if (bombsLeft > 0) dropBomb();
    }
    checkPlaneCollisions();
  }

  function updateDying(p, dt) {
    p.dying += dt;
    if (!p.crashed) {
      p.spin += dt * 8;
      p.alt = Math.max(0, p.alt - dt * 0.8);
      p.x += (wind * 0.4 + p.vx * 0.3) * dt;
      p.y += 16 * dt;
      p.smokeT -= dt;
      if (p.smokeT <= 0) {
        p.smokeT = 0.05;
        smoke(p.x, toStrip(p.y), 2, 0.9, 1, "#4a4842");
        fire(p.x, toStrip(p.y), 1);
      }
      if (p.dying >= CRASH_T) {
        p.crashed = true;
        const sy = toStrip(p.y);
        boom(p.x, sy, 12, 0);
        bakeCrater(p.x, sy, 6);
        Sfx.boom(true);
        for (const t of world.targets) if (t.alive && hits(t, p.x, sy, 10)) destroyTarget(t, 1, false);
      }
    } else if (p.dying >= CRASH_T + 1.2 && state === "playing") {
      if (planesLeft > 0) {
        plane = newPlane(false);
        Sfx.engineOn();
      } else endRun(false);
    }
  }

  // A damaged plane trails grey smoke, and black smoke with sparks of fire on its last hit
  function damageSmoke(p, dt) {
    if (p.hp >= PLANE_HITS) return;
    p.smokeT -= dt;
    if (p.smokeT > 0) return;
    const bad = p.hp <= 1;
    p.smokeT = bad ? 0.05 : 0.11;
    const side = Math.random() < 0.5 ? -4 : 4;
    smoke(p.x + side + rr(-1, 1), toStrip(p.y) + 2, bad ? 2 : 1.5, bad ? 1.4 : 1, 1, bad ? "#2e2c2a" : "#a8a8a0");
    if (bad && Math.random() < 0.5) fire(p.x + side, toStrip(p.y) + 1, 1);
  }

  // A flak hit: costs one of the plane's hits, and the plane once they're all gone
  function flakHit() {
    if (DEMO) return;
    plane.hp -= 1;
    if (plane.hp <= 0) {
      planeHit();
      return;
    }
    plane.invuln = HIT_IMMUNE;
    plane.smokeT = 0;
    for (let i = 0; i < 4; i++) particles.push({ kind: "debris", x: plane.x, y: toStrip(plane.y), vx: rr(-40, 40), vy: rr(-40, 40), life: rr(0.3, 0.5), max: 0.5, layer: 1 });
    Sfx.damage();
  }

  // The plane is destroyed
  function planeHit() {
    if (DEMO) return;
    plane.alive = false;
    plane.dying = 0;
    planesLeft -= 1;
    boom(plane.x, toStrip(plane.y), 7, 1);
    Sfx.planeHit();
    Sfx.engineOff();
  }

  function checkPlaneCollisions() {
    const p = plane;
    if (state !== "playing" || !p.alive || p.invuln > 0 || p.entering) return;
    const vt = viewTop();
    for (const b of world.blimps) {
      if (b.gone) continue;
      const dx = p.x - b.x;
      const dy = p.y - (b.y - vt);
      if ((dx / 13.5) ** 2 + (dy / 18) ** 2 < 1) {
        planeHit();
        return;
      }
    }
  }

  // ============================================================
  // Bombs
  // ============================================================
  function dropBomb() {
    const T = FALL_T;
    bombs.push({
      x: plane.x,
      y: toStrip(plane.y) - 4,
      vx: plane.vx * BOMB_INHERIT + wind * WIND_PUSH,
      fwd: bombFwd(plane),
      t: 0,
      T,
      h0: heightOf(plane.alt),
    });
    bombsLeft -= 1;
    reload = BOMB_RELOAD; // every drop restarts the reload
    stats.bombs++;
    Sfx.drop(T);
  }

  function updateBombs(dt) {
    for (const b of bombs) {
      b.t += dt;
      // Forward speed fades from the plane's speed, so the bomb falls back a little
      b.y -= b.fwd * Math.exp(-BOMB_DRAG * b.t) * dt;
      b.vx += (wind - b.vx) * BOMB_SIDE_K * dt;
      b.x += b.vx * dt;
      if (b.t >= b.T) {
        b.done = true;
        if (impact(b.x, b.y, 1, BLAST_R, false)) stats.bombHits++;
      }
    }
    bombs = bombs.filter((b) => !b.done);
  }

  function hits(t, x, y, r) {
    const cx = clamp(x, t.x - t.hw, t.x + t.hw);
    const cy = clamp(y, t.y - t.hh, t.y + t.hh);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }

  // Returns true if a military target was hit
  function impact(x, y, mult, r, isChain) {
    let gained = 0;
    let penalty = false;
    let big = isChain;
    for (const t of world.targets) {
      if (!t.alive || !hits(t, x, y, r)) continue;
      const pts = destroyTarget(t, mult, true);
      if (pts > 0) gained += pts;
      else if (pts < 0) penalty = true;
      if (t.kind === "ammo") big = true;
    }
    if (!gained && !penalty && world.inRiver(x, y)) {
      splash(x, y);
      Sfx.splash();
    } else {
      boom(x, y, isChain ? 22 : 14, 0);
      bakeCrater(x, y, isChain ? 9 : 5 + Math.floor(Math.random() * 3));
      addFire(x, y, isChain ? 12 : rr(7, 10), isChain ? 6 : 4);
      Sfx.boom(big);
    }
    if (gained > 0) Sfx.hit(gained);
    if (penalty) Sfx.penalty();
    return gained > 0;
  }

  function destroyTarget(t, mult, scored) {
    t.alive = false;
    t.burn = t.kind === "trench" ? 2 : 7;
    if (t.kind === "trench") {
      world.g.fillStyle = "#4b3a26";
      world.g.fillRect(t.x - 8, t.y - 3, 16, 6);
      bakeCrater(t.x, t.y, 4);
    }
    if (t.kind === "winch" && t.blimp.falling === 0) {
      t.blimp.falling = 0.001;
      Sfx.blimpDown();
    }
    if (!scored) return 0;
    let pts;
    if (t.pts < 0) {
      pts = t.pts;
      stats.houses++;
      addPopup(t.x, t.y - t.hh - 4, String(pts), "#ff6a5a");
    } else {
      pts = Math.round((t.pts * mult) / 5) * 5;
      if (t.kind === "winch") stats.blimps++;
      else stats.hits++;
      addPopup(t.x, t.y - t.hh - 4, "+" + pts, "#f2d16b");
    }
    score += pts;
    if (t.kind === "ammo") chains.push({ x: t.x, y: t.y, mult, t: 0.25 });
    return pts;
  }

  // ============================================================
  // Blimps and flak
  // ============================================================
  function updateBlimps(dt) {
    const vt = viewTop();
    for (const b of world.blimps) {
      if (b.gone) continue;
      b.drift += (wind * 0.5 - b.drift) * Math.min(1, dt * 0.6);
      if (b.flash > 0) b.flash -= dt;
      if (b.falling > 0) {
        b.falling += dt;
        b.fallDx += (wind * 0.6 + 6) * dt;
        b.k = Math.max(0, 1 - b.falling / BLIMP_FALL_T);
        if (Math.random() < 0.6) fire(b.x + (Math.random() * 10 - 5), b.y + (Math.random() * 16 - 8), 1);
        if (Math.random() < 0.2) smoke(b.x, b.y, 3, 1.2, 1, "#4a4842");
        if (b.falling > BLIMP_FALL_T) {
          b.gone = true;
          boom(b.x, b.y, 14, 0);
          bakeCrater(b.x, b.y, 7);
          Sfx.boom(true);
        }
      }
      b.x = b.wx - CABLE_X * b.k + b.drift + b.fallDx;
      b.y = b.wy - CABLE_Y * b.k + Math.sin(animT * 1.3 + b.phase) * 1.5 * b.k;

      // Gunners fire at the plane while it is in range
      const sy = b.y - vt;
      if (state === "playing" && b.falling === 0 && plane.alive && !plane.entering && sy > 4 && sy < plane.y + 20) {
        b.cd -= dt;
        if (b.cd <= 0) {
          b.cd = b.band === 0 ? rr(2.4, 3.6) : b.band === 1 ? rr(2.0, 3.2) : rr(1.7, 2.8);
          b.flash = 0.12;
          fireShell(b.x, b.y + 4, BLIMP_SHELL_T, false);
        }
      }
    }
  }

  // An alarm sounds once as each army camp's fence comes onto the top of the screen
  function updateCampAlarms() {
    const vt = viewTop();
    for (const c of world.camps) {
      if (c.alarmed || c.bottom < vt || c.top > vt + H) continue;
      c.alarmed = true;
      Sfx.alarm();
      baseAlertT = 3;
    }
  }

  // The air-raid siren wails while the plane flies over a village, and fades once it's behind
  function updateSiren() {
    const vt = viewTop();
    const near = world.villages.some((v) => v.y + VILLAGE_HALF - vt > plane.y - SIREN_AHEAD && v.y - VILLAGE_HALF - vt < plane.y);
    if (near) Sfx.sirenOn();
    else Sfx.sirenOff();
  }

  // AA guns swing toward the plane and fire while it is ahead of them and in range
  function updateAAGuns(dt) {
    const vt = viewTop();
    for (const t of world.targets) {
      if (t.kind !== "aa" || !t.alive) continue;
      const sy = t.y - vt;
      if (sy < -20 || sy > H + 20) continue;
      if (t.flash > 0) t.flash -= dt;
      const want = Math.atan2(plane.y - sy, plane.x - t.x);
      let turn = want - t.aim;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      t.aim += clamp(turn, -3 * dt, 3 * dt);
      if (state !== "playing" || !plane.alive || plane.entering) continue;
      if (sy < 10 || sy > plane.y - 40 || Math.abs(plane.x - t.x) > 110) continue;
      t.cd -= dt;
      if (t.cd <= 0 && Math.abs(turn) < 0.3) {
        t.cd = rr(2.8, 4.2);
        t.flash = 0.12;
        const mx = t.x + Math.cos(t.aim) * 7;
        const my = t.y + Math.sin(t.aim) * 7;
        smoke(mx, my, 2, 0.8, 0, "#c9c6b8");
        fireShell(mx, my, GROUND_SHELL_T, true);
      }
    }
  }

  // A shell flies from (sx, sy) to a point near the plane and bursts when it gets there
  function fireShell(sx, sy, T, ground) {
    flak.push({
      sx,
      sy,
      x: plane.x + plane.vx * T + rr(-26, 26),
      // the same spread as an instant burst 0.6 s after firing, for any flight time
      y: toStrip(plane.y + rr(-28, 16)) - SCROLL * (T - 0.6),
      t: 0,
      T,
      ground,
      popped: false,
    });
    Sfx.flakFire();
  }

  // Where a shell is u of the way through its flight. Ground shells slow as they climb
  function shellPos(f, u) {
    const k = f.ground ? 1 - (1 - u) ** 1.6 : u;
    return [f.sx + (f.x - f.sx) * k, f.sy + (f.y - f.sy) * k];
  }

  function updateFlak(dt) {
    const vt = viewTop();
    for (const f of flak) {
      f.t += dt;
      f.x += wind * 0.3 * dt;
      const a = f.t - f.T;
      if (a >= 0 && !f.popped) {
        f.popped = true;
        Sfx.flak();
        for (let i = 0; i < 3; i++) smoke(f.x + rr(-3, 3), f.y + rr(-3, 3), 3, 1.4, 1, "#3e3a3a");
      }
      // Only the core of the burst is deadly; the drawn cloud is bigger
      if (a >= 0 && a < 0.3 && state === "playing" && plane.alive && plane.invuln <= 0 && !plane.entering) {
        const r = 3 + 5 * Math.min(1, a / 0.15);
        const dx = plane.x - f.x;
        const dy = plane.y - (f.y - vt);
        if (dx * dx + dy * dy < (r + 3) ** 2) flakHit();
      }
    }
    flak = flak.filter((f) => f.t < f.T + 0.6);
  }

  // ============================================================
  // World effects: trucks, wind, smoke, fire, popups, clouds
  // ============================================================
  function updateWind(dt) {
    windTimer -= dt;
    if (windTimer <= 0) {
      windTimer = 4 + Math.random() * 4;
      windTarget = clamp(windTarget + (Math.random() * 28 - 14), -WIND_MAX, WIND_MAX);
    }
    wind += (windTarget - wind) * Math.min(1, dt * 0.5);
  }

  function updateTrucks(dt) {
    for (const t of world.targets) {
      if (!t.moving || !t.alive) continue;
      t.d += t.speed * dt;
      if ((t.d > t.hi && t.speed > 0) || (t.d < t.lo && t.speed < 0)) t.speed = -t.speed;
      positionTruck(t);
    }
  }

  function smoke(x, y, r, life, layer = 0, color = "#8a8a84") {
    particles.push({ kind: "smoke", x, y, vx: wind * 0.5 + rr(-3, 3), vy: rr(-5, -1), r, life, max: life, layer, color });
  }

  function fire(x, y, layer = 0) {
    particles.push({ kind: "fire", x: x + rr(-2, 2), y: y + rr(-2, 2), vx: wind * 0.3, vy: rr(-12, -4), life: rr(0.25, 0.5), max: 0.5, layer });
  }

  function boom(x, y, r, layer) {
    // Smoke first, so the fireball draws on top of it
    for (let i = 0; i < 5; i++) smoke(x + rr(-r / 3, r / 3), y + rr(-r / 3, r / 3), r * 0.45, 2.2, layer, "#4a4642");
    particles.push({ kind: "boom", x, y, vx: 0, vy: 0, r, life: 0.6, max: 0.6, layer });
    particles.push({ kind: "ring", x, y, vx: 0, vy: 0, r, life: 0.3, max: 0.3, layer });
    for (let i = 0; i < Math.round(r * 1.2); i++) {
      const a = rr(0, Math.PI * 2);
      const v = rr(20, r * 6);
      particles.push({ kind: "debris", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(0.3, 0.8), max: 0.8, layer });
    }
  }

  // A bomb crater keeps burning and smoking for a while after the blast
  function addFire(x, y, life, size) {
    fires.push({ x, y, life, max: life, size, emit: 0 });
    if (fires.length > 40) fires.shift();
  }

  function updateFires(dt) {
    const vt = viewTop();
    for (const f of fires) {
      f.life -= dt;
      f.emit -= dt;
      if (f.emit > 0 || f.y < vt - 40 || f.y > vt + H + 40) continue;
      const k = f.life / f.max;
      f.emit = 0.08 + (1 - k) * 0.15; // dies down as it burns out
      fire(f.x + rr(-f.size, f.size), f.y + rr(-f.size / 2, f.size / 2), 0);
      if (Math.random() < 0.5) smoke(f.x + rr(-2, 2), f.y - 2, 2 + f.size * 0.5 * k, 2.6, 0, k > 0.4 ? "#2e2c2a" : "#5a5650");
    }
    fires = fires.filter((f) => f.life > 0);
  }

  function splash(x, y) {
    for (let i = 0; i < 14; i++) {
      particles.push({ kind: "splash", x, y, vx: rr(-30, 30), vy: rr(-30, 30), life: rr(0.3, 0.6), max: 0.6, layer: 0 });
    }
  }

  function addPopup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 1.1 });
  }

  function updateFx(dt) {
    const vt = viewTop();
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "smoke") p.r += dt * 2;
      if (p.kind === "debris" || p.kind === "splash") {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
    particles = particles.filter((p) => p.life > 0);
    updateFires(dt);

    for (const t of world.targets) {
      if (t.y < vt - 30 || t.y > vt + H + 30) continue;
      t.emit -= dt;
      if (t.alive && t.art && t.art.chimney) {
        if (t.emit <= 0) {
          t.emit = rr(0.45, 0.8);
          smoke(t.x + t.art.chimney.x, t.y + t.art.chimney.y, 1, 2.4, 0, "#b8b8b0");
        }
      } else if (!t.alive && t.burn > 0) {
        t.burn -= dt;
        if (t.emit <= 0) {
          t.emit = 0.12;
          fire(t.x, t.y, 0);
          if (Math.random() < 0.4) smoke(t.x, t.y, 2, 1.8, 0, "#4a4842");
        }
      }
    }

    for (const c of chains) {
      c.t -= dt;
      if (c.t <= 0) {
        c.done = true;
        impact(c.x, c.y, c.mult, CHAIN_R, true);
      }
    }
    chains = chains.filter((c) => !c.done);

    for (const p of popups) {
      p.life -= dt;
      p.y -= 14 * dt;
    }
    popups = popups.filter((p) => p.life > 0);
  }

  function updateClouds(dt) {
    while (clouds.length < 2) {
      const i = Math.floor(Math.random() * S.clouds.length);
      clouds.push({ i, x: Math.random() * W - 30, y: -40 - Math.random() * 300 - (clouds.length ? 200 : 0) });
    }
    for (const c of clouds) {
      c.y += SCROLL * 1.3 * dt;
      c.x += wind * 0.5 * dt;
      if (c.y > H + 40 || c.x < -90 || c.x > W + 40) {
        c.i = Math.floor(Math.random() * S.clouds.length);
        c.y = -40 - Math.random() * 160;
        c.x = Math.random() * W - 30;
      }
    }
  }

  // ============================================================
  // Main update
  // ============================================================
  function update(dt) {
    animT += dt;
    if (soundMsgT > 0) soundMsgT -= dt;
    if (state === "paused") return;
    if (baseAlertT > 0) baseAlertT -= dt;
    updateClouds(dt);
    updateWind(dt);
    if (state === "title") {
      scroll += SCROLL * 0.5 * dt;
      if (scroll > TRAVEL) scroll = 0;
      updateTrucks(dt);
      updateBlimps(dt);
      updateFx(dt);
      return;
    }
    if (state === "playing") {
      time += dt;
      if (time >= RUN_TIME) {
        time = RUN_TIME;
        endRun(true);
      }
    }
    if (state === "over") overT += dt;
    scroll = Math.min(scroll + SCROLL * dt, TRAVEL + TAIL - 4);
    updatePlane(dt);
    if (state === "playing") {
      updateCampAlarms();
      updateSiren();
    }
    updateBombs(dt);
    updateTrucks(dt);
    updateBlimps(dt);
    updateAAGuns(dt);
    updateFlak(dt);
    updateFx(dt);
  }

  // ============================================================
  // Drawing
  // ============================================================
  function drawTargets(vt) {
    for (const t of world.targets) {
      if (!t.art || t.y < vt - 30 || t.y > vt + H + 30) continue;
      let img;
      if (t.kind === "truck") {
        const down = t.moving ? t.speed < 0 : t.dir < 0;
        img = t.alive ? (down ? t.art.imgDown : t.art.img) : down ? t.art.burntDown : t.art.burnt;
      } else img = t.alive ? t.art.img : t.art.burnt;
      ctx.drawImage(img, Math.round(t.x - img.width / 2), Math.round(t.y - vt - img.height / 2));
    }
  }

  function drawAAGuns(vt) {
    for (const t of world.targets) {
      if (t.kind !== "aa" || !t.alive) continue;
      const y = t.y - vt;
      if (y < -20 || y > H + 20) continue;
      const c = Math.cos(t.aim);
      const s = Math.sin(t.aim);
      // Twin barrels, side by side
      for (const off of [-1, 1]) {
        const ox = -s * off;
        const oy = c * off;
        pixLine(t.x + ox, y + oy, t.x + ox + c * 10, y + oy + s * 10, "#1b1b26");
        pixLine(t.x + ox, y + oy, t.x + ox + c * 8, y + oy + s * 8, "#a9b3b8");
      }
      if (t.flash > 0) pixCircle(ctx, t.x + c * 12, y + s * 12, 3, "#f2d16b");
    }
  }

  // Where a bomb dropped now would land in still air
  function drawBombSight() {
    const p = plane;
    if (state !== "playing" || !p.alive || p.entering) return;
    const T = FALL_T;
    const ahead = (bombFwd(p) * (1 - Math.exp(-BOMB_DRAG * T))) / BOMB_DRAG;
    const side = (p.vx * BOMB_INHERIT * (1 - Math.exp(-BOMB_SIDE_K * T))) / BOMB_SIDE_K;
    const x = Math.round(p.x + side);
    const y = Math.round(p.y - 4 - ahead);
    ctx.globalAlpha = bombsLeft === 0 ? 0.35 : 0.85;
    ctx.fillStyle = "#f2efe4";
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillRect(x + dx * 5 - (dx < 0 ? 0 : 2), y + dy * 5, 3, 1);
      ctx.fillRect(x + dx * 5, y + dy * 5 - (dy < 0 ? 0 : 2), 1, 3);
    }
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;
  }

  function drawFlags(vt) {
    const len = 3 + Math.round((Math.abs(wind) / WIND_MAX) * 5);
    const dir = wind >= 0 ? 1 : -1;
    const wave = Math.floor(animT * 6) % 2;
    for (const f of world.flags) {
      const x = f.x;
      const y = Math.round(f.y - vt);
      if (y < -10 || y > H + 10) continue;
      ctx.fillStyle = "rgba(16,24,12,0.4)";
      ctx.fillRect(x + 1, y + 1, 1, 4);
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x, y - 1, 1, 2);
      for (let i = 1; i <= len; i++) {
        const yy = y - 2 + ((i + wave) % 2 === 0 && i > 1 ? 1 : 0);
        ctx.fillStyle = "#c0443a";
        ctx.fillRect(x + dir * i, yy, 1, 1);
        ctx.fillStyle = "#f2efe4";
        ctx.fillRect(x + dir * i, yy + 1, 1, 1);
        ctx.fillStyle = "#1b1b26";
        ctx.fillRect(x + dir * i, yy + 2, 1, 1);
      }
    }
  }

  // Flickering flames in the burning craters
  function drawFires(vt) {
    for (const f of fires) {
      const y = Math.round(f.y - vt);
      if (y < -20 || y > H + 20) continue;
      const k = f.life / f.max;
      const n = Math.ceil(f.size * 4 * Math.min(1, k * 1.5));
      for (let i = 0; i < n; i++) {
        const big = Math.random() < k;
        ctx.fillStyle = pick(["#f2d16b", "#e08a3a", "#e08a3a", "#c0443a"]);
        ctx.fillRect(Math.round(f.x + rr(-f.size, f.size)), Math.round(y + rr(-f.size * 1.4, f.size * 0.4)), big ? 2 : 1, big ? 2 : 1);
      }
    }
  }

  function drawParticles(vt, layer) {
    for (const p of particles) {
      if (p.layer !== layer) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y - vt);
      if (y < -30 || y > H + 30) continue;
      const k = p.life / p.max;
      if (p.kind === "boom") {
        const prog = 1 - k;
        const r = p.r * (prog < 0.2 ? prog / 0.2 : 1 - (prog - 0.2) * 0.6);
        if (prog < 0.15) {
          pixCircle(ctx, x, y, r, "#f2d16b");
          pixCircle(ctx, x, y, r * 0.6, "#ffffff");
        } else if (prog < 0.6) {
          pixCircle(ctx, x, y, r, "#e08a3a");
          pixCircle(ctx, x, y, r * 0.6, "#f2d16b");
          if (prog < 0.4) pixCircle(ctx, x, y, r * 0.25, "#ffffff");
        } else {
          pixCircle(ctx, x, y, r, "#7c2a20");
          pixCircle(ctx, x, y, r * 0.5, "#e08a3a");
        }
      } else if (p.kind === "ring") {
        // The shock wave: a pale ring racing out from the blast
        const ringR = p.r * (1 + (1 - k) * 1.2);
        ctx.globalAlpha = k * 0.8;
        ctx.fillStyle = "#f2efe4";
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          ctx.fillRect(Math.round(x + Math.cos(a) * ringR), Math.round(y + Math.sin(a) * ringR), 1, 1);
        }
        ctx.globalAlpha = 1;
      } else if (p.kind === "smoke") {
        ctx.globalAlpha = Math.min(0.75, k * 0.9);
        pixCircle(ctx, x, y, p.r, p.color);
        ctx.globalAlpha = 1;
      } else if (p.kind === "fire") {
        ctx.fillStyle = k > 0.6 ? "#f2d16b" : k > 0.3 ? "#e08a3a" : "#c0443a";
        ctx.fillRect(x, y, k > 0.5 ? 2 : 1, k > 0.5 ? 2 : 1);
      } else if (p.kind === "debris") {
        ctx.fillStyle = "#2e2216";
        ctx.fillRect(x, y, 1, 1);
      } else if (p.kind === "splash") {
        ctx.fillStyle = k > 0.5 ? "#ffffff" : "#9cc4e8";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawShadows(vt) {
    for (const b of world.blimps) {
      if (b.gone) continue;
      const sx = b.x + CABLE_X * b.k;
      const sy = b.y + CABLE_Y * b.k - vt;
      if (sy < -40 || sy > H + 40) continue;
      ctx.drawImage(S.blimpShadow, Math.round(sx - S.blimpShadow.width / 2), Math.round(sy - S.blimpShadow.height / 2));
    }
    for (const b of bombs) {
      const h = b.h0 * (1 - (b.t / b.T) ** 2);
      ctx.fillStyle = "rgba(16,24,12,0.45)";
      ctx.fillRect(Math.round(b.x + SHADOW_X * h - 1), Math.round(b.y - vt + SHADOW_Y * h), 2, 2);
    }
    if (plane && !plane.crashed && plane.y < H + 30) drawPlaneShadow(plane);
  }

  function planeFrame(p) {
    return S.planeFrame(p.bank, p.pitch || 0);
  }

  function drawPlaneShadow(p) {
    const h = heightOf(p.alt);
    const fr = planeFrame(p);
    const img = fr.shadow;
    const x = p.x + SHADOW_X * h;
    const y = p.y + SHADOW_Y * h;
    if (!p.alive) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(p.spin);
      ctx.drawImage(img, -fr.cx, -Math.round(img.height / 2));
      ctx.restore();
    } else ctx.drawImage(img, Math.round(x) - fr.cx, Math.round(y - img.height / 2));
  }

  function drawPlane(p) {
    if (p.crashed) return;
    const fr = planeFrame(p);
    const img = fr.img;
    if (!p.alive) {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.rotate(p.spin);
      ctx.drawImage(img, -fr.cx, -Math.round(img.height / 2));
      ctx.restore();
      return;
    }
    if (p.invuln > 0 && Math.floor(animT * 12) % 2 === 0) return;
    const cx = Math.round(p.x);
    const py = Math.round(p.y - img.height / 2);
    ctx.drawImage(img, cx - fr.cx, py);
    // Spinning propeller, centered on the nose
    ctx.fillStyle = "rgba(210,210,200,0.8)";
    if (Math.floor(p.prop) % 2 === 0) ctx.fillRect(cx - 5, py - 1, 11, 1);
    else {
      ctx.fillRect(cx - 2, py - 1, 5, 1);
      ctx.fillRect(cx - 4, py, 1, 1);
      ctx.fillRect(cx + 4, py, 1, 1);
    }
  }

  function drawBombs(vt) {
    for (const b of bombs) {
      const f = b.t / b.T;
      const img = f < 0.35 ? S.bombL : f < 0.75 ? S.bombM : S.bombS;
      ctx.drawImage(img, Math.round(b.x - img.width / 2), Math.round(b.y - vt - img.height / 2));
    }
  }

  function drawBlimps(vt) {
    for (const b of world.blimps) {
      if (b.gone) continue;
      const y = b.y - vt;
      if (y < -50 || y > H + 50) continue;
      if (b.falling === 0) pixLine(b.x, y + 8, b.wx, b.wy - vt, "#2e2e2e");
      else pixLine(b.x, y + 8, b.x + 3, y + 18, "#2e2e2e");
      const img = S.blimp;
      if (b.falling > 0) {
        ctx.save();
        ctx.translate(Math.round(b.x), Math.round(y));
        ctx.rotate(b.falling * 0.5);
        ctx.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
        ctx.restore();
      } else ctx.drawImage(img, Math.round(b.x - img.width / 2), Math.round(y - img.height / 2));
      if (b.flash > 0) {
        ctx.fillStyle = "#f2d16b";
        ctx.fillRect(Math.round(b.x) - 1, Math.round(y) + 2, 3, 3);
      }
    }
  }

  function drawFlak(vt) {
    for (const f of flak) {
      const x = Math.round(f.x);
      const y = Math.round(f.y - vt);
      const a = f.t - f.T;
      if (a < 0) {
        // The shell in flight, with a smoke trail and a glowing fuse
        const u = f.t / f.T;
        for (let i = 8; i >= 1; i--) {
          const [tx, ty] = shellPos(f, Math.max(0, u - i * 0.04));
          ctx.globalAlpha = 0.75 - i * 0.07;
          ctx.fillStyle = "#e8e4d8";
          const sz = i <= 3 ? 2 : 1;
          ctx.fillRect(Math.round(tx), Math.round(ty - vt), sz, sz);
        }
        ctx.globalAlpha = 1;
        const [px, py] = shellPos(f, u);
        const sx = Math.round(px);
        const sy = Math.round(py - vt);
        // Ground shells grow as they climb toward the plane
        const r = !f.ground || u > 0.45 ? 2 : 1;
        ctx.fillStyle = "#1b1b26";
        ctx.fillRect(sx - r, sy - r, r * 2 + 1, r * 2 + 1);
        ctx.fillStyle = Math.floor(f.t * 16) % 2 === 0 ? "#fff6c0" : "#e08a3a";
        ctx.fillRect(sx - r + 1, sy - r + 1, r * 2 - 1, r * 2 - 1);
        continue;
      }
      const r = 4 + 7 * Math.min(1, a / 0.15);
      if (a < 0.1) {
        pixCircle(ctx, x, y, r, "#ffffff");
        pixCircle(ctx, x, y, r * 0.5, "#f2d16b");
      } else {
        ctx.globalAlpha = Math.max(0, 1 - (a - 0.1) / 0.5);
        pixCircle(ctx, x, y, r, "#2e2a2a");
        pixCircle(ctx, x - 1, y - 1, r * 0.6, "#4a4542");
        if (a < 0.25) pixCircle(ctx, x, y, r * 0.3, "#e08a3a");
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawClouds(shadow) {
    for (const c of clouds) {
      if (shadow) ctx.drawImage(S.cloudShadows[c.i], Math.round(c.x + 30), Math.round(c.y + 46));
      else {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(S.clouds[c.i], Math.round(c.x), Math.round(c.y));
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawPopups(vt) {
    for (const p of popups) {
      if (p.life < 0.3 && Math.floor(p.life * 20) % 2 === 0) continue;
      S.text(ctx, p.text, p.x, p.y - vt, p.color, { align: "center" });
    }
  }

  function drawWindArrow(cx, cy) {
    const mag = Math.abs(wind);
    if (mag < 1.5) {
      S.text(ctx, "CALM", cx, cy - 3, "#f2efe4", { align: "center" });
      return;
    }
    const dir = wind > 0 ? 1 : -1;
    const half = 1 + Math.round((mag / WIND_MAX) * 8);
    ctx.fillStyle = "#f2efe4";
    ctx.fillRect(cx - half, cy, half * 2 + 1, 1);
    const tip = cx + dir * half;
    ctx.fillRect(tip - dir, cy - 1, 1, 3);
    ctx.fillRect(tip - dir * 2, cy - 2, 1, 5);
  }

  function drawHud() {
    ctx.fillStyle = "rgba(16,18,26,0.78)";
    ctx.fillRect(0, 0, W, 13);
    S.text(ctx, "SCORE " + score, 4, 3, "#f2efe4");
    const left = Math.max(0, RUN_TIME - time);
    const secs = Math.ceil(left);
    const tStr = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
    const blink = left <= 5 && left > 0 && Math.floor(animT * 4) % 2 === 0;
    S.text(ctx, tStr, W / 2, 3, blink ? "#e0503c" : left <= 10 ? "#f2d16b" : "#f2efe4", { align: "center" });
    for (let i = 0; i < planesLeft; i++) ctx.drawImage(S.planeIcon, W - 13 - i * 12, 3);
    // Damage meter: a pip per hit the plane can still take, green at full strength, red on the last
    if (plane.alive && state !== "over") {
      const hpColor = plane.hp >= PLANE_HITS ? "#9fe07a" : plane.hp === 1 ? "#e0503c" : "#f2d16b";
      for (let i = 0; i < PLANE_HITS; i++) {
        ctx.fillStyle = i < plane.hp ? hpColor : "#3a3c46";
        ctx.fillRect(W - 46 + i * 6, 4, 4, 5);
      }
    }

    // Wind
    ctx.fillStyle = "rgba(16,18,26,0.6)";
    ctx.fillRect(W - 44, 16, 40, 22);
    S.text(ctx, "WIND", W - 24, 18, "#c9c6b8", { align: "center" });
    drawWindArrow(W - 24, 31);

    // Bomb load, in the bottom-right corner: one icon per bomb left, and a bar that fills while reloading
    const bw = BOMB_LOAD * 8 + 2;
    const bx = W - 4 - bw;
    const by = H - 38;
    ctx.fillStyle = "rgba(16,18,26,0.6)";
    ctx.fillRect(bx, by, bw, 34);
    S.text(ctx, "BOMBS", bx + bw / 2, by + 3, bombsLeft ? "#c9c6b8" : "#e0503c", { align: "center" });
    for (let i = 0; i < BOMB_LOAD; i++) {
      ctx.globalAlpha = i < bombsLeft ? 1 : 0.25;
      ctx.drawImage(S.bombL, bx + 2 + i * 8, by + 12, 6, 14);
    }
    ctx.globalAlpha = 1;
    if (bombsLeft < BOMB_LOAD) {
      const fill = Math.round((bw - 4) * (1 - reload / BOMB_RELOAD));
      ctx.fillStyle = "#2a2c36";
      ctx.fillRect(bx + 2, by + 29, bw - 4, 2);
      ctx.fillStyle = "#f2d16b";
      ctx.fillRect(bx + 2, by + 29, fill, 2);
    }
  }

  function drawVersion() {
    ctx.globalAlpha = 0.55;
    S.text(ctx, "SKYRAIDER V" + VERSION, 4, H - 10, "#f2efe4");
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = "rgba(16,18,26,0.82)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#a8975f";
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  // The title screen announces the game, then Enter brings up the mission orders
  function drawTitle() {
    if (showOrders) drawOrders();
    else drawSplash();
  }

  function drawSplash() {
    ctx.fillStyle = "rgba(16,18,26,0.6)";
    ctx.fillRect(0, 70, W, 150);
    ctx.fillStyle = "#a8975f";
    ctx.fillRect(0, 70, W, 1);
    ctx.fillRect(0, 219, W, 1);
    S.text(ctx, "THE WESTERN FRONT, 1917", W / 2, 84, "#c9c6b8", { align: "center" });
    S.text(ctx, "SKYRAIDER", W / 2, 102, "#f2d16b", { scale: 4, align: "center" });
    S.text(ctx, "WWI BOMBING RUN", W / 2, 140, "#f2efe4", { scale: 2, align: "center" });
    S.text(ctx, "V" + VERSION, W / 2, 160, "#c9c6b8", { align: "center" });
    if (Math.floor(animT * 2) % 2 === 0) S.text(ctx, "PRESS ENTER", W / 2, 180, "#ffffff", { scale: 2, align: "center" });
    S.text(ctx, "FOR YOUR MISSION", W / 2, 200, "#f2efe4", { align: "center" });
    if (best > 0) S.text(ctx, "BEST " + best, W - 4, H - 10, "#f2d16b", { align: "right" });
  }

  // The mission orders on a sheet of paper, under the logo
  function drawOrders() {
    S.text(ctx, "SKYRAIDER", W / 2, 18, "#f2d16b", { scale: 3, align: "center" });
    S.text(ctx, "V" + VERSION + "  -  WWI BOMBING RUN", W / 2, 43, "#f2efe4", { align: "center" });

    const x = 16, y = 58, w = W - 32, h = 242;
    const INK = "#2b2418", FADED = "#5e5039", RED = "#a8322a";
    ctx.fillStyle = "rgba(16,18,26,0.45)";
    ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = "#e9dfbf";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#d3c393";
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);
    const rule = (ry) => {
      ctx.fillStyle = "#b9a874";
      ctx.fillRect(x + 10, ry, w - 20, 1);
    };
    const ink = (str, ty, color = INK, opts = {}) => S.text(ctx, str, W / 2, ty, color, { align: "center", shadow: false, ...opts });

    // "TOP SECRET" stamp
    const sw = S.textWidth("TOP SECRET") + 10;
    ctx.fillStyle = RED;
    ctx.fillRect(W / 2 - sw / 2, 65, sw, 1);
    ctx.fillRect(W / 2 - sw / 2, 77, sw, 1);
    ctx.fillRect(W / 2 - sw / 2, 65, 1, 13);
    ctx.fillRect(W / 2 + sw / 2 - 1, 65, 1, 13);
    ink("TOP SECRET", 68, RED);

    ink("YOUR MISSION", 85, RED, { scale: 2 });
    ink("INFLICT MAXIMUM DAMAGE TO", 106);
    ink("ENEMY FORCES WHILE MINIMIZING", 116);
    ink("HARM TO NON-MILITARY TARGETS.", 126);
    rule(138);
    [
      "BOMB TRENCHES, GUNS, TRUCKS, TENTS,",
      "AMMO DUMPS, AA GUNS AND THE BRIDGE.",
      "SPARE THE VILLAGES: -100 A HOUSE.",
      "BOMBS DRIFT IN THE WIND.",
      "60 SECONDS, 2 PLANES.",
    ].forEach((r, i) => ink(r, 144 + i * 10, FADED));
    rule(196);
    [
      ["LEFT/RIGHT", "STEER"],
      ["UP/DOWN", "FORWARD / BACK"],
      ["SPACE", "DROP A BOMB"],
      ["P", "PAUSE"],
      ["M", "SOUND ON/OFF"],
    ].forEach(([k, v], i) => {
      S.text(ctx, k, x + 22, 202 + i * 10, RED, { shadow: false });
      S.text(ctx, v, x + 98, 202 + i * 10, INK, { shadow: false });
    });
    rule(254);
    ink("IF YOU ACCEPT THIS MISSION,", 262);
    if (Math.floor(animT * 2) % 2 === 0) ink("PRESS ENTER", 276, RED, { scale: 2 });

    if (best > 0) S.text(ctx, "BEST " + best, W - 4, H - 10, "#f2d16b", { align: "right" });
  }

  function drawPaused() {
    panel(48, 150, W - 96, 52);
    S.text(ctx, "PAUSED", W / 2, 160, "#f2d16b", { scale: 2, align: "center" });
    S.text(ctx, "P OR SPACE TO RESUME", W / 2, 184, "#f2efe4", { align: "center" });
  }

  function drawOver() {
    if (overT < 1.2) return;
    panel(24, 70, W - 48, 210);
    S.text(ctx, timeUp ? "RUN COMPLETE" : "SHOT DOWN", W / 2, 82, timeUp ? "#f2d16b" : "#ff6a5a", { scale: 2, align: "center" });
    const acc = stats.bombs ? Math.round((stats.bombHits / stats.bombs) * 100) : 0;
    const rows = [
      ["TARGETS HIT", String(stats.hits), "#f2efe4"],
      ["BLIMPS DOWNED", String(stats.blimps), "#f2efe4"],
      ["HOUSES HIT", stats.houses ? stats.houses + " (-" + stats.houses * 100 + ")" : "0", stats.houses ? "#ff6a5a" : "#f2efe4"],
      ["BOMBS DROPPED", String(stats.bombs), "#f2efe4"],
      ["ACCURACY", acc + "%", "#f2efe4"],
      ["PLANE BONUS", "+" + planeBonus, "#f2efe4"],
    ];
    rows.forEach(([label, value, color], i) => {
      S.text(ctx, label, 38, 108 + i * 12, "#c9c6b8");
      S.text(ctx, value, W - 38, 108 + i * 12, color, { align: "right" });
    });
    S.text(ctx, "SCORE", W / 2, 186, "#c9c6b8", { align: "center" });
    S.text(ctx, String(score), W / 2, 198, "#f2d16b", { scale: 3, align: "center" });
    S.text(ctx, newBest ? "NEW BEST!" : "BEST " + best, W / 2, 226, newBest ? "#9fe07a" : "#c9c6b8", { align: "center" });
    const rank = rankFor(score);
    S.text(ctx, "AWARDED THE RANK OF", W / 2, 238, "#c9c6b8", { align: "center" });
    S.text(ctx, rank.name, W / 2, 248, rank.color, { align: "center" });
    if (overT > 1.6 && Math.floor(animT * 2) % 2 === 0) S.text(ctx, "SPACE TO FLY AGAIN", W / 2, 264, "#ffffff", { align: "center" });
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    const vt = Math.round(viewTop());
    ctx.drawImage(world.strip, 0, vt, W, H, 0, 0, W, H);
    drawTargets(vt);
    drawAAGuns(vt);
    drawFlags(vt);
    drawFires(vt);
    drawParticles(vt, 0);
    drawClouds(true);
    if (state === "title") {
      const demoPlane = { x: W / 2, y: PLANE_Y + 30, alt: ALT, bank: 0, prop: animT * 30, alive: true, invuln: 0, crashed: false };
      drawShadows(vt);
      drawPlaneShadow(demoPlane);
      drawBlimps(vt);
      drawPlane(demoPlane);
    } else {
      drawShadows(vt);
      drawBombSight();
      drawBombs(vt);
      drawPlane(plane);
      drawBlimps(vt);
      drawFlak(vt);
    }
    drawParticles(vt, 1);
    drawClouds(false);
    drawPopups(vt);
    if (state === "title") drawTitle();
    else {
      drawHud();
      if (baseAlertT > 0 && state === "playing" && Math.floor(baseAlertT * 4) % 2 === 1) {
        S.text(ctx, "ENEMY BASE AHEAD!", W / 2, 46, "#e0503c", { scale: 2, align: "center" });
      }
      if (state === "paused") drawPaused();
      if (state === "over") drawOver();
    }
    if (soundMsgT > 0) S.text(ctx, Sfx.isMuted() ? "SOUND OFF" : "SOUND ON", W / 2, 20, "#f2efe4", { align: "center" });
    drawVersion();
  }

  // ============================================================
  // Start
  // ============================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  world = buildWorld(SEED !== null ? SEED : (Math.random() * 1e9) | 0);
  wind = 12;
  windTarget = 12;
  windTimer = 5;
  if (AUTOSTART) startRun();
  if (SIM) {
    for (let i = 0; i < SIM * 60; i++) update(1 / 60);
    const kinds = {};
    for (const t of world.targets) kinds[t.kind] = (kinds[t.kind] || "") + (t.alive ? "+" : "x");
    if (stats) document.title = JSON.stringify({ score, time: +time.toFixed(1), planesLeft, hp: plane.hp, ...stats, inAir: bombs.length, shells: flak.filter((f) => f.t < f.T).length, alarms: world.camps.filter((c) => c.alarmed).length, siren: Sfx.sirenPlaying(), kinds });
  }
  requestAnimationFrame(frame);
})();
