/**
 * A short looping demonstration of the movement.
 *
 * Written instructions are hard work for someone who is unsure, in pain, or
 * not reading in their first language. A four-second loop answers "what am I
 * meant to do?" before the camera ever opens.
 *
 * Drawn as animated SVG so it is a few kilobytes rather than a video file,
 * scales to any screen, and follows the theme. Motion is driven by CSS so it
 * can be switched off for anyone who has asked for reduced motion - they get
 * the mid-movement pose held still, which is still a useful picture.
 *
 * Only the built-in exercises have a demonstration. A therapist's own written
 * exercise has none, and the UI simply omits it rather than showing something
 * generic and wrong.
 */

import type { ReactElement } from "react";

type DemoName = "knee_flexion" | "heel_slide" | "straight_leg_raise";

const DEMO_BY_SLUG: Record<string, DemoName> = {
  knee_flexion: "knee_flexion",
  heel_slide: "heel_slide",
  straight_leg_raise: "straight_leg_raise",
  // Seated knee straightening is the same limb path as knee flexion, reversed;
  // the loop reads correctly for both.
  knee_extension: "knee_flexion",
};

export function hasDemo(slug: string): boolean {
  return slug in DEMO_BY_SLUG;
}

const FIGURE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Seated knee bend: the lower leg swings back under the chair and returns. */
function KneeFlexionDemo() {
  return (
    <svg viewBox="0 0 220 150" className="w-full" role="img" aria-label="A seated person slowly bending the knee and straightening it again.">
      <style>{`
        @keyframes pp-knee { 0%,12% { transform: rotate(0deg); } 50%,62% { transform: rotate(-62deg); } 100% { transform: rotate(0deg); } }
        .pp-knee-leg { transform-origin: 96px 92px; animation: pp-knee 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pp-knee-leg { animation: none; transform: rotate(-32deg); }
        }
      `}</style>
      <g {...FIGURE}>
        <path d="M20 132h180" strokeOpacity="0.3" />
        {/* chair */}
        <g strokeOpacity="0.45">
          <path d="M96 92h52M148 92V46M104 92v38M144 92v38" />
        </g>
        {/* trunk, head, thigh */}
        <circle cx="126" cy="38" r="12" />
        <path d="M124 50c-5 9-8 21-9 32" />
        <path d="M115 92H96" />
        {/* the moving lower leg */}
        <g className="pp-knee-leg">
          <path d="M96 92v34" />
          <path d="M96 126h-15" />
        </g>
      </g>
    </svg>
  );
}

/** Heel slide: lying down, the heel draws up towards the body and back. */
function HeelSlideDemo() {
  return (
    <svg viewBox="0 0 220 150" className="w-full" role="img" aria-label="A person lying down, sliding the heel up towards the body and back down again.">
      <style>{`
        @keyframes pp-heel { 0%,12% { transform: translateX(0); } 50%,62% { transform: translateX(-34px); } 100% { transform: translateX(0); } }
        @keyframes pp-knee-rise { 0%,12% { transform: translateY(0); } 50%,62% { transform: translateY(-26px); } 100% { transform: translateY(0); } }
        .pp-heel-foot { animation: pp-heel 4s ease-in-out infinite; }
        .pp-heel-knee { animation: pp-knee-rise 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pp-heel-foot { animation: none; transform: translateX(-18px); }
          .pp-heel-knee { animation: none; transform: translateY(-14px); }
        }
      `}</style>
      <g {...FIGURE}>
        <path d="M14 122h192" strokeOpacity="0.3" />
        {/* head and trunk, lying flat */}
        <circle cx="42" cy="102" r="12" />
        <path d="M54 104h48" />
        {/* the leg: hip stays, knee lifts, heel slides in */}
        <g className="pp-heel-knee">
          <circle cx="132" cy="98" r="2.5" fill="currentColor" stroke="none" />
        </g>
        <path className="pp-heel-knee" d="M102 104l30-6" />
        <path className="pp-heel-foot pp-heel-knee" d="M132 98l32 16" strokeOpacity="0.999" />
        <g className="pp-heel-foot">
          <path d="M164 114h-12" strokeOpacity="0.6" />
        </g>
      </g>
    </svg>
  );
}

/** Straight leg raise: the whole leg lifts, knee locked, then lowers. */
function StraightLegRaiseDemo() {
  return (
    <svg viewBox="0 0 220 150" className="w-full" role="img" aria-label="A person lying down, lifting one straight leg upwards and lowering it slowly.">
      <style>{`
        @keyframes pp-slr { 0%,12% { transform: rotate(0deg); } 50%,62% { transform: rotate(-42deg); } 100% { transform: rotate(0deg); } }
        .pp-slr-leg { transform-origin: 104px 106px; animation: pp-slr 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pp-slr-leg { animation: none; transform: rotate(-24deg); }
        }
      `}</style>
      <g {...FIGURE}>
        <path d="M14 124h192" strokeOpacity="0.3" />
        <circle cx="44" cy="104" r="12" />
        <path d="M56 106h48" />
        {/* resting leg */}
        <path d="M104 106h62" strokeOpacity="0.35" />
        <path d="M166 106v-9" strokeOpacity="0.35" />
        {/* lifting leg, knee kept straight */}
        <g className="pp-slr-leg">
          <path d="M104 106h62" />
          <path d="M166 106l6-8" />
        </g>
      </g>
    </svg>
  );
}

const COMPONENTS: Record<DemoName, () => ReactElement> = {
  knee_flexion: KneeFlexionDemo,
  heel_slide: HeelSlideDemo,
  straight_leg_raise: StraightLegRaiseDemo,
};

export function ExerciseDemo({ slug, className = "" }: { slug: string; className?: string }) {
  const name = DEMO_BY_SLUG[slug];
  if (!name) return null;
  const Demo = COMPONENTS[name];
  return (
    <div className={`text-text ${className}`}>
      <Demo />
    </div>
  );
}
