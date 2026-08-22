// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshUser, updateSelfProfile } = vi.hoisted(() => ({
  refreshUser: vi.fn(async () => undefined),
  updateSelfProfile: vi.fn(async () => undefined),
}));

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    language: "nl",
    user: {
      id: "user-1",
      name: "Test Gebruiker",
      email: "test@kangoeroeschool.com",
      department: "ICT",
      jobTitle: "Beheerder",
      initials: "TG",
    },
    emailVerified: true,
    refreshUser,
    updateProfilePhoto: vi.fn(),
  }),
}));

vi.mock("../auth/firebaseAuth", () => ({
  authErrorMessage: (reason: unknown) => String(reason),
  updateSelfProfile,
}));

vi.mock("../components/WorkflowUi", () => ({
  AccountBackButton: () => null,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { ProfilePage } from "./Account";

afterEach(() => {
  cleanup();
  refreshUser.mockClear();
  updateSelfProfile.mockClear();
});

describe("ProfilePage", () => {
  it("houdt het bewerkingspaneel open na het opslaan", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Profiel bewerken" }));
    const name = screen.getByRole("textbox", { name: "Volledige naam" });
    fireEvent.change(name, { target: { value: "Nieuwe Naam" } });
    fireEvent.click(screen.getByRole("button", { name: "Profiel opslaan" }));

    await waitFor(() => expect(updateSelfProfile).toHaveBeenCalled());
    expect(await screen.findByText("Profiel bijgewerkt.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Volledige naam" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Profiel opslaan" })).toBeVisible();
  });
});
