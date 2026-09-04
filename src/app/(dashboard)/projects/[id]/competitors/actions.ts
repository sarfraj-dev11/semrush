"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { competitors } from "@/db/schema";

export async function addCompetitorAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const rawDomain = (formData.get("domain") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() || null;

  if (!projectId || !rawDomain) {
    throw new Error("Competitor domain is required.");
  }

  const domain = rawDomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  const [existing] = await db
    .select({ id: competitors.id })
    .from(competitors)
    .where(
      and(
        eq(competitors.projectId, projectId),
        eq(competitors.domain, domain),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("This competitor domain is already tracked.");
  }

  await db.insert(competitors).values({
    projectId,
    domain,
    name: name || domain,
  });

  revalidatePath(`/projects/${projectId}/competitors`);
}

export async function deleteCompetitorAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const [row] = await db
    .select({ projectId: competitors.projectId })
    .from(competitors)
    .where(eq(competitors.id, id))
    .limit(1);

  if (!row) return;

  await db.delete(competitors).where(eq(competitors.id, id));
  revalidatePath(`/projects/${row.projectId}/competitors`);
}
