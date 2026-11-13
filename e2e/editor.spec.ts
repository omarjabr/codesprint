import { test, expect } from "@playwright/test";
import {
    gotoApp,
    isRunActive,
    readSnippetLines,
    resultWpm,
    startSession,
    typeSnippetLines,
    waitForStableSnippet,
    watchConsole,
} from "./helpers";

for (const language of ["Python", "JavaScript", "Java", "C++"]) {
    test(`${language} keeps syntax colors and correctable typing decorations`, async ({ page }) => {
        const errors = watchConsole(page);
        await gotoApp(page);
        await page.getByRole("button", { name: language, exact: true }).click();
        const lines = await waitForStableSnippet(page);

        // Tokenization must survive the reduced Monaco contribution list.
        await expect.poll(() => page.locator(".view-line span").evaluateAll((spans) =>
            new Set(spans.map((span) => getComputedStyle(span).color)).size,
        )).toBeGreaterThan(1);

        await startSession(page);
        const first = lines[0].trimStart()[0];
        await page.keyboard.type(first === "~" ? "!" : "~");
        await expect(page.locator(".cs-wrong").first()).toBeVisible();
        await page.keyboard.press("Backspace");
        await expect(page.locator(".cs-wrong")).toHaveCount(0);
        await page.keyboard.type(first);
        await expect(page.locator(".cs-complete").first()).toBeVisible();
        await page.keyboard.press("Backspace");
        await expect(page.locator(".cs-complete")).toHaveCount(0);

        await typeSnippetLines(page, lines);
        await expect(resultWpm(page)).toBeVisible({ timeout: 15000 });
        expect(errors).toEqual([]);
    });
}

test("Vim attaches before typing and survives a snippet change", async ({ page }) => {
    const errors = watchConsole(page);
    await page.addInitScript(() => {
        localStorage.setItem("codesprint-vim-mode-default-v1", "1");
        localStorage.setItem("codesprint-preferences", JSON.stringify({ vimMode: true }));
    });
    await gotoApp(page);
    for (const language of ["Python", "Java"]) {
        await page.getByRole("button", { name: language, exact: true }).click();
        await waitForStableSnippet(page);
        const status = page.locator(".vim-status-bar");
        await expect(status).toBeVisible();
        await expect(status).toContainText("NORMAL");
    }

    const lines = await waitForStableSnippet(page);
    await startSession(page);
    const cursor = page.locator(".monaco-editor .cursor").first();
    const caret = page.locator(".cs-caret");
    const topBefore = await cursor.evaluate((el) => (el as HTMLElement).style.top);
    const caretBefore = await caret.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--caret-y"));
    await page.keyboard.press("j");
    await expect.poll(() => cursor.evaluate((el) => (el as HTMLElement).style.top)).not.toBe(topBefore);
    await expect.poll(() => caret.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--caret-y"))).not.toBe(caretBefore);
    await expect(page.locator(".cs-wrong")).toHaveCount(0);
    expect(await isRunActive(page)).toBe(false);

    await page.keyboard.press("v");
    await expect(page.locator(".vim-status-bar")).toContainText("VISUAL");
    await expect(page.locator(".cs-wrong")).toHaveCount(0);

    await page.keyboard.press("Escape");
    const query = lines[0]?.trim().split(/\s+/).at(-1) ?? "";
    const leftBefore = await cursor.evaluate((el) => (el as HTMLElement).style.left);
    await page.keyboard.press("/");
    await page.keyboard.type(query);
    await page.keyboard.press("Enter");
    await expect.poll(() => cursor.evaluate((el) => (el as HTMLElement).style.left)).not.toBe(leftBefore);
    await expect(page.locator(".cs-wrong")).toHaveCount(0);

    const beforeEdit = await readSnippetLines(page);
    await page.keyboard.press("x");
    await expect(page.getByTestId("vim-edit-hint")).toHaveText("Edits belong to Vim drills");
    expect(await readSnippetLines(page)).toEqual(beforeEdit);
    await expect(page.locator(".cs-wrong")).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("Vim Insert types at the frontier and Escape leaves Insert", async ({ page }) => {
    const errors = watchConsole(page);
    await page.addInitScript(() => {
        localStorage.setItem("codesprint-vim-mode-default-v1", "1");
        localStorage.setItem("codesprint-preferences", JSON.stringify({ vimMode: true }));
    });
    await gotoApp(page);
    const lines = await waitForStableSnippet(page);
    await startSession(page);

    await page.keyboard.press("i");
    await expect(page.locator(".vim-status-bar")).toContainText("INSERT");
    expect(await isRunActive(page)).toBe(true);
    await expect(page.locator(".cs-wrong")).toHaveCount(0);

    const first = lines[0]?.trimStart()[0] ?? "";
    await page.keyboard.type(first);
    await expect(page.locator(".cs-complete").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".vim-status-bar")).toContainText("NORMAL");
    expect(await isRunActive(page)).toBe(true);
    await expect(page.locator(".cs-wrong")).toHaveCount(0);
    await expect(page.locator(".cs-complete").first()).toBeVisible();

    await page.keyboard.press("Escape");
    expect(await isRunActive(page)).toBe(false);
    await expect(page.locator(".cs-complete")).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("Vim Insert types on the line the caret moved to", async ({ page }) => {
    const errors = watchConsole(page);
    await page.addInitScript(() => {
        localStorage.setItem("codesprint-vim-mode-default-v1", "1");
        localStorage.setItem("codesprint-preferences", JSON.stringify({ vimMode: true }));
    });
    await gotoApp(page);
    const lines = await waitForStableSnippet(page);
    const target = lines[1]?.trimStart()[0] ?? "";
    test.skip(target.length === 0, "snippet has no second line to type");
    await startSession(page);

    const caret = page.locator(".cs-caret");
    const yBefore = await caret.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--caret-y"));
    await page.keyboard.press("j");
    await expect.poll(() => caret.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--caret-y"))).not.toBe(yBefore);

    await page.keyboard.press("i");
    await expect(page.locator(".vim-status-bar")).toContainText("INSERT");
    await page.keyboard.type(target);
    await expect(page.locator(".cs-complete").first()).toBeVisible();
    await expect(page.locator(".view-line").first().locator(".cs-complete")).toHaveCount(0);
    expect(await caret.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--caret-y"))).not.toBe(yBefore);
    expect(errors).toEqual([]);
});
