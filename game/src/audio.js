// Every sound is synthesized with WebAudio: no audio files, nothing to download.
// A tiny synth: oscillators for tones, filtered noise for impacts, and a two-tone
// siren whose pitch follows the nearest police car. Created lazily on first use,
// because browsers only let audio start after a user gesture.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && context.state === 'suspended') context.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol || 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol || 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  /** Continuous engine hum: speed 0..1 sets pitch and loudness. Call every frame. */
  function engine(speedRatio, on) {
    if (!ensure()) return;
    const target = on && !muted ? 0.05 + speedRatio * 0.09 : 0;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, context.currentTime, 0.08);
  }

  /** Two-tone siren; call every frame with wanted > 0. */
  function siren(dt, on) {
    if (!ensure()) return;
    sirenTimer += dt;
    const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
    sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, context.currentTime, 0.05);
    sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, context.currentTime, 0.1);
  }

  function shoot() {
    noise(0.12, 0.5, 2800);
    tone(160, 0.08, 'square', 0.2, 60);
  }
  function punch() {
    noise(0.09, 0.35, 500);
  }
  function crash() {
    noise(0.25, 0.5, 700);
  }
  function pickup() {
    tone(660, 0.1, 'sine', 0.2);
    tone(990, 0.14, 'sine', 0.2);
  }
  function coin() {
    tone(880, 0.07, 'sine', 0.18);
    tone(1320, 0.12, 'sine', 0.18);
  }
  function click() {
    tone(440, 0.05, 'square', 0.1);
  }
  function busted() {
    tone(220, 0.4, 'sawtooth', 0.2, 110);
  }
  function missionDone() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.18, 'triangle', 0.22), i * 110);
    });
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { resume, engine, siren, shoot, punch, crash, pickup, coin, click, busted, missionDone, toggleMute };
}
