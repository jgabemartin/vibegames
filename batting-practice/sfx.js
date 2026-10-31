const Sfx = (() => {
  const VOLUME = 0.6;

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let flight = null;

  // Must be called from a user gesture so the browser lets audio start
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 2);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function ready() {
    return !!ctx;
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : VOLUME;
    return muted;
  }

  // Freeze every playing sound (flight whistle, crowd) while the game is paused
  function setPaused(p) {
    if (!ctx) return;
    if (p) ctx.suspend();
    else ctx.resume();
  }

  function tone(type, freqStart, freqEnd, dur, vol, delay = 0) {
    const time = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, time);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, time + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function noise(filterType, filterFreq, dur, vol, delay = 0, q = 1) {
    const time = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(time, Math.random() * 1.0);
    src.stop(time + dur);
  }

  // Noise burst whose filter sweeps between two frequencies, for whooshes
  function sweep(filterType, f0, f1, dur, vol, attack, delay = 0) {
    const time = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(f0, time);
    filter.frequency.exponentialRampToValueAtTime(f1, time + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(time, Math.random() * 1.0);
    src.stop(time + dur + 0.02);
  }

  // Pitcher's grunt and the ball whooshing out of the hand
  function pitchRelease() {
    if (!ready()) return;
    tone("sawtooth", 140, 90, 0.12, 0.08);
    sweep("bandpass", 500, 2200, 0.28, 0.35, 0.08);
  }

  // Airy swish of the bat through the zone
  function swing() {
    if (!ready()) return;
    sweep("highpass", 1200, 4000, 0.2, 0.45, 0.06);
    sweep("bandpass", 300, 900, 0.18, 0.2, 0.05);
  }

  // Wooden crack; quality 0..1 makes it sharper and louder
  function hit(quality) {
    if (!ready()) return;
    if (quality > 0.45) {
      noise("highpass", 1800 + quality * 1800, 0.09, 0.5 + quality * 0.5);
      tone("square", 1900 + quality * 600, 1200, 0.05, 0.2 + quality * 0.15);
      tone("triangle", 520, 260, 0.12, 0.35);
      noise("bandpass", 900, 0.2, 0.25, 0.01, 2);
    } else {
      // Dull, off-the-handle thunk
      tone("triangle", 260, 120, 0.14, 0.4);
      noise("lowpass", 900, 0.1, 0.4);
    }
  }

  // Whistle that rises and falls with the arc of the ball
  function ballFlight(duration, apexFraction = 0.5) {
    if (!ready() || duration < 0.3) return;
    stopFlight();
    const time = ctx.currentTime;
    const end = time + duration;
    const apex = time + duration * apexFraction;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.linearRampToValueAtTime(1600, apex);
    filter.frequency.linearRampToValueAtTime(700, end);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, time);
    osc.frequency.linearRampToValueAtTime(1100, apex);
    osc.frequency.linearRampToValueAtTime(500, end);
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.04;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.22, time + 0.15);
    gain.gain.linearRampToValueAtTime(0.12, apex);
    gain.gain.linearRampToValueAtTime(0.2, end - 0.05);
    gain.gain.linearRampToValueAtTime(0.0001, end);

    src.connect(filter).connect(gain);
    osc.connect(oscGain).connect(gain);
    gain.connect(master);
    src.start(time);
    osc.start(time);
    src.stop(end + 0.05);
    osc.stop(end + 0.05);
    flight = { src, osc, gain };
  }

  function stopFlight() {
    if (!flight) return;
    try {
      flight.gain.gain.cancelScheduledValues(ctx.currentTime);
      flight.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      flight.src.stop();
      flight.osc.stop();
    } catch (e) { /* already stopped */ }
    flight = null;
  }

  // Thump of the ball hitting turf; intensity 0..1
  function groundImpact(intensity) {
    if (!ready()) return;
    const v = Math.max(0.05, Math.min(1, intensity));
    tone("sine", 160 + v * 60, 55, 0.12 + v * 0.08, 0.15 + v * 0.5);
    noise("lowpass", 400 + v * 600, 0.08 + v * 0.06, 0.1 + v * 0.35);
  }

  // Ball clanging off the outfield wall
  function wallHit() {
    if (!ready()) return;
    tone("sine", 120, 50, 0.25, 0.6);
    noise("lowpass", 700, 0.2, 0.5);
    noise("bandpass", 1800, 0.12, 0.2, 0, 4);
  }

  // Leather pop when the ball reaches the catcher
  function catcherMitt() {
    if (!ready()) return;
    noise("bandpass", 1400, 0.06, 0.8, 0, 1.2);
    tone("sine", 300, 120, 0.07, 0.3);
  }

  // Little descending "aww" for a foul ball
  function foul() {
    if (!ready()) return;
    tone("triangle", 660, 620, 0.14, 0.12);
    tone("triangle", 494, 440, 0.24, 0.12, 0.15);
  }

  // Crowd swell plus a rising fanfare
  function homeRun() {
    if (!ready()) return;
    const time = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.45, time + 0.7);
    gain.gain.setValueAtTime(0.45, time + 1.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 4);
    src.connect(filter).connect(gain).connect(master);
    src.start(time);
    src.stop(time + 4.1);

    [523, 659, 784, 1047].forEach((f, i) => {
      tone("square", f, f, i === 3 ? 0.5 : 0.14, 0.1, 0.1 + i * 0.12);
    });
  }

  return { unlock, toggleMute, setPaused,pitchRelease, swing, hit, ballFlight, stopFlight, groundImpact, wallHit, catcherMitt, foul, homeRun };
})();
