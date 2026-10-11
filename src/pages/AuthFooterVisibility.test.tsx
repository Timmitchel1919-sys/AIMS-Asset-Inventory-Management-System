// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({ language: "en", user: null, authLoading: false }),
}));
vi.mock("../auth/firebaseAuth", () => ({
  authErrorMessage: () => "",
  forgotPassword: async () => undefined,
  googleLogin: async () => undefined,
  register: async () => undefined,
  validateRegistration: () => ({}),
}));
vi.mock("../components/auth/AuthBrandPanel", () => ({ AuthBrandPanel: () => null }));
vi.mock("../components/branding/AimsPublicLockup", () => ({ AimsPublicLockup: () => null }));

import Auth from "./Auth";

const renderAuth = (mode: "login" | "signup" | "forgot") =>
  render(
    <MemoryRouter>
      <Auth mode={mode} />
    </MemoryRouter>,
  );
afterEach(cleanup);

const footerTexts = [/Terms & Conditions/, /Privacy Notice/, /ICT Support/, /All rights reserved/, /Designed and developed by/];

describe("auth page footer", () => {
  it("is not shown on the sign-up page", () => {
    renderAuth("signup");
    for (const text of footerTexts) expect(screen.queryByText(text)).toBeNull();
    expect(document.querySelector(".auth-footer")).toBeNull();
  });
  it("is still shown on the login page", () => {
    renderAuth("login");
    expect(screen.getByText(/Terms & Conditions/)).toBeInTheDocument();
    expect(screen.getByText(/Designed and developed by/)).toBeInTheDocument();
  });
});
