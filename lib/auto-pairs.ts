import type { SupportedLanguage } from "@/lib/snippets";
import { tokenize } from "@/lib/tokenizer";

/**
 * Brackets an editor closes on its own. Angle brackets are matched separately:
 * the tokenizer treats `<` and `>` as operators, and `<=` or `<<` must stay
 * comparisons and shifts rather than generic pairs.
 */
const BRACKET_PAIRS: Readonly<Record<string, string>> = {
    "(": ")",
    "[": "]",
    "{": "}",
};

/** True when `<` opens a pair, not the start of `<=` or `<<`. */
function isAngleOpener(content: string, index: number): boolean {
    const next = content[index + 1];
    const previous = index > 0 ? content[index - 1] : "";
    if (next === "=" || next === "<") return false;
    if (previous === "<") return false;
    return true;
}

/** True when `>` closes a pair. `>=` stays a comparison. */
function isAngleCloser(content: string, index: number): boolean {
    return content[index + 1] !== "=";
}

/**
 * Characters that can appear between `<` and `>` in a type argument or an
 * include, such as `unique<T>`, `Map<String, Object>`, or `#include <array>`.
 * A comparison like `a < b` fails this check, so it does not gain a closer.
 */
function isTypeArgumentSpan(content: string, openIndex: number, closeIndex: number): boolean {
    for (let index = openIndex + 1; index < closeIndex; index += 1) {
        const char = content[index];
        if (char === " " || char === "\t" || char === "<" || char === ">") continue;
        if (char === "," || char === "." || char === ":" || char === "[" || char === "]" || char === "?") continue;
        const code = char.charCodeAt(0);
        const isDigit = code >= 48 && code <= 57;
        const isUpper = code >= 65 && code <= 90;
        const isLower = code >= 97 && code <= 122;
        if (isDigit || isUpper || isLower || char === "_" || char === "$") continue;
        return false;
    }
    return true;
}

/**
 * `a < b > c` is two comparisons. The `>` is followed by more expression, so
 * the `<` must not swallow it. `Map<String, Object> context` is different:
 * the `<` is glued to a name, which is how generics are written.
 */
function isGluedToName(content: string, openIndex: number): boolean {
    if (openIndex === 0) return false;
    const previous = content[openIndex - 1];
    const code = previous.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    return isDigit || isUpper || isLower || previous === "_" || previous === "$";
}

function closesIntoExpression(content: string, closeIndex: number): boolean {
    let index = closeIndex + 1;
    while (content[index] === " " || content[index] === "\t") index += 1;
    const next = content[index];
    if (next === undefined) return false;
    const code = next.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    return isDigit || isUpper || isLower || next === "_";
}

/**
 * Index of the `>` that matches the `<` at `openIndex`.
 *
 * Strings and comments are skipped. Nested pairs use depth, so the outer `<`
 * in `vector<vector<int>>` closes on the last `>`, and each `>` in `>>` counts.
 * A comparison such as `index < values.length` returns nothing, so the user
 * types `<` and keeps going. No closer is added for them to delete.
 */
function findAngleCloser(
    content: string,
    tokens: readonly { category: string; start: number; end: number }[],
    openIndex: number,
): readonly number[] {
    if (!isAngleOpener(content, openIndex)) return [];

    let depth = 0;
    for (const token of tokens) {
        if (token.end <= openIndex) continue;
        if (token.category === "string" || token.category === "comment") continue;
        const from = Math.max(token.start, openIndex);
        for (let index = from; index < token.end; index += 1) {
            const char = content[index];
            if (char === "<" && isAngleOpener(content, index)) {
                depth += 1;
            } else if (char === ">" && isAngleCloser(content, index)) {
                depth -= 1;
                if (depth === 0) {
                    if (!isTypeArgumentSpan(content, openIndex, index)) return [];
                    if (!isGluedToName(content, openIndex) && closesIntoExpression(content, index)) return [];
                    return [index];
                }
            }
        }
    }
    return [];
}

/**
 * Indices of the closer an editor would insert when `openIndex` is typed.
 *
 * Returns `[]` when the character is not an opener or the snippet has no
 * matching closer. Quotes use the tokenizer's string token, so an apostrophe
 * in `don't` does not swallow a later string. Brackets ignore pairs that sit
 * inside strings or comments. A Python triple quote highlights all three
 * closing characters, not the next quote in the opening `"""`.
 */
export function findAutoCloseIndices(
    content: string,
    openIndex: number,
    language: SupportedLanguage,
): readonly number[] {
    if (openIndex < 0 || openIndex >= content.length) return [];

    const tokens = tokenize(content, language);
    let openTokenStart = -1;
    let openTokenEnd = -1;
    let openTokenCategory = "";
    for (const token of tokens) {
        if (token.start > openIndex) break;
        if (openIndex >= token.start && openIndex < token.end) {
            openTokenStart = token.start;
            openTokenEnd = token.end;
            openTokenCategory = token.category;
            break;
        }
    }
    if (openTokenStart < 0) return [];

    if (openTokenCategory === "string") {
        if (openIndex !== openTokenStart) return [];
        const quote = content[openIndex];
        if (quote === undefined) return [];
        const isTriple =
            openTokenEnd - openTokenStart >= 6 &&
            content[openIndex + 1] === quote &&
            content[openIndex + 2] === quote &&
            content[openTokenEnd - 1] === quote &&
            content[openTokenEnd - 2] === quote &&
            content[openTokenEnd - 3] === quote;
        if (isTriple) return [openTokenEnd - 3, openTokenEnd - 2, openTokenEnd - 1];
        if (openTokenEnd - openTokenStart >= 2 && content[openTokenEnd - 1] === quote) {
            return [openTokenEnd - 1];
        }
        return [];
    }

    const open = content[openIndex];
    if (open === "<") {
        if (openTokenCategory === "comment") return [];
        return findAngleCloser(content, tokens, openIndex);
    }
    if (openTokenCategory !== "delimiter") return [];
    if (open === undefined) return [];
    const close = BRACKET_PAIRS[open];
    if (close === undefined) return [];

    let depth = 0;
    for (const token of tokens) {
        if (token.end <= openIndex) continue;
        if (token.category !== "delimiter") continue;
        if (token.text === open) {
            depth += 1;
        } else if (token.text === close) {
            depth -= 1;
            if (depth === 0) return [token.start];
        }
    }
    return [];
}
