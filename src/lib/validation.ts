import { z } from "zod";
import { normalizeDomain } from "@/lib/utils";

/** Empty form fields arrive as "" — store them as NULL, not empty strings. */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  website: optionalText(200),
  contactName: optionalText(120),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address",
    )
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  contactPhone: optionalText(60),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  notes: optionalText(5000),
});

export const projectSchema = z.object({
  clientId: z.coerce.number().int().positive("Pick a client"),
  name: z.string().trim().min(1, "Name is required").max(120),
  domain: z
    .string()
    .trim()
    .min(1, "Domain is required")
    .transform(normalizeDomain)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.hostname.includes(".");
      } catch {
        return false;
      }
    }, "Enter a valid domain, e.g. example.com"),
  targetCountry: z.string().trim().min(2).default("US"),
  targetDevice: z.enum(["mobile", "desktop", "both"]).default("mobile"),
  crawlDepth: z.coerce.number().int().min(1).max(10).default(3),
  crawlLimit: z.coerce.number().int().min(1).max(10000).default(500),
  crawlConcurrency: z.coerce.number().int().min(1).max(10).default(4),
  respectRobots: z.coerce.boolean().default(true),
  includePatterns: optionalText(2000),
  excludePatterns: optionalText(2000),
  userAgent: optionalText(200),
});

export const competitorSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  name: optionalText(120),
  domain: z.string().trim().min(1, "Domain is required").transform(normalizeDomain),
});

export const taskSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText(4000),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignee: optionalText(120),
  dueDate: optionalText(20),
  issueCode: optionalText(60),
  pageUrl: optionalText(2000),
});

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export function formToObject(formData: FormData) {
  const entries: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    entries[key] = value;
  }
  return entries;
}

/** Checkboxes are absent from FormData when unchecked. */
export function readCheckbox(formData: FormData, name: string) {
  return formData.get(name) !== null;
}

export function toActionState(error: z.ZodError): ActionState {
  const flattened = z.flattenError(error);
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: flattened.fieldErrors as Record<string, string[]>,
  };
}
