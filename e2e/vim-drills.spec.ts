import { expect, test } from "@playwright/test";
import { gotoApp, resultWpm, watchConsole } from "./helpers";

test("Vim drills complete a motion and a delete without a typing result", async ({ page }) => {
    const errors = watchConsole(page);
    await gotoApp(page);

    await page.getByRole("button", { name: "Vim", exact: true }).click();
    await expect(page.getByTestId("vim-drill-session")).toBeVisible();
    await expect(page.getByText("Move onto the word marker")).toBeVisible();
    const status = page.locator(".vim-status-bar");
    await expect(status).toContainText("NORMAL");

    await page.locator(".monaco-editor textarea").focus();
    await page.keyboard.press("w");
    await expect(page.getByTestId("vim-drill-complete")).toBeVisible();

    await page.getByRole("button", { name: "Next drill" }).click();
    await expect(page.getByText("Delete the middle line")).toBeVisible();
    await expect(status).toContainText("NORMAL");
    await page.locator(".monaco-editor textarea").focus();
    await page.keyboard.press("j");
    await page.keyboard.press("d");
    await page.keyboard.press("d");
    await expect(page.getByTestId("vim-drill-complete")).toBeVisible();
    await expect(resultWpm(page)).toHaveCount(0);
    expect(errors).toEqual([]);
});
