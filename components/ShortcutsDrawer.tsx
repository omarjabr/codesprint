"use client";

import {
    Box,
    DrawerBackdrop,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    DrawerPositioner,
    DrawerRoot,
    DrawerTitle,
    Grid,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react";
import { Fragment, useRef } from "react";
import { KEYBOARD_SHORTCUTS } from "@/lib/shortcuts";
import { DrawerCloseButton } from "@/components/ui/DialogCloseButton";
import { overlayBackdropProps, overlayDrawerProps, overlayHeaderProps } from "@/components/ui/overlay";

type ShortcutsDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
};

/**
 * Caps the key column so every description starts on the same x. 9rem is wide
 * enough for the longest combo to wrap onto two centered lines
 * ("Option/Alt +" / "Left/Right") instead of spilling out of the chip. The
 * track can shrink on a narrow drawer; the label wraps inside the chip.
 */
const KEY_COLUMN = "minmax(0, 9rem)";

export function ShortcutsDrawer({ isOpen, onClose }: ShortcutsDrawerProps) {
    const bodyRef = useRef<HTMLDivElement>(null);

    return (
        <DrawerRoot
            open={isOpen}
            placement="end"
            size="sm"
            initialFocusEl={() => bodyRef.current}
            onOpenChange={({ open }) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <Portal>
                <DrawerBackdrop {...overlayBackdropProps} />
                <DrawerPositioner>
                    <DrawerContent {...overlayDrawerProps}>
                        <DrawerCloseButton />
                        <DrawerHeader {...overlayHeaderProps}>
                            <DrawerTitle>Keyboard shortcuts</DrawerTitle>
                        </DrawerHeader>
                        <DrawerBody ref={bodyRef} tabIndex={-1} outline="none">
                            <Stack gap={6} mt={4}>
                                <Text color="var(--text-subtle)" fontSize="sm">
                                    Stay on the keys, every action has a gesture.
                                </Text>
                                <Grid
                                    templateColumns={`${KEY_COLUMN} minmax(0, 1fr)`}
                                    columnGap={4}
                                    rowGap={3}
                                    alignItems="center"
                                >
                                    {KEYBOARD_SHORTCUTS.map((shortcut) => (
                                        <Fragment key={shortcut.combo}>
                                            <Box
                                                px={3}
                                                py={2}
                                                borderRadius="var(--radius-sm)"
                                                border="1px solid var(--border)"
                                                bg="var(--surface)"
                                                boxShadow="var(--elev-1)"
                                                fontFamily="var(--font-mono), ui-monospace, Menlo, Consolas, monospace"
                                                fontWeight={600}
                                                fontSize="sm"
                                                lineHeight="1.35"
                                                textAlign="center"
                                                color="var(--text)"
                                                letterSpacing="0.02em"
                                                minW={0}
                                                maxW="100%"
                                                whiteSpace="normal"
                                                overflowWrap="break-word"
                                            >
                                                {shortcut.combo}
                                            </Box>
                                            <Text color="var(--text-subtle)" fontSize="sm">
                                                {shortcut.detail}
                                            </Text>
                                        </Fragment>
                                    ))}
                                </Grid>
                            </Stack>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerPositioner>
            </Portal>
        </DrawerRoot>
    );
}

export default ShortcutsDrawer;
