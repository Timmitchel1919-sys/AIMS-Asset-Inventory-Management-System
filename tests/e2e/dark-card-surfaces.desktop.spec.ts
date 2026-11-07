import { expect, test } from "@playwright/test";

async function mountCardProbe(page: import("@playwright/test").Page, theme: "dark" | "aims-light") {
  await page.goto("/login");
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    const probe = document.createElement("div");
    probe.id = "theme-card-probe";
    probe.innerHTML = `
      <div class="authenticated-app">
        <aside class="app-sidebar">Sidebar</aside>
        <main><article class="card">Card</article></main>
      </div>`;
    document.body.append(probe);
  }, theme);
}

test("dark cards share the obsidian surface while the sidebar stays independent", async ({ page }) => {
  await mountCardProbe(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const card = page.locator("#theme-card-probe main .card");
  await expect(card).toBeVisible();
  const cardStyle = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      backdropFilter: style.backdropFilter,
    };
  });

  expect(cardStyle.backgroundColor).toBe("rgb(13, 16, 21)");
  expect(cardStyle.backgroundImage).toBe("none");
  expect(cardStyle.borderColor).toBe("rgb(39, 44, 53)");
  expect(Number.parseFloat(cardStyle.borderRadius)).toBeGreaterThanOrEqual(21);
  expect(cardStyle.backdropFilter).toBe("none");

  const sidebarBackground = await page
    .locator(".app-sidebar")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(sidebarBackground).not.toBe(cardStyle.backgroundColor);
});

test("light theme card surfaces remain untouched", async ({ page }) => {
  await mountCardProbe(page, "aims-light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "aims-light");
  const background = await page
    .locator("#theme-card-probe main .card")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgb(13, 16, 21)");
});
