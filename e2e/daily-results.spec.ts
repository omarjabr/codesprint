import { test, expect } from "@playwright/test";
import { gotoApp } from "./helpers";

test("header marks today done after reload and keeps the all-time best in storage", async ({ page }) => {
    await page.addInitScript(() => {
        const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
        const today = date(new Date());
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const bestDate = date(yesterday);
        localStorage.setItem("codesprint-daily", JSON.stringify({
            streak: { currentStreak: 2, longestStreak: 2, lastActiveDate: today, streakStartDate: bestDate },
            lastCompletedDate: today, completedDates: [bestDate, today],
            best: { wpm: 110, accuracy: 0.99, dateStr: bestDate },
            resultsByDate: { [today]: { wpm: 90, accuracy: 0.95, dateStr: today } },
        }));
    });
    await gotoApp(page);
    await expect(page.getByRole("button", { name: /^Daily Challenge #\d+, done$/ })).toBeVisible();
    await expect(page.getByText("110", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: /^Daily Challenge #\d+, done$/ })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("codesprint-daily")!).best.wpm)).toBe(110);
});

test("legacy completion with only yesterday's best never shares that score as today's", async ({ page }) => {
    await page.addInitScript(() => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        localStorage.setItem("codesprint-daily", JSON.stringify({
            completedDates: ["2024-01-01", today], lastCompletedDate: today,
            best: { wpm: 110, accuracy: 0.99, dateStr: "2024-01-01" },
        }));
    });
    await gotoApp(page);
    await expect(page.getByRole("button", { name: /^Daily Challenge #\d+, done$/ })).toBeVisible();
    await expect(page.getByText("110", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy result" })).toHaveCount(0);
});
