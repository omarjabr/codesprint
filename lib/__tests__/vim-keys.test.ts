import { describe, expect, it } from "vitest";
import { classifyVimKey, vimInsertIndex, vimRunComplete } from "@/lib/vim-keys";

describe("classifyVimKey", () => {
    it("treats motions, counts, visual, and search as motions", () => {
        for (const key of ["j", "k", "w", "b", "0", "$", "g", "G", "3", "v", "V", "/", "?"]) {
            expect(classifyVimKey(key)).toBe("motion");
        }
    });

    it("treats mutating commands as edits", () => {
        for (const key of ["d", "c", "x", "s", "r", "o", "O", "p", "J", "~"]) {
            expect(classifyVimKey(key)).toBe("edit");
        }
    });

    it("treats i, a, A, and I as insert entry", () => {
        for (const key of ["i", "a", "A", "I"]) {
            expect(classifyVimKey(key)).toBe("insert-entry");
        }
    });

    it("treats Escape as escape", () => {
        expect(classifyVimKey("Escape")).toBe("escape");
    });
});

describe("vimInsertIndex", () => {
    const content = "ab\n  cd\n";

    it("types the character under the caret for i", () => {
        expect(vimInsertIndex(content, 4, "i")).toBe(4);
    });

    it("steps one character forward for a", () => {
        expect(vimInsertIndex(content, 0, "a")).toBe(1);
        expect(vimInsertIndex(content, content.length, "a")).toBe(content.length);
    });

    it("lands on the line ending for A and the first non-blank for I", () => {
        expect(vimInsertIndex(content, 0, "A")).toBe(2);
        expect(vimInsertIndex(content, 4, "I")).toBe(5);
    });
});

describe("vimRunComplete", () => {
    it("requires every character except a trailing newline", () => {
        const content = "ab\n";
        expect(vimRunComplete(content, new Set([0]))).toBe(false);
        expect(vimRunComplete(content, new Set([0, 1]))).toBe(true);
        expect(vimRunComplete("ab", new Set([1]))).toBe(false);
    });
});
