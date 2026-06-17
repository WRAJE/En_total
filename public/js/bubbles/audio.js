const AudioManager = {
  ctx: null,
  enabled: true,
  musicGain: null,
  musicOscillators: [],

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.ctx.destination);
  },

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  playNote(freq, duration, time, type = 'sine', gain = 0.1) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
    return osc;
  },

  // SpongeBob-style happy melody
  playJingle() {
    this.ensure();
    const now = this.ctx.currentTime;
    const notes = [
      [523, 0.15], [659, 0.15], [784, 0.15], [1047, 0.3],
      [784, 0.15], [659, 0.15], [523, 0.3],
    ];
    notes.forEach(([freq, dur], i) => {
      this.playNote(freq, dur, now + i * 0.2, 'square', 0.06);
    });
  },

  playCorrect() {
    this.ensure();
    const now = this.ctx.currentTime;
    this.playNote(880, 0.1, now, 'sine', 0.1);
    this.playNote(1100, 0.15, now + 0.1, 'sine', 0.1);
  },

  playWrong() {
    this.ensure();
    const now = this.ctx.currentTime;
    this.playNote(220, 0.2, now, 'sawtooth', 0.06);
    this.playNote(180, 0.3, now + 0.15, 'sawtooth', 0.06);
  },

  playJump() {
    this.ensure();
    const now = this.ctx.currentTime;
    this.playNote(400, 0.08, now, 'sine', 0.05);
    this.playNote(600, 0.08, now + 0.05, 'sine', 0.05);
  },

  playHit() {
    this.ensure();
    const now = this.ctx.currentTime;
    this.playNote(150, 0.3, now, 'sawtooth', 0.08);
    this.playNote(100, 0.4, now + 0.1, 'sawtooth', 0.06);
  },

  playCatch() {
    this.ensure();
    const now = this.ctx.currentTime;
    this.playNote(600, 0.08, now, 'triangle', 0.08);
    this.playNote(800, 0.08, now + 0.06, 'triangle', 0.08);
    this.playNote(1000, 0.12, now + 0.12, 'triangle', 0.06);
  },

  // Ocean background ambiance
  startOcean() {
    if (!this.enabled) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const noise = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    noise.type = 'sine';
    noise.frequency.value = 60;
    noiseGain.gain.setValueAtTime(0.04, now);
    noiseGain.gain.linearRampToValueAtTime(0.08, now + 2);
    noiseGain.gain.linearRampToValueAtTime(0.03, now + 4);
    noise.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    this._oceanNoise = { osc: noise, gain: noiseGain };
  },

  stopOcean() {
    if (this._oceanNoise) {
      this._oceanNoise.osc.stop();
      this._oceanNoise = null;
    }
  },

  // 80s arcade announcer "SPEED UP!" style sound
  playSpeedBoost() {
    this.ensure();
    const now = this.ctx.currentTime;
    // Ascending square wave "wow" effect
    for (let i = 0; i < 4; i++) {
      const freq = 200 + i * 300 + Math.random() * 50;
      this.playNote(freq, 0.12, now + i * 0.08, 'square', 0.07);
    }
    // High sparkle at the end
    this.playNote(1200, 0.15, now + 0.35, 'sine', 0.08);
    this.playNote(1600, 0.2, now + 0.4, 'sine', 0.06);
  },

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopOcean();
    return this.enabled;
  },
};
