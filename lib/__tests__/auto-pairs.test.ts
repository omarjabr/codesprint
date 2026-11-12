import { describe, expect, it } from "vitest";
import { findAutoCloseIndices } from "../auto-pairs";

describe("findAutoCloseIndices", () => {
    it("pairs brackets and leaves the caret room to type inside", () => {
        expect(findAutoCloseIndices("call(bar)", 4, "javascript")).toEqual([8]);
        expect(findAutoCloseIndices("items[i]", 5, "javascript")).toEqual([7]);
        expect(findAutoCloseIndices("obj{}", 3, "javascript")).toEqual([4]);
    });

    it("pairs quotes, including an empty pair and a template literal", () => {
        expect(findAutoCloseIndices("\"hi\"", 0, "javascript")).toEqual([3]);
        expect(findAutoCloseIndices("''", 0, "python")).toEqual([1]);
        expect(findAutoCloseIndices("`x`", 0, "javascript")).toEqual([2]);
    });

    it("pairs a Python triple quote as three closing characters", () => {
        expect(findAutoCloseIndices("\"\"\"hi\"\"\"", 0, "python")).toEqual([5, 6, 7]);
    });

    it("ignores a closer that sits inside a string", () => {
        expect(findAutoCloseIndices("foo(\")\")", 3, "javascript")).toEqual([7]);
    });

    it("does not pair an apostrophe that never closes", () => {
        expect(findAutoCloseIndices("don't", 3, "javascript")).toEqual([]);
    });

    it("does not pair a closing character or a non-pair", () => {
        expect(findAutoCloseIndices("()", 1, "javascript")).toEqual([]);
        expect(findAutoCloseIndices("a < b", 2, "javascript")).toEqual([]);
    });

    it("pairs angle brackets, including an empty pair and a nested close", () => {
        expect(findAutoCloseIndices("unique<T>", 6, "javascript")).toEqual([8]);
        expect(findAutoCloseIndices("box<>", 3, "java")).toEqual([4]);
        expect(findAutoCloseIndices("vector<vector<int>>", 6, "cpp")).toEqual([18]);
        expect(findAutoCloseIndices("vector<vector<int>>", 13, "cpp")).toEqual([17]);
    });

    it("does not treat a comparison or a shift as an angle bracket", () => {
        expect(findAutoCloseIndices("a <= b", 2, "javascript")).toEqual([]);
        expect(findAutoCloseIndices("a << b", 2, "cpp")).toEqual([]);
        expect(findAutoCloseIndices("a << b", 3, "cpp")).toEqual([]);
        expect(findAutoCloseIndices("a >= b", 2, "javascript")).toEqual([]);

        const chained = "a < b > c";
        expect(findAutoCloseIndices(chained, chained.indexOf("<"), "javascript")).toEqual([]);

        const laterGeneric = "index < values.length; list<T>()";
        expect(findAutoCloseIndices(laterGeneric, laterGeneric.indexOf("<"), "javascript")).toEqual([]);
        expect(findAutoCloseIndices(laterGeneric, laterGeneric.lastIndexOf("<"), "javascript")).toEqual([
            laterGeneric.indexOf(">"),
        ]);
    });

    it("still pairs an include, a template, and a generic before a name", () => {
        const include = "#include <array>";
        expect(findAutoCloseIndices(include, include.indexOf("<"), "cpp")).toEqual([include.indexOf(">")]);

        const template = "template <typename T, std::size_t N>";
        expect(findAutoCloseIndices(template, template.indexOf("<"), "cpp")).toEqual([template.lastIndexOf(">")]);

        const map = "Map<String, Object> context";
        expect(findAutoCloseIndices(map, map.indexOf("<"), "java")).toEqual([map.indexOf(">")]);
    });
});
