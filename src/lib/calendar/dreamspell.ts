/** Symbolic names from the Foundation for the Law of Time's thirteen galactic tones. */
export const DREAMSPELL_TONES = [
  'Magnetic', 'Lunar', 'Electric', 'Self-Existing', 'Overtone', 'Rhythmic',
  'Resonant', 'Galactic', 'Solar', 'Planetary', 'Spectral', 'Crystal', 'Cosmic'
] as const;

/** X intervals and free periods have no thirteen-tone index. */
export function dreamspellSuffix(index: number, enabled: boolean): string {
  const name = DREAMSPELL_TONES[index - 1];
  return enabled && name ? ` (${name})` : '';
}
