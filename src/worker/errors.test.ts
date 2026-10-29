import { describe, expect, it } from "vitest";
import {
  PermanentJobError,
  TransientJobError,
  classifyJobError,
} from "@/worker/errors";

describe("worker error classification", () => {
  it("keeps permanent and transient errors distinct", () => {
    expect(classifyJobError(new PermanentJobError("Paused site"))).toEqual({
      message: "Paused site",
      permanent: true,
    });
    expect(classifyJobError(new TransientJobError("Network down"))).toEqual({
      message: "Network down",
      permanent: false,
    });
  });

  it("treats common GitHub and provider client errors as permanent", () => {
    expect(classifyJobError(new Error("GitHub request failed (404)"))).toMatchObject({
      permanent: true,
    });
    expect(classifyJobError(new Error("provider request failed (429)"))).toMatchObject({
      permanent: false,
    });
  });

  it("does not retry missing deployment configuration", () => {
    const error = new Error("XAI_API_KEY is required");
    error.name = "ProviderNotConfiguredError";
    expect(classifyJobError(error)).toEqual({
      message: "XAI_API_KEY is required",
      permanent: true,
    });
  });
});
