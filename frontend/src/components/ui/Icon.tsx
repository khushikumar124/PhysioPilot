/**
 * Line icons.
 *
 * A single stroked set at a consistent 1.6px weight, sized in `em` so an icon
 * always matches the text it sits beside. Emoji were replaced by these: they
 * render differently on every platform, they carry a tone that does not belong
 * in a clinical tool, and they cannot inherit colour or weight.
 */

import type { ReactElement } from "react";

export type IconName =
  | "today"
  | "progress"
  | "assistant"
  | "check"
  | "chevron-right"
  | "chevron-left"
  | "arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "camera"
  | "camera-off"
  | "sound-on"
  | "sound-off"
  | "sun"
  | "moon"
  | "plus"
  | "alert"
  | "info"
  | "user"
  | "users"
  | "sign-out"
  | "calendar"
  | "clock"
  | "edit"
  | "trash"
  | "send"
  | "target"
  | "activity"
  | "play";

const PATHS: Record<IconName, ReactElement> = {
  today: (
    <>
      <path d="M3 10.2 12 3.5l9 6.7" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M9.75 20V13.5h4.5V20" />
    </>
  ),
  progress: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M4 15.5l4.8-5.2 3.4 3 5.4-6" />
      <path d="M14.6 7.3h3.2v3.2" />
    </>
  ),
  assistant: (
    <>
      <path d="M20 12.6c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.4-.3L5 20.5l1.2-3.2A6.2 6.2 0 0 1 4 12.6C4 9 7.6 6.1 12 6.1s8 2.9 8 6.5Z" />
      <path d="M9 12h.01M12 12h.01M15 12h.01" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 7" />,
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  "arrow-up": (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.5h3.2l1.6-2.4h7.4l1.6 2.4h3.2v11H3.5z" />
      <circle cx="12" cy="13.6" r="3.4" />
    </>
  ),
  "camera-off": (
    <>
      <path d="M3.5 8.5h2.2m3.4 0h6.6l1.6-2.4h.9" />
      <path d="M20.5 10v9.5H6" />
      <path d="M3.5 8.5v11h2" />
      <path d="M4 4l16 16" />
    </>
  ),
  "sound-on": (
    <>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <path d="M15.5 9.5a4 4 0 0 1 0 5" />
      <path d="M18 7a7 7 0 0 1 0 10" />
    </>
  ),
  "sound-off": (
    <>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <path d="M16 10l4 4M20 10l-4 4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4.2M12 17.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3.1 2.7-5 6-5s6 1.9 6 5" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6.1M17.5 14.9c2 .6 3.5 2.1 3.5 4.6" />
    </>
  ),
  "sign-out": (
    <>
      <path d="M14.5 8V5.5h-9v13h9V16" />
      <path d="M10 12h10.5" />
      <path d="M17.5 8.5 21 12l-3.5 3.5" />
    </>
  ),
  calendar: (
    <>
      <path d="M4.5 6.5h15v13h-15z" />
      <path d="M4.5 10.5h15M9 4.5v4M15 4.5v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.2 2" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h4L19 9a2.5 2.5 0 0 0-3.5-3.5L5 16z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2" />
      <path d="M6.5 6.5 7.5 20h9l1-13.5" />
    </>
  ),
  send: <path d="M4 12 20 4.5 15 20l-4-6z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  activity: <path d="M3 12.5h4l2.5-7 4.5 14 2.5-7h4.5" />,
  play: <path d="M7.5 5.2 19 12 7.5 18.8z" fill="currentColor" />,
};

export function Icon({
  name,
  className = "",
  size = "1em",
  strokeWidth = 1.6,
}: {
  name: IconName;
  className?: string;
  size?: string | number;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
