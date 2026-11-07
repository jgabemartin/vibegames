const Sfx = (() => {
  const VOLUME = 0.5;

  let ctx = null;
  let sfxGain = null;
  let noiseBuffer = null;

  function ready() {
    if (!ctx) {
      ctx = Music.getContext();
      if (!ctx) return false;
      sfxGain = ctx.createGain();
      sfxGain.gain.value = VOLUME;
      sfxGain.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return true;
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
    osc.connect(gain).connect(sfxGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function noise(filterType, filterFreq, dur, vol, delay = 0) {
    const time = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter).connect(gain).connect(sfxGain);
    src.start(time);
    src.stop(time + dur);
  }

  // Springy upward chirp
  function jump() {
    if (!ready()) return;
    tone("square", 260, 620, 0.14, 0.18);
  }

  // Higher double chirp with a whoosh for the mid-air SuperHop
  function superHop() {
    if (!ready()) return;
    tone("square", 420, 900, 0.1, 0.16);
    tone("square", 700, 1400, 0.12, 0.12, 0.06);
    noise("highpass", 3000, 0.15, 0.15);
  }

  // Two-note bright ding
  function coin() {
    if (!ready()) return;
    tone("square", 988, 988, 0.07, 0.14);
    tone("square", 1319, 1319, 0.22, 0.14, 0.07);
  }

  // Dull thud when riding into the side of a hay bale, pumpkin, or wagon
  function bump() {
    if (!ready()) return;
    tone("sine", 140, 60, 0.12, 0.5);
    noise("lowpass", 500, 0.08, 0.4);
  }

  // Boing for hopping on a dog
  function stomp() {
    if (!ready()) return;
    tone("triangle", 520, 140, 0.16, 0.45);
    noise("bandpass", 1200, 0.05, 0.25);
  }

  // Harsh crash when a dog knocks you off the bike
  function hurt() {
    if (!ready()) return;
    tone("sawtooth", 320, 70, 0.35, 0.3);
    noise("lowpass", 1800, 0.25, 0.45);
  }

  // Falling slide whistle followed by a distant thump
  function fall() {
    if (!ready()) return;
    tone("sine", 1100, 160, 0.75, 0.3);
    tone("sine", 110, 45, 0.2, 0.55, 0.75);
    noise("lowpass", 300, 0.2, 0.4, 0.75);
  }

  // Deep growl when a boss wakes up
  function bossRoar() {
    if (!ready()) return;
    tone("sawtooth", 70, 50, 0.9, 0.35);
    tone("sawtooth", 105, 60, 0.9, 0.2);
    noise("lowpass", 400, 0.9, 0.35);
  }

  // Soft thump of an apple hitting the ground
  function applePlop() {
    if (!ready()) return;
    tone("sine", 220, 90, 0.08, 0.2);
  }

  // Sinking groan when you get past a boss
  function bossDefeat() {
    if (!ready()) return;
    tone("sawtooth", 160, 55, 1.0, 0.25);
    [784, 988, 1175].forEach((f, i) => tone("square", f, f, 0.15, 0.1, 0.5 + i * 0.12));
  }

  // Rushing flare of fire
  function fireWhoosh() {
    if (!ready()) return;
    const time = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(300, time);
    filter.frequency.exponentialRampToValueAtTime(1800, time + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    src.connect(filter).connect(gain).connect(sfxGain);
    src.start(time);
    src.stop(time + 0.5);
  }

  // Two raspy coughs
  function cough() {
    if (!ready()) return;
    noise("bandpass", 900, 0.14, 0.6);
    tone("sawtooth", 180, 120, 0.12, 0.15);
    noise("bandpass", 750, 0.16, 0.5, 0.22);
    tone("sawtooth", 160, 100, 0.14, 0.13, 0.22);
  }

  // Rival rider dropping into the pit
  function rivalFall() {
    if (!ready()) return;
    tone("sine", 700, 200, 0.5, 0.12);
  }

  // Big boom, firework pops, and cascading chimes for beating the final boss
  function celebration() {
    if (!ready()) return;
    tone("sine", 90, 30, 0.9, 0.6);
    noise("lowpass", 900, 0.7, 0.55);

    // Pops line up with the firework bursts on screen
    [0.3, 0.57, 0.8, 1.03, 1.27, 1.53, 1.83].forEach((t) => {
      noise("highpass", 2500, 0.12, 0.35, t);
      tone("sine", 160, 60, 0.15, 0.3, t);
    });

    // Two quick runs cascading down, then one climbing up to a final chord
    const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];
    const notes = [...scale.slice().reverse(), ...scale.slice().reverse(), ...scale];
    notes.forEach((f, i) => tone("triangle", f, f, 0.25, 0.12, 0.15 + i * 0.065));
    const chordAt = 0.15 + notes.length * 0.065;
    [1047, 1319, 1568, 2093].forEach((f) => tone("triangle", f, f, 1.2, 0.1, chordAt));
  }

  // Rising arpeggio for finishing a level
  function levelUp() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      tone("square", f, f, i === 3 ? 0.4 : 0.12, 0.13, i * 0.1);
    });
  }

  return { jump, superHop, coin, bump, stomp, hurt, fall, bossRoar, applePlop, bossDefeat, fireWhoosh, cough, rivalFall, celebration, levelUp };
})();
