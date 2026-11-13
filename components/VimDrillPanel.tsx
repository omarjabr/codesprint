"use client";

import { Box, Stack, Text, chakra } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import { useVimDrill } from "@/hooks/useVimDrill";
import type { SurfaceStyle, SyntaxHighlightingMode } from "@/lib/preferences";

const CodePanel = dynamic(() => import("@/components/CodePanel"), {
    ssr: false,
    loading: () => <Box h="160px" bg="var(--panel)" borderRadius="md" />,
});

const NO_INDEXES = new Set<number>();

type VimDrillPanelProps = {
    fontSize: number;
    surfaceStyle: SurfaceStyle;
    syntaxHighlighting: SyntaxHighlightingMode;
};

/** Clock for a drill. Minutes and seconds, not words per minute. */
function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const padded = seconds < 10 ? `0${String(seconds)}` : String(seconds);
    return `${String(minutes)}:${padded}`;
}

/**
 * Editable Vim practice. The typing engine is not involved: Monaco Vim owns
 * the buffer, and the drill ends when the goal text or cursor is reached.
 */
export function VimDrillPanel({ fontSize, surfaceStyle, syntaxHighlighting }: VimDrillPanelProps) {
    const session = useVimDrill(true);
    const { drill, attempt, solved, report } = session;
    const editorKey = `${drill.id}-${String(attempt)}`;

    return (
        <Stack gap={4} w="100%" data-testid="vim-drill-session">
            <Stack gap={1}>
                <Text fontSize="sm" fontWeight={600} color="var(--text)">
                    {drill.title}
                </Text>
                <Text fontSize="sm" color="var(--text-subtle)">
                    {drill.instruction}
                </Text>
                <Text fontSize="xs" color="var(--text-subtle)" fontVariantNumeric="tabular-nums">
                    {`${formatElapsed(session.elapsedMs)} · ${String(session.keystrokes)} keystrokes · ${String(session.completedCount)} of ${String(session.total)} completed`}
                </Text>
            </Stack>
            {solved ? (
                <Stack direction="row" gap={3} align="center" data-testid="vim-drill-complete">
                    <Text fontSize="sm" color="var(--success, var(--text))">
                        Drill complete.
                    </Text>
                    <chakra.button type="button" className="session-control-option" onClick={session.next}>
                        Next drill
                    </chakra.button>
                    <chakra.button type="button" className="session-control-option" onClick={session.retry}>
                        Try again
                    </chakra.button>
                </Stack>
            ) : null}
            <CodePanel
                key={editorKey}
                content={drill.startText}
                cursorChar={0}
                typedThrough={0}
                wrongChars={NO_INDEXES}
                autoClosedChars={NO_INDEXES}
                language="javascript"
                caretErrorActive={false}
                onReady={(focusEditor) => focusEditor()}
                fontSize={fontSize}
                surfaceStyle={surfaceStyle}
                syntaxHighlighting={syntaxHighlighting}
                interaction="vim-drill"
                onDrillState={report}
            />
        </Stack>
    );
}
