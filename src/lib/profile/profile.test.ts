import { describe, expect, it } from "vitest";
import { MAX_PROFILE_IMAGE_BYTES, validateProfileImage } from "@/lib/profile/image";
import { canUnlinkEmail, canUnlinkGithub, deleteConfirmationMatches } from "@/lib/profile/rules";
import { avatarFor, initialsFor } from "@/lib/profile/avatar";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("profile image validation", () => {
  it("accepts PNG, JPEG, and WebP by magic bytes", () => {
    expect(validateProfileImage({ type: "image/png", size: png.length, bytes: png })).toMatchObject({
      ok: true,
      extension: "png",
    });
    expect(validateProfileImage({ type: "image/jpeg", size: jpeg.length, bytes: jpeg })).toMatchObject({
      ok: true,
      extension: "jpg",
    });
    expect(validateProfileImage({ type: "image/webp", size: webp.length, bytes: webp })).toMatchObject({
      ok: true,
      extension: "webp",
    });
  });

  it("rejects a mismatched type and magic bytes", () => {
    expect(validateProfileImage({ type: "image/png", size: png.length, bytes: jpeg })).toEqual({
      ok: false,
      reason: "type",
    });
    expect(validateProfileImage({ type: "image/gif", size: png.length, bytes: png })).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("rejects empty and oversized files", () => {
    expect(validateProfileImage({ type: "image/png", size: 0, bytes: png })).toEqual({
      ok: false,
      reason: "size",
    });
    expect(
      validateProfileImage({ type: "image/png", size: MAX_PROFILE_IMAGE_BYTES + 1, bytes: png }),
    ).toEqual({ ok: false, reason: "size" });
  });
});

describe("profile rules", () => {
  it("keeps at least one sign-in method", () => {
    expect(
      canUnlinkGithub({ githubId: "42", email: "ada@example.com", emailSignInEnabled: false }),
    ).toBe(false);
    expect(
      canUnlinkGithub({ githubId: "42", email: "ada@example.com", emailSignInEnabled: true }),
    ).toBe(true);
    expect(
      canUnlinkEmail({ githubId: null, email: "ada@example.com", emailSignInEnabled: true }),
    ).toBe(false);
    expect(
      canUnlinkEmail({ githubId: "42", email: "ada@example.com", emailSignInEnabled: true }),
    ).toBe(true);
  });

  it("requires the exact login for deletion", () => {
    expect(deleteConfirmationMatches("Ada", "ada")).toBe(true);
    expect(deleteConfirmationMatches("ada ", "ada")).toBe(true);
    expect(deleteConfirmationMatches("wrong", "ada")).toBe(false);
    expect(deleteConfirmationMatches("", "")).toBe(false);
  });
});

describe("avatar helpers", () => {
  it("prefers the uploaded image, then GitHub, then initials", () => {
    expect(avatarFor({ imageUrl: "upload", avatarUrl: "github" })).toBe("upload");
    expect(avatarFor({ imageUrl: null, avatarUrl: "github" })).toBe("github");
    expect(avatarFor({ imageUrl: null, avatarUrl: null })).toBeNull();
    expect(initialsFor("Ada Lovelace", "ada")).toBe("AL");
    expect(initialsFor(null, "ada")).toBe("AD");
  });
});
