// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockInventoryRepository } from "../../data/mockRepository";
import { RepositoryProvider } from "../../data/repositoryContext";

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({ language: "en", user: { id: "u1", name: "Ann", role: "administrator" } }),
}));

import { StarterLocationsButton } from "./StarterLocationsButton";

let repo: MockInventoryRepository;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  localStorage.setItem("kcs-language", "en");
  repo = new MockInventoryRepository();
});
afterEach(cleanup);

const departments = () => repo.snapshot().references.filter((r) => r.kind === "department");

describe("StarterLocationsButton", () => {
  it("shows what will be added, adds only after confirmation, then disables itself", async () => {
    render(<RepositoryProvider repository={repo}><StarterLocationsButton /></RepositoryProvider>);
    const before = departments().length;
    const open = screen.getByRole("button", { name: /Kangoeroe High and Lokaal 3 - Lokaal 16/ });
    expect(open).toBeEnabled();
    fireEvent.click(open);
    expect(screen.getByText(/14 department\(s\) will be added \(Lokaal 3 to Lokaal 16\)/)).toBeInTheDocument();
    expect(departments()).toHaveLength(before); // nothing yet
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(departments()).toHaveLength(before + 14), { timeout: 15000 });
    expect(await screen.findByText(/14 department\(s\) added/, undefined, { timeout: 15000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Kangoeroe High and Lokaal 3/ })).toBeDisabled());
  }, 30000);
});
