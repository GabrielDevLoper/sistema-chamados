import { getOrganizationBySlug } from "../../../../../db/organizations";
import { getR2 } from "../../../../../db/runtime";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization?.logoKey) return new Response(null, { status: 404 });
  const object = await getR2().get(organization.logoKey);
  if (!object) return new Response(null, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
