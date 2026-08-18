import { getD1 } from "./runtime";
import type { Organization } from "./types";

export const DEFAULT_ORGANIZATION_SLUG = "cartorio";

type OrganizationRow = {
  id: number;
  trade_name: string;
  slug: string;
  business_type: string;
  logo_key: string | null;
  display_logo_key: string | null;
  display_background_key: string | null;
  primary_color: string;
  timezone: string;
  status: Organization["status"];
  created_at: string;
  updated_at: string;
};

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    tradeName: row.trade_name,
    slug: row.slug,
    businessType: row.business_type,
    logoKey: row.logo_key,
    displayLogoKey: row.display_logo_key,
    displayBackgroundKey: row.display_background_key,
    primaryColor: row.primary_color,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrganizationBySlug(
  slug: string,
  options: { includeInactive?: boolean } = {}
): Promise<Organization | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  const row = await getD1()
    .prepare(
      `SELECT * FROM organizations
       WHERE slug = ? ${options.includeInactive ? "" : "AND status = 'active'"}
       LIMIT 1`
    )
    .bind(normalizedSlug)
    .first<OrganizationRow>();
  return row ? mapOrganization(row) : null;
}

export async function getOrganizationById(
  id: number,
  options: { includeInactive?: boolean } = {}
): Promise<Organization | null> {
  const row = await getD1()
    .prepare(
      `SELECT * FROM organizations
       WHERE id = ? ${options.includeInactive ? "" : "AND status = 'active'"}
       LIMIT 1`
    )
    .bind(id)
    .first<OrganizationRow>();
  return row ? mapOrganization(row) : null;
}

export async function getDefaultOrganization(): Promise<Organization> {
  const organization = await getOrganizationBySlug(DEFAULT_ORGANIZATION_SLUG);
  if (!organization) {
    throw new Error(
      "A organização padrão não foi encontrada. Aplique as migrations do banco."
    );
  }
  return organization;
}

export async function listOrganizations(): Promise<Organization[]> {
  const { results } = await getD1()
    .prepare("SELECT * FROM organizations ORDER BY created_at DESC, id DESC")
    .all<OrganizationRow>();
  return results.map(mapOrganization);
}
