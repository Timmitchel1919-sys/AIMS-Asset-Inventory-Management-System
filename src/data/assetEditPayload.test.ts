import { describe, expect, it } from "vitest";
import { editableAssetValues } from "./assetEditPayload";

describe("editableAssetValues", () => {
  it("does not send read-only identifiers from an ordinary asset edit", () => {
    expect(
      editableAssetValues({
        code: "KHL-01",
        codePrefix: "KHL",
        codeNumber: "01",
        previousCodes: ["KHL-00"],
        codeCorrection: "KHL-02",
        correctionReason: "typo",
        name: "Corrected laptop name",
        location: "ICT Store",
      }),
    ).toEqual({ name: "Corrected laptop name", location: "ICT Store" });
  });
});
