export type Density = 'comfortable' | 'compact';

export const DENSITY_COOKIE = 'density';

/**
 * Three states collapse to two here on purpose: "comfortable" is the absence
 * of the attribute and the absence of the cookie, so a stale value can never
 * outlive a reset. Anything other than the literal "compact" is comfortable.
 */
export function parseDensity(raw: string | undefined): Density {
  return raw === 'compact' ? 'compact' : 'comfortable';
}

/**
 * Stamps the root element and persists the choice. The attribute goes on
 * <html>, not on an inner wrapper, so the dialog, the sheet and the popover —
 * which render outside the page tree — inherit it too.
 */
export function applyDensity(density: Density, root: HTMLElement = document.documentElement): void {
  if (density === 'compact') root.dataset.density = 'compact';
  else delete root.dataset.density;

  document.cookie =
    density === 'compact'
      ? `${DENSITY_COOKIE}=compact; path=/; max-age=31536000; samesite=lax`
      : `${DENSITY_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
