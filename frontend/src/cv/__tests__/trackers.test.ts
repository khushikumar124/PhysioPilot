/**
 * Landmark -> joint angle -> repetition, end to end.
 *
 * Pose estimation itself is Google's pretrained BlazePose model and is not
 * re-tested here. What is tested is everything PhysioPilot owns: the angle
 * convention, side selection, degraded landmarks, and the handoff into the
 * repetition detector.
 */

import { describe, expect, it } from "vitest";
import { angleAt, LM, type Landmark } from "../landmarks";
import { checkFraming } from "../framing";
import { RepDetector } from "../repDetector";
import { getTracker, hipFlexionTracker, kneeFlexionTracker } from "../trackers";

/** Build a 33-point landmark array for a person lying side-on to the camera. */
function poseWithKneeBend(kneeFlexionDegrees: number, visibility = 0.9): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.1,
  }));

  const set = (index: number, x: number, y: number, v = visibility) => {
    landmarks[index] = { x, y, visibility: v };
  };

  // Torso, seen from the side.
  set(LM.leftShoulder, 0.30, 0.30);
  set(LM.rightShoulder, 0.30, 0.31);
  set(LM.leftHip, 0.40, 0.55);
  set(LM.rightHip, 0.40, 0.56);

  // Thigh runs horizontally from hip to knee.
  const knee = { x: 0.62, y: 0.55 };
  set(LM.leftKnee, knee.x, knee.y);
  set(LM.rightKnee, knee.x, knee.y + 0.01);

  // The shin rotates about the knee by the requested flexion angle.
  const shin = 0.22;
  const radians = (kneeFlexionDegrees * Math.PI) / 180;
  const ankle = {
    x: knee.x + shin * Math.cos(radians),
    // Image y grows downwards; flexion lifts the ankle towards the hip.
    y: knee.y - shin * Math.sin(radians),
  };
  set(LM.leftAnkle, ankle.x, ankle.y);
  set(LM.rightAnkle, ankle.x, ankle.y + 0.01);
  set(LM.leftFoot, ankle.x + 0.03, ankle.y);
  set(LM.rightFoot, ankle.x + 0.03, ankle.y + 0.01);

  return landmarks;
}

