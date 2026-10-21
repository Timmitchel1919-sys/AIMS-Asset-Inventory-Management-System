import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud = "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function main() {
  const docId = "dept-groep-6b";
  const body = {
    fields: {
      kind: { stringValue: "department" },
      name: { stringValue: "Groep 6B" },
      status: { stringValue: "Active" },
      type: { stringValue: "Department" },
      details: { mapValue: { fields: {} } },
      createdDate: { timestampValue: new Date().toISOString() },
      lastUpdated: { timestampValue: new Date().toISOString() },
    },
  };
  const res = await fetch(`${base}/references?documentId=${docId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("Create Groep 6B status:", res.status);
  const json = await res.json();
  console.log("Response:", json.name || json.error);
}

main().catch(console.error);
