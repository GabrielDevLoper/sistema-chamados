type OrganizationAsset = "logo" | "display-logo" | "background";

/**
 * Organization media is stored under a new R2 key on every upload. Keeping
 * that key in the URL makes the browser pick up the newly active asset instead
 * of reusing a cached response for the old URL.
 */
export function publicOrganizationAssetUrl(
  slug: string,
  asset: OrganizationAsset,
  key: string | null | undefined,
) {
  if (!key) return undefined;
  return `/api/public/${encodeURIComponent(slug)}/${asset}?v=${encodeURIComponent(key)}`;
}
