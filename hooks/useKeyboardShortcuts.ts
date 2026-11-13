"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Phase } from "./useFocusManagement";
import { classifyVimKey, VIM_EDIT_HINT } from "@/lib/vim-keys";

export type PracticeMode = "type" | "vim-drill";

/** Normal moves the caret. Insert types the character under it. */
export type VimSessionMode = "normal" | "insert";

export interface UseKeyboardShortcutsProps {
    phase: Phase;
    vimMode: boolean;
    problemCount: number;
    engineHandleKeyDown: (e: KeyboardEvent) => void;
    onReset: () => void;
    onNextProblem: () => void;
    onStartEngine: () => void;
    enableEditorFocus: () => void;
    focusEditor: () => void;
    setShowLiveStatsDuringRun: (enabled: boolean) => void;
    showLiveStatsDuringRun: boolean;
    clearAutoAdvance: () => void;
    onOpenAIDrill?: () => void;
    /**
     * True while any dialog/drawer owns the keyboard. The capture-phase handler
     * bails entirely so keys reach the open overlay instead of the engine.
     */
    isOverlayOpen?: boolean;
    /** Vim drills hand the keyboard to Monaco. Typing is the default. */
    practiceMode?: PracticeMode;
    /** Called when a mutating Vim command is blocked on the read-only snippet. */
    onVimHint?: (message: string) => void;
    /** Snippet offset of the Vim caret, so Insert can type there. */
    readVimCaret?: () => number;
    /** Park the typing caret where Insert should begin. */
    seekVimCaret?: (offset: number, key: string) => void;
}

export interface UseKeyboardShortcutsReturn {
    /** Normal or Insert while the Vim preference is on. Normal otherwise. */
    vimSessionMode: VimSessionMode;
}

const forwardedKeys = new WeakSet<KeyboardEvent>();

/**
 * Send a key to Monaco when focus is somewhere else (the page body, a button).
 * If the textarea is already the target, the original event continues to it.
 */
function passToMonaco(event: KeyboardEvent): void {
    const textarea = document.querySelector(".monaco-editor textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (event.target === textarea) return;
    event.preventDefault();
    event.stopPropagation();
    const forwarded = new KeyboardEvent("keydown", {
        key: event.key,
        code: event.code,
        bubbles: true,
        cancelable: true,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
    });
    forwardedKeys.add(forwarded);
    textarea.focus();
    textarea.dispatchEvent(forwarded);
}

function isForeignField(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target.closest(".monaco-editor, .vim-status-bar")) return false;
    return Boolean(target.closest("input, textarea, [contenteditable=true]"));
}

function ownsVimStatus(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(".vim-status-bar"));
}

/**
 * Hook to manage global keyboard shortcuts and event listeners.
 *
 * Hierarchy:
 * 0. Overlay gate
 * 1. Vim drills: Monaco owns every key
 * 2. Vim typing: Normal moves the caret, Insert types at that caret
 * 3. Shift+A on the result screen
 * 4. Idle typing guard
 * 5. Global shortcuts
 * 6. Typing engine
 *
 * The document listener is registered once. Changing inputs are read through a ref.
 */
