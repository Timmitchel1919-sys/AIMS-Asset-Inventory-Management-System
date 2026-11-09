import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

const cases = [
  { theme: "dark", route: "/dashboard", collapsed: true, mobile: false, screenshot: "/tmp/aims-profile-dark-collapsed.png" },
  { theme: "aimsLight", route: "/assets", collapsed: false, mobile: false, screenshot: "/tmp/aims-profile-light-expanded.png" },
  { theme: "dark", route: "/dashboard", collapsed: false, mobile: true, screenshot: "/tmp/aims-profile-dark-mobile.png" },
  { theme: "aimsLight", route: "/assets", collapsed: false, mobile: true, screenshot: "/tmp/aims-profile-light-mobile.png" },
] as const;

for (const item of cases) {
  test(`profile menu opens from its ${item.mobile ? "mobile" : item.collapsed ? "collapsed" : "expanded"} ${item.theme} topbar trigger`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.setViewportSize(item.mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 });
    await page.addInitScript(({ theme, collapsed }) => {
      localStorage.setItem("kcs-auth", "in");
      localStorage.setItem("kcs-role", "administrator");
      localStorage.setItem("authenticatedThemePreference", theme);
      localStorage.setItem("kcs-sidebar-collapsed", String(collapsed));
    }, { theme: item.theme, collapsed: item.collapsed });
    await page.goto(item.route);
    await expect(page).toHaveURL(new RegExp(`${item.route}$`));
    await expect(page.getByRole("heading").first()).toBeVisible();

    if (item.mobile) {
      await page.locator(".topbar-menu-trigger").click();
      await expect(page.locator(".app-sidebar")).toHaveClass(/open/);
    }

    const profileButton = page.getByRole("button", { name: /open account menu/i });
    await profileButton.hover();
    await page.waitForTimeout(220);
    const profileHoverBackground = await profileButton.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(profileHoverBackground).not.toBe("rgba(0, 0, 0, 0)");
    await page.screenshot({
      path: item.screenshot.replace(".png", "-hover.png"),
      fullPage: false,
    });
    await profileButton.click();
    if (item.mobile) {
      await expect(page.locator(".app-sidebar")).not.toHaveClass(/open/);
    }

    const accountMenu = page.locator("#account-menu");
    await expect(accountMenu).toBeVisible();
    await expect(page.locator(".authenticated-app")).toHaveAttribute(
      "data-profile-menu-open",
      "true",
    );
    const accountScrim = page.locator(".account-sheet-scrim");
    await expect(accountScrim).toBeVisible();
    expect(await accountScrim.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )).not.toBe("rgba(0, 0, 0, 0)");
    const [menuBox, buttonBox] = await Promise.all([
      accountMenu.boundingBox(),
      profileButton.boundingBox(),
    ]);
    expect(menuBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(menuBox!.y).toBeGreaterThanOrEqual(buttonBox!.y + buttonBox!.height);
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
      item.mobile ? 390 : 1440,
    );
    await page.screenshot({ path: item.screenshot, fullPage: false });
    expect(
      consoleErrors.filter(
        (message) => !message.includes("ERR_TUNNEL_CONNECTION_FAILED"),
      ),
    ).toEqual([]);
  });
}
