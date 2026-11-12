"use client";

import { useEffect, useState } from "react";
import {
    DialogBackdrop,
    DialogBody,
    DialogContent,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
    Flex,
    Portal,
    Text,
} from "@chakra-ui/react";
import { DialogCloseButton } from "@/components/ui/DialogCloseButton";
import { overlayBackdropProps, overlayDialogProps, overlayHeaderProps } from "@/components/ui/overlay";

/** Languages shipped in `data/snippets-*.json`. */
const LANGUAGE_COUNT = 4;
/** Rounded size of that corpus (896 snippets at the time of writing). */
const SNIPPET_COUNT_LABEL = "~900 snippets";

/**
 * The about copy that used to sit above the session. It lives in a popup now
 * so the editor starts higher on the page.
 */
export function Hero() {
    const [bestWpm, setBestWpm] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        let detach = () => {};
        // The module stays dynamically imported (it drags IndexedDB helpers in),
        // so the event name is read off the resolved module rather than
        // duplicated here — one source of truth, still nothing in first load.
        import("@/lib/storage/session-history")
            .then((mod) => {
                if (cancelled) return;
                const refresh = () => {
                    mod.getSessionStatsAsync()
                        .then((stats) => {
                            if (!cancelled) setBestWpm(Math.round(stats.bestWpm));
                        })
                        .catch((err) => {
                            console.warn("Failed to load personal best:", err);
                        });
                };
                // A finished run writes its record while this strip is mounted
                // (just hidden), so without this the line still reads "no runs
                // yet" when the user lands back on the session.
                window.addEventListener(mod.SESSION_SAVED_EVENT, refresh);
                detach = () => window.removeEventListener(mod.SESSION_SAVED_EVENT, refresh);
                refresh();
            })
            .catch((err) => {
                // Decorative stat only — a storage-less browser just gets a shorter line.
                console.warn("Failed to load personal best:", err);
            });
        return () => {
            cancelled = true;
            detach();
        };
    }, []);

    const stats = [
        `${LANGUAGE_COUNT} languages`,
        SNIPPET_COUNT_LABEL,
        bestWpm === null ? null : bestWpm > 0 ? `best ${bestWpm} wpm` : "no runs yet",
    ].filter((entry): entry is string => entry !== null);

    return (
        <Flex as="section" direction="column" gap={3} aria-label="About CodeSprint">
            <Text as="p" fontSize="sm" color="var(--text)" lineHeight={1.5}>
                Type real source code and get faster at the syntax you actually write.
            </Text>
            <Flex
                as="p"
                align="center"
                gap={2}
                flexWrap="wrap"
                fontSize="xs"
                color="var(--text-subtle)"
                letterSpacing="0.06em"
                fontVariantNumeric="tabular-nums"
            >
                {stats.map((entry, index) => (
                    <Flex as="span" key={entry} align="center" gap={2}>
                        {index > 0 && (
                            <Text as="span" aria-hidden="true" opacity={0.55}>
                                ·
                            </Text>
                        )}
                        {entry}
                    </Flex>
                ))}
            </Flex>
        </Flex>
    );
}

type AboutDialogProps = {
    isOpen: boolean;
    onClose: () => void;
};

/** Popup for the about copy. Opened from the header info button. */
export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
    return (
        <DialogRoot
            open={isOpen}
            size="sm"
            placement="center"
            onOpenChange={({ open }) => {
                if (!open) onClose();
            }}
        >
            <Portal>
                <DialogBackdrop {...overlayBackdropProps} />
                <DialogPositioner>
                    <DialogContent {...overlayDialogProps}>
                        <DialogCloseButton />
                        <DialogHeader {...overlayHeaderProps}>
                            <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">
                                About CodeSprint
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody py={4}>
                            <Hero />
                        </DialogBody>
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}

export default Hero;
