"""The prescribable exercise catalogue.

`cv_supported` is true only where a real client-side tracker exists. Knee
flexion is the fully implemented tracker for this prototype; heel slide and
straight leg raise reuse the same hip/knee angle pipeline with their own
targets. The remaining entries are prescribable and self-reported, and the UI
says so plainly rather than implying tracking that does not exist.
"""

EXERCISES = [
    {
        "slug": "knee_flexion",
        "name": "Knee Flexion",
        "description": (
            "Seated or lying knee bend. Measures the angle between hip, knee and "
            "ankle to record how far the knee bends."
        ),
        "patient_cue": "Slowly bend your knee as far as is comfortable, then straighten it again.",
        "body_region": "knee",
        "difficulty": "easy",
        "cv_supported": True,
        "tracker_key": "knee_flexion",
        "primary_metric": "knee_flexion_rom",
        "default_target_rom": 90.0,
    },
    {
        "slug": "heel_slide",
        "name": "Heel Slide",
        "description": (
            "Lying on the back, slide the heel towards the buttock. Tracked with "
            "the same knee-angle measurement as knee flexion."
        ),
        "patient_cue": "Slide your heel slowly towards you, then slide it back down.",
        "body_region": "knee",
        "difficulty": "easy",
        "cv_supported": True,
        "tracker_key": "knee_flexion",
        "primary_metric": "knee_flexion_rom",
        "default_target_rom": 75.0,
    },
    {
        "slug": "straight_leg_raise",
        "name": "Straight Leg Raise",
        "description": (
            "Lying down, lift the straight leg. Measures the hip angle between "
            "shoulder, hip and knee."
        ),
        "patient_cue": "Keep your leg straight and lift it slowly, then lower it down.",
        "body_region": "hip",
        "difficulty": "easy",
        "cv_supported": True,
        "tracker_key": "hip_flexion",
        "primary_metric": "hip_flexion_rom",
        "default_target_rom": 45.0,
    },
    {
        "slug": "knee_extension",
        "name": "Knee Extension",
        "description": "Seated straightening of the knee against gravity.",
        "patient_cue": "Straighten your knee out in front of you, hold, then lower slowly.",
        "body_region": "knee",
        "difficulty": "easy",
        "cv_supported": False,
        "tracker_key": None,
        "primary_metric": None,
        "default_target_rom": None,
    },
    {
        "slug": "sit_to_stand",
        "name": "Sit to Stand",
        "description": "Standing up from a chair and sitting back down under control.",
        "patient_cue": "Stand up from the chair slowly, then sit back down slowly.",
        "body_region": "knee",
        "difficulty": "moderate",
        "cv_supported": False,
        "tracker_key": None,
        "primary_metric": None,
        "default_target_rom": None,
    },
    {
        "slug": "shoulder_flexion",
        "name": "Shoulder Flexion",
        "description": "Raising the arm forward and upward.",
        "patient_cue": "Raise your arm forward and up as far as is comfortable, then lower it.",
        "body_region": "shoulder",
        "difficulty": "easy",
        "cv_supported": False,
        "tracker_key": None,
        "primary_metric": None,
        "default_target_rom": None,
    },
]
