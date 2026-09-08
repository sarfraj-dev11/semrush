"use client";

import Image from "next/image";
import Link from "next/link";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, FolderKanban, Sparkles, Volume2, VolumeX } from "lucide-react";

export function RetroDino404() {
  const [isJumping, setIsJumping] = useState(false);
  const [legFrame, setLegFrame] = useState<0 | 1>(0);
  const [score, setScore] = useState(404);
  const [highScore, setHighScore] = useState(404);
  const [jumps, setJumps] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevMilestoneRef = useRef(Math.floor(404 / 100));

  // Load high score from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("retro_dino_highscore");
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val > 404) setHighScore(val);
      }
    } catch {
      // LocalStorage unavailable
    }
  }, []);


  // Initialize or retrieve Web Audio Context
  const getAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (err) {
      console.error("❌ AudioContext initialization error:", err);
      return null;
    }
  }, []);

  // 1. Play Retro 8-bit Jump Sound
  const playJumpSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (err) {
      console.error("❌ Jump sound playback error:", err);
    }
  }, [soundEnabled, getAudioContext]);

  // 2. Play Subtle Running Footstep Sound
  const playStepSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(180, ctx.currentTime);

      gain.gain.setValueAtTime(0.012, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    } catch (err) {
      console.error("❌ Footstep sound playback error:", err);
    }
  }, [soundEnabled, getAudioContext]);

  // 3. Play Landing Thud Sound
  const playLandSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (err) {
      console.error("❌ Landing sound playback error:", err);
    }
  }, [soundEnabled, getAudioContext]);

  // 4. Play Retro 100-Point Milestone Double Beep (Chrome Dino iconic chime)
  const playMilestoneSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Beep 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "square";
      osc1.frequency.setValueAtTime(820, now);
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Beep 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1060, now + 0.09);
      gain2.gain.setValueAtTime(0.05, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.18);
    } catch (err) {
      console.error("❌ Milestone sound playback error:", err);
    }
  }, [soundEnabled, getAudioContext]);

  // Dino Running Legs Animation (alternates legs every 130ms while on the ground)
  useEffect(() => {
    if (isJumping) return;

    const legInterval = setInterval(() => {
      setLegFrame((f) => (f === 0 ? 1 : 0));
      playStepSound();
    }, 130);

    return () => clearInterval(legInterval);
  }, [isJumping, playStepSound]);

  // Jump Action (Dino leaps off ground, lands back down)
  const triggerJump = useCallback(() => {
    if (isJumping) return;
    setIsJumping(true);
    setJumps((j) => j + 1);
    setScore((s) => s + 35);
    playJumpSound();

    setTimeout(() => {
      setIsJumping(false);
      playLandSound();
    }, 500);
  }, [isJumping, playJumpSound, playLandSound]);

  // Continuous Score Ticker & Milestone Chime Detection
  useEffect(() => {
    const timer = setInterval(() => {
      setScore((prevScore) => {
        const nextScore = prevScore + 1;
        const currentMilestone = Math.floor(nextScore / 100);
        if (currentMilestone > prevMilestoneRef.current) {
          prevMilestoneRef.current = currentMilestone;
          playMilestoneSound();
        }

        setHighScore((prevHigh) => {
          if (nextScore > prevHigh) {
            try {
              localStorage.setItem("retro_dino_highscore", String(nextScore));
            } catch {
              // LocalStorage unavailable
            }
            return nextScore;
          }
          return prevHigh;
        });


        return nextScore;
      });
    }, 200);

    return () => clearInterval(timer);
  }, [playMilestoneSound]);

  // Spacebar or Up arrow to jump
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        triggerJump();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerJump]);

  return (
    <div className="flex flex-col items-center justify-center select-none w-full max-w-xl mx-auto px-4 py-6">
      {/* 8-bit Retro HUD Bar */}
      <div className="w-full flex items-center justify-between font-mono text-[11px] sm:text-[12px] font-bold tracking-widest text-zinc-500 dark:text-zinc-400 mb-4 px-2">
        <div className="flex items-center gap-3">
          <span className="text-red-500 font-extrabold flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500 animate-ping inline-block" />
            <span>404</span>
          </span>
          {highScore > 0 && (
            <span className="text-zinc-400">HI {String(highScore).padStart(5, "0")}</span>
          )}
          <span>SCORE {String(score).padStart(5, "0")}</span>
          {jumps > 0 && (
            <span className="hidden sm:inline-block text-zinc-400">JUMPS {jumps}</span>
          )}
        </div>


        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={triggerJump}
            className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase text-zinc-500 dark:text-zinc-400 hover:text-foreground tracking-wider bg-surface-muted hover:bg-surface border border-border/80 px-2.5 py-0.5 rounded-sm transition-colors cursor-pointer"
          >
            <Sparkles className="size-3 text-amber-500" />
            <span>Space / Click to Jump</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const nextVal = !soundEnabled;
              setSoundEnabled(nextVal);
              if (nextVal) {
                getAudioContext();
              }
            }}
            className="p-1.5 text-zinc-400 hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-surface-muted"
            title={soundEnabled ? "Mute 8-bit audio" : "Enable 8-bit sound effects"}
            aria-label="Toggle retro sound"
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-emerald-500" />
            ) : (
              <VolumeX className="size-4 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {/* Main Interactive Retro Stage (800x600 coordinate ratio) */}
      <div
        onClick={triggerJump}
        className="relative w-full aspect-[800/600] max-w-[520px] mx-auto cursor-pointer group flex items-center justify-center overflow-hidden"
        title="Click or press Space to jump!"
      >
        {/* Animated Pixel Meteor Streaks in the Sky */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="pixel-meteor meteor-1" />
          <div className="pixel-meteor meteor-2" />
          <div className="pixel-meteor meteor-3" />
        </div>

        {/* Ambient Neon Atmosphere in Background */}
        <div className="absolute inset-0 pointer-events-none bg-radial from-red-500/8 via-transparent to-transparent opacity-60 dark:opacity-90" />

        {/* Static Retro Scene: Red 404, Sky Meteors, Page Not Found */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Light Theme Background */}
          <Image
            src="/404-bg-light.png"
            alt="404 Page Not Found"
            fill
            sizes="(max-width: 600px) 100vw, 520px"
            priority
            className="object-contain dark:hidden"
            style={{ imageRendering: "pixelated" }}
          />

          {/* Dark Theme Background with Neon Drop Shadow */}
          <Image
            src="/404-bg-dark.png"
            alt="404 Page Not Found"
            fill
            sizes="(max-width: 600px) 100vw, 520px"
            priority
            className="object-contain hidden dark:block drop-shadow-[0_0_18px_rgba(239,68,68,0.22)]"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Scrolling Ground Track: Ground dashes continuously move to the left */}
        <div
          className="absolute pointer-events-none z-20 overflow-hidden"
          style={{
            top: "58.67%",
            left: "26%",
            width: "48%",
            height: "5.67%",
          }}
        >
          <div className="flex w-[200%] h-full animate-ground-run">
            {/* Dark Theme Ground Track */}
            <div className="hidden dark:flex w-full h-full">
              <div className="relative w-1/2 h-full">
                <Image
                  src="/404-ground-track-dark.png"
                  alt="ground"
                  fill
                  sizes="260px"
                  priority
                  className="object-fill"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="relative w-1/2 h-full">
                <Image
                  src="/404-ground-track-dark.png"
                  alt="ground"
                  fill
                  sizes="260px"
                  priority
                  className="object-fill"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            </div>

            {/* Light Theme Ground Track */}
            <div className="flex dark:hidden w-full h-full">
              <div className="relative w-1/2 h-full">
                <Image
                  src="/404-ground-track-light.png"
                  alt="ground"
                  fill
                  sizes="260px"
                  priority
                  className="object-fill"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="relative w-1/2 h-full">
                <Image
                  src="/404-ground-track-light.png"
                  alt="ground"
                  fill
                  sizes="260px"
                  priority
                  className="object-fill"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            </div>
          </div>
        </div>


        {/* The Animated Dinosaur: Firmly Grounded, Legs Running, Jumps Up On Action */}
        <div
          className={`absolute pointer-events-none z-30 transition-transform ${
            isJumping ? "animate-dino-leap" : ""
          }`}
          style={{
            left: "40.125%",
            top: "35.833%",
            width: "17.5%",
            height: "23.333%",
          }}
        >
          <div className="relative w-full h-full">
            {/* Dark Mode Dinosaur Sprites */}
            <div className="hidden dark:block relative w-full h-full">
              {isJumping ? (
                <Image
                  src="/dino-dark-jump.png"
                  alt="Jumping Dino"
                  fill
                  sizes="140px"
                  priority
                  className="object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : legFrame === 0 ? (
                <Image
                  src="/dino-dark-run1.png"
                  alt="Running Dino Frame 1"
                  fill
                  sizes="140px"
                  priority
                  className="object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <Image
                  src="/dino-dark-run2.png"
                  alt="Running Dino Frame 2"
                  fill
                  sizes="140px"
                  priority
                  className="object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
            </div>

            {/* Light Mode Dinosaur Sprites */}
            <div className="block dark:hidden relative w-full h-full">
              {isJumping ? (
                <Image
                  src="/dino-light-jump.png"
                  alt="Jumping Dino"
                  fill
                  sizes="140px"
                  priority
                  className="object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : legFrame === 0 ? (
                <Image
                  src="/dino-light-run1.png"
                  alt="Running Dino Frame 1"
                  fill
                  sizes="140px"
                  priority
                  className="object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <Image
                  src="/dino-light-run2.png"
                  alt="Running Dino Frame 2"
                  fill
                  sizes="140px"
                  priority
                  className="object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Retro Navigation Links */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[14px]">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 font-semibold text-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors px-4 py-2 rounded-xl hover:bg-surface-muted border border-transparent hover:border-border/80 shadow-2xs"
        >
          <span>Go to home</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>

        <span className="text-border-strong select-none">·</span>

        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-surface-muted"
        >
          <FolderKanban className="size-3.5" />
          <span>Projects</span>
        </Link>

        <span className="text-border-strong select-none">·</span>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-surface-muted cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Go back</span>
        </button>
      </div>

      {/* Embedded CSS for Authentic 8-bit Dino & Ground Animations */}
      <style jsx global>{`
        /* Ground Scrolling Track: Dashes continuously drift left */
        @keyframes ground-runner {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-ground-run {
          animation: ground-runner 1.2s linear infinite;
        }

        /* Dino Jump: Leaps off ground, pauses at peak, lands cleanly on ground */
        @keyframes dino-leap {
          0% {
            transform: translateY(0px);
          }
          20% {
            transform: translateY(-25px);
          }
          45% {
            transform: translateY(-48px);
          }
          65% {
            transform: translateY(-44px);
          }
          85% {
            transform: translateY(-14px);
          }
          100% {
            transform: translateY(0px);
          }
        }
        .animate-dino-leap {
          animation: dino-leap 0.5s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
        }

        /* Falling Pixel Meteor Streaks in the Sky */
        @keyframes meteor-streak {
          0% {
            transform: translate(-30px, -30px) scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translate(30px, 20px) scale(1);
          }
          80% {
            opacity: 0.8;
            transform: translate(200px, 140px) scale(0.8);
          }
          100% {
            transform: translate(300px, 210px) scale(0);
            opacity: 0;
          }
        }

        .pixel-meteor {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #ef4444;
          box-shadow: -2px -2px 0 #ef4444, -4px -4px 0 #ef4444, -8px -8px 0 rgba(239,68,68,0.4);
          opacity: 0;
        }
        .meteor-1 {
          top: 10%;
          left: 15%;
          animation: meteor-streak 4s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        .meteor-2 {
          top: 18%;
          left: 25%;
          animation: meteor-streak 5.2s cubic-bezier(0.25, 1, 0.5, 1) infinite 2.2s;
        }
        .meteor-3 {
          top: 5%;
          left: 40%;
          animation: meteor-streak 6s cubic-bezier(0.25, 1, 0.5, 1) infinite 3.8s;
        }
      `}</style>
    </div>
  );
}
