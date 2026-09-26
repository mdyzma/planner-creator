/** A few outline icons for the app chrome (24-unit grid, drawn with the current text colour). */
const PATHS = {
  undo: ['M9 14L4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  download: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
  globe: [
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',
    'M3.6 9h16.8',
    'M3.6 15h16.8',
    'M12 3a14 14 0 0 1 0 18',
    'M12 3a14 14 0 0 0 0 18',
  ],
  'chevron-down': ['M6 9l6 6 6-6'],
  spread: [
    'M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3z',
    'M21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z',
  ],
  page: ['M6 3h9l4 4v14H6z', 'M14 3v5h5'],
  sliders: [
    'M4 6h10',
    'M18 6h2',
    'M4 12h4',
    'M12 12h8',
    'M4 18h12',
    'M20 18h0',
    'M16 4v4',
    'M10 10v4',
    'M18 16v4',
  ],
  check: ['M5 12l5 5L20 7'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
