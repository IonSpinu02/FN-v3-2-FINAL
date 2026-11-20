import { findPoliticianBySlug } from "@/lib/politicalDefectionsCatalog";
import { PoliticianDossierClient } from "@/components/PoliticianDossierClient";
import { redirect } from "next/navigation";

export default async function PoliticianDossierPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const politician = findPoliticianBySlug(slug);
  if (!politician) {
    redirect("/app/news");
  }
  return <PoliticianDossierClient politician={politician} />;
}
