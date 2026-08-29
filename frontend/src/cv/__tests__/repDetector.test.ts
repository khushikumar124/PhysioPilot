/**
 * Repetition detection is tested against synthetic movement traces: a
 * sinusoidal joint angle sampled at a camera-like frame rate, plus the
 * degraded cases that happen in a living room.
 */

import { describe, expect, it } from "vitest";
import { RepDetector, type AngleSample } from "../repDetector";

const FPS = 30;

/** Build a trace of `reps` bends from `rest` degrees to `peak` degrees. */
function trace(options: {
  reps: number;
  peak: number;
  rest?: number;
  secondsPerRep?: number;
  visibility?: number;
  restSeconds?: number;
}): AngleSample[] {
  const { reps, peak, rest = 8, secondsPerRep = 3, visibility = 0.9, restSeconds = 1 } = options;
  const samples: AngleSample[] = [];
  let t = 0;
  const step = 1000 / FPS;

  const hold = (seconds: number, angle: number) => {
    for (let i = 0; i < seconds * FPS; i += 1) {
      samples.push({ t, angle, visibility });
      t += step;
    }
  };

  // Settle at rest first so the detector can calibrate a baseline.
  hold(restSeconds, rest);

  for (let r = 0; r < reps; r += 1) {
    const frames = Math.round(secondsPerRep * FPS);
    for (let i = 0; i < frames; i += 1) {
      const phase = (i / frames) * 2 * Math.PI;
      const angle = rest + ((peak - rest) * (1 - Math.cos(phase))) / 2;
      samples.push({ t, angle, visibility });
      t += step;
    }
    hold(0.4, rest);
  }
  return samples;
}

function run(samples: AngleSample[], targetRom = 90) {
  const detector = new RepDetector({ targetRom });
  samples.forEach((sample) => detector.push(sample));
  return detector;
}

describe("RepDetector", () => {
  it("counts a clean set of repetitions", () => {
    const detector = run(trace({ reps: 10, peak: 95 }));
    expect(detector.reps).toHaveLength(10);
  });

  it("records the peak angle of each repetition", () => {
    const detector = run(trace({ reps: 3, peak: 95 }));
    detector.reps.forEach((rep) => {
      expect(rep.maxAngle).toBeGreaterThan(90);
      expect(rep.maxAngle).toBeLessThanOrEqual(95.5);
    });
  });

  it("counts repetitions that stop well short of the target", () => {
    // Under-range repetitions must still be counted - judging them is the
    // server's job, and a patient who cannot reach the target still did work.
    const detector = run(trace({ reps: 6, peak: 48 }), 90);
    expect(detector.reps).toHaveLength(6);
    expect(detector.reps[0].maxAngle).toBeLessThan(50);
  });

  it("ignores movement that never leaves the resting position", () => {
    const detector = run(trace({ reps: 8, peak: 14 }), 90);
    expect(detector.reps).toHaveLength(0);
  });

  it("handles fast and slow movement at the same target", () => {
    expect(run(trace({ reps: 5, peak: 95, secondsPerRep: 1.2 })).reps).toHaveLength(5);
    expect(run(trace({ reps: 5, peak: 95, secondsPerRep: 7 })).reps).toHaveLength(5);
  });

  it("reports duration so the server can flag rushed repetitions", () => {
    const fast = run(trace({ reps: 3, peak: 95, secondsPerRep: 1.0 }));
    const slow = run(trace({ reps: 3, peak: 95, secondsPerRep: 5.0 }));
    expect(fast.reps[0].durationSeconds).toBeLessThan(slow.reps[0].durationSeconds);
  });

  it("calibrates a resting position that is not zero", () => {
    // A knee that rests at 25 degrees must not read as permanently flexed.
    const detector = run(trace({ reps: 5, peak: 100, rest: 25 }), 90);
    expect(detector.reps).toHaveLength(5);
  });

  it("does not double-count a pause at the threshold", () => {
    const samples = trace({ reps: 1, peak: 95 });
    // Insert a long hover right at the rise threshold, mid-set.
    const hover: AngleSample[] = [];
    const last = samples[samples.length - 1].t;
    for (let i = 0; i < 60; i += 1) {
      hover.push({ t: last + i * 33, angle: 40 + (i % 2), visibility: 0.9 });
    }
    const detector = new RepDetector({ targetRom: 90 });
    [...samples, ...hover].forEach((s) => detector.push(s));
    expect(detector.reps).toHaveLength(1);
  });

  it("survives frames with no pose and keeps counting afterwards", () => {
    const samples = trace({ reps: 4, peak: 95 });
    const dropped = samples.map((sample, index) =>
      index % 17 === 0 ? { ...sample, angle: null, visibility: 0 } : sample,
    );
    const detector = run(dropped);
    expect(detector.reps).toHaveLength(4);
    expect(detector.poseCoverage).toBeGreaterThan(0.9);
    expect(detector.poseCoverage).toBeLessThan(1);
  });

  it("discards a repetition when the person leaves the frame mid-movement", () => {
    const detector = new RepDetector({ targetRom: 90 });
    let t = 0;
    // Rest, then start bending...
    for (let i = 0; i < 40; i += 1) detector.push({ t: (t += 33), angle: 8, visibility: 0.9 });
    for (let i = 0; i < 20; i += 1) detector.push({ t: (t += 33), angle: 20 + i * 3, visibility: 0.9 });
    // ...then vanish for three seconds.
    for (let i = 0; i < 90; i += 1) detector.push({ t: (t += 33), angle: null, visibility: 0 });
    expect(detector.reps).toHaveLength(0);
    expect(detector.currentState).toBe("lost");

    // Coming back into frame must restore counting.
    for (let i = 0; i < 40; i += 1) detector.push({ t: (t += 33), angle: 8, visibility: 0.9 });
    trace({ reps: 2, peak: 95, restSeconds: 0 }).forEach((s) =>
      detector.push({ ...s, t: (t += 33) }),
    );
    expect(detector.reps.length).toBeGreaterThanOrEqual(2);
  });

  it("passes visibility through so unreliable repetitions can be excluded", () => {
    const detector = run(trace({ reps: 3, peak: 95, visibility: 0.3 }));
    detector.reps.forEach((rep) => expect(rep.meanVisibility).toBeLessThan(0.5));
  });

  it("reports no coverage when the pose is never usable", () => {
    const detector = new RepDetector({ targetRom: 90 });
    for (let i = 0; i < 100; i += 1) detector.push({ t: i * 33, angle: null, visibility: 0 });
    expect(detector.reps).toHaveLength(0);
    expect(detector.poseCoverage).toBe(0);
    expect(detector.smoothedAngle).toBeNull();
  });

  it("works for a small-range exercise such as a straight leg raise", () => {
    const detector = run(trace({ reps: 8, peak: 42, rest: 3 }), 35);
    expect(detector.reps).toHaveLength(8);
  });
});