export function useKeyboardShortcuts(props: UseKeyboardShortcutsProps): UseKeyboardShortcutsReturn {
    const { vimMode, practiceMode = "type" } = props;
    const [vimSessionMode, setVimSessionMode] = useState<VimSessionMode>("normal");

    useEffect(() => {
        if (!vimMode || practiceMode === "vim-drill") {
            setVimSessionMode("normal");
        }
    }, [vimMode, practiceMode]);

    const latestRef = useRef({ props, vimSessionMode });
    latestRef.current = { props, vimSessionMode };

    const enterInsert = useCallback((phase: Phase, onReset: () => void, onStartEngine: () => void, enableEditorFocus: () => void, focusEditor: () => void) => {
        setVimSessionMode("insert");
        enableEditorFocus();
        if (phase === "finished") {
            onReset();
            onStartEngine();
        } else if (phase === "idle") {
            onStartEngine();
        }
        focusEditor();
    }, []);

    const latestEnterInsert = useRef(enterInsert);
    latestEnterInsert.current = enterInsert;

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (forwardedKeys.has(e)) return;

            const {
                props: {
                    phase,
                    vimMode: vimOn,
                    problemCount,
                    engineHandleKeyDown,
                    onReset,
                    onNextProblem,
                    onStartEngine,
                    enableEditorFocus,
                    focusEditor,
                    setShowLiveStatsDuringRun,
                    showLiveStatsDuringRun,
                    clearAutoAdvance,
                    onOpenAIDrill,
                    isOverlayOpen,
                    practiceMode: mode = "type",
                    onVimHint,
                    readVimCaret,
                    seekVimCaret,
                },
                vimSessionMode: sessionMode,
            } = latestRef.current;

            if (isOverlayOpen) return;

            if (mode === "vim-drill") return;

            if (vimOn && ownsVimStatus(e.target)) return;

            if (vimOn && isForeignField(e.target)) return;

            const keyLower = e.key.toLowerCase();
            const noModifiers = !e.metaKey && !e.ctrlKey && !e.altKey;

            if (vimOn) {
                if (e.key === "Escape" && sessionMode === "insert") {
                    e.preventDefault();
                    e.stopPropagation();
                    setVimSessionMode("normal");
                    return;
                }

                if (sessionMode === "insert") {
                    if (!noModifiers) return;
                    enableEditorFocus();
                    engineHandleKeyDown(e);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (e.key === "Escape" && (phase === "running" || phase === "countdown")) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearAutoAdvance();
                    onReset();
                    return;
                }

                if (e.key === "Escape" && phase === "finished" && problemCount > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onNextProblem();
                    return;
                }

                if (e.metaKey || e.ctrlKey || e.altKey) {
                    passToMonaco(e);
                    return;
                }

                const kind = classifyVimKey(e.key);
                if (kind === "insert-entry") {
                    e.preventDefault();
                    e.stopPropagation();
                    latestEnterInsert.current(phase, onReset, onStartEngine, enableEditorFocus, focusEditor);
                    if (seekVimCaret) seekVimCaret(readVimCaret ? readVimCaret() : 0, e.key);
                    return;
                }
                if (kind === "edit") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onVimHint) onVimHint(VIM_EDIT_HINT);
                    return;
                }

                enableEditorFocus();
                passToMonaco(e);
                return;
            }

            if (e.key === "Escape") {
                if (phase === "finished" && problemCount > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onNextProblem();
                    return;
                }
                if (phase === "running" || phase === "countdown") {
                    clearAutoAdvance();
                    onReset();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            if (
                e.shiftKey &&
                noModifiers &&
                keyLower === "a" &&
                phase === "finished" &&
                onOpenAIDrill
            ) {
                e.preventDefault();
                e.stopPropagation();
                onOpenAIDrill();
                return;
            }

            if (phase === "idle" && noModifiers) {
                if (e.key === "Tab") return;
                const isPrintable = e.key.length === 1 || e.key === "Enter";
                if (isPrintable) {
                    enableEditorFocus();
                    engineHandleKeyDown(e);
                    return;
                }
            }

            if (noModifiers) {
                if (phase === "finished" && problemCount > 1) {
                    if (e.key === "Tab" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        enableEditorFocus();
                        onNextProblem();
                        return;
                    }
                }
                if (keyLower === "r" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onReset();
                    onStartEngine();
                    focusEditor();
                    return;
                }
                if ((keyLower === "n" || keyLower === "q") && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onNextProblem();
                    return;
                }
                if (keyLower === "l" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLiveStatsDuringRun(!showLiveStatsDuringRun);
                    return;
                }
                if (keyLower === "p" && phase !== "running") return;
                if (keyLower === "a" && phase !== "running") return;
            }

            enableEditorFocus();
            engineHandleKeyDown(e);
        }

        function onPaste(e: ClipboardEvent) {
            const target = e.target instanceof Element ? e.target : null;
            if (target?.closest("input, textarea, [contenteditable=true]")) return;
            e.preventDefault();
        }

        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("paste", onPaste);

        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("paste", onPaste);
        };
    }, []);

    return { vimSessionMode };
}
