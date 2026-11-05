import { z } from "zod";
import { COUNTRIES } from "./countries";

/**
 * Normalises user text: unicode NFKC, strips control / zero-width / bidi
 * characters and angle brackets, collapses whitespace and trims.
 */
export function sanitizeText(value: string): string {
  return value
    .normalize("NFKC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const clean = (v: unknown) => (typeof v === "string" ? sanitizeText(v) : v);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address");

/** Password rules for new accounts and password resets. */
export const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72, "Password is too long"),
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

export const usernameSchema = z.preprocess(
  (v) => (typeof v === "string" ? sanitizeText(v).replace(/^@/, "").toLowerCase() : v),
  z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      USERNAME_REGEX,
      "Use lowercase letters, numbers and _ only, starting with a letter",
    ),
);

export const BIO_MAX = 160;

export const profileSchema = z.object({
  fullName: z.preprocess(
    clean,
    z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be at most 60 characters")
      .regex(/^[\p{L}\p{M}' .-]+$/u, "Name can only contain letters, spaces, ' . and -"),
  ),
  username: usernameSchema,
  country: z.preprocess(
    clean,
    z.string().refine((c) => (COUNTRIES as readonly string[]).includes(c), "Select your country"),
  ),
  location: z.preprocess(
    clean,
    z
      .string()
      .min(2, "Location must be at least 2 characters")
      .max(80, "Location must be at most 80 characters")
      .regex(/^[\p{L}\p{M}\p{N}' .,()-]+$/u, "Location contains invalid characters"),
  ),
  bio: z.preprocess(
    (v) => (v == null ? "" : clean(v)),
    z.string().max(BIO_MAX, `Bio must be at most ${BIO_MAX} characters`),
  ),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Returns a map of field -> first error message. */
export function fieldErrors<K extends string = string>(error: z.ZodError): Partial<Record<K, string>> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out as Partial<Record<K, string>>;
}
