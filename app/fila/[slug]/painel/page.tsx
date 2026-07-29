import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "../../../../db/organizations";
import { QueueApp } from "../../../queue-app";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) return {};
  return {
    title: `${organization.tradeName} | Painel de chamadas`,
    description: `Acompanhe as chamadas de atendimento da ${organization.tradeName}.`,
    themeColor: organization.primaryColor,
  };
}

export default async function OrganizationDisplayPage({ params }: PageProps) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  return (
    <QueueApp
      initialMode="display"
      organizationSlug={organization.slug}
      initialOrganization={{
        tradeName: organization.tradeName,
        slug: organization.slug,
        logoKey: organization.logoKey,
        primaryColor: organization.primaryColor,
        timezone: organization.timezone,
      }}
    />
  );
}
