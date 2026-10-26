import { expect, test, type Page } from "@playwright/test";

const themes = [
  ["kcs-azure-intelligence", "aimsLight"],
  ["dark", "dark"],
  ["aims-turquoise-glass", "aimsTurquoiseGlass"],
] as const;

async function makeTableScrollable(page: Page) {
  await page.locator("table").first().evaluate((table) => {
    const body = table.tBodies[0];
    const source = Array.from(body?.rows ?? []);
    if (!body || source.length === 0) return;
    for (let copy = 0; copy < 16; copy += 1) {
      source.forEach((row) => body.append(row.cloneNode(true)));
    }
  });
}

async function verifyStickyHeader(page: Page) {
  const table = page.locator("table").first();
  const header = table.locator("thead th").first();
  await expect(header).toBeVisible();
  await makeTableScrollable(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const scrollHost = table.locator("xpath=parent::*");
  await scrollHost.evaluate((element) => { element.scrollTop = 0; element.scrollLeft = 0; });

  const initial = await header.boundingBox();
  expect(initial).not.toBeNull();
  expect(await header.evaluate((cell) => getComputedStyle(cell).top)).toBe("0px");
  expect(await table.evaluate((element) => Math.abs(
    element.tHead!.rows[0].cells[0].getBoundingClientRect().top - element.parentElement!.getBoundingClientRect().top,
  ))).toBeLessThanOrEqual(2);

  await scrollHost.evaluate((element) => { element.scrollTop = Math.min(900, element.scrollHeight - element.clientHeight); });
  expect(await table.evaluate((element) => Math.abs(
    element.tHead!.rows[0].cells[0].getBoundingClientRect().top - element.parentElement!.getBoundingClientRect().top,
  ))).toBeLessThanOrEqual(2);
  expect(await header.evaluate((cell) => getComputedStyle(cell).position)).toBe("sticky");
  expect(await header.evaluate((cell) => getComputedStyle(cell).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  const firstCell = table.locator("tbody tr").first().locator("td,th").first();
  const before = { header: await header.boundingBox(), cell: await firstCell.boundingBox() };
  await scrollHost.evaluate((element) => { element.scrollLeft = 180; });
  const after = { header: await header.boundingBox(), cell: await firstCell.boundingBox() };
  expect(Math.round((before.header?.x ?? 0) - (before.cell?.x ?? 0))).toBe(
    Math.round((after.header?.x ?? 0) - (after.cell?.x ?? 0)),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "en");
  });
});

test("shared table header stays frozen and opaque in the three required theme families", async ({ page }) => {
  for (const [cssTheme, aimsTheme] of themes) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/assets");
    await page.evaluate(([theme, aims]) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.aimsTheme = aims;
    }, [cssTheme, aimsTheme]);
    await verifyStickyHeader(page);
  }
});

test("shared behavior covers inventory, administration, users and network tables", async ({ page }) => {
  for (const route of ["/assets", "/inventory", "/users", "/device-management"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    if (route === "/device-management" && !(await page.locator("table").count())) {
      await page.locator(".page").evaluate((pageRoot) => {
        const fixture = document.createElement("div");
        fixture.className = "dm-table-wrap";
        fixture.innerHTML = `<table><thead><tr><th>Device</th><th>Status</th><th>Last seen</th></tr></thead><tbody>${Array.from(
          { length: 30 },
          (_, index) => `<tr><td>Device ${index + 1}</td><td>Online</td><td>Now</td></tr>`,
        ).join("")}</tbody></table>`;
        pageRoot.append(fixture);
      });
    }
    await expect(page.locator("table").first(), route).toBeVisible();
    await verifyStickyHeader(page);
  }
});

test("required responsive widths remain free of page-level horizontal overflow", async ({ page }) => {
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[375,812]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/assets");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}x${height}`).toBeLessThanOrEqual(width);
  }
});

test("Main location header never wraps", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/assets");
  const mainLocation = page.locator('th[data-column-id="location"]');
  await expect(mainLocation).toBeVisible();
  await expect(mainLocation).toHaveCSS("white-space", "nowrap");
});

test("ICT Assets selection boxes align and data columns share equal width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets");

  const table = page.locator('[data-testid="table-assets"] table');
  const headerCheckbox = table.locator('thead input[type="checkbox"]');
  const rowCheckbox = table.locator('tbody input[type="checkbox"]').first();
  const [headerBox, rowBox] = await Promise.all([
    headerCheckbox.boundingBox(),
    rowCheckbox.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(headerBox?.x).toBeCloseTo(rowBox?.x ?? 0, 0);

  const widths = await table.locator("thead th[data-column-id]").evaluateAll((cells) =>
    cells.map((cell) => cell.getBoundingClientRect().width),
  );
  expect(widths.length).toBeGreaterThan(1);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
});
