// Synthesized audio: engine hum, gunfire, sirens, and an original synthwave loop.
// No audio files — everything is generated with the Web Audio API at run time.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sirenOsc = null;
    this.sirenGain = null;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  tone(freq, dur, type = 'square', vol = 0.5, when = 0, slideTo = null) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.4, when = 0) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master);
    src.start(t0);
  }
  gunshot() { this.noise(0.12, 0.5); this.tone(160, 0.08, 'square', 0.3, 0, 60); }
  punch() { this.noise(0.06, 0.25); this.tone(90, 0.07, 'triangle', 0.4); }
  hit() { this.tone(220, 0.1, 'sawtooth', 0.35, 0, 140); }
  carCrash() { this.noise(0.35, 0.6); this.tone(70, 0.3, 'sawtooth', 0.4, 0, 40); }
  carEnter() { this.tone(320, 0.09, 'square', 0.3); this.tone(480, 0.09, 'square', 0.3, 0.09); }
  cash() { this.tone(880, 0.08, 'sine', 0.4); this.tone(1320, 0.12, 'sine', 0.4, 0.08); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.45, i * 0.14)); }
  missionFail() { [330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.35, i * 0.16)); }
  starUp() { this.tone(700, 0.1, 'square', 0.3); this.tone(900, 0.14, 'square', 0.3, 0.09); }
  busted() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.4, i * 0.18)); }
  setSiren(active) {
    if (!this.ensure()) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0.06;
      const lfo = this.ctx.createOscillator(), lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.9; lfoGain.gain.value = 220;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 700;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      lfo.start(); this.sirenOsc.start();
      this.sirenLfo = lfo;
    } else if (!active && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc.disconnect(); this.sirenLfo = null; this.sirenOsc = null;
    }
  }
  // Original synthwave loop: a slow minor-key bassline and pad.
  startMusic() {
    if (!this.musicOn || !this.ctx) return;
    const notes = [110, 110, 130.8, 98, 110, 110, 164.8, 146.8]; // A A C G A A E D
    let step = 0;
    const beat = 0.42;
    this.musicTimer = setInterval(() => {
      if (!this.musicOn) return;
      const f = notes[step % notes.length];
      this.tone(f, beat * 0.9, 'sawtooth', 0.12);
      if (step % 2 === 0) this.tone(f * 2, beat * 0.5, 'triangle', 0.06, 0.02);
      if (step % 8 === 7) this.tone(f * 3, beat * 1.6, 'sine', 0.05, 0.1);
      step++;
    }, beat * 1000);
  }
  toggleMusic() { this.musicOn = !this.musicOn; return this.musicOn; }
}