describe("angleAt", () => {
  it("measures a straight line as 180 degrees", () => {
    expect(
      angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ).toBeCloseTo(180, 5);
  });

  it("measures a right angle as 90 degrees", () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(90, 5);
  });

  it("returns 0 rather than NaN for coincident points", () => {
    expect(angleAt({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe("kneeFlexionTracker", () => {
  it("reads a straight leg as close to zero degrees of flexion", () => {
    const reading = kneeFlexionTracker.measure(poseWithKneeBend(0));
    expect(reading.angle).not.toBeNull();
    expect(reading.angle!).toBeLessThan(5);
  });

  it("reads a bent knee at roughly the true flexion angle", () => {
    for (const degrees of [30, 60, 90, 110]) {
      const reading = kneeFlexionTracker.measure(poseWithKneeBend(degrees));
      expect(reading.angle!).toBeGreaterThan(degrees - 6);
      expect(reading.angle!).toBeLessThan(degrees + 6);
    }
  });

  it("returns no measurement when the joint is not visible", () => {
    const reading = kneeFlexionTracker.measure(poseWithKneeBend(90, 0.15));
    expect(reading.angle).toBeNull();
    expect(reading.visibility).toBeLessThan(0.5);
  });

  it("returns no measurement when landmarks are missing entirely", () => {
    expect(kneeFlexionTracker.measure([]).angle).toBeNull();
    expect(kneeFlexionTracker.measure(Array.from({ length: 12 }, () => ({ x: 0, y: 0 }))).angle).toBeNull();
  });

  it("uses whichever side the camera can see", () => {
    const landmarks = poseWithKneeBend(90);
    // Hide the left leg entirely; the right leg must still be measured.
    [LM.leftHip, LM.leftKnee, LM.leftAnkle].forEach((index) => {
      landmarks[index] = { ...landmarks[index], visibility: 0.05 };
    });
    const reading = kneeFlexionTracker.measure(landmarks);
    expect(reading.side).toBe("right");
    expect(reading.angle!).toBeGreaterThan(80);
  });
});

describe("tracker registry", () => {
  it("resolves the trackers the catalogue refers to", () => {
    expect(getTracker("knee_flexion")).toBe(kneeFlexionTracker);
    expect(getTracker("hip_flexion")).toBe(hipFlexionTracker);
  });

  it("returns null for an exercise with no tracker", () => {
    expect(getTracker(null)).toBeNull();
    expect(getTracker("sit_to_stand")).toBeNull();
  });
});

describe("framing guidance", () => {
  it("asks the patient to step into view when nobody is there", () => {
    expect(checkFraming(null, kneeFlexionTracker).status).toBe("no_person");
    expect(checkFraming([], kneeFlexionTracker).ready).toBe(false);
  });

  it("reports ready for a well-framed person", () => {
    expect(checkFraming(poseWithKneeBend(20), kneeFlexionTracker).status).toBe("ready");
  });

  it("asks the patient to move back when a joint runs off the edge", () => {
    const landmarks = poseWithKneeBend(20);
    landmarks[LM.leftAnkle] = { x: 0.995, y: 0.5, visibility: 0.9 };
    landmarks[LM.rightAnkle] = { x: 0.995, y: 0.51, visibility: 0.9 };
    expect(checkFraming(landmarks, kneeFlexionTracker).status).toBe("too_close");
  });

  it("asks the patient to come closer when they fill too little of the frame", () => {
    const landmarks = poseWithKneeBend(20).map((landmark) => ({
      ...landmark,
      // Squash everyone into a small patch in the middle of the picture.
      x: 0.5 + (landmark.x - 0.5) * 0.15,
      y: 0.5 + (landmark.y - 0.5) * 0.15,
    }));
    expect(checkFraming(landmarks, kneeFlexionTracker).status).toBe("too_far");
  });

  it("gives every guidance message in plain language", () => {
    const messages = [
      checkFraming(null, kneeFlexionTracker).message,
      checkFraming(poseWithKneeBend(20), kneeFlexionTracker).message,
    ];
    messages.forEach((message) => {
      expect(message.length).toBeLessThan(80);
      expect(message).not.toMatch(/landmark|pose|confidence|bounding/i);
    });
  });
});

describe("landmarks through to repetition counting", () => {
  it("counts repetitions from a stream of poses", () => {
    const detector = new RepDetector({ targetRom: 90 });
    let t = 0;
    const feed = (degrees: number, frames: number) => {
      for (let i = 0; i < frames; i += 1) {
        const reading = kneeFlexionTracker.measure(poseWithKneeBend(degrees));
        detector.push({ t: (t += 33), angle: reading.angle, visibility: reading.visibility });
      }
    };

    feed(3, 20); // settle at rest
    for (let rep = 0; rep < 5; rep += 1) {
      for (let degrees = 5; degrees <= 95; degrees += 10) feed(degrees, 5);
      for (let degrees = 95; degrees >= 5; degrees -= 10) feed(degrees, 5);
    }

    expect(detector.reps).toHaveLength(5);
    expect(detector.reps[0].maxAngle).toBeGreaterThan(85);
    expect(detector.poseCoverage).toBe(1);
  });

  it("does not count repetitions while the patient is out of frame", () => {
    const detector = new RepDetector({ targetRom: 90 });
    let t = 0;
    for (let i = 0; i < 200; i += 1) {
      const reading = kneeFlexionTracker.measure(poseWithKneeBend(i % 2 ? 95 : 5, 0.1));
      detector.push({ t: (t += 33), angle: reading.angle, visibility: reading.visibility });
    }
    expect(detector.reps).toHaveLength(0);
    expect(detector.poseCoverage).toBe(0);
  });
});
