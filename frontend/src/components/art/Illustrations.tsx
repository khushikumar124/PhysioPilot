/**
 * Line illustrations.
 *
 * Drawn rather than borrowed: an open stroke style with rounded caps, a little
 * off-perfect so the screens feel made by a person. They carry information the
 * text cannot - where to put the phone, what the camera needs to see - which
 * is why they earn their space. Everything inherits `currentColor`, so they
 * work in both themes without a second asset.
 */

export function PositioningGuide({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 150"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="A person seated side-on to a phone propped up about two metres away, with the whole leg inside the camera view."
    >
      {/* floor */}
      <path d="M18 128h224" strokeOpacity="0.3" />

      {/* phone on a stand, with the camera's view fanning out towards the leg */}
      <rect x="30" y="84" width="22" height="38" rx="4" />
      <path d="M36 90h10" strokeOpacity="0.45" />
      <path d="M41 122v6M32 128h18" />
      <path d="M54 96 122 66M54 112l68 26" strokeDasharray="5 5" strokeOpacity="0.4" />

      {/* chair, drawn first so the figure sits in front of it */}
      <g strokeOpacity="0.5">
        <path d="M150 96h46" />
        <path d="M196 96V54" />
        <path d="M156 96v30M192 96v30" />
      </g>

      {/* seated figure, facing the phone */}
      <circle cx="172" cy="46" r="12" />
      <path d="M170 58c-6 10-9 21-10 32" />
      <path d="M167 70c-8 4-13 10-15 17" strokeOpacity="0.75" />
      <path d="M160 90h-46" />
      <path d="M114 90v30" />
      <path d="M114 122h-16" />

      {/* the movement itself: the lower leg swinging up */}
      <path d="M114 90c14 2 24 10 27 22" strokeDasharray="3 5" strokeOpacity="0.65" />
    </svg>
  );
}

export function EmptyRoutine({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="An empty clipboard."
    >
      <path d="M50 22h80a6 6 0 0 1 6 6v72a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6Z" />
      <path d="M72 22a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v6H72Z" />
      <path d="M62 52h56M62 68h40M62 84h24" strokeOpacity="0.4" />
    </svg>
  );
}

export function SessionDone({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Session complete."
    >
      {/* deliberately not a perfect circle - drawn, not generated */}
      <path d="M60 12c26 0 48 21 48 47s-22 48-48 48S12 85 12 59 34 12 60 12Z" strokeOpacity="0.35" />
      <path d="M40 60.5 54 74l27-28" />
      <path d="M96 26l4-8M104 36l8-3M86 18l1-8" strokeOpacity="0.5" strokeWidth="1.8" />
    </svg>
  );
}

export function NoPatients({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="No patients yet."
    >
      <circle cx="72" cy="46" r="16" />
      <path d="M44 96c0-15 12.5-24 28-24s28 9 28 24" />
      <path d="M112 52a13 13 0 0 0 0-24" strokeOpacity="0.45" />
      <path d="M118 74c11 3 18 11 18 22" strokeOpacity="0.45" />
      <path d="M136 32h18M145 23v18" strokeOpacity="0.7" />
    </svg>
  );
}
