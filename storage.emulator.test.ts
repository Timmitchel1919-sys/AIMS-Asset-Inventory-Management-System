import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { getMetadata, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

let environment: RulesTestEnvironment;
const verified = (email = "verified@kangoeroeschool.com") => ({ email, email_verified: true });

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "aims-storage-rules-test",
    storage: { host: "127.0.0.1", port: 9199, rules: readFileSync("storage.rules", "utf8") },
  });
});
afterAll(() => environment.cleanup());

describe("AIMS Storage authorization", () => {
  it("allows a verified exact-domain user to write only under their uid", async () => {
    const storage = environment.authenticatedContext("user-1", verified()).storage();
    await assertSucceeds(uploadBytes(ref(storage, "aims/user-1/asset.txt"), new Uint8Array([1])));
    await assertFails(uploadBytes(ref(storage, "aims/user-2/asset.txt"), new Uint8Array([1])));
  });

  it("denies unverified, wrong-domain, lookalike, and unauthenticated users", async () => {
    const attempts = [
      environment.unauthenticatedContext(),
      environment.authenticatedContext("wrong", verified("person@gmail.com")),
      environment.authenticatedContext("lookalike", verified("person@kangoeroeschool.com.attacker.com")),
      environment.authenticatedContext("unverified", { email: "person@kangoeroeschool.com", email_verified: false }),
    ];
    for (const context of attempts) {
      await assertFails(uploadBytes(ref(context.storage(), "aims/unverified/file.txt"), new Uint8Array([1])));
    }
  });

  it("enforces the ten-megabyte limit and default-denies other paths", async () => {
    const storage = environment.authenticatedContext("user-1", verified()).storage();
    await assertFails(uploadBytes(ref(storage, "aims/user-1/large.bin"), new Uint8Array(10 * 1024 * 1024)));
    await assertFails(uploadBytes(ref(storage, "other/user-1/file.txt"), new Uint8Array([1])));
  });

  it("allows verified school users to read an existing AIMS object", async () => {
    const owner = environment.authenticatedContext("owner", verified()).storage();
    await uploadBytes(ref(owner, "aims/owner/shared.txt"), new Uint8Array([1]));
    const reader = environment.authenticatedContext("reader", verified("reader@kangoeroeschool.com")).storage();
    await assertSucceeds(getMetadata(ref(reader, "aims/owner/shared.txt")));
  });
});
