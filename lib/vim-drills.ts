/** A cursor goal. Line and column are 1-based, matching Monaco. */
export type VimDrillCursor = {
    line: number;
    column: number;
};

/** What the buffer or cursor must look like for the drill to count. */
export type VimDrillGoal = {
    text?: string;
    cursor?: VimDrillCursor;
};

export type VimDrill = {
    id: string;
    title: string;
    instruction: string;
    startText: string;
    goal: VimDrillGoal;
};

/** Live editor reading used to decide whether a drill is done. */
export type VimDrillSnapshot = {
    text: string;
    line: number;
    column: number;
};

const COMPLETED_DRILLS_KEY = "codesprint-vim-drills-completed";

/**
 * Short catalog. Motions check the cursor. Operators and insert check the text.
 * Not a full tutor: enough to prove motions, deletes, and insert against a real buffer.
 */
export const VIM_DRILLS: readonly VimDrill[] = [
    {
        id: "motion-word",
        title: "Word motion",
        instruction: "Move onto the word marker. From the start of the line, w does it.",
        startText: "alpha marker omega",
        goal: { cursor: { line: 1, column: 7 } },
    },
    {
        id: "op-delete-line",
        title: "Delete a line",
        instruction: "Delete the middle line. j moves down, dd deletes the line.",
        startText: "keep\nremove\nkeep",
        goal: { text: "keep\nkeep" },
    },
    {
        id: "motion-find",
        title: "Find a character",
        instruction: "Land on the x. f, then x.",
        startText: "abcxyz",
        goal: { cursor: { line: 1, column: 4 } },
    },
    {
        id: "motion-last-line",
        title: "Last line",
        instruction: "Go to the first character of the last line. G.",
        startText: "one\ntwo\nthree",
        goal: { cursor: { line: 3, column: 1 } },
    },
    {
        id: "op-change-word",
        title: "Change a word",
        instruction: "Change red to blue. w lands on red, cw deletes it, then type blue and press Escape.",
        startText: "paint red barn",
        goal: { text: "paint blue barn" },
    },
    {
        id: "insert-gap",
        title: "Append a word",
        instruction: "Append the word yes. A enters insert at the end of the line, then type a space and yes, then Escape.",
        startText: "answer:",
        goal: { text: "answer: yes" },
    },
];

/** Compare drill text without a single trailing newline or Windows line endings. */
export function normalizeDrillText(text: string): string {
    return text.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

/**
 * True when every part of the goal matches. A goal with both text and a cursor
 * requires both. A goal with neither never matches.
 */
export function drillGoalMet(goal: VimDrillGoal, actual: VimDrillSnapshot): boolean {
    const wantsText = typeof goal.text === "string";
    const wantsCursor = goal.cursor !== undefined;
    if (!wantsText && !wantsCursor) return false;

    if (wantsText && normalizeDrillText(actual.text) !== normalizeDrillText(goal.text ?? "")) {
        return false;
    }
    if (wantsCursor && goal.cursor) {
        if (actual.line !== goal.cursor.line || actual.column !== goal.cursor.column) {
            return false;
        }
    }
    return true;
}

/** Ids the browser has already finished. Empty on the server and on bad storage. */
export function readCompletedDrillIds(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(COMPLETED_DRILLS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const ids: string[] = [];
        for (const item of parsed) {
            if (typeof item === "string") ids.push(item);
        }
        return ids;
    } catch {
        return [];
    }
}

/** Remember a finished drill and return the full id list. */
export function markDrillComplete(id: string): string[] {
    const current = readCompletedDrillIds();
    if (current.includes(id)) return current;
    const next = [...current, id];
    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(COMPLETED_DRILLS_KEY, JSON.stringify(next));
        } catch {
            return current;
        }
    }
    return next;
}
