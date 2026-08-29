/**
 * Repetition detection.
 *
 * Input: a stream of (timestamp, flexion angle, visibility) samples.
 * Output: completed repetitions with the features the server's movement
 * quality layer expects.
 *
 * The detector is a hysteresis state machine over a smoothed angle signal:
 *
 *   rest ──angle > riseThreshold──▶ moving ──angle < fallThreshold──▶ rest
 *                                     │                                 │
 *                                     └────── tracks peak, duration ─────┘
 *
 * Two thresholds (rather than one) stop a patient who pauses near the
 * threshold from producing a burst of phantom repetitions. Everything is
 * expressed as a fraction of the prescribed target range, so the detector
 * works for a 35-degree leg raise and a 100-degree knee bend alike.
 *
 * This module is deliberately free of DOM and MediaPipe imports so that it can
 * be unit-tested against synthetic movement traces.
 */

export interface AngleSample {
  /** Milliseconds. */
  t: number;
  /** Flexion angle in degrees, or null when the pose was not usable. */
  angle: number | null;
  visibility: number;
}

export interface DetectedRep {
  index: number;
  minAngle: number;
  maxAngle: number;
  durationSeconds: number;
  peakVelocity: number;
  meanVisibility: number;
}

export interface DetectorOptions {
  /** Prescribed range in degrees; thresholds are derived from it. */
  targetRom: number;
  /** Fraction of the target that starts a repetition. */
  riseFraction?: number;
  /** Fraction of the target that ends it. */
  fallFraction?: number;
  /** Samples shorter than this are treated as jitter, not a repetition. */
  minRepSeconds?: number;
  /** Samples in the smoothing window. */
  smoothingWindow?: number;
  /** How long tracking may be lost mid-repetition before it is discarded. */
  maxDropoutSeconds?: number;
}

export type DetectorState = "calibrating" | "rest" | "moving" | "lost";

const DEFAULTS = {
  riseFraction: 0.35,
  fallFraction: 0.15,
  minRepSeconds: 0.35,
  smoothingWindow: 5,
  maxDropoutSeconds: 1.5,
};

/** Median filter: rejects single-frame landmark spikes without lag-smearing peaks. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class RepDetector {
  private readonly options: Required<DetectorOptions>;
  private window: number[] = [];
  private state: DetectorState = "calibrating";
  private baseline: number | null = null;
  private calibrationSamples: number[] = [];

  private repStartT = 0;
  private repMin = 0;
  private repMax = 0;
  private repVisibilities: number[] = [];
  private repPeakVelocity = 0;
  private lastSample: { t: number; angle: number } | null = null;
  private lastGoodT: number | null = null;

  private repsDetected: DetectedRep[] = [];
  private usableFrames = 0;
  private totalFrames = 0;

  constructor(options: DetectorOptions) {
    this.options = { ...DEFAULTS, ...options };
  }

  get reps(): DetectedRep[] {
    return this.repsDetected;
  }

  get currentState(): DetectorState {
    return this.state;
  }

  /** Fraction of frames in which the joint could actually be measured. */
  get poseCoverage(): number {
    return this.totalFrames === 0 ? 0 : this.usableFrames / this.totalFrames;
  }

  /** Smoothed angle of the most recent usable frame, for the live display. */
  get smoothedAngle(): number | null {
    return this.window.length ? median(this.window) : null;
  }

  /** Peak angle reached in the repetition currently under way. */
  get liveMax(): number | null {
    return this.state === "moving" ? this.repMax : null;
  }

  private get riseThreshold(): number {
    return (this.baseline ?? 0) + this.options.targetRom * this.options.riseFraction;
  }

  private get fallThreshold(): number {
    return (this.baseline ?? 0) + this.options.targetRom * this.options.fallFraction;
  }

  /**
   * Feed one frame. Returns a repetition if this frame completed one.
   *
   * A frame with `angle === null` means the pose was not usable (person out of
   * frame, occlusion, poor light). Those frames never produce a repetition and
   * never corrupt one: if tracking is lost for too long mid-movement, the
   * in-flight repetition is discarded rather than guessed at.
   */
  push(sample: AngleSample): DetectedRep | null {
    this.totalFrames += 1;

    if (sample.angle === null || !Number.isFinite(sample.angle)) {
      if (
        this.state === "moving" &&
        this.lastGoodT !== null &&
        (sample.t - this.lastGoodT) / 1000 > this.options.maxDropoutSeconds
      ) {
        // Too long without a measurement: throw away the partial repetition.
        this.state = "lost";
        this.resetRep();
      } else if (this.state !== "moving") {
        this.state = this.baseline === null ? "calibrating" : "lost";
      }
      this.lastSample = null;
      return null;
    }

    this.usableFrames += 1;
    this.lastGoodT = sample.t;

    this.window.push(sample.angle);
    if (this.window.length > this.options.smoothingWindow) this.window.shift();
    const angle = median(this.window);

    // Calibrate the resting position from the first stable moment. Patients do
    // not start from a textbook zero: a knee at rest may sit at 8-15 degrees.
    if (this.baseline === null) {
      this.calibrationSamples.push(angle);
      if (this.calibrationSamples.length >= this.options.smoothingWindow * 2) {
        this.baseline = median(this.calibrationSamples);
        this.state = "rest";
      }
      this.lastSample = { t: sample.t, angle };
      return null;
    }

    let velocity = 0;
    if (this.lastSample) {
      const dt = (sample.t - this.lastSample.t) / 1000;
      if (dt > 0) velocity = Math.abs(angle - this.lastSample.angle) / dt;
    }
    this.lastSample = { t: sample.t, angle };

    if (this.state === "rest" || this.state === "lost") {
      // Track the resting position slowly, so a patient who settles into a
      // different position does not lose the ability to trigger repetitions.
      if (angle < (this.baseline ?? angle)) {
        this.baseline = this.baseline === null ? angle : this.baseline * 0.9 + angle * 0.1;
      }
      if (angle >= this.riseThreshold) {
        this.state = "moving";
        this.repStartT = sample.t;
        this.repMin = angle;
        this.repMax = angle;
        this.repVisibilities = [sample.visibility];
        this.repPeakVelocity = velocity;
      }
      return null;
    }

    // state === "moving"
    this.repMax = Math.max(this.repMax, angle);
    this.repMin = Math.min(this.repMin, angle);
    this.repVisibilities.push(sample.visibility);
    this.repPeakVelocity = Math.max(this.repPeakVelocity, velocity);

    if (angle <= this.fallThreshold) {
      const durationSeconds = (sample.t - this.repStartT) / 1000;
      const rep: DetectedRep = {
        index: this.repsDetected.length,
        minAngle: Math.round(this.repMin * 10) / 10,
        maxAngle: Math.round(this.repMax * 10) / 10,
        durationSeconds: Math.round(durationSeconds * 100) / 100,
        peakVelocity: Math.round(this.repPeakVelocity * 10) / 10,
        meanVisibility:
          Math.round(
            (this.repVisibilities.reduce((a, b) => a + b, 0) /
              Math.max(1, this.repVisibilities.length)) *
              100,
          ) / 100,
      };
      this.state = "rest";
      this.resetRep();

      if (durationSeconds < this.options.minRepSeconds) {
        // Too brief to be a movement: almost certainly landmark jitter.
        return null;
      }
      this.repsDetected.push(rep);
      return rep;
    }

    return null;
  }

  private resetRep(): void {
    this.repMin = 0;
    this.repMax = 0;
    this.repVisibilities = [];
    this.repPeakVelocity = 0;
  }
}
