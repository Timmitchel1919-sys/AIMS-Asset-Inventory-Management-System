import { describe, expect, it } from "vitest";
import {
  generateQrToken,
  isValidQrToken,
  QR_RESOLVER_PREFIX,
  QR_TOKEN_LENGTH,
  planQrBackfill,
  qrResolverPath,
  qrResolverUrl,
  qrTokenFromValue,
  type QrBackfillAssessment,
} from "./qrIdentity";
import type { Asset, QrIdentity } from "./types";

const identity = (id: string, assetId: string, status: "ACTIVE" | "REVOKED" = "ACTIVE"): QrIdentity => ({
  id,
  assetId,
  status,
  source: "created",
});

describe("QR token generation and validation", () => {
  it("produces opaque 24-character tokens without PII", () => {
    const first = generateQrToken();
    const second = generateQrToken();
    expect(first).toHaveLength(QR_TOKEN_LENGTH);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
  });

  it("accepts only well-formed tokens", () => {
    expect(isValidQrToken(generateQrToken())).toBe(true);
    expect(isValidQrToken("short")).toBe(false);
    expect(isValidQrToken("")).toBe(false);
    expect(isValidQrToken("has space")).toBe(false);
    expect(isValidQrToken("x".repeat(100))).toBe(false);
    expect(isValidQrToken("abc=0")).toBe(false);
  });
});

describe("QR resolver URL helpers", () => {
  const token = generateQrToken();
  it("builds /q/ paths and URLs", () => {
    expect(qrResolverPath(token)).toBe(`/q/${token}`);
    expect(qrResolverUrl(token)).toBe(`https://aims-asset-inventory-system.web.app/q/${token}`);
    expect(qrResolverUrl(token, "https://aims-asset-inventory-system.web.app/")).toBe(
      `https://aims-asset-inventory-system.web.app/q/${token}`,
    );
    expect(QR_RESOLVER_PREFIX).toBe("/q/");
  });

  it("extracts tokens from URLs and raw values", () => {
    expect(qrTokenFromValue(`https://aims-asset-inventory-system.web.app/q/${token}`)).toBe(token);
    expect(qrTokenFromValue(`/q/${token}"`)).toBe(null);
    expect(qrTokenFromValue(`/q/${token}`)).toBe(token);
    expect(qrTokenFromValue(token)).toBe(token);
    expect(qrTokenFromValue("https://example.com/assets/it-1")).toBe(null);
    expect(qrTokenFromValue("KCSMD-147")).toBe(null);
    expect(qrTokenFromValue("")).toBe(null);
  });
});

describe("planQrBackfill", () => {
  const asset = (id: string, code: string, qrToken?: string): Asset => ({ id, code, qrToken } as Asset);
  const plan = (assets: Asset[], identities: QrIdentity[]) => planQrBackfill(assets, identities);

  it("mints a token for every asset that has none", () => {
    const assessment = plan([asset("a1", "KCSMD-100")], []);
    expect(assessment.create).toEqual(["a1"]);
    expect(assessment.blocked).toEqual([]);
    expect(assessment.preserve).toEqual([]);
  });

  it("preserves assets with a valid ACTIVE identity bound to them", () => {
    const token = generateQrToken();
    const assessment = plan(
      [asset("a1", "KCSMD-100", token), asset("a2", "KCSMD-101")],
      [identity(token, "a1")],
    );
    expect(assessment.preserve).toEqual(["a1"]);
    expect(assessment.create).toEqual(["a2"]);
  });

  it("repairs an orphaned token by reusing the printed token", () => {
    const token = generateQrToken();
    const assessment = plan([asset("a1", "KCSMD-100", token)], []);
    expect(assessment.create).toEqual(["a1"]);
    expect(assessment.blocked).toEqual([]);
  });

  it("re-provisions when the bound identity is revoked or the token is malformed", () => {
    const revoked = generateQrToken();
    const blockedRevoked = plan(
      [asset("a1", "KCSMD-100", revoked)],
      [identity(revoked, "a1", "REVOKED")],
    );
    expect(blockedRevoked.create).toEqual(["a1"]);
    expect(blockedRevoked.invalidQrRecords).toBe(1);

    const malformed = plan([asset("a1", "KCSMD-100", "not-a-token")], []);
    expect(malformed.create).toEqual(["a1"]);
    expect(malformed.invalidQrRecords).toBe(1);
  });

  it("blocks duplicate inventory codes and duplicate token bindings", () => {
    const token = generateQrToken();
    const assessment = plan(
      [asset("a1", "KCSMD-100"), asset("a2", "KCSMD-100", token), asset("a3", "KCSMD-101", token)],
      [],
    );
    const codes = assessment.blocked.filter((blocked) => blocked.code === "KCSMD-100");
    const tokens = assessment.blocked.filter(
      (blocked) => blocked.reason.includes("already bound"),
    );
    expect(codes.length).toBe(2);
    expect(tokens.length).toBe(1);
    expect(assessment.duplicateCodeConflicts).toContain("KCSMD-100");
    expect(assessment.duplicateQrConflicts).toBe(1);
    expect(assessment.create).toEqual([]);
  });

  it("never calls assets that cannot be provisioned", () => {
    const assessment = plan(
      [
        asset("a1", "KCSMD-100"),
        asset("a2", "KCSMD-100"),
        asset("a3", "KCSMD-101"),
      ],
      [],
    );
    expect(assessment.blocked.length).toBe(2);
    expect(assessment.create).toEqual(["a3"]);
    expect(assessment.totalAssets).toBe(3);
    expect((assessment as QrBackfillAssessment).duplicateCodeConflicts).toEqual(["KCSMD-100"]);
  });
});