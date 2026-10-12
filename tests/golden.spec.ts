import { expect, test, type Page } from "@playwright/test";

/** One step, keyboard-first: guess, hold Space to look (twice), nudge the rating with arrows, answer. */
async function faceStep(page: Page) {
  await page.getByRole("button", { name: "Look", exact: true }).click();
  await expect(page.getByText("Hold to look")).toBeVisible();

  // Hold Space to look, let go (the image blurs again), then look once more.
  await page.keyboard.down("Space");
  await page.waitForTimeout(1000);
  await page.keyboard.up("Space");
  await page.keyboard.down("Space");
  await page.waitForTimeout(1000);
  await page.keyboard.up("Space");

  // Rate with the arrow keys while the slider isn't focused (5 points per press).
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await expect(page.getByText("Easier or worse than you expected?")).toBeVisible();
  await page.getByRole("button", { name: "Easier", exact: true }).click();
}

test("golden path on the demo spider ladder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Try the demo/ }).first().click();
  await expect(page).toHaveURL(/\/ladder\/demo-spiders$/);

  await page.getByRole("link", { name: /^Start\b/ }).first().click();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await page.getByRole("button", { name: "Begin", exact: true }).click();

  for (let step = 1; step <= 3; step++) {
    await expect(page.getByText(`Step ${step} of 9`)).toBeVisible();
    await faceStep(page);
    if (step < 3) await page.getByRole("button", { name: "Next step", exact: true }).click();
  }

  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nice work." })).toBeVisible();
  await page.getByRole("link", { name: "See report", exact: true }).click();

  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText(/Based on 3 ratings/).first()).toBeVisible();
});
