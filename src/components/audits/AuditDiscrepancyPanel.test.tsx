// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockInventoryRepository } from "../../data/mockRepository";
import { withAssetWorkflowComposition } from "../../data/assetWorkflowComposition";
import { RepositoryProvider, useMockSnapshot } from "../../data/repositoryContext";

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({ language: "en", user: { id: "u1", name: "Reviewer", email: "r@kangoeroeschool.com", role: "administrator" } }),
}));
vi.mock("../../i18n", () => ({ useT: () => (key: string) => key.split(".").pop() ?? key }));

import { AuditDiscrepancyPanel } from "./AuditDiscrepancyPanel";

let repo: MockInventoryRepository;

function Harness({ auditId }: { auditId: string }) {
  const snapshot = useMockSnapshot();
  const audit = snapshot.audits.find((item) => item.id === auditId)!;
  return <AuditDiscrepancyPanel audit={audit} />;
}

async function seed() {
  const generated = await repo.execute({ action: "audit.generate", values: { name: "UI control", count: repo.snapshot().assets.length, seed: "U", assignee: "A", deadline: "2026-12-31" } });
  const audit = repo.snapshot().audits.find((a) => a.id === generated.entityId)!;
  const item = audit.sampleItems!.find((i) => repo.snapshot().assets.some((a) => a.id === i.recordId))!;
  await repo.execute({ action: "audit.discrepancy", entityId: audit.id, values: { scannedCode: item.code, outcome: "Wrong location" } });
  return { audit, assetId: item.recordId };
}

beforeEach(() => {
  localStorage.setItem("kcs-language", "en");
  repo = withAssetWorkflowComposition(new MockInventoryRepository());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AuditDiscrepancyPanel", () => {
  it("says so when a control has no discrepancies", async () => {
    const generated = await repo.execute({ action: "audit.generate", values: { name: "Clean", count: 2, seed: "C", assignee: "A", deadline: "2026-12-31" } });
    render(<RepositoryProvider repository={repo}><Harness auditId={generated.entityId!} /></RepositoryProvider>);
    expect(screen.getByText("No discrepancies recorded for this control.")).toBeInTheDocument();
  });

  it("walks a discrepancy through proposal, approval and application without touching data early", async () => {
    const { audit, assetId } = await seed();
    const asset = () => repo.snapshot().assets.find((a) => a.id === assetId)!;
    const was = asset().condition;
    const next = was === "Poor" ? "Fair" : "Poor";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RepositoryProvider repository={repo}><Harness auditId={audit.id} /></RepositoryProvider>);

    // Nothing is applied just because a discrepancy exists.
    expect(screen.getByText(/never changes the asset records automatically/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Propose correction" }));
    fireEvent.change(screen.getByLabelText("What should be corrected"), { target: { value: "condition" } });
    fireEvent.change(screen.getByLabelText(/New value/), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/Justification/), { target: { value: "Checked by hand" } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit proposal for review" }).closest("form")!);

    // Pending review: nothing changed yet, and it cannot be applied.
    expect(await screen.findByText("Awaiting review", undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(asset().condition).toBe(was);
    expect(screen.queryByRole("button", { name: "Apply approved correction" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const apply = await screen.findByRole("button", { name: "Apply approved correction" }, { timeout: 8000 });
    expect(asset().condition).toBe(was); // approval alone changes nothing
    fireEvent.click(apply);

    await waitFor(() => expect(asset().condition).toBe(next), { timeout: 8000 });
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(`Applied`, undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Close discrepancy" }, { timeout: 8000 })).toBeInTheDocument();
  });

  it("does not apply when the reviewer declines the confirmation", async () => {
    const { audit, assetId } = await seed();
    const was = repo.snapshot().assets.find((a) => a.id === assetId)!.condition;
    const next = was === "Poor" ? "Fair" : "Poor";
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<RepositoryProvider repository={repo}><Harness auditId={audit.id} /></RepositoryProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Propose correction" }));
    fireEvent.change(screen.getByLabelText(/New value/), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/Justification/), { target: { value: "Reason" } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit proposal for review" }).closest("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }, { timeout: 8000 }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply approved correction" }, { timeout: 8000 }));
    expect(repo.snapshot().assets.find((a) => a.id === assetId)!.condition).toBe(was);
  });

  it("offers only statuses the asset may move to", async () => {
    const { audit, assetId } = await seed();
    repo.snapshot().assets.find((a) => a.id === assetId)!.status = "Archived";
    render(<RepositoryProvider repository={repo}><Harness auditId={audit.id} /></RepositoryProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Propose correction" }));
    fireEvent.change(screen.getByLabelText("What should be corrected"), { target: { value: "status" } });
    const select = screen.getByLabelText(/New value/);
    // An archived asset has no valid next status: only the placeholder remains.
    expect(within(select).getAllByRole("option")).toHaveLength(1);
  });
});
