"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    VIM_DRILLS,
    drillGoalMet,
    markDrillComplete,
    readCompletedDrillIds,
    type VimDrillSnapshot,
} from "@/lib/vim-drills";

/**
 * One Vim drill at a time: keystrokes, a clock, and a goal check against the editor.
 * Completed ids are stored locally and do not count as typing sessions.
 */
export function useVimDrill(active: boolean) {
    const [index, setIndex] = useState(0);
    const [attempt, setAttempt] = useState(0);
    const [completedIds, setCompletedIds] = useState<string[]>([]);
    const [keystrokes, setKeystrokes] = useState(0);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [solved, setSolved] = useState(false);
    const solvedRef = useRef(false);

    const drill = VIM_DRILLS[index] ?? VIM_DRILLS[0];

    useEffect(() => {
        setCompletedIds(readCompletedDrillIds());
    }, []);

    useEffect(() => {
        solvedRef.current = false;
        setSolved(false);
        setKeystrokes(0);
        setStartedAt(null);
        setElapsedMs(0);
    }, [drill.id, attempt]);

    useEffect(() => {
        if (!active || startedAt === null || solved) return;
        const timerId = window.setInterval(() => {
            setElapsedMs(Date.now() - startedAt);
        }, 200);
        return () => window.clearInterval(timerId);
    }, [active, startedAt, solved]);

    useEffect(() => {
        if (!active || solved) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta") return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (!target.closest(".monaco-editor, .vim-status-bar")) return;
            setStartedAt((current) => current ?? Date.now());
            setKeystrokes((count) => count + 1);
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [active, solved, drill.id, attempt]);

    const report = useCallback((snapshot: VimDrillSnapshot) => {
        if (!active || solvedRef.current) return;
        if (!drillGoalMet(drill.goal, snapshot)) return;
        solvedRef.current = true;
        setSolved(true);
        setStartedAt((current) => {
            if (current !== null) {
                setElapsedMs(Date.now() - current);
            }
            return current;
        });
        setCompletedIds(markDrillComplete(drill.id));
    }, [active, drill]);

    const next = useCallback(() => {
        setIndex((current) => (current + 1) % VIM_DRILLS.length);
        setAttempt((current) => current + 1);
    }, []);

    const retry = useCallback(() => {
        setAttempt((current) => current + 1);
    }, []);

    return {
        drill,
        attempt,
        solved,
        keystrokes,
        elapsedMs,
        completedCount: completedIds.length,
        total: VIM_DRILLS.length,
        report,
        next,
        retry,
    };
}
