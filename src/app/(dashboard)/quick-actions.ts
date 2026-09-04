"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slugs";

export async function quickCreateProject(formData: FormData) {
  let domain = String(formData.get("domain") || "").trim();
  const country = String(formData.get("country") || "WW");
  const redirectToOverview = formData.get("redirectToOverview") !== "false";

  if (!domain) return;

  // Clean domain input
  if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
    domain = `https://${domain}`;
  }

  const hostname = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  // Create friendly project name e.g. "Acme Corp" or "Example Site"
  const cleanName = hostname
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const projectName = cleanName || "New Project";

  // Check if project already exists
  const existingProjects = await db
    .select()
    .from(projects)
    .where(
      or(
        eq(projects.domain, `https://${hostname}`),
        eq(projects.domain, `http://${hostname}`),
        eq(projects.name, projectName),
      ),
    )
    .limit(1);

  let targetSlug = "";

  if (existingProjects.length > 0) {
    targetSlug = toProjectSlug(existingProjects[0].name);
  } else {
    // Ensure a client exists
    const [existingClient] = await db
      .select()
      .from(clients)
      .limit(1);

    let client = existingClient;
    if (!client) {
      const [newClient] = await db
        .insert(clients)
        .values({
          name: "Primary Organization",
          status: "active",
        })
        .returning();
      client = newClient;
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        clientId: client.id,
        name: projectName,
        domain: `https://${hostname}`,
        targetCountry: country === "WW" ? "US" : country,
        targetDevice: "desktop",
      })
      .returning();

    // Sync to Firebase
    try {
      const { syncProjectToFirebase } = await import("@/lib/firebase-tracking");
      await syncProjectToFirebase({
        id: newProject.id,
        name: newProject.name,
        domain: newProject.domain,
        targetCountry: newProject.targetCountry,
        targetDevice: newProject.targetDevice,
        clientId: newProject.clientId,
      });
    } catch (err) {
      console.error("❌ Firebase sync failed (quick-action project):", err);
    }

    targetSlug = toProjectSlug(newProject.name);
  }

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/domain-overview");

  if (redirectToOverview) {
    redirect(`/${targetSlug}/overview?country=${country}`);
  } else {
    redirect(`/${targetSlug}`);
  }
}
