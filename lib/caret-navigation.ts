/**
 * Caret movement inside a typing snippet.
 *
 * The caret may sit on text the user has already typed, and on a closer the
 * editor inserted for them, including the slot just after that closer. It
 * never steps into template text that is still untyped. A gap of untyped
 * text is skipped so an auto-closed `)` can be passed without retyping it.
 */

export type CaretArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function isCaretArrowKey(key: string): key is CaretArrowKey {
    return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

/** Column of `index` on its line. A caret sitting on a newline has the line's end column. */
export function columnAt(content: string, index: number): number {
    const clamped = Math.max(0, Math.min(index, content.length));
    const breakAt = content.lastIndexOf("\n", clamped - 1);
    const lineStart = breakAt === -1 ? 0 : breakAt + 1;
    return clamped - lineStart;
}

/**
 * Caret slots the user is allowed to occupy.
 *
 * `0..progressIndex` is the contiguous run they typed. Each auto-closed
 * closer, and the slot immediately after it, is included even when it sits
 * ahead of that run, so the caret can move onto and past the closer.
 */
export function allowedCaretPositions(
    length: number,
    progressIndex: number,
    autoClosed: readonly number[],
): number[] {
    const progress = Math.max(0, Math.min(progressIndex, length));
    const allowed = new Set<number>();
    for (let index = 0; index <= progress; index += 1) {
        allowed.add(index);
    }
    for (const index of autoClosed) {
        if (index < 0 || index >= length) continue;
        allowed.add(index);
        if (index + 1 <= length) allowed.add(index + 1);
    }
    return [...allowed].sort((left, right) => left - right);
}

function lineStartOf(content: string, index: number): number {
    const clamped = Math.max(0, Math.min(index, content.length));
    const breakAt = content.lastIndexOf("\n", clamped - 1);
    return breakAt === -1 ? 0 : breakAt + 1;
}

/** Index of the line's newline, or `content.length` when the line is the last one. */
function lineEndOf(content: string, lineStart: number): number {
    const breakAt = content.indexOf("\n", lineStart);
    return breakAt === -1 ? content.length : breakAt;
}

function adjacentLineStart(content: string, lineStart: number, direction: -1 | 1): number | null {
    if (direction < 0) {
        if (lineStart === 0) return null;
        return lineStartOf(content, lineStart - 1);
    }
    const lineEnd = lineEndOf(content, lineStart);
    if (lineEnd >= content.length || content[lineEnd] !== "\n") return null;
    return lineEnd + 1;
}

function stepHorizontal(allowed: readonly number[], cursor: number, direction: -1 | 1): number {
    if (direction < 0) {
        let previous = cursor;
        for (const position of allowed) {
            if (position >= cursor) break;
            previous = position;
        }
        return previous;
    }
    for (const position of allowed) {
        if (position > cursor) return position;
    }
    return cursor;
}

function stepVertical(
    content: string,
    allowed: readonly number[],
    cursor: number,
    direction: -1 | 1,
    preferredColumn: number,
): number {
    const currentLine = lineStartOf(content, cursor);
    const targetLine = adjacentLineStart(content, currentLine, direction);
    if (targetLine === null) return cursor;

    const lineEnd = lineEndOf(content, targetLine);
    const desired = targetLine + Math.max(0, preferredColumn);
    let nearest = -1;
    let firstOnLine = -1;
    for (const position of allowed) {
        if (position < targetLine || position > lineEnd) continue;
        if (firstOnLine === -1) firstOnLine = position;
        if (position <= desired) nearest = position;
    }
    if (nearest !== -1) return nearest;
    if (firstOnLine !== -1) return firstOnLine;
    return cursor;
}

/**
 * Next caret index for an arrow key.
 *
 * Left and right also report the column they landed on, so a later up or
 * down can return to it. Up and down keep the column they were given.
 */
export function moveCaret(
    content: string,
    cursor: number,
    progressIndex: number,
    autoClosed: readonly number[],
    key: CaretArrowKey,
    preferredColumn: number,
): { cursor: number; preferredColumn: number } {
    const allowed = allowedCaretPositions(content.length, progressIndex, autoClosed);
    if (key === "ArrowLeft" || key === "ArrowRight") {
        const next = stepHorizontal(allowed, cursor, key === "ArrowRight" ? 1 : -1);
        return { cursor: next, preferredColumn: columnAt(content, next) };
    }
    const next = stepVertical(
        content,
        allowed,
        cursor,
        key === "ArrowDown" ? 1 : -1,
        preferredColumn,
    );
    return { cursor: next, preferredColumn };
}
