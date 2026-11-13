/**
 * How a key is routed while the typing test is in Vim Normal mode.
 * Motions, counts, visual, and search all reach Monaco. Edits do not.
 */
export type VimKeyClass = "motion" | "edit" | "insert-entry" | "escape";

/** Shown when a mutating command is pressed on the read-only snippet. */
export const VIM_EDIT_HINT = "Edits belong to Vim drills";

const INSERT_ENTRY_KEYS = new Set(["i", "a", "A", "I"]);

// Operators and the shifted forms that mutate the buffer. Tab would ask the
// read-only editor to indent, which surfaces Monaco's edit warning.
const EDIT_KEYS = new Set([
    "d",
    "c",
    "x",
    "s",
    "r",
    "o",
    "O",
    "p",
    "J",
    "~",
    "D",
    "C",
    "S",
    "X",
    "R",
    "P",
    ".",
    "u",
    "Tab",
]);

/**
 * Classify one key for the read-only typing session.
 * Visual (`v`) and search (`/`) are motions: they reach Monaco and are not scored.
 */
export function classifyVimKey(key: string): VimKeyClass {
    if (key === "Escape") return "escape";
    if (INSERT_ENTRY_KEYS.has(key)) return "insert-entry";
    if (EDIT_KEYS.has(key)) return "edit";
    return "motion";
}

/**
 * Where Insert begins, as a snippet offset.
 * `i` types the character under the caret, `a` the next one, `A` the end of
 * the line, and `I` the first non-blank character on the line.
 */
export function vimInsertIndex(content: string, offset: number, key: string): number {
    const clamped = Math.max(0, Math.min(offset, content.length));
    if (key === "a") return Math.min(content.length, clamped + 1);
    if (key === "A") {
        const lineEnd = content.indexOf("\n", clamped);
        return lineEnd === -1 ? content.length : lineEnd;
    }
    if (key === "I") {
        const lineStart = clamped === 0 ? 0 : content.lastIndexOf("\n", clamped - 1) + 1;
        let index = lineStart;
        while (index < content.length && (content[index] === " " || content[index] === "\t")) {
            index += 1;
        }
        return index;
    }
    return clamped;
}

/**
 * The run is done when every character has been typed, wherever the caret
 * visited. A trailing newline is optional, matching the sequential finish.
 */
export function vimRunComplete(content: string, settled: ReadonlySet<number>): boolean {
    const last = content.endsWith("\n") ? content.length - 1 : content.length;
    if (last <= 0) return false;
    for (let index = 0; index < last; index += 1) {
        if (!settled.has(index)) return false;
    }
    return true;
}
