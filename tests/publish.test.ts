import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCaption, publishConfigFromEnv } from "@/lib/publish/instagram";

describe("buildCaption", () => {
  it("appends normalised hashtags after a blank line", () => {
    expect(buildCaption("Hello", ["one", "#two", "  "])).toBe("Hello\n\n#one #two");
  });

  it("caps hashtags at Instagram's 30, counting ones already in the body", () => {
    const tags = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const out = buildCaption("Body #already", tags);
    expect(out.match(/#\w+/g)!.length).toBe(30);
  });

  it("never exceeds 2,200 characters", () => {
    expect(buildCaption("x".repeat(3000), []).length).toBe(2200);
  });
});

describe("publishConfigFromEnv", () => {
  const full = {
    NEXT_PUBLIC_IG_AUTOPUBLISH_HANDLE: "@angelokinetic",
    COMPOSIO_API_KEY: "k",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "s",
  } as NodeJS.ProcessEnv;

  it("is off unless every piece is set", () => {
    expect(publishConfigFromEnv({})).toBeNull();
    expect(publishConfigFromEnv({ ...full, COMPOSIO_API_KEY: "" })).toBeNull();
  });

  it("strips the @ and trailing slash", () => {
    expect(publishConfigFromEnv(full)).toMatchObject({ handle: "angelokinetic", supabaseUrl: "https://x.supabase.co" });
  });
});

describe("POST /api/publish", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a 404 when publishing isn't configured (the public deploy)", async () => {
    vi.stubEnv("NEXT_PUBLIC_IG_AUTOPUBLISH_HANDLE", "");
    vi.stubEnv("IG_AUTOPUBLISH_HANDLE", "");
    const { POST } = await import("@/app/api/publish/route");
    const res = await POST(new Request("http://x/api/publish", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("demands the token when one is set", async () => {
    vi.stubEnv("IG_AUTOPUBLISH_HANDLE", "angelokinetic");
    vi.stubEnv("COMPOSIO_API_KEY", "k");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "s");
    vi.stubEnv("IG_PUBLISH_TOKEN", "secret");
    const { POST } = await import("@/app/api/publish/route");
    const res = await POST(new Request("http://x/api/publish", { method: "POST", headers: { "x-publish-token": "wrong" } }));
    expect(res.status).toBe(401);
  });
});
