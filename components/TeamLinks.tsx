"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
    useDisclosure, Button, Input, Textarea, addToast,
} from "@heroui/react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/hono";

interface TeamLink {
    id: string;
    title: string;
    url: string;
    description: string | null;
    creatorName: string | null;
    canEdit: boolean;
}

type LinkForm = { title: string; url: string; description: string };

const EMPTY_FORM: LinkForm = { title: "", url: "", description: "" };

async function readError(res: Response, fallback: string): Promise<string> {
    try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body.error === "string") return body.error;
        if (res.status === 400) return "入力内容を確認してください（http:// または https:// のURLのみ登録できます）";
    } catch {
        // ignore
    }
    return fallback;
}

function hostnameOf(url: string) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

export function TeamLinks({ teamId }: { teamId: string }) {
    const [links, setLinks] = useState<TeamLink[]>([]);
    const [form, setForm] = useState<LinkForm>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const fetchLinks = useCallback(async () => {
        try {
            const res = await api.teams[":id"].links.$get({ param: { id: teamId } });
            if (res.ok) setLinks(await res.json());
        } catch (error) {
            console.error(error);
        }
    }, [teamId]);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        onOpen();
    };

    const openEdit = (link: TeamLink) => {
        setEditingId(link.id);
        setForm({ title: link.title, url: link.url, description: link.description ?? "" });
        onOpen();
    };

    const handleSave = async (onClose: () => void) => {
        setIsSaving(true);
        const json = {
            title: form.title,
            url: form.url,
            ...(form.description.trim() ? { description: form.description } : {}),
        };
        try {
            const res = editingId
                ? await api.teams[":id"].links[":linkId"].$put({ param: { id: teamId, linkId: editingId }, json })
                : await api.teams[":id"].links.$post({ param: { id: teamId }, json });

            if (!res.ok) {
                addToast({ title: await readError(res, "リンクの保存に失敗しました"), color: "danger" });
                return;
            }
            addToast({ title: editingId ? "リンクを更新しました" : "リンクを追加しました", color: "success" });
            onClose();
            fetchLinks();
        } catch (error) {
            console.error(error);
            addToast({ title: "エラーが発生しました", color: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (link: TeamLink) => {
        if (!confirm(`「${link.title}」を削除しますか？`)) return;
        try {
            const res = await api.teams[":id"].links[":linkId"].$delete({ param: { id: teamId, linkId: link.id } });
            if (!res.ok) {
                addToast({ title: await readError(res, "リンクの削除に失敗しました"), color: "danger" });
                return;
            }
            setLinks((prev) => prev.filter((l) => l.id !== link.id));
        } catch (error) {
            console.error(error);
            addToast({ title: "エラーが発生しました", color: "danger" });
        }
    };

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-700">リンク集</h2>
                <Button size="sm" variant="flat" color="primary" startContent={<Plus size={16} />} onPress={openCreate}>
                    リンクを追加
                </Button>
            </div>

            {links.length === 0 ? (
                <div className="p-4 border border-dashed border-gray-300 rounded-lg text-gray-500 text-sm bg-white/50">
                    リンクはまだ登録されていません
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {links.map((link) => (
                        <div
                            key={link.id}
                            className="group relative bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all"
                        >
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="block pr-14">
                                <h3 className="font-bold text-gray-800 group-hover:text-blue-600 mb-1 flex items-center gap-1">
                                    <span className="truncate">{link.title}</span>
                                    <ExternalLink size={14} className="shrink-0 text-gray-400" />
                                </h3>
                                <p className="text-xs text-blue-500 truncate">{hostnameOf(link.url)}</p>
                                {link.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{link.description}</p>
                                )}
                                {link.creatorName && (
                                    <p className="text-[11px] text-gray-400 mt-2">追加: {link.creatorName}</p>
                                )}
                            </a>
                            {link.canEdit && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <Button isIconOnly size="sm" variant="light" aria-label="リンクを編集" onPress={() => openEdit(link)}>
                                        <Pencil size={14} />
                                    </Button>
                                    <Button isIconOnly size="sm" variant="light" color="danger" aria-label="リンクを削除" onPress={() => handleDelete(link)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{editingId ? "リンクを編集" : "リンクを追加"}</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <Input
                                        label="タイトル"
                                        isRequired
                                        value={form.title}
                                        onValueChange={(title) => setForm((f) => ({ ...f, title }))}
                                        placeholder="例: 仕様書"
                                        maxLength={100}
                                    />
                                    <Input
                                        label="URL"
                                        type="url"
                                        isRequired
                                        value={form.url}
                                        onValueChange={(url) => setForm((f) => ({ ...f, url }))}
                                        placeholder="https://example.com"
                                        maxLength={2048}
                                    />
                                    <Textarea
                                        label="説明（任意）"
                                        value={form.description}
                                        onValueChange={(description) => setForm((f) => ({ ...f, description }))}
                                        maxLength={500}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>キャンセル</Button>
                                <Button
                                    color="primary"
                                    isLoading={isSaving}
                                    isDisabled={!form.title.trim() || !form.url.trim()}
                                    onPress={() => handleSave(onClose)}
                                >
                                    {editingId ? "更新" : "追加"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
