import { describe, expect, it } from "vitest";
import { profileSchema, signupSchema, usernameSchema, sanitizeText } from "@/lib/validation";
import { detectImageKind, validateAvatarBytes } from "@/lib/image-validate";
import { lockRemainingMs, BASE_LOCK_MS } from "@/lib/auth-throttle";

const validProfile = {
  fullName: "Manus Wanjohi",
  username: "manus_tech",
  country: "Kenya",
  location: "Nairobi",
  bio: "Book lover | Reader | Tech Enthusiast",
};

describe("username rules", () => {
  it("accepts lowercase letters, numbers and underscores", () => {
    expect(usernameSchema.safeParse("manus_tech").success).toBe(true);
  });
  it("lowercases and strips a leading @", () => {
    expect(usernameSchema.parse("@Manus_Tech")).toBe("manus_tech");
  });
  it("rejects names shorter than 3 or longer than 20", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
  });
  it("rejects names starting with a number or containing symbols", () => {
    expect(usernameSchema.safeParse("1reader").success).toBe(false);
    expect(usernameSchema.safeParse("read-er").success).toBe(false);
  });
});

describe("profile rules", () => {
  it("accepts a complete valid profile", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });
  it("rejects a bio over 160 characters", () => {
    expect(profileSchema.safeParse({ ...validProfile, bio: "a".repeat(161) }).success).toBe(false);
  });
  it("rejects an unknown country", () => {
    expect(profileSchema.safeParse({ ...validProfile, country: "Atlantis" }).success).toBe(false);
  });
  it("strips markup characters from text", () => {
    expect(sanitizeText("  <b>Hi</b>\u200B there ")).toBe("bHi/b there");
  });
});

describe("password rules", () => {
  it("requires 8+ characters with a letter and a number", () => {
    const base = { email: "a@b.co" };
    expect(signupSchema.safeParse({ ...base, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "longpassword", confirmPassword: "longpassword" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "reader2026", confirmPassword: "reader2026" }).success).toBe(true);
  });
});

describe("avatar upload checks", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  it("detects images by magic bytes", () => {
    expect(detectImageKind(png)).toBe("png");
    expect(detectImageKind(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
  });
  it("rejects files larger than 2 MB", () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(png);
    const b64 = btoa(Array.from(big, (c) => String.fromCharCode(c)).join(""));
    expect(validateAvatarBytes(b64).ok).toBe(false);
  });
  it("rejects an image that embeds script markup", () => {
    const bytes = new Uint8Array(400);
    bytes.set(png);
    bytes.set(new TextEncoder().encode("<script>alert(1)</script>"), 50);
    const b64 = btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""));
    expect(validateAvatarBytes(b64).ok).toBe(false);
  });
});

describe("sign-in cooldown", () => {
  const now = 1_000_000_000;
  it("allows the first 4 failed attempts without waiting", () => {
    expect(lockRemainingMs([now - 4, now - 3, now - 2, now - 1], now)).toBe(0);
  });
  it("locks for 30 seconds after 5 failed attempts", () => {
    expect(lockRemainingMs([now - 4, now - 3, now - 2, now - 1, now], now)).toBe(BASE_LOCK_MS);
  });
  it("doubles the lock for each extra failure", () => {
    const fails = [now - 5, now - 4, now - 3, now - 2, now - 1, now];
    expect(lockRemainingMs(fails, now)).toBe(BASE_LOCK_MS * 2);
  });
});
