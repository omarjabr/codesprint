"use client";

import { type ReactNode } from "react";
import {
    Flex,
    Text,
    TooltipRoot,
    TooltipTrigger,
    TooltipPositioner,
    TooltipContent,
    chakra,
} from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import { m } from "framer-motion";
import { getControlsMotion } from "@/lib/motion-config";
import type { SupportedLanguage } from "@/lib/snippets";
import type { LengthFilter } from "@/hooks/useSessionControls";
import type { Phase } from "@/hooks/useFocusManagement";
import type { Difficulty } from "@/lib/snippets";
import { getActiveProvider } from "@/lib/ai/key-storage";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { useAIDrills } from "@/hooks/useAIDrills";
import { usePreferences } from "@/lib/preferences";

export type SurfaceStyle = "panel" | "immersive";

export interface SessionControlBarProps {
    /** Current language */
    language: SupportedLanguage;
    /** Callback when language changes */
    onLanguageChange: (lang: SupportedLanguage) => void;
    /** Current length preference */
    lengthPreference: LengthFilter;
    /** Callback when length preference changes */
    onLengthChange: (pref: LengthFilter) => void;
    /** Current surface style */
    surfaceStyle: SurfaceStyle;
    /** Callback when surface style changes */
    onSurfaceChange: (style: SurfaceStyle) => void;
    /** Current phase */
    phase: Phase;
    /** Whether controls are disabled */
    disabled: boolean;
    /** Whether terminal mode is enabled */
    isTerminalMode: boolean;
    /** Whether user prefers reduced motion */
    prefersReducedMotion: boolean;
    /** Number of snippets due for review */
    dueCount?: number;
    /** Suggested difficulty from adaptive system */
    suggestedDifficulty?: Difficulty;
    /** Callback when AI Drill button is clicked */
    onOpenAIDrill?: () => void;
}

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
];

const LENGTH_OPTIONS: Array<{ value: LengthFilter; label: string; helper: string }> = [
    { value: "all", label: "All", helper: "any length" },
    { value: "short", label: "Short", helper: "under ~15 lines" },
    { value: "medium", label: "Medium", helper: "tight 15-40 lines" },
    { value: "long", label: "Long", helper: "extended 40+ lines" },
];

const SURFACE_OPTIONS: Array<{ value: SurfaceStyle; label: string }> = [
    { value: "panel", label: "Framed" },
    { value: "immersive", label: "Immersive" },
];

interface ControlOptionProps {
    label: string;
    pressed?: boolean;
    disabled?: boolean;
    /** Shown on hover. Omitted for options whose label is already the whole meaning. */
    helper?: string;
    onClick: () => void;
    children?: ReactNode;
}

/**
 * One item inside a config capsule. Active state is accent-colored text, the
 * same treatment Monkeytype uses for the selected mode.
 */
function ControlOption({ label, pressed, disabled, helper, onClick, children }: ControlOptionProps) {
    const button = (
        <chakra.button
            type="button"
            className="session-control-option"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
        >
            {children ?? label}
        </chakra.button>
    );

    if (!helper) return button;

    return (
        <TooltipRoot>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipPositioner>
                <TooltipContent
                    bg="var(--surface)"
                    color="var(--text)"
                    border="1px solid var(--border)"
                    fontSize="xs"
                    px={2}
                    py={1}
                >
                    {helper}
                </TooltipContent>
            </TooltipPositioner>
        </TooltipRoot>
    );
}

/**
 * Language, length, and surface, as three centered capsules. A run starts on
 * the first keystroke, so this row has no Start button.
 */
export function SessionControlBar({
    language,
    onLanguageChange,
    lengthPreference,
    onLengthChange,
    surfaceStyle,
    onSurfaceChange,
    phase,
    disabled,
    isTerminalMode,
    prefersReducedMotion,
    dueCount,
    suggestedDifficulty,
    onOpenAIDrill,
}: SessionControlBarProps) {
    const controlsMotion = getControlsMotion(prefersReducedMotion);

    const { preferences } = usePreferences();
    const ai = useAIDrills(preferences);
    const showAIDrill = preferences.aiDrillsEnabled && getActiveProvider() !== null &&
        phase !== "running" && phase !== "countdown";
    const rateLimit = checkRateLimit(preferences.aiMaxDrillsPerDay);

    const hasDue = dueCount !== undefined && dueCount > 0;
    const showMetaRow = hasDue || Boolean(suggestedDifficulty);
    const barClass = isTerminalMode
        ? "session-control-bar session-control-bar-terminal"
        : "session-control-bar";

    return (
        <m.div className={barClass} {...controlsMotion}>
            <div className="session-control-row">
                <div className="session-control-group" role="group" aria-label="Language">
                    {LANGUAGE_OPTIONS.map((option) => (
                        <ControlOption
                            key={option.value}
                            label={option.label}
                            pressed={language === option.value}
                            disabled={disabled}
                            onClick={() => onLanguageChange(option.value)}
                        />
                    ))}
                </div>

                <div className="session-control-group" role="group" aria-label="Snippet length">
                    {LENGTH_OPTIONS.map((option) => (
                        <ControlOption
                            key={option.value}
                            label={option.label}
                            helper={option.helper}
                            pressed={lengthPreference === option.value}
                            disabled={disabled}
                            onClick={() => onLengthChange(option.value)}
                        />
                    ))}
                </div>

                <div className="session-control-group" role="group" aria-label="Appearance">
                    {SURFACE_OPTIONS.map((option) => (
                        <ControlOption
                            key={option.value}
                            label={option.label}
                            pressed={surfaceStyle === option.value}
                            disabled={disabled}
                            onClick={() => onSurfaceChange(option.value)}
                        />
                    ))}
                </div>

                {showAIDrill && (
                    <div className="session-control-group" role="group" aria-label="AI drills">
                        <ControlOption
                            label="AI"
                            helper={!rateLimit.allowed ? rateLimit.reason : "Generate AI drill (Shift+A on the result screen)"}
                            disabled={!rateLimit.allowed}
                            onClick={() => onOpenAIDrill?.()}
                        >
                            <Flex as="span" align="center" gap={1.5}>
                                <BoltIcon boxSize={3.5} />
                                AI
                                <Text as="span" fontSize="xs" color="var(--text-subtle)" fontVariantNumeric="tabular-nums">
                                    {ai.remainingToday}
                                </Text>
                            </Flex>
                        </ControlOption>
                    </div>
                )}
            </div>

            {showMetaRow && (
                <div className="session-control-meta">
                    {hasDue && (
                        <Flex align="center" gap={1.5} color="var(--accent)">
                            <DueIcon boxSize={3.5} />
                            <Text fontSize="xs" fontWeight={600} fontVariantNumeric="tabular-nums">
                                {dueCount} due for review
                            </Text>
                        </Flex>
                    )}
                    {suggestedDifficulty && (
                        <Text fontSize="xs" color="var(--text-subtle)">
                            Suggested:{" "}
                            <Text as="span" fontWeight={600} color="var(--text)">
                                {suggestedDifficulty}
                            </Text>
                        </Text>
                    )}
                </div>
            )}
        </m.div>
    );
}

function BoltIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </chakra.svg>
    );
}

function DueIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" />
            <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
        </chakra.svg>
    );
}
