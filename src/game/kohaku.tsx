import { useEffect, useRef, useState } from "react";
import { Heart, Volume2, VolumeX } from "lucide-react";
import shrineUrl from "@/assets/shrine/shrine.jpg";
import handUrl from "@/assets/shrine/hand.webp";
import calmUrl from "@/assets/shrine/kohaku-calm.webp";
import blissUrl from "@/assets/shrine/kohaku-bliss.webp";
import delightUrl from "@/assets/shrine/kohaku-delight.webp";
import shyUrl from "@/assets/shrine/kohaku-shy.webp";
import sleepyUrl from "@/assets/shrine/kohaku-sleepy.webp";
import { ensureAudio, playBell, playMiss, playPat, resumeAudio, setMuted, startAmbience } from "@/game/audio";
import { LINES, pickLine } from "@/game/lines";

const SAVE_KEY = "kohaku-v1";

const FACES = [
  { id: "calm", src: calmUrl },
  { id: "delight", src: delightUrl },
  { id: "bliss", src: blissUrl },
  { id: "shy", src: shyUrl },
  { id: "sleepy", src: sleepyUrl },
] as const;

type FaceId = (typeof FACES)[number]["id"];

const MOODS = [
  { at: 0, id: "distant", label: "Distant" },
  { at: 14, id: "curious", label: "Curious" },
  { at: 32, id: "fond", label: "Fond" },
  { at: 52, id: "devoted", label: "Devoted" },
  { at: 74, id: "blissful", label: "Blissful" },
  { at: 90, id: "shrineheart", label: "Shrineheart" },
] as const;

type MoodId = (typeof MOODS)[number]["id"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "heart" | "leaf";
  rot: number;
  vr: number;
  size: number;
};

type Save = { v: 1; fondness: number; pats: number; best: number };

function moodFor(fondness: number) {
  let current: (typeof MOODS)[number] = MOODS[0];
  for (const mood of MOODS) {
    if (fondness >= mood.at) current = mood;
  }
  return current;
}

function faceFor(warmth: number, ticklish: number, fondness: number): FaceId {
  if (ticklish > 0.05) return "shy";
  if (warmth < 0.45) return "calm";
  if (warmth < 1.8) return "delight";
  if (warmth < 4.2) return "bliss";
  return fondness >= 48 ? "sleepy" : "bliss";
}

