// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assets } from "../data/mock";
import { defaultPolicyRules } from "../domain/deviceManagement";

const store = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  queueCommands: vi.fn(async (_request: unknown) => "batch"),
  assignPolicy: vi.fn(async () => undefined),
  enrollDevices: vi.fn(async () => undefined),
}));

vi.mock("../context/AppContext", () => ({
  useApp: () => ({ language: "en", user: { id: "owner", name: "Owner", role: "owner" } }),
}));
vi.mock("../data/repositoryContext", () => ({
  useMockSnapshot: () => ({ assets }),
}));
vi.mock("../i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("../data/deviceManagementStore", () => ({
  useDeviceManagementData: () => store.data,
  queueCommands: store.queueCommands,
  assignPolicy: store.assignPolicy,
  enrollDevices: store.enrollDevices,
  unenrollDevice: vi.fn(),
  savePolicy: vi.fn(),
  deletePolicy: vi.fn(),
  cancelCommand: vi.fn(),
}));

import DeviceManagement from "./DeviceManagement";

const [first, second] = assets;
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DeviceManagement />
    </MemoryRouter>,
  );

beforeEach(() => {
  // jsdom has no <dialog> modal support.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  store.queueCommands.mockClear();
  store.data = {
    connected: true,
    loading: false,
    error: "",
    devices: [
      { assetId: first.id, assetCode: first.code, policyId: "p1" },
      { assetId: second.id, assetCode: second.code },
    ],
    policies: [
      { id: "p1", name: "Standard", description: "", active: true, rules: { ...defaultPolicyRules, requireAssignee: true } },
    ],
    commands: [],
    audit: [],
  };
});
afterEach(cleanup);

describe("DeviceManagement page", () => {
  it("shows the no-agent notice and the managed device register", () => {
    renderAt("/device-management");
    expect(screen.getByRole("note")).toHaveTextContent(/No device agent is connected/);
    expect(screen.getByText(first.code)).toBeInTheDocument();
    expect(screen.getByText(second.code)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });
  it("selects the tab from the route", () => {
    renderAt("/device-policies");
    expect(screen.getByRole("tab", { name: "Policies" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });
  it("is unavailable without Firebase", () => {
    store.data = { ...store.data, connected: false };
    renderAt("/device-management");
    expect(screen.getByText("Firebase is not connected")).toBeInTheDocument();
  });
  it("queues a bulk command only with a reason for sensitive types and an acknowledgement", () => {
    renderAt("/device-management");
    fireEvent.click(screen.getByLabelText(first.code));
    fireEvent.click(screen.getByRole("button", { name: "Queue command" }));
    const dialog = screen.getByRole("dialog", { name: "New command" });
    fireEvent.change(within(dialog).getByLabelText("Command"), { target: { value: "wipe" } });
    const submit = within(dialog).getAllByRole("button", { name: "Queue command" }).at(-1)!;
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Device stolen, case 12" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /only records a request/ }));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(store.queueCommands).toHaveBeenCalledTimes(1);
    expect(store.queueCommands.mock.calls[0][0]).toMatchObject({ type: "wipe", targets: [{ assetId: first.id }] });
  });
});
