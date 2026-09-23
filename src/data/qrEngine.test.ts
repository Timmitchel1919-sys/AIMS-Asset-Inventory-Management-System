import { describe, expect, it } from "vitest";
import { WorkflowRepositoryEngine } from "./mockRepository";
import { isValidQrToken } from "../domain/qrIdentity";

const engine = () => new WorkflowRepositoryEngine();

describe("QR identity engine", () => {
  it("mints an opaque identity for every new asset", async () => {
    const repository = engine();
    const created = await repository.execute({
      action: "asset.create",
      actor: "Tester",
      values: {
        name: "QR Laptop",
        serialNumber: "SN-QR-0001",
        category: "Laptops",
        codePrefix: "KCSMD",
      },
    });
    expect(created.ok).toBe(true);
    const asset = repository
      .snapshot()
      .assets.find((item) => item.id === created.entityId)!;
    expect(isValidQrToken(asset.qrToken || "")).toBe(true);
    const snapshot = repository.snapshot();
    const identity = snapshot.qrIdentities.find(
      (item) => item.id === asset.qrToken,
    );
    expect(identity).toMatchObject({
      assetId: asset.id,
      status: "ACTIVE",
      source: "created",
      createdBy: "Tester",
    });
    expect(snapshot.assetHistoryEvents[0]).toMatchObject({
      eventType: "qr_create",
      category: "qr",
      assetId: asset.id,
    });
  });

  it("backfills existing assets idempotently", async () => {
    const repository = engine();
    const legacy = repository.snapshot().assets[0];
    expect(legacy.qrToken).toBeUndefined();

    const first = await repository.execute({
      action: "qr.backfill",
      entityId: legacy.id,
      actor: "Tester",
    });
    expect(first.ok).toBe(true);
    const afterFirst = repository
      .snapshot()
      .assets.find((item) => item.id === legacy.id)!;
    expect(isValidQrToken(afterFirst.qrToken || "")).toBe(true);
    expect(afterFirst.qr).toBe(true);
    const minted = afterFirst.qrToken as string;
    expect(
      repository.snapshot().qrIdentities.find((item) => item.id === minted),
    ).toMatchObject({ assetId: legacy.id, status: "ACTIVE", source: "backfilled" });

    const reRun = await repository.execute({
      action: "qr.backfill",
      entityId: legacy.id,
      actor: "Tester",
    });
    expect(reRun.ok).toBe(true);
    const afterReRun = repository
      .snapshot()
      .assets.find((item) => item.id === legacy.id)!;
    expect(afterReRun.qrToken).toBe(minted);
    const matching = repository
      .snapshot()
      .qrIdentities.filter((item) => item.assetId === legacy.id);
    expect(matching.length).toBe(1);
  });

  it("revokes an identity and clears the token from the asset", async () => {
    const repository = engine();
    const legacy = repository.snapshot().assets[0];
    await repository.execute({
      action: "qr.backfill",
      entityId: legacy.id,
      actor: "Tester",
    });
    const token = repository
      .snapshot()
      .assets.find((item) => item.id === legacy.id)!.qrToken as string;

    const revoked = await repository.execute({
      action: "qr.revoke",
      entityId: legacy.id,
      actor: "Tester",
    });
    expect(revoked.ok).toBe(true);
    const asset = repository
      .snapshot()
      .assets.find((item) => item.id === legacy.id)!;
    expect(asset.qrToken).toBeUndefined();
    expect(asset.qr).toBe(false);
    expect(
      repository.snapshot().qrIdentities.find((item) => item.id === token),
    ).toMatchObject({ status: "REVOKED", revokedBy: "Tester" });
    expect(repository.snapshot().assetHistoryEvents[0]).toMatchObject({
      eventType: "qr_revoke",
      assetId: legacy.id,
    });

    const doubleRevoke = await repository.execute({
      action: "qr.revoke",
      entityId: legacy.id,
      actor: "Tester",
    });
    expect(doubleRevoke.ok).toBe(false);
  });

  it("replaces an identity by rotating to a fresh token", async () => {
    const repository = engine();
    const legacy = repository.snapshot().assets[1];
    await repository.execute({
      action: "qr.backfill",
      entityId: legacy.id,
      actor: "Tester",
    });
    const oldToken = repository
      .snapshot()
      .assets.find((item) => item.id === legacy.id)!.qrToken as string;

    const replaced = await repository.execute({
      action: "qr.replace",
      entityId: legacy.id,
      actor: "Tester",
    });
    expect(replaced.ok).toBe(true);
    const asset = repository
      .snapshot()
      .assets.find((item) => item.id === legacy.id)!;
    expect(isValidQrToken(asset.qrToken || "")).toBe(true);
    expect(asset.qrToken).not.toBe(oldToken);
    const old = repository.snapshot().qrIdentities.find(
      (item) => item.id === oldToken,
    );
    expect(old).toMatchObject({ status: "REVOKED", replacedByToken: asset.qrToken });
    const fresh = repository.snapshot().qrIdentities.find(
      (item) => item.id === asset.qrToken,
    );
    expect(fresh).toMatchObject({
      assetId: legacy.id,
      status: "ACTIVE",
      source: "rotated",
    });
  });

  it("records reprints only for identities that belong to the asset", async () => {
    const repository = engine();
    const legacy = repository.snapshot().assets[0];
    await repository.execute({
      action: "qr.backfill",
      entityId: legacy.id,
      actor: "Tester",
    });
    const reprint = await repository.execute({
      action: "qr.reprint",
      entityId: legacy.id,
      actor: "Tester",
    });
    expect(reprint.ok).toBe(true);
    const unknown = await repository.execute({
      action: "qr.reprint",
      entityId: "no-such-asset",
      actor: "Tester",
    });
    expect(unknown.ok).toBe(false);
  });
});