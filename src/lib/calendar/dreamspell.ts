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

export const HARMONIC_ACTIONS = ['Initiate', 'Refine', 'Transform', 'Ripen'] as const;
export function harmonicSuffix(index: number, enabled: boolean): string {
  const name = HARMONIC_ACTIONS[index - 1];
  return enabled && name ? ` (${name})` : '';
}
export function dreamspellYearSuffix(year: number, wave: number, ageType: number, enabled: boolean): string {
  return wave !== 0 ? dreamspellSuffix(year, enabled) : harmonicSuffix(year, enabled && ageType === 4);
}

