import { expect, test, type Page } from "@playwright/test";

/** One rung, keyboard-first: predict, hold Space to look, rate with arrows, reflect. */
async function rateRung(page: Page, n: number) {
  await expect(page.getByRole("heading", { name: /./ }).first()).toBeVisible();
  await page.getByRole("button", { name: "I'll panic" }).click();
  await page.getByRole("button", { name: "I’m ready to look" }).click();

  // Hold Space to look (hold-to-view), release, look again.
  await page.locator("body").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(1200);
  await page.keyboard.up("Space");
  await page.keyboard.down("Space");
  await page.waitForTimeout(800);
  await page.keyboard.up("Space");
  // Rate distress with the arrow keys.
  for (let i = 0; i < n + 2; i++) await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByLabel("What did you learn?").fill(`It stayed still on rung ${n}.`);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "What next?" })).toBeVisible();
}

test("golden path on the demo spider ladder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the demo ladder" }).click();
  await expect(page).toHaveURL(/\/ladder\/demo-spiders$/);
  await expect(page.getByText("Demo ladder", { exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: /Start session/ }).click();
  await expect(page.getByRole("heading", { name: "Take your time." })).toBeVisible();
  await page.getByRole("button", { name: "Begin" }).click();

  await rateRung(page, 1);
  await page.getByRole("button", { name: /Climb to rung 2/ }).click();
  await rateRung(page, 2);
  await page.getByRole("button", { name: /Climb to rung 3/ }).click();
  await rateRung(page, 3);

  await page.getByRole("button", { name: "End the session for today" }).click();
  await expect(page.getByRole("heading", { name: "You did the work today." })).toBeVisible();
  await page.getByRole("button", { name: "Open the report" }).click();

  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText("3 exposures")).toBeVisible();
  await expect(page.getByText("“It stayed still on rung 3.”")).toBeVisible();
  await expect(page.getByText(/Exploratory: based on 3 ratings/)).toBeVisible();
});
