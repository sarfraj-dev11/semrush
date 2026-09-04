"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients } from "@/db/schema";
import {
  clientSchema,
  formToObject,
  toActionState,
  type ActionState,
} from "@/lib/validation";

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return toActionState(parsed.error);

  await db.insert(clients).values(parsed.data);
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true };
}

export async function updateClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Missing client id." };
  }

  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return toActionState(parsed.error);

  await db
    .update(clients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clients.id, id));

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

/** Cascades to the client's projects and everything below them. */
export async function deleteClientAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/clients");
}
