// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_ACCOUNT_MENU_EVENT } from "../lib/accountMenu";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({ language: "nl" }),
}));

import { AccountBackButton, Dialog } from "./WorkflowUi";

function CurrentPath() {
  return <output>{useLocation().pathname}</output>;
}

afterEach(cleanup);

describe("AccountBackButton", () => {
  it("gaat terug en vraagt het accountpaneel opnieuw te openen", () => {
    const onOpen = vi.fn();
    window.addEventListener(OPEN_ACCOUNT_MENU_EVENT, onOpen, { once: true });

    render(
      <MemoryRouter initialEntries={["/dashboard", "/profile"]} initialIndex={1}>
        <AccountBackButton />
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Terug" }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByText("/dashboard")).toBeVisible();
  });
});

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

describe("Dialog", () => {
  it("remounts form content after closing so default values belong to the selected record", () => {
    const { rerender } = render(
      <Dialog open title="Edit" onClose={() => {}}>
        <input aria-label="Code group name" defaultValue="First group" />
      </Dialog>,
    );

    expect(screen.getByLabelText("Code group name")).toHaveValue("First group");

    rerender(
      <Dialog open={false} title="Edit" onClose={() => {}}>
        <input aria-label="Code group name" defaultValue="First group" />
      </Dialog>,
    );
    expect(screen.queryByLabelText("Code group name")).not.toBeInTheDocument();

    rerender(
      <Dialog open title="Edit" onClose={() => {}}>
        <input aria-label="Code group name" defaultValue="Second group" />
      </Dialog>,
    );

    expect(screen.getByLabelText("Code group name")).toHaveValue("Second group");
  });
});
