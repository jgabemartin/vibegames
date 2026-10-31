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

  // Rising arpeggio for finishing a level
  function levelUp() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      tone("square", f, f, i === 3 ? 0.4 : 0.12, 0.13, i * 0.1);
    });
  }

  return { jump, coin, bump, stomp, hurt, fall, levelUp };
})();
