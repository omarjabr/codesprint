export type Shortcut = {
    combo: string;
    detail: string;
};

export const KEYBOARD_SHORTCUTS: Shortcut[] = [
    { combo: "R", detail: "Reset the session and start a fresh run" },
    { combo: "N or Q", detail: "Jump to the next problem when paused or finished" },
    { combo: "L", detail: "Show or hide the live stats panel" },
    { combo: "P", detail: "Open preferences" },
    { combo: "A", detail: "Open analytics dashboard" },
    { combo: "i a A I", detail: "With Vim on, move anywhere and type at the caret. Normal is not scored" },
    { combo: "Cmd/Ctrl + Left/Right", detail: "Jump to the start or end of the line you have typed" },
    { combo: "Option/Alt + Left/Right", detail: "Jump to the previous or next word you have typed" },
    { combo: "Esc", detail: "Abort the run. With Vim on, the first Esc leaves Insert and the second aborts" },
    { combo: "Shift + A", detail: "Generate AI drill after a run (requires API key)" },
];