function poolFor(fondness: number) {
  if (fondness >= 100) return LINES.maxed;
  if (fondness >= 74) return LINES.high;
  if (fondness >= 32) return LINES.mid;
  return LINES.early;
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, 0.35);
  ctx.bezierCurveTo(-1.05, -0.35, -0.55, -1.15, 0, -0.45);
  ctx.bezierCurveTo(0.55, -1.15, 1.05, -0.35, 0, 0.35);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(size, size * 0.55);
  ctx.beginPath();
  ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function KohakuGame() {
  const [started, setStarted] = useState(false);
  const [fondness, setFondness] = useState(0);
  const [pats, setPats] = useState(0);
  const [best, setBest] = useState(0);
  const [rhythm, setRhythm] = useState(0);
  const [face, setFace] = useState<FaceId>("calm");
  const [line, setLine] = useState("She is waiting under the maple, pretending not to watch the path.");
  const [muted, setMutedState] = useState(false);
  const [hint, setHint] = useState(true);
  const [pointerFine, setPointerFine] = useState(true);

  const fondnessRef = useRef(0);
  const patsRef = useRef(0);
  const bestRef = useRef(0);
  const rhythmRef = useRef(0);
  const faceRef = useRef<FaceId>("calm");
  const lineRef = useRef(line);
  const startedRef = useRef(false);
  const warmthRef = useRef(0);
  const ticklishRef = useRef(0);
  const squashRef = useRef(0);
  const pressRef = useRef(0);
  const lastPatRef = useRef(0);
  const lastSayRef = useRef(0);
  const saidFirstRef = useRef(false);
  const idleRef = useRef(0);
  const motionRef = useRef(true);
  const fineRef = useRef(true);
  const pointerRef = useRef({ x: -999, y: -999, over: false, ui: false });
  const strokingRef = useRef(false);
  const strokeRef = useRef({ x: 0, y: 0 });
  const figureRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const patKindRef = useRef<(kind: "head" | "miss" | "button") => void>(() => {});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw) as Save;
      if (save.v !== 1 || typeof save.fondness !== "number") return;
      fondnessRef.current = Math.min(100, Math.max(0, save.fondness));
      patsRef.current = save.pats || 0;
      bestRef.current = save.best || 0;
      setFondness(fondnessRef.current);
      setPats(patsRef.current);
      setBest(bestRef.current);
      if (fondnessRef.current > 0) {
        const welcome = LINES.return[0];
        lineRef.current = welcome;
        setLine(welcome);
      }
    } catch {
      /* ignore broken saves */
    }
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    const apply = () => {
      motionRef.current = !motion.matches;
      fineRef.current = fine.matches;
      setPointerFine(fine.matches);
    };
    apply();
    motion.addEventListener("change", apply);
    fine.addEventListener("change", apply);
    const onVis = () => {
      if (document.visibilityState === "visible") resumeAudio();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      motion.removeEventListener("change", apply);
      fine.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const say = (text: string, force = false) => {
    const now = performance.now();
    if (!force && now - lastSayRef.current < 1700) return;
    lastSayRef.current = now;
    lineRef.current = text;
    setLine(text);
  };

  const begin = () => {
    if (startedRef.current) return;
    ensureAudio();
    startedRef.current = true;
    setStarted(true);
    startAmbience();
    const opening = fondnessRef.current > 0 ? LINES.return[0] : LINES.intro[0];
    say(opening, true);
  };

  patKindRef.current = (kind) => {
    ensureAudio();
    begin();
    const now = performance.now();
    const dt = lastPatRef.current === 0 ? 9999 : now - lastPatRef.current;
    lastPatRef.current = now;
    idleRef.current = 0;

    if (kind === "miss") {
      playMiss();
      squashRef.current = Math.max(squashRef.current, 0.35);
      say(pickLine(LINES.miss, lineRef.current));
      return;
    }

    const fast = dt < 240;
    let nextRhythm = rhythmRef.current;
    if (dt > 1400) nextRhythm = 1;
    else if (fast) nextRhythm = 0;
    else if (dt >= 420 && dt <= 940) nextRhythm = Math.min(8, nextRhythm + 1);
    else nextRhythm = Math.max(1, nextRhythm);
    rhythmRef.current = nextRhythm;
    setRhythm(nextRhythm);
    if (nextRhythm > bestRef.current) {
      bestRef.current = nextRhythm;
      setBest(nextRhythm);
    }

    if (fast) {
      ticklishRef.current = 1.15;
      warmthRef.current = Math.min(6, warmthRef.current + 0.35);
    } else {
      ticklishRef.current = 0;
      warmthRef.current = Math.min(8, warmthRef.current + (dt >= 420 && dt <= 940 ? 1.55 : 1.05));
    }

    const before = moodFor(fondnessRef.current).id;
    const gain = fast ? 0.06 : 0.38 + Math.min(nextRhythm, 5) * 0.08;
    const atMax = fondnessRef.current >= 100;
    fondnessRef.current = Math.min(100, fondnessRef.current + (atMax ? 0 : gain));
    patsRef.current += 1;
    setFondness(fondnessRef.current);
    setPats(patsRef.current);
    const after = moodFor(fondnessRef.current);
    squashRef.current = 1;
    pressRef.current = 1;
    playPat();
    setHint(false);
    spawnHearts(fast ? 1 : 3 + Math.min(2, Math.floor(nextRhythm / 3)));

    if (before !== after.id && after.id !== "distant") {
      playBell();
      const tierLine = LINES.tiers[after.id as Exclude<MoodId, "distant">];
      if (tierLine) say(tierLine, true);
    } else if (fast) {
      say(pickLine(LINES.fast, lineRef.current));
    } else if (!saidFirstRef.current) {
      saidFirstRef.current = true;
      if (fondnessRef.current < 18) say(LINES.first[0], true);
    } else if (nextRhythm >= 4 && dt >= 420 && dt <= 940) {
      say(pickLine(LINES.rhythm, lineRef.current));
    } else if (patsRef.current % 3 === 0) {
      say(pickLine(poolFor(fondnessRef.current), lineRef.current));
    }

    try {
      const save: Save = {
        v: 1,
        fondness: fondnessRef.current,
        pats: patsRef.current,
        best: bestRef.current,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      /* private mode */
    }
  };

  function spawnHearts(count: number) {
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    if (!canvas || !figure || !motionRef.current) return;
    const rect = figure.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = rect.left - canvasRect.left + rect.width * 0.5;
    const y = rect.top - canvasRect.top + rect.height * 0.16;
    for (let i = 0; i < count; i += 1) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * rect.width * 0.2,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 28,
        vy: -40 - Math.random() * 50,
        life: 0,
        max: 0.9 + Math.random() * 0.45,
        kind: "heart",
        rot: 0,
        vr: 0,
        size: 8 + Math.random() * 6,
      });
    }
  }

  useEffect(() => {
    const stage = stageRef.current;
    const figure = figureRef.current;
    if (!stage || !figure) return;
    const fit = () => {
      const bounds = stage.getBoundingClientRect();
      const maxW = Math.min(bounds.width, 480);
      const maxH = bounds.height;
      let width = maxW;
      let height = width * 1.5;
      if (maxH > 0 && height > maxH) {
        height = maxH;
        width = height / 1.5;
      }
      if (width > 8) {
        figure.style.width = `${width}px`;
        figure.style.height = `${height}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      warmthRef.current = Math.max(0, warmthRef.current - dt * 0.28);
      ticklishRef.current = Math.max(0, ticklishRef.current - dt);
      squashRef.current = Math.max(0, squashRef.current - dt * 3.4);
      pressRef.current = Math.max(0, pressRef.current - dt * 4.2);
      if (startedRef.current) idleRef.current += dt;

      const nextFace = faceFor(warmthRef.current, ticklishRef.current, fondnessRef.current);
      if (nextFace !== faceRef.current) {
        faceRef.current = nextFace;
        setFace(nextFace);
      }
      if (startedRef.current && idleRef.current > 14) {
        idleRef.current = 0;
        const text = pickLine(LINES.idle, lineRef.current);
        lineRef.current = text;
        lastSayRef.current = performance.now();
        setLine(text);
      }

      const sprite = spriteRef.current;
      if (sprite) {
        const sway = motionRef.current ? Math.sin(now / 900) * 0.4 : 0;
        const bob = motionRef.current ? Math.sin(now / 700) * 3 : 0;
        const squash = squashRef.current;
        sprite.style.transform = `translateY(${bob + squash * 12}px) rotate(${sway}deg) scale(${1 - squash * 0.03}, ${1 + squash * 0.018})`;
      }

      const hand = handRef.current;
      const pointer = pointerRef.current;
      if (hand) {
        const show = startedRef.current && pointer.over && !pointer.ui && (fineRef.current || strokingRef.current);
        const dip = pressRef.current * 16;
        hand.style.opacity = show ? "1" : "0";
        hand.style.transform = `translate(${pointer.x}px, ${pointer.y + dip}px) translate(-50%, -42%) rotate(${pressRef.current * -8}deg) scale(${1 - pressRef.current * 0.06})`;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const parent = canvas.parentElement;
        if (parent) {
          const rect = parent.getBoundingClientRect();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = Math.max(1, Math.floor(rect.width * dpr));
          const h = Math.max(1, Math.floor(rect.height * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, rect.width, rect.height);
            if (motionRef.current && startedRef.current && Math.random() < dt * 1.4) {
              particlesRef.current.push({
                x: Math.random() * rect.width,
                y: -12,
                vx: -8 + Math.random() * 10,
                vy: 18 + Math.random() * 22,
                life: 0,
                max: 4 + Math.random() * 3,
                kind: "leaf",
                rot: Math.random() * 6,
                vr: (Math.random() - 0.5) * 1.4,
                size: 5 + Math.random() * 4,
              });
            }
            const next: Particle[] = [];
            for (const particle of particlesRef.current) {
              particle.life += dt;
              if (particle.life >= particle.max) continue;
              particle.x += particle.vx * dt;
              particle.y += particle.vy * dt;
              particle.rot += particle.vr * dt;
              if (particle.kind === "leaf") particle.vx += Math.sin(now / 400 + particle.y) * dt * 6;
              const alpha = 1 - particle.life / particle.max;
              ctx.globalAlpha = Math.max(0, alpha);
              ctx.fillStyle = particle.kind === "heart" ? "#a33b30" : "#c6a15b";
              if (particle.kind === "heart") drawHeart(ctx, particle.x, particle.y, particle.size);
              else drawLeaf(ctx, particle.x, particle.y, particle.size, particle.rot);
              next.push(particle);
            }
            ctx.globalAlpha = 1;
            particlesRef.current = next;
          }
        }
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      pointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        over: true,
        ui: Boolean(target?.closest("[data-ui]")),
      };
    };
    const leave = () => {
      pointerRef.current.over = false;
    };
    const up = () => {
      strokingRef.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointerleave", leave);
    };
  }, []);

  const mood = moodFor(fondness);
  const glow = 0.18 + fondness / 160;

  return (
    <main className="relative h-dvh overflow-hidden bg-ink">
      <img src={shrineUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="shrine-scrim pointer-events-none absolute inset-0" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />

      <div className="relative z-10 flex h-full flex-col">
        <header data-ui className="flex items-center gap-4 px-4 pt-4 pb-2">
          <div className="shrink-0">
            <p className="font-display text-sm tracking-widest text-gold">琥珀</p>
            <h1 className="font-display text-3xl leading-none text-balance text-paper">Kohaku</h1>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm text-paper">
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5 fill-vermillion text-vermillion" aria-hidden="true" />
                {started || fondness > 0 ? mood.label : "Waiting"}
              </span>
              <span className="tabular-nums" data-testid="fondness">
                {Math.floor(fondness)}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-paper/25"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(fondness)}
              aria-label="Fondness"
            >
              <div className="h-full rounded-full bg-vermillion" style={{ width: `${fondness}%` }} />
            </div>
          </div>
        </header>

        <div ref={stageRef} className="flex min-h-0 flex-1 items-end justify-center">
          <div ref={figureRef} className="kohaku-figure relative" style={{ cursor: pointerFine && started ? "none" : "auto" }}>
            <div className="kohaku-glow" style={{ opacity: glow }} />
            <div ref={spriteRef} className="absolute inset-0" style={{ transformOrigin: "50% 92%" }}>
              {FACES.map((item) => (
                <img
                  key={item.id}
                  src={item.src}
                  alt={item.id === face ? "Kohaku, a kitsune shrine maiden in white and vermillion robes" : ""}
                  aria-hidden={item.id !== face}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${item.id === face ? "opacity-100" : "opacity-0"}`}
                  draggable={false}
                />
              ))}
            </div>
            {hint && <div className="kohaku-ring" aria-hidden="true" />}
            <button
              type="button"
              className="kohaku-head"
              aria-label="Pat between Kohaku's ears"
              onPointerDown={(event) => {
                event.preventDefault();
                strokingRef.current = true;
                strokeRef.current = { x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
                patKindRef.current("head");
              }}
              onPointerMove={(event) => {
                if (!strokingRef.current) return;
                const dx = event.clientX - strokeRef.current.x;
                const dy = event.clientY - strokeRef.current.y;
                if (dx * dx + dy * dy > 46 * 46) {
                  strokeRef.current = { x: event.clientX, y: event.clientY };
                  patKindRef.current("head");
                }
              }}
              onPointerUp={() => {
                strokingRef.current = false;
              }}
              onClick={(event) => {
                if (event.detail === 0) patKindRef.current("head");
              }}
            />
            <div
              className="kohaku-body"
              onPointerDown={(event) => {
                event.preventDefault();
                patKindRef.current("miss");
              }}
            />
          </div>
        </div>

        <footer data-ui className="px-4 pt-2 pb-4">
          <div className="mx-auto w-full max-w-md rounded-3xl bg-paper px-4 py-3 text-ink shadow-lg">
            <p className="min-h-16 text-pretty text-base leading-snug" data-testid="line">
              {line}
            </p>
            {!started ? (
              <button
                type="button"
                className="mt-2 min-h-11 w-full rounded-full bg-ink px-5 py-3 font-display text-lg text-paper"
                onClick={() => begin()}
              >
                {fondness > 0 ? "Return to her" : "Approach the shrine"}
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-full bg-ink px-5 py-3 font-display text-lg text-paper"
                  onClick={() => patKindRef.current("button")}
                >
                  Pat her head
                </button>
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-paper"
                  aria-pressed={muted}
                  aria-label={muted ? "Unmute" : "Mute"}
                  onClick={() => {
                    const next = !muted;
                    setMutedState(next);
                    ensureAudio();
                    setMuted(next);
                  }}
                >
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-ink/70">
              <span className="tabular-nums">{pats} pats</span>
              <span className="inline-flex items-center gap-1" aria-label={`Cadence ${Math.min(5, rhythm)} of 5`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={`inline-block size-1.5 rounded-full ${index < Math.min(5, rhythm) ? "bg-vermillion" : "bg-ink/20"}`}
                  />
                ))}
              </span>
              <span className="tabular-nums">best {best}</span>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-md text-center text-xs text-paper/80">
            {hint ? "Pet the top of her head. A slow rhythm is kinder than mashing." : "Slow and steady. She can tell."}
          </p>
        </footer>
      </div>

      <img
        ref={handRef}
        src={handUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none fixed top-0 left-0 z-30 w-28 opacity-0 select-none"
      />
    </main>
  );
}
