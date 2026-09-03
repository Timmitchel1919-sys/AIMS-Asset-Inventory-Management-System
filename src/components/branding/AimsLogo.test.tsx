// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const theme = { value: "aimsMidnight" };
vi.mock("../../context/AppContext", () => ({
  useApp: () => ({ effectiveTheme: theme.value }),
}));

import { AimsLogo } from "./AimsLogo";

afterEach(cleanup);

describe("<AimsLogo>", () => {
  it("sidebar placement follows the theme: blue normally, green under Green", () => {
    theme.value = "aimsMidnight";
    const { container, rerender } = render(<AimsLogo placement="sidebar" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/aims-logo-blue.png",
    );

    theme.value = "aimsEmeraldGloss";
    rerender(<AimsLogo placement="sidebar" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/aims-logo-green.png",
    );
  });

  it("every non-sidebar placement stays blue even under the Green theme", () => {
    theme.value = "aimsEmeraldGloss";
    const { container } = render(<AimsLogo />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/aims-logo-blue.png",
    );
  });

  it("carries the brand alt text, or an empty alt when decorative", () => {
    theme.value = "aimsMidnight";
    const meaningful = render(<AimsLogo />);
    expect(meaningful.container.querySelector("img")).toHaveAttribute(
      "alt",
      "AIMS — Asset & Inventory Management System",
    );
    cleanup();
    const decorative = render(<AimsLogo decorative />);
    expect(decorative.container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
