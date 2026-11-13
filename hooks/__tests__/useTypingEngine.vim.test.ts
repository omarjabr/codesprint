import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Snippet } from "@/lib/snippets";

vi.mock("@/lib/preferences", () => ({
    usePreferences: () => ({
        preferences: {
            countdownEnabled: false,
            vimMode: true,
            requireTabForIndent: false,
            theme: "gruvbox",
            fontSize: 24,
            caretWidth: 3,
            surfaceStyle: "immersive",
            showLiveStatsDuringRun: true,
            interfaceMode: "ide",
            syntaxHighlighting: "full",
            debugGapBuffer: false,
        },
        setTheme: vi.fn(),
        setFontSize: vi.fn(),
        setCaretWidth: vi.fn(),
        setCountdownEnabled: vi.fn(),
        setSurfaceStyle: vi.fn(),
        setShowLiveStatsDuringRun: vi.fn(),
        setInterfaceMode: vi.fn(),
        setRequireTabForIndent: vi.fn(),
        setSyntaxHighlighting: vi.fn(),
        setVimMode: vi.fn(),
        setDebugGapBuffer: vi.fn(),
    }),
}));

import { useTypingEngine } from "../useTypingEngine";

function makeSnippet(content: string): Snippet {
    return {
        id: "test",
        problemId: "test:test",
        title: "Test Snippet",
        content,
        language: "javascript",
        lengthCategory: "short",
        difficulty: "easy",
        lines: content.split("\n").length,
    };
}

function fireKey(key: string): KeyboardEvent {
    return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
}

describe("useTypingEngine vim roaming", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("types the character under the caret and leaves the gap unmarked", () => {
        const snippet = makeSnippet("abc");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.seekVimCaret(2, "i");
            result.current.handleKeyDown(fireKey("c"));
        });

        expect(result.current.phase).toBe("running");
        expect(result.current.cursorIndex).toBe(3);
        expect(result.current.settledChars).toEqual([2]);
        expect(result.current.progressIndex).toBe(0);
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("finishes only after every character has been typed", () => {
        const snippet = makeSnippet("abc");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.seekVimCaret(2, "i");
            result.current.handleKeyDown(fireKey("c"));
            result.current.seekVimCaret(0, "i");
            result.current.handleKeyDown(fireKey("a"));
            result.current.handleKeyDown(fireKey("b"));
        });

        expect(result.current.settledChars).toEqual([0, 1, 2]);
        expect(result.current.phase).toBe("finished");
    });

    it("marks a mismatch at the caret and backspace forgets it", () => {
        const snippet = makeSnippet("abc");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.seekVimCaret(0, "i");
            result.current.handleKeyDown(fireKey("x"));
        });

        expect(result.current.wrongChars.has(0)).toBe(true);
        expect(result.current.settledChars).toEqual([]);
        expect(result.current.cursorIndex).toBe(1);

        act(() => {
            result.current.handleKeyDown(fireKey("Backspace"));
        });

        expect(result.current.cursorIndex).toBe(0);
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("lets arrows move through text that has not been typed yet", () => {
        const snippet = makeSnippet("abc");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.start();
        });
        act(() => {
            result.current.handleKeyDown(fireKey("ArrowRight"));
        });

        expect(result.current.cursorIndex).toBe(1);
        expect(result.current.progressIndex).toBe(0);
        expect(result.current.settledChars).toEqual([]);
    });
});
