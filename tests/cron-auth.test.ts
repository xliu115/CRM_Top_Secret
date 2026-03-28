import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

describe("cron-auth verifyCronSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a valid x-cron-secret header", () => {
    vi.stubEnv("CRON_SECRET", "super-secret-value");
    const req = new NextRequest("http://localhost/api/cron/cadence-advance", {
      headers: { "x-cron-secret": "super-secret-value" },
    });
    expect(verifyCronSecret(req)).toBe(true);
  });

  it("rejects an invalid header", () => {
    vi.stubEnv("CRON_SECRET", "expected");
    const req = new NextRequest("http://localhost/api/cron/morning-briefing", {
      headers: { "x-cron-secret": "wrong" },
    });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("rejects when CRON_SECRET is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = new NextRequest("http://localhost/api/cron/reply-detection", {
      headers: { "x-cron-secret": "anything" },
    });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("does not accept secret via query string", () => {
    vi.stubEnv("CRON_SECRET", "only-in-header");
    const req = new NextRequest(
      "http://localhost/api/cron/job?cron_secret=only-in-header",
      { headers: new Headers() }
    );
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("rejects when header is missing", () => {
    vi.stubEnv("CRON_SECRET", "only-in-header");
    const req = new NextRequest("http://localhost/api/cron/job");
    expect(verifyCronSecret(req)).toBe(false);
  });
});
