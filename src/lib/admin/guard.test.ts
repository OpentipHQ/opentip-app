import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestSession } from "@/lib/auth";
import { readActAs } from "@/lib/admin/act-as";
import {
  requireAdminAction,
  requireAdminPage,
  requireWritableAdminAction,
} from "@/lib/admin/guard";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getRequestSession: vi.fn(),
}));

vi.mock("@/lib/admin/act-as", () => ({
  readActAs: vi.fn(),
}));

const admin = {
  userId: "admin_1",
  login: "admin",
  name: null,
  role: "ADMIN" as const,
  exp: Date.now() + 1000,
};
const user = { ...admin, role: "USER" as const };

describe("admin guard", () => {
  beforeEach(() => {
    vi.mocked(readActAs).mockResolvedValue(null);
  });

  it("sends signed-out users to login", async () => {
    vi.mocked(getRequestSession).mockResolvedValue(null);
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/login?next=/admin");
  });

  it("returns 404 for a signed-in non-admin", async () => {
    vi.mocked(getRequestSession).mockResolvedValue(user);
    await expect(requireAdminPage()).rejects.toThrow("NOT_FOUND");
    await expect(requireAdminAction()).rejects.toThrow("NOT_FOUND");
  });

  it("allows an admin", async () => {
    vi.mocked(getRequestSession).mockResolvedValue(admin);
    await expect(requireAdminPage()).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("blocks writes while act-as is active", async () => {
    vi.mocked(getRequestSession).mockResolvedValue(admin);
    vi.mocked(readActAs).mockResolvedValue({
      userId: "target",
      login: "target",
      name: null,
      role: "USER",
      exp: Date.now() + 1000,
      actorId: "admin_1",
    });
    await expect(requireWritableAdminAction()).rejects.toThrow("NOT_FOUND");
  });
});
