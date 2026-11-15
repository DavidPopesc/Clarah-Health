"use client";

import { useId } from "react";

// Clarah Health as a friendly nurse: cap with a blue cross, eucalyptus scrubs and a stethoscope, in the
// site's palette. She blinks now and then and smiles; while her voice plays, her mouth moves as
// she talks and a soft ring pulses around her. Animations live in globals.css (.clara-*).
export function ClaraAvatar({ speaking = false, size = 64 }: { speaking?: boolean; size?: number }) {
  const clip = useId();
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_#c9d3bd] ${speaking ? "clara-speaking" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-label="Clarah Health, your AI health nurse">
        <defs>
          <clipPath id={clip}>
            <circle cx="32" cy="32" r="32" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="64" height="64" fill="#e7ecdf" />
          {/* hair, behind the face */}
          <path d="M17.5 32c0-11 6.5-18 14.5-18s14.5 7 14.5 18v10c-2.5 2-5.5 3-8 3H25.5c-2.5 0-5.5-1-8-3z" fill="#4a3428" />
          {/* scrubs and neck */}
          <path d="M8 64c0-12 10-19.5 24-19.5S56 52 56 64z" fill="#3c5a4e" />
          <rect x="28" y="38" width="8" height="9" rx="2" fill="#e9c4a8" />
          <path d="M26.5 44.6 32 51.5l5.5-6.9" fill="#e9c4a8" />
          <path d="M26.5 44.6 32 51.5l5.5-6.9" fill="none" stroke="#2c443a" strokeWidth="1.6" strokeLinejoin="round" />
          {/* stethoscope */}
          <path d="M23.5 46c-.5 6 2.5 10 7 10.5M40.5 46c.5 5-1 8.5-4 10" fill="none" stroke="#2a4fa8" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="36.3" cy="56.6" r="2.8" fill="#2a4fa8" />
          <circle cx="36.3" cy="56.6" r="1.2" fill="#dfe6f5" />
          {/* face */}
          <ellipse cx="32" cy="30.5" rx="10.5" ry="12" fill="#f1d3bd" />
          <path d="M21.5 28c1.5-6 5.5-9.5 10.5-9.5s9 3.5 10.5 9.5c-4.5-1.5-8-3.5-10.5-6.5-2.5 3-6 5-10.5 6.5z" fill="#4a3428" />
          <g className="clara-eyes">
            <circle cx="28" cy="31" r="1.4" fill="#2b211c" />
            <circle cx="36" cy="31" r="1.4" fill="#2b211c" />
          </g>
          <circle cx="25.6" cy="34.6" r="1.9" fill="#e8a99a" opacity={speaking ? 0.5 : 0.7} />
          <circle cx="38.4" cy="34.6" r="1.9" fill="#e8a99a" opacity={speaking ? 0.5 : 0.7} />
          {speaking ? (
            // An open, smiling mouth that opens and closes as she talks.
            <g className="clara-mouth-talk">
              <path d="M28.2 35c2 3.6 5.6 3.6 7.6 0z" fill="#7a3b33" stroke="#9a5a4a" strokeWidth="1" strokeLinejoin="round" />
              <path d="M30.4 37.1c1 .6 2.2.6 3.2 0" fill="none" stroke="#d98579" strokeWidth="1.1" strokeLinecap="round" />
            </g>
          ) : (
            // A warm closed smile when she's not speaking.
            <path d="M28 35.2c2.2 2.4 5.8 2.4 8 0" fill="none" stroke="#9a5a4a" strokeWidth="1.9" strokeLinecap="round" />
          )}
          {/* nurse's cap with a blue cross */}
          <path d="M20.5 20.5 22.5 11.5h19l2 9c-3.8-1.6-7.6-2.3-11.5-2.3s-7.7.7-11.5 2.3z" fill="#fffdf7" stroke="#a9b89a" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M32 12.9v5.4M29.3 15.6h5.4" stroke="#2a4fa8" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </svg>
    </span>
  );
}
