import { describe, expect, it, beforeEach } from "vitest";
import { drillGoalMet, markDrillComplete, normalizeDrillText, readCompletedDrillIds, type VimDrillGoal } from "@/lib/vim-drills";

const cursorGoal: VimDrillGoal = { cursor: { line: 1, column: 7 } };
const textGoal: VimDrillGoal = { text: "keep\nkeep" };
const bothGoal: VimDrillGoal = { text: "paint blue barn", cursor: { line: 1, column: 1 } };

describe("drillGoalMet", () => {
    it("matches a cursor and ignores the text", () => {
        expect(drillGoalMet(cursorGoal, { text: "anything", line: 1, column: 7 })).toBe(true);
    });

    it("rejects a cursor miss", () => {
        expect(drillGoalMet(cursorGoal, { text: "anything", line: 1, column: 6 })).toBe(false);
    });

    it("matches text and ignores a trailing newline", () => {
        expect(drillGoalMet(textGoal, { text: "keep\nkeep\n", line: 2, column: 1 })).toBe(true);
    });

    it("rejects a text miss", () => {
        expect(drillGoalMet(textGoal, { text: "keep\nremove\nkeep", line: 1, column: 1 })).toBe(false);
    });

    it("requires both parts when the goal has text and a cursor", () => {
        expect(drillGoalMet(bothGoal, { text: "paint blue barn", line: 1, column: 1 })).toBe(true);
        expect(drillGoalMet(bothGoal, { text: "paint blue barn", line: 1, column: 2 })).toBe(false);
        expect(drillGoalMet(bothGoal, { text: "paint red barn", line: 1, column: 1 })).toBe(false);
    });

    it("normalizes Windows newlines", () => {
        expect(normalizeDrillText("keep\r\nkeep\r\n")).toBe("keep\nkeep");
    });
});

describe("completed drill ids", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("remembers an id once", () => {
        expect(readCompletedDrillIds()).toEqual([]);
        expect(markDrillComplete("motion-word")).toEqual(["motion-word"]);
        expect(markDrillComplete("motion-word")).toEqual(["motion-word"]);
        expect(readCompletedDrillIds()).toEqual(["motion-word"]);
    });
});
