import { describe, expect, it } from "vitest";
import { assetFormDefaults, assetFormSchema } from "./assetManagement";

const messages = {
  required: "required",
  serial: "serial",
  prefix: "prefix",
  correctionReason: "reason",
  price: "price",
};

describe("legacy asset edit validation", () => {
  it("allows one-field repair even when historical required fields are blank", () => {
    const result = assetFormSchema(messages, true).safeParse({
      ...assetFormDefaults,
      codePrefix: "",
      codeNumber: "",
      name: "",
      category: "",
      type: "",
      serialNumber: "",
      location: "",
      currentLocationId: "",
      department: "",
      notes: "corrected note",
    });
    expect(result.success).toBe(true);
  });

  it("keeps complete identifying fields required when creating an asset", () => {
    const result = assetFormSchema(messages, false).safeParse({
      ...assetFormDefaults,
      notes: "only one field",
    });
    expect(result.success).toBe(false);
  });
});
