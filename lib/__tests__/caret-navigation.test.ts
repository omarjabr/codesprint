import { describe, expect, it } from "vitest";
import { allowedCaretPositions, jumpCaret, jumpWord, moveCaret, progressAfterCaretJump } from "@/lib/caret-navigation";

describe("allowedCaretPositions", () => {
    it("includes the typed prefix and an auto-closed closer ahead of it", () => {
        expect(allowedCaretPositions("call(bar)".length, 5, [8])).toEqual([0, 1, 2, 3, 4, 5, 8, 9]);
    });

    it("includes the slot after a closer that ends the snippet", () => {
        expect(allowedCaretPositions(2, 1, [1])).toEqual([0, 1, 2]);
    });
});

describe("moveCaret", () => {
    it("stops at the typed frontier when nothing ahead was written", () => {
        const content = "hello";
        const right = moveCaret(content, 2, 2, [], "ArrowRight", 2);
        expect(right.cursor).toBe(2);

        const left = moveCaret(content, 0, 2, [], "ArrowLeft", 0);
        expect(left.cursor).toBe(0);
    });

    it("steps onto an auto-closed closer and then past it, skipping untyped text", () => {
        const content = "call(bar)";
        const onCloser = moveCaret(content, 5, 5, [8], "ArrowRight", 5);
        expect(onCloser.cursor).toBe(8);

        const pastCloser = moveCaret(content, 8, 5, [8], "ArrowRight", 8);
        expect(pastCloser.cursor).toBe(9);

        const backToCloser = moveCaret(content, 9, 5, [8], "ArrowLeft", 9);
        expect(backToCloser.cursor).toBe(8);

        const backToFrontier = moveCaret(content, 8, 5, [8], "ArrowLeft", 8);
        expect(backToFrontier.cursor).toBe(5);
    });

    it("moves up and down only on lines that were written, clamping the column", () => {
        const content = "alpha\nbeta\ngamma";
        const up = moveCaret(content, 10, 10, [], "ArrowUp", 4);
        expect(up.cursor).toBe(4);
        expect(up.preferredColumn).toBe(4);

        const down = moveCaret(content, 4, 10, [], "ArrowDown", up.preferredColumn);
        expect(down.cursor).toBe(10);
    });

    it("does not enter a line the user has not reached", () => {
        const content = "ab\ncd";
        const down = moveCaret(content, 2, 2, [], "ArrowDown", 2);
        expect(down.cursor).toBe(2);
    });

    it("lands on a later line's closer without walking through untyped characters", () => {
        const content = "foo(\n)\n";
        const down = moveCaret(content, 4, 4, [5], "ArrowDown", 0);
        expect(down.cursor).toBe(5);
    });
});

describe("jumpCaret", () => {
    it("jumps to the start of the line and the end of the typed word", () => {
        const content = "hello world\nnext";
        const end = jumpCaret(content, 2, 8, [], "right");
        expect(end.cursor).toBe(8);

        const start = jumpCaret(content, 8, 8, [], "left");
        expect(start.cursor).toBe(0);
    });

    it("jumps to the end of a finished line and does not enter the next one", () => {
        const content = "hello world\nnext";
        const end = jumpCaret(content, 3, 11, [], "right");
        expect(end.cursor).toBe(11);

        const start = jumpCaret(content, end.cursor, 11, [], "left");
        expect(start.cursor).toBe(0);
    });

    it("does not leap from the typed word to a closer across untyped text", () => {
        const content = "call(bar)";
        const end = jumpCaret(content, 2, 5, [8], "right");
        expect(end.cursor).toBe(5);
    });
});

describe("jumpWord", () => {
    it("steps to the end of each typed word and then back to the start", () => {
        const content = "hello world\nnext";
        const endOfHello = jumpWord(content, 2, 11, [], "right");
        expect(endOfHello.cursor).toBe(5);

        const endOfWorld = jumpWord(content, endOfHello.cursor, 11, [], "right");
        expect(endOfWorld.cursor).toBe(11);

        const startOfWorld = jumpWord(content, endOfWorld.cursor, 11, [], "left");
        expect(startOfWorld.cursor).toBe(6);

        const startOfHello = jumpWord(content, startOfWorld.cursor, 11, [], "left");
        expect(startOfHello.cursor).toBe(0);
    });

    it("stops at the end of the word that has been typed", () => {
        const content = "hello world";
        const end = jumpWord(content, 2, 8, [], "right");
        expect(end.cursor).toBe(5);

        const typedEnd = jumpWord(content, end.cursor, 8, [], "right");
        expect(typedEnd.cursor).toBe(8);
    });

    it("does not cross untyped text to reach a later closer", () => {
        const content = "call(bar)";
        const end = jumpWord(content, 1, 5, [8], "right");
        expect(end.cursor).toBe(4);

        const frontier = jumpWord(content, end.cursor, 5, [8], "right");
        expect(frontier.cursor).toBe(5);
    });
});

describe("progressAfterCaretJump", () => {
    it("extends progress only across a closer that is already the next character", () => {
        expect(progressAfterCaretJump(1, 2, 1, [1])).toBe(2);
        expect(progressAfterCaretJump(5, 9, 5, [8])).toBe(5);
        expect(progressAfterCaretJump(2, 5, 5, [])).toBe(5);
    });
});
