"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, useDisclosure, Button } from "@heroui/react";
import { Bell } from "lucide-react";
import { DiscordSettingsForm } from "@/components/DiscordSettingsForm";

interface TeamDiscordSettingsProps {
    teamId: string;
    teamName: string;
}

export function TeamDiscordSettings({ teamId, teamName }: TeamDiscordSettingsProps) {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    return (
        <>
            <Button
                onPress={onOpen}
                size="sm"
                variant="flat"
                isIconOnly
                aria-label="Discord通知設定"
            >
                <Bell size={18} />
            </Button>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Discord通知
                                <span className="text-sm font-normal text-gray-500">
                                    「{teamName}」の未完了タスクを Discord に通知します
                                </span>
                            </ModalHeader>
                            <ModalBody className="pb-6">
                                <DiscordSettingsForm scope={{ type: "team", teamId }} onDone={onClose} />
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}
