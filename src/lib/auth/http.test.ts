import { describe, expect, it } from "vitest";
import { requestOrigin } from "@/lib/auth/http";

describe("request origin", () => {
  it("keeps the host the browser used", () => {
    const request = new Request("http://localhost:3000/login", {
      headers: { host: "127.0.0.1:3000" },
    });
    expect(requestOrigin(request)).toBe("http://127.0.0.1:3000");
  });
});
