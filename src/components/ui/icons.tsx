// Small shared inline icons used as placeholders where a real per-race
// logo isn't available yet (see RaceIcon call sites) — swapping in an
// actual <img> per race later only means changing what's rendered here.

export function CheckeredFlagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 21V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 4h16v10H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 4h4v3H4zM12 4h4v3h-4zM8 7h4v3H8zM16 7h4v3h-4zM4 10h4v4H4zM12 10h4v4h-4z" fill="currentColor" />
    </svg>
  );
}
