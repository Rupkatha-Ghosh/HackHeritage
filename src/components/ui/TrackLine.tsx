import React, { useLayoutEffect, useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { animate, stagger, withMotion } from "../../lib/anime";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { cn } from "../../lib/cn";

export interface TrackStep {
  /** The agent's name in the pipeline, exactly as the API reports it. */
  agent: string;
  title: string;
  /** What this stage does, in the operator's language. */
  role: string;
  /** What it hands to the next stage. */
  emits: string;
  /** Marks stages that can degrade without stopping the run. */
  fallback?: string;
}

interface TrackLineProps {
  steps: TrackStep[];
  className?: string;
}

/**
 * The nine-agent pipeline drawn as a survey track line: a vessel's plotted
 * course with a numbered fix at each observation. The bright overlay advances
 * with scroll, so reading the section runs the pipeline.
 */
export const TrackLine: React.FC<TrackLineProps> = ({ steps, className }) => {
  const rootRef = useRef<HTMLOListElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start 72%", "end 55%"],
  });
  const smooth = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });
  const runHeight = useTransform(smooth, (v) => `${Math.max(0, v) * 100}%`);

  // Fix marks are struck onto the chart in sequence, as a surveyor would plot
  // them. Layout effect, because the marks start hidden under `motion-safe`.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const marks = root.querySelectorAll<HTMLElement>("[data-fix]");

    return withMotion(
      () =>
        animate(marks, {
          scale: [0.2, 1],
          rotate: [0, 45],
          opacity: [0, 1],
          duration: 720,
          delay: stagger(95, { start: 220 }),
          ease: "out(3)",
        }),
      () => {
        marks.forEach((mark) => {
          mark.style.opacity = "1";
          mark.style.transform = "rotate(45deg)";
        });
      },
    );
  }, []);

  return (
    /* The rail sits outside the `<ol>`: a list may only contain `<li>`, and a
       stray `<div>` there is invalid markup that assistive tech may drop. */
    <div className={cn("relative", className)}>
      {/* Plotted course: a dashed base track with the run drawn over it. */}
      <div
        aria-hidden="true"
        className="absolute bottom-6 left-[13px] top-3 w-px sm:left-[17px]"
      >
        <div className="absolute inset-0 border-l border-dashed border-shoal/25" />
        <motion.div
          className="absolute inset-x-0 top-0 w-px bg-gradient-to-b from-shoal via-shoal to-buoy"
          style={reduced ? { height: "100%" } : { height: runHeight }}
        />
      </div>

      <ol ref={rootRef} className="relative">
      {steps.map((step, index) => (
        <li key={step.agent} className="relative flex gap-5 pb-9 sm:gap-7">
          {/* Fix mark: a diamond, the chart symbol for an observed position. */}
          <div className="relative z-10 shrink-0 pt-1">
            <span
              data-fix=""
              className="block h-[9px] w-[9px] border border-shoal bg-abyssal motion-safe:opacity-0 sm:h-[11px] sm:w-[11px]"
            />
          </div>

          <div className="min-w-0 flex-1 pt-px">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[10px] tabular-nums text-buoy">
                FIX {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-lg font-semibold leading-tight text-chartpaper sm:text-xl">
                {step.title}
              </h3>
            </div>

            <p className="mt-1 font-mono text-[10px] tracking-[0.16em] text-shoal/60">
              {step.agent}
            </p>

            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-slate-300">
              {step.role}
            </p>

            <div className="mt-3.5 flex flex-col gap-1.5 border-l border-shoal/15 pl-3.5 text-[12px] sm:flex-row sm:items-center sm:gap-5">
              <span className="text-fathom">
                <span className="plate-label mr-2">Hands on</span>
                <span className="hydrographic text-slate-300">{step.emits}</span>
              </span>
              {step.fallback && (
                <span className="text-fathom">
                  <span className="plate-label mr-2 text-amber-400/80">
                    If unavailable
                  </span>
                  <span className="hydrographic text-amber-200/80">
                    {step.fallback}
                  </span>
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
      </ol>
    </div>
  );
};
