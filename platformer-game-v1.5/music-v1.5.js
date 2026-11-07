const Music = (() => {
  const TEMPO = 128;
  const STEP_DUR = 60 / TEMPO / 4;
  const STEPS_PER_BAR = 16;
  const BARS_PER_SECTION = 2;
  const SECTION_STEPS = STEPS_PER_BAR * BARS_PER_SECTION;
  const CHORD_ROOTS = ["A", "D", "E", "D"];
  const TOTAL_STEPS = SECTION_STEPS * CHORD_ROOTS.length;
  const SCHEDULE_AHEAD = 0.1;
  const LOOKAHEAD_INTERVAL_MS = 25;
  const TARGET_VOLUME = 0.32;
  const MUTE_KEY = "farmBmxMusicMuted";

  const NOTE_SEMITONES = {
    C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4,
    "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2,
  };

  const RIFF_PATTERN = [
    { stepOffset: 0, idx: 0, dur: 3, slide: false },
    { stepOffset: 3, idx: 2, dur: 3, slide: false },
    { stepOffset: 6, idx: 3, dur: 2, slide: true },
    { stepOffset: 8, idx: 2, dur: 2, slide: false },
    { stepOffset: 10, idx: 0, dur: 6, slide: false },
    { stepOffset: 16, idx: 4, dur: 4, slide: true },
    { stepOffset: 20, idx: 3, dur: 4, slide: false },
    { stepOffset: 24, idx: 0, dur: 8, slide: false },
  ];

  let ctx = null;
  let musicGain = null;
  let noiseBuffer = null;
  let distortionCurve = null;
  let sections = null;
  let started = false;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let nextStepTime = 0;
  let currentStep = 0;
  let timer = null;

  function noteFreq(note, octave, extraSemitones = 0) {
    const semitoneFromA4 = NOTE_SEMITONES[note] + extraSemitones + (octave - 4) * 12;
    return 440 * Math.pow(2, semitoneFromA4 / 12);
  }

  function buildSection(rootNote) {
    return {
      bassFreq: noteFreq(rootNote, 2),
      turnaroundFreq: noteFreq(rootNote, 2, 7),
      chordFreqs: [0, 4, 7].map((iv) => noteFreq(rootNote, 3, iv)),
      leadFreqs: [0, 3, 5, 7, 10].map((iv) => noteFreq(rootNote, 4, iv)),
    };
  }

  function makeDistortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(amount * x);
    }
    return curve;
  }

  function createNoiseBuffer() {
    const len = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function initAudio() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ctx.destination);
    noiseBuffer = createNoiseBuffer();
    distortionCurve = makeDistortionCurve(8);
    sections = CHORD_ROOTS.map(buildSection);
  }

  function playKick(time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  function playSnare(time) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.7, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    noise.connect(hp).connect(ng).connect(musicGain);
    noise.start(time);
    noise.stop(time + 0.15);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 200;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(og).connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  function playHiHat(time, accent) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const gain = ctx.createGain();
    const vol = accent ? 0.22 : 0.11;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    noise.connect(hp).connect(gain).connect(musicGain);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  function playBass(freq, time, dur) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.9, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter).connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function playGuitarStab(freqs, time) {
    const dur = 0.22;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    gain.connect(shaper).connect(filter).connect(musicGain);
    freqs.forEach((f) => {
      [-5, 5].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.detune.value = cents;
        osc.connect(gain);
        osc.start(time);
        osc.stop(time + dur + 0.02);
      });
    });
  }

  function playLeadNote(freq, time, dur, slide) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    if (slide) {
      osc.frequency.setValueAtTime(freq * 0.94, time);
      osc.frequency.linearRampToValueAtTime(freq, time + 0.05);
    } else {
      osc.frequency.setValueAtTime(freq, time);
    }
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.4, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(shaper).connect(filter).connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function scheduleRiff(section, time) {
    for (const n of RIFF_PATTERN) {
      const noteTime = time + n.stepOffset * STEP_DUR;
      const dur = n.dur * STEP_DUR * 0.92;
      playLeadNote(section.leadFreqs[n.idx], noteTime, dur, n.slide);
    }
  }

  function scheduleStep(step, time) {
    const barStep = step % STEPS_PER_BAR;
    const stepInSection = step % SECTION_STEPS;
    const sectionIndex = Math.floor(step / SECTION_STEPS) % sections.length;
    const section = sections[sectionIndex];

    if (barStep === 0 || barStep === 8) playKick(time);
    if (barStep === 4 || barStep === 12) playSnare(time);
    if (barStep % 2 === 0) playHiHat(time, barStep % 4 === 0);

    if (barStep % 4 === 0) playBass(section.bassFreq, time, STEP_DUR * 3.6);
    if (stepInSection === 30) playBass(section.turnaroundFreq, time, STEP_DUR * 1.6);

    if (barStep === 4 || barStep === 12) playGuitarStab(section.chordFreqs, time);

    if (stepInSection === 0) scheduleRiff(section, time);
  }

  function scheduler() {
    while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(currentStep, nextStepTime);
      nextStepTime += STEP_DUR;
      currentStep = (currentStep + 1) % TOTAL_STEPS;
    }
  }

  function start() {
    if (started) return;
    if (!ctx) initAudio();
    ctx.resume();
    started = true;
    const now = ctx.currentTime;
    musicGain.gain.setValueAtTime(0, now);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : TARGET_VOLUME, now + 1.2);
    nextStepTime = now + 0.05;
    currentStep = 0;
    timer = setInterval(scheduler, LOOKAHEAD_INTERVAL_MS);
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (musicGain) {
      musicGain.gain.setTargetAtTime(muted ? 0 : TARGET_VOLUME, ctx.currentTime, 0.05);
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function isStarted() {
    return started;
  }

  function getContext() {
    return ctx;
  }

  return { start, toggleMute, isMuted, isStarted, getContext };
})();
