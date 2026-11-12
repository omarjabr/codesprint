import type { SupportedLanguage } from "@/lib/snippets";
import { tokenize } from "@/lib/tokenizer";

/**
 * Brackets an editor closes on its own. Angle brackets stay manual: `<` is a
 * comparison operator in these languages, and editors do not pair it by default.
 */
const BRACKET_PAIRS: Readonly<Record<string, string>> = {
    "(": ")",
    "[": "]",
    "{": "}",
};

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

    if (openTokenCategory !== "delimiter") return [];
    const open = content[openIndex];
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
