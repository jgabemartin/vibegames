// SkyRaider sound effects, made with the Web Audio API. The engine, the bomb whistle, the
// explosions and the flak guns firing are recorded clips embedded as base64 (engine-v1.0.js,
// bomb-whistle-v1.0.js, explosion-1/2/3-v1.0.js, flak-fire-1/2-v1.0.js);
// everything else is made in code. Until the clips are decoded, coded versions play instead.
const Sfx = (() => {
  const MUTE_KEY = "skyRaiderMuted";
  const VOLUME = 0.7;
  const ENGINE_CLIP_VOL = 0.3; // the recorded engine, kept under the bombs and flak
  const FLAK_FIRE_VOL = 0.35; // guns firing: a bit quieter than the bombs, since they're further off
  const ENGINE_SKIP = 2; // seconds of start-up at the front of engine.mp3 that aren't looped

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let eng = null;
  let muted = false;
  let engineClip = null; // { buf, loopStart, loopEnd }: decoded engine.mp3 and its steady stretch
  let engineLevel = { alt: 0.5, climb: 0 };
  let whistle = null; // { buf, end }: decoded bomb-whistle.mp3 and where its sound ends
  let blasts = []; // [{ buf, start }]: decoded explosion clips and where each one starts
  let lastBlast = -1;
  let shots = []; // [{ buf, start }]: decoded flak-firing clips
  let playing = []; // explosion clips still sounding, so a carpet of bombs can't pile up
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (e) {
    // storage blocked: sound starts on
  }

  // Browsers only allow audio after a key press, so the game calls this from its key handler
  function init() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // A limiter keeps stacked explosions from distorting
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    loadClips();
  }

  // Decode an embedded base64 mp3 into a buffer
  function decodeEmbedded(b64, onOk) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    ctx.decodeAudioData(bytes.buffer, onOk, () => {});
  }

  // First and last moments louder than a whisper
  function soundSpan(buf) {
    const d = buf.getChannelData(0);
    let a = 0;
    while (a < d.length && Math.abs(d[a]) < 0.02) a++;
    let b = d.length - 1;
    while (b > a && Math.abs(d[b]) < 0.02) b--;
    return [Math.max(0, a / buf.sampleRate - 0.002), b / buf.sampleRate];
  }

  // Skip the first 2 s of the clip, where the engine turns over, and loop the rest.
  // Both ends are cut where the wave crosses zero going up, so the loop doesn't click
  function findEngineLoop(buf) {
    const d = buf.getChannelData(0);
    const upCross = (i) => {
      while (i < d.length - 1 && !(d[i] <= 0 && d[i + 1] > 0)) i++;
      return i;
    };
    let last = d.length - 1;
    while (last > 0 && Math.abs(d[last]) < 0.02) last--; // trailing silence
    const a = upCross(Math.floor(buf.sampleRate * ENGINE_SKIP));
    let b = last;
    while (b > a && !(d[b - 1] <= 0 && d[b] > 0)) b--;
    return { buf, loopStart: a / buf.sampleRate, loopEnd: b / buf.sampleRate };
  }

  function loadClips() {
    if (typeof ENGINE_MP3 !== "undefined") {
      decodeEmbedded(ENGINE_MP3, (buf) => {
        engineClip = findEngineLoop(buf);
        // Swap the coded drone for the recording if it's already running
        if (eng && !eng.src) {
          engineOff(0.05);
          engineOn();
        }
      });
    }
    if (typeof BOMB_WHISTLE_MP3 !== "undefined") {
      decodeEmbedded(BOMB_WHISTLE_MP3, (buf) => {
        whistle = { buf, end: soundSpan(buf)[1] };
      });
    }
    const explosions = [
      typeof EXPLOSION_1_MP3 !== "undefined" && EXPLOSION_1_MP3,
      typeof EXPLOSION_2_MP3 !== "undefined" && EXPLOSION_2_MP3,
      typeof EXPLOSION_3_MP3 !== "undefined" && EXPLOSION_3_MP3,
    ];
    for (const b64 of explosions) if (b64) decodeEmbedded(b64, (buf) => blasts.push({ buf, start: soundSpan(buf)[0] }));
    const firing = [typeof FLAK_FIRE_1_MP3 !== "undefined" && FLAK_FIRE_1_MP3, typeof FLAK_FIRE_2_MP3 !== "undefined" && FLAK_FIRE_2_MP3];
    for (const b64 of firing) if (b64) decodeEmbedded(b64, (buf) => shots.push({ buf, start: soundSpan(buf)[0] }));
  }

  function playClip(buf, offset, dur, vol, rate = 1) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    src.connect(g);
    g.connect(master);
    if (dur === undefined) src.start(t, offset);
    else src.start(t, offset, dur);
    return { src, g };
  }

  function tone(type, f0, f1, dur, vol, at = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(filterType, f0, f1, dur, vol, at = 0, q = 0.8) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  // ---- Engine drone: a buzzy saw with a throb from the propeller ----
  function engineOn() {
    if (!ctx || eng) return;
    if (engineClip) {
      const src = ctx.createBufferSource();
      src.buffer = engineClip.buf;
      src.loop = true;
      src.loopStart = engineClip.loopStart;
      src.loopEnd = engineClip.loopEnd;
      const g = ctx.createGain();
      src.connect(g);
      g.connect(master);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(ENGINE_CLIP_VOL, t + 0.6);
      src.start(t, engineClip.loopStart);
      eng = { src, g, nodes: [src] };
      setEngine(engineLevel.alt, engineLevel.climb);
      return;
    }
    const o1 = ctx.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 62;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = 31;
    const sub = ctx.createGain();
    sub.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 14;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.016;
    lfo.connect(lfoDepth);
    lfoDepth.connect(g.gain);
    o1.connect(lp);
    o2.connect(sub);
    sub.connect(lp);
    lp.connect(g);
    g.connect(master);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.6);
    o1.start(t);
    o2.start(t);
    lfo.start(t);
    eng = { o1, o2, lfo, g, nodes: [o1, o2, lfo] };
  }

  function setEngine(alt, climb) {
    engineLevel = { alt, climb };
    if (!eng) return;
    if (eng.src) {
      // Revs up as the plane climbs and higher up
      eng.src.playbackRate.setTargetAtTime(0.9 + alt * 0.25 + climb * 0.08, ctx.currentTime, 0.25);
      return;
    }
    const f = 56 + alt * 16 + climb * 8;
    const t = ctx.currentTime;
    eng.o1.frequency.setTargetAtTime(f, t, 0.25);
    eng.o2.frequency.setTargetAtTime(f / 2, t, 0.25);
    eng.lfo.frequency.setTargetAtTime(f / 4.2, t, 0.25);
  }

  function engineOff(fade = 0.3) {
    if (!eng) return;
    const e = eng;
    eng = null;
    const t = ctx.currentTime;
    e.g.gain.cancelScheduledValues(t);
    e.g.gain.setValueAtTime(e.g.gain.value, t);
    e.g.gain.linearRampToValueAtTime(0, t + fade);
    for (const n of e.nodes) n.stop(t + fade + 0.05);
  }

  // ---- Effects ----
  function drop(fallTime) {
    if (!ctx) return;
    tone("square", 320, 180, 0.05, 0.07);
    if (whistle) {
      // The last stretch of the recorded whistle, timed to end as the bomb lands
      const from = Math.max(0, whistle.end - fallTime);
      const { g } = playClip(whistle.buf, from, fallTime + 0.05, 0.0001);
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.35, t + Math.min(0.25, fallTime / 3));
      g.gain.setValueAtTime(0.35, t + fallTime - 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + fallTime + 0.04);
      return;
    }
    // Falling whistle that drops in pitch until the bomb lands
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(420, t + fallTime);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + fallTime * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + fallTime);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + fallTime + 0.02);
  }

  function boom(big) {
    if (!ctx) return;
    if (blasts.length) {
      // A random explosion clip, never the same one twice running, at a slightly random pitch
      let i = Math.floor(Math.random() * blasts.length);
      if (i === lastBlast && blasts.length > 1) i = (i + 1 + Math.floor(Math.random() * (blasts.length - 1))) % blasts.length;
      lastBlast = i;
      const b = blasts[i];
      const rate = (big ? 0.8 : 0.92) + Math.random() * 0.16;
      // Keep at most four going: the oldest fades out
      playing = playing.filter((p) => p.end > ctx.currentTime);
      if (playing.length >= 4) {
        const old = playing.shift();
        old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
      const p = playClip(b.buf, b.start, undefined, big ? 1 : 0.75, rate);
      // Explosion clips run up to 4 s; fade the tail so a long rumble doesn't drown the next one
      p.g.gain.setTargetAtTime(0, ctx.currentTime + 1.6, 0.4);
      p.end = ctx.currentTime + (b.buf.duration - b.start) / rate;
      playing.push(p);
      if (big) tone("sine", 70, 28, 0.9, 0.6);
      return;
    }
    noise("lowpass", big ? 1400 : 1800, 120, big ? 1.2 : 0.6, big ? 0.9 : 0.6);
    tone("sine", 95, 32, big ? 0.7 : 0.4, big ? 0.8 : 0.55);
    if (big) noise("lowpass", 900, 100, 0.9, 0.5, 0.18);
  }

  function splash() {
    noise("bandpass", 1800, 500, 0.4, 0.35, 0, 1.2);
    tone("sine", 600, 200, 0.15, 0.05);
  }

  function flak() {
    noise("bandpass", 1100, 280, 0.3, 0.45, 0, 1);
    tone("square", 150, 55, 0.12, 0.1);
  }

  // A distant gun firing a flak shell
  function flakFire() {
    if (!ctx) return;
    if (shots.length) {
      // One of the two gunshot clips at random, at a slightly random pitch
      const s = shots[Math.floor(Math.random() * shots.length)];
      const p = playClip(s.buf, s.start, undefined, FLAK_FIRE_VOL, 0.9 + Math.random() * 0.2);
      p.g.gain.setTargetAtTime(0, ctx.currentTime + 0.6, 0.15);
      return;
    }
    noise("lowpass", 700, 120, 0.18, 0.18, 0, 0.7);
  }

  function hit(points) {
    tone("square", 880, 880, 0.07, 0.06);
    tone("square", 1318.5, 1318.5, 0.1, 0.06, 0.06);
    if (points >= 150) tone("square", 1760, 1760, 0.12, 0.06, 0.12);
  }

  function penalty() {
    tone("square", 220, 140, 0.22, 0.09);
    tone("square", 165, 98, 0.3, 0.09, 0.14);
  }

  function blimpDown() {
    noise("bandpass", 2400, 260, 1.6, 0.25, 0, 2);
    tone("sawtooth", 320, 55, 1.6, 0.05);
  }

  function planeHit() {
    noise("lowpass", 2600, 300, 0.5, 0.55);
    tone("sawtooth", 520, 70, 1.5, 0.07, 0.05);
  }

  // Short bugle calls for take-off and the end of a run
  function start() {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => tone("triangle", f, f, i === 3 ? 0.4 : 0.16, 0.12, i * 0.11));
  }

  function end() {
    [783.99, 659.25, 523.25, 659.25, 1046.5].forEach((f, i) => tone("triangle", f, f, i === 4 ? 0.6 : 0.16, 0.12, i * 0.13));
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setValueAtTime(muted ? 0 : VOLUME, ctx.currentTime);
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch (e) {
      // not saved
    }
    return muted;
  }

  return {
    init, engineOn, setEngine, engineOff,
    drop, boom, splash, flak, flakFire, hit, penalty, blimpDown, planeHit, start, end,
    toggleMute, isMuted: () => muted,
  };
})();
