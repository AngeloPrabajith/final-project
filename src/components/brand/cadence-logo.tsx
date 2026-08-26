interface CadenceLogoProps {
  className?: string;
  size?: number;
}

/**
 * Cadence logomark — an oscillating waveform inside a rounded square.
 * Visually encodes sprint rhythm + capacity amplitude, the thesis of the app.
 */
export function CadenceLogo({ className, size = 20 }: CadenceLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary" />
      <path
        d="M5 16 C 7 16, 8 8, 11 8 S 15 24, 17 24 S 21 10, 23 10 S 27 16, 27 16"
        stroke="currentColor"
        className="stroke-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="23" cy="10" r="1.8" className="fill-primary-foreground" />
    </svg>
  );
}
