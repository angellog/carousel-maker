import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAND, captionCredit, displayHost, siteUrl } from "@/lib/brand";

afterEach(() => vi.unstubAllEnvs());

describe("brand", () => {
  it("credit names the craft and the promise, with no link when no URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(captionCredit()).toBe("Typeset by The Carousel Maker — no AI images, just type & math.");
  });

  it("credit carries the bare host when a site URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.thecarouselmaker.com/some/path");
    expect(siteUrl()).toBe("https://www.thecarouselmaker.com");
    expect(captionCredit()).toMatch(/type & math\. thecarouselmaker\.com$/);
  });

  it("ignores a malformed site URL rather than printing it", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(siteUrl()).toBeUndefined();
    expect(captionCredit()).not.toMatch(/not a url/);
  });

  it("displayHost strips www", () => {
    expect(displayHost("https://www.example.com")).toBe("example.com");
  });

  it("short name fits a home-screen label", () => {
    expect(BRAND.short.length).toBeLessThanOrEqual(15);
  });
});
