import { describe, expect, it } from "vitest";
import {
  licenseLabel,
  licenseSecretFromEnv,
  revokedFromEnv,
  signLicense,
  verifyLicense,
  verifyMessage,
} from "@/lib/access/license";

const SECRET = "test-secret-do-not-use";

function mint(over: Partial<Parameters<typeof signLicense>[0]> = {}) {
  return signLicense({ email: "buyer@example.com", tier: "maker", seat: 7, ...over }, SECRET);
}

describe("licence tokens", () => {
  it("round-trips a signed licence", () => {
    const { token, license } = mint();
    const result = verifyLicense(token, { secret: SECRET });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.license.id).toBe(license.id);
      expect(result.license.email).toBe("buyer@example.com");
      expect(result.license.seat).toBe(7);
      expect(result.license.tier).toBe("maker");
    }
  });

  it("rejects a licence signed with a different secret", () => {
    const { token } = mint();
    expect(verifyLicense(token, { secret: "another-secret" })).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("rejects a payload edited to claim a better deal", () => {
    const { token } = mint({ seat: 4321 });
    const [version, payload, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.seat = 1; // vanity-edit the seat number
    const tampered = `${version}.${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${sig}`;
    expect(verifyLicense(tampered, { secret: SECRET })).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses anything that isn't a cm1 token", () => {
    expect(verifyLicense("", { secret: SECRET })).toEqual({ ok: false, reason: "missing" });
    expect(verifyLicense("nonsense", { secret: SECRET })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyLicense("cm9.a.b", { secret: SECRET })).toEqual({ ok: false, reason: "bad-version" });
  });

  it("refuses everything when the server has no secret configured", () => {
    const { token } = mint();
    expect(verifyLicense(token, { secret: undefined })).toEqual({ ok: false, reason: "no-secret" });
  });

  it("honours revocation, for refunds and abuse", () => {
    const { token, license } = mint();
    expect(verifyLicense(token, { secret: SECRET, revoked: [license.id] })).toEqual({
      ok: false,
      reason: "revoked",
    });
    expect(verifyLicense(token, { secret: SECRET, revoked: ["someone-else"] }).ok).toBe(true);
  });

  it("will not sign without a secret", () => {
    expect(() => signLicense({ email: "a@b.com", tier: "maker", seat: 1 }, "")).toThrow();
  });

  it("gives every failure a sentence a buyer can act on", () => {
    for (const reason of ["missing", "malformed", "bad-version", "bad-signature", "revoked", "no-secret"] as const) {
      expect(verifyMessage(reason).length).toBeGreaterThan(10);
    }
  });

  it("labels a licence by seat, not by its full id", () => {
    const { license } = mint({ seat: 42 });
    expect(licenseLabel(license)).toMatch(/^#42 · /);
    expect(licenseLabel(license).length).toBeLessThan(license.id.length + 8);
  });
});

describe("licence config from env", () => {
  it("reads and trims the secret, treating blank as unset", () => {
    expect(licenseSecretFromEnv({ CAROUSEL_LICENSE_SECRET: "  s3cret  " })).toBe("s3cret");
    expect(licenseSecretFromEnv({ CAROUSEL_LICENSE_SECRET: "   " })).toBeUndefined();
    expect(licenseSecretFromEnv({})).toBeUndefined();
  });

  it("parses a revocation list separated by commas or whitespace", () => {
    expect(revokedFromEnv({ CAROUSEL_LICENSE_REVOKED: "a, b  c," })).toEqual(["a", "b", "c"]);
    expect(revokedFromEnv({})).toEqual([]);
  });
});
