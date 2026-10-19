type Mixer = {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
};

let mixer: Mixer | null = null;
let muted = false;
let ambienceOn = false;
let ambienceTimer = 0;

function curve(value: number) {
  return value * value;
}

export function ensureAudio() {
  if (!mixer) {
    const ctx = new AudioContext({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const music = ctx.createGain();
    sfx.gain.value = curve(0.85);
    music.gain.value = curve(muted ? 0 : 0.55);
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    mixer = { ctx, sfx, music };
  }
  if (mixer.ctx.state === "suspended") void mixer.ctx.resume();
  return mixer;
}

export function setMuted(next: boolean) {
  muted = next;
  if (!mixer) return;
  const now = mixer.ctx.currentTime;
  mixer.sfx.gain.setTargetAtTime(curve(next ? 0 : 0.85), now, 0.03);
  mixer.music.gain.setTargetAtTime(curve(next || !ambienceOn ? 0 : 0.55), now, 0.05);
}

export function resumeAudio() {
  if (mixer && mixer.ctx.state === "suspended") void mixer.ctx.resume();
}

function tone(
  ctx: AudioContext,
  dest: GainNode,
  freq: number,
  when: number,
  dur: number,
  gain: number,
  type: OscillatorType,
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(amp);
  amp.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
  };
}

export function playPat() {
  const { ctx, sfx } = ensureAudio();
  const now = ctx.currentTime;
  const base = 150 + Math.random() * 40;
  tone(ctx, sfx, base, now, 0.09, 0.16, "sine");
  tone(ctx, sfx, base * 2.1, now, 0.05, 0.04, "triangle");
}

export function playMiss() {
  const { ctx, sfx } = ensureAudio();
  tone(ctx, sfx, 110, ctx.currentTime, 0.08, 0.05, "sine");
}

export function playBell() {
  const { ctx, sfx } = ensureAudio();
  const now = ctx.currentTime;
  tone(ctx, sfx, 880, now, 0.45, 0.07, "sine");
  tone(ctx, sfx, 1320, now + 0.03, 0.38, 0.04, "sine");
}

const SCALE = [392, 440, 494, 523.25, 587.33];
const STEPS = [0, 2, 4, 2, 3, 1, 0, 4];
const GAPS = [0.72, 0.72, 1.35, 0.48, 0.9, 1.6, 0.7, 1.9];

export function startAmbience() {
  const mix = ensureAudio();
  ambienceOn = true;
  if (!muted) {
    mix.music.gain.setTargetAtTime(curve(0.55), mix.ctx.currentTime, 0.08);
  }
  if (ambienceTimer) return;
  let step = 0;
  let next = mix.ctx.currentTime + 0.4;
  const pump = () => {
    if (!ambienceOn) return;
    const now = mix.ctx.currentTime;
    while (next < now + 0.35) {
      tone(mix.ctx, mix.music, SCALE[STEPS[step % STEPS.length]], next, 0.55, 0.05, "sine");
      next += GAPS[step % GAPS.length];
      step += 1;
    }
    ambienceTimer = window.setTimeout(pump, 200);
  };
  pump();
}
