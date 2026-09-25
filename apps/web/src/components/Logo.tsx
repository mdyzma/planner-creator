/**
 * The YAPCO mark: an apple-shaped planner with binder rings, a stem and leaf, and a ticked
 * checklist. Ink follows the text colour (light and dark themes); the tick and leaf keep their
 * colours. The master artwork lives in docs/brand/.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id="yapco-body" d={BODY} />
        <clipPath id="yapco-top">
          <rect x="0" y="0" width="64" height="24" />
        </clipPath>
      </defs>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <use href="#yapco-body" fill="currentColor" stroke="none" clipPath="url(#yapco-top)" />
        <use href="#yapco-body" strokeWidth="3.5" />
        <path d="M20 9V19M44 9V19" strokeWidth="3.5" />
        <path d="M32 17C32 13 32.3 10.5 33.2 8" strokeWidth="2.8" />
        <rect x="15" y="31" width="8" height="8" rx="2" strokeWidth="2.6" />
        <rect x="15" y="43.5" width="8" height="8" rx="2" strokeWidth="2.6" />
        <path d="M28.5 35H47M28.5 47.5H44" strokeWidth="2.6" />
        <path d="M16.8 34.6L19.4 37.2L25 30" stroke={TICK} strokeWidth="2.8" />
      </g>
      <path d="M33.2 8.5C34.8 4.5 38.5 2.8 41.8 3.2C41 6.8 37.6 9.6 33.2 8.5Z" fill={LEAF} />
    </svg>
  );
}

const BODY =
  'M32 17C28 13.5 22 12.5 17 14.5C9.5 17.5 6 25.5 6.5 34.5C7 46.5 14 58 23 58.5C27 58.7 29 56.5 32 56.5C35 56.5 37 58.7 41 58.5C50 58 57 46.5 57.5 34.5C58 25.5 54.5 17.5 47 14.5C42 12.5 36 13.5 32 17Z';
const TICK = '#c8322b';
const LEAF = '#4a8a3c';
