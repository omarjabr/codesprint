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

function positionsOnLine(content: string, allowed: readonly number[], cursor: number): number[] {
    const lineStart = lineStartOf(content, cursor);
    const lineEnd = lineEndOf(content, lineStart);
    return allowed.filter((position) => position >= lineStart && position <= lineEnd);
}

/**
 * End of the written run that contains `cursor` on this line.
 *
 * Stops at the first gap, so a jump reaches the end of the word or line the
 * user has typed and does not leap across template text to a distant closer.
 */
function contiguousEnd(positions: readonly number[], cursor: number): number {
    let end = cursor;
    for (const position of positions) {
        if (position < cursor) continue;
        if (position > end + 1) break;
        end = position;
    }
    return end;
}

/**
 * Cmd/Ctrl+Left or Right within text the user has already written.
 *
 * Left goes to the start of the line. Right goes to the end of the typed
 * word when the line is unfinished, and to the end of the line when it is not.
 */
export function jumpCaret(
    content: string,
    cursor: number,
    progressIndex: number,
    autoClosed: readonly number[],
    direction: "left" | "right",
): { cursor: number; preferredColumn: number } {
    const allowed = allowedCaretPositions(content.length, progressIndex, autoClosed);
    const onLine = positionsOnLine(content, allowed, cursor);
    if (onLine.length === 0) {
        return { cursor, preferredColumn: columnAt(content, cursor) };
    }

    const lineStart = lineStartOf(content, cursor);
    const next = direction === "left"
        ? (onLine.includes(lineStart) ? lineStart : onLine[0])
        : contiguousEnd(onLine, cursor);
    return { cursor: next, preferredColumn: columnAt(content, next) };
}

function isWordChar(char: string | undefined): boolean {
    if (char === undefined) return false;
    return /[A-Za-z0-9_]/.test(char);
}

/**
 * The unbroken run of written caret slots that contains `cursor`.
 * A gap of untyped template text splits the runs, so a word jump cannot
 * cross it.
 */
function runContaining(positions: readonly number[], cursor: number): { floor: number; limit: number } | null {
    if (positions.length === 0) return null;
    const runs: Array<{ floor: number; limit: number }> = [];
    let floor = positions[0];
    let previous = positions[0];
    for (let index = 1; index < positions.length; index += 1) {
        const position = positions[index];
        if (position > previous + 1) {
            runs.push({ floor, limit: previous });
            floor = position;
        }
        previous = position;
    }
    runs.push({ floor, limit: previous });

    for (const run of runs) {
        if (cursor >= run.floor && cursor <= run.limit) return run;
    }
    for (let index = runs.length - 1; index >= 0; index -= 1) {
        if (runs[index].limit <= cursor) return runs[index];
    }
    return runs[0];
}

/** Caret index just after the word that starts at or after `cursor`. */
function nextWordEnd(content: string, cursor: number, limit: number): number {
    let index = cursor;
    if (isWordChar(content[index])) {
        while (index < limit && isWordChar(content[index])) index += 1;
        return index;
    }
    while (index < limit && !isWordChar(content[index])) index += 1;
    while (index < limit && isWordChar(content[index])) index += 1;
    return index;
}

/** Caret index at the start of the word before `cursor`, or of the word the caret is in. */
function previousWordStart(content: string, cursor: number, floor: number): number {
    let index = cursor;
    if (index > floor && isWordChar(content[index - 1])) {
        while (index > floor && isWordChar(content[index - 1])) index -= 1;
        return index;
    }
    while (index > floor && !isWordChar(content[index - 1])) index -= 1;
    while (index > floor && isWordChar(content[index - 1])) index -= 1;
    return index;
}

/**
 * Option+Left/Right on Mac, and Alt+Left/Right on Windows.
 *
 * Right lands at the end of the current word, then the next one. Left lands
 * at the start of the current word, then the previous one. Both stay inside
 * text the user has already typed.
 */
export function jumpWord(
    content: string,
    cursor: number,
    progressIndex: number,
    autoClosed: readonly number[],
    direction: "left" | "right",
): { cursor: number; preferredColumn: number } {
    const allowed = allowedCaretPositions(content.length, progressIndex, autoClosed);
    const run = runContaining(allowed, cursor);
    if (!run) {
        return { cursor, preferredColumn: columnAt(content, cursor) };
    }
    const next = direction === "right"
        ? nextWordEnd(content, cursor, run.limit)
        : previousWordStart(content, cursor, run.floor);
    return { cursor: next, preferredColumn: columnAt(content, next) };
}

/**
 * How far a forward jump may extend the typed run.
 *
 * A jump that only crosses auto-closed closers consumes them. A jump that
 * would have to cross untyped template text leaves progress where it is.
 */
export function progressAfterCaretJump(
    before: number,
    next: number,
    progress: number,
    autoClosed: readonly number[],
): number {
    if (before !== progress || next <= progress) return progress;
    const closed = new Set(autoClosed);
    let index = progress;
    while (index < next) {
        if (!closed.has(index)) return progress;
        index += 1;
    }
    return next;
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
