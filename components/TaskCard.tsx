"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FripCard from "@/components/FripCard";
import { 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem 
} from "@heroui/dropdown";
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  useDisclosure 
} from "@heroui/modal";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem, Avatar } from "@heroui/react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { api } from "@/lib/hono";

type TaskStatus = "todo" | "in_progress" | "done";

export interface Member {
    id: string;
    name: string;
    image?: string | null;
}

interface TaskCardProps {
    id?: string;
    title?: string;
    description?: string | null;
    team?: string;
    status?: string; 
    dueDate?: string;
    assigneeId?: string | null; 
    members?: Member[];
    groupId?: string | null;
    groupName?: string | null;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
    todo: { label: "未着手", className: "bg-gray-100 text-gray-600 border-gray-200" },
    in_progress: { label: "進行中", className: "bg-blue-100 text-blue-600 border-blue-200" },
    done: { label: "完了", className: "bg-green-100 text-green-600 border-green-200" },
};

export default function TaskCard({ 
    id,
    title = "タイトル",
    description = "",
    team = "個人用",
    status = "todo",
    dueDate = "--/--/--",
    assigneeId = null,
    members = [],
    groupId = null,
    groupName = null,
}: TaskCardProps) {
    const router = useRouter();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    
    const { 
        isOpen: isDeleteOpen, 
        onOpen: onDeleteOpen, 
        onOpenChange: onDeleteOpenChange 
    } = useDisclosure();

    const { 
        isOpen: isCompleteOpen, 
        onOpen: onCompleteOpen, 
        onOpenChange: onCompleteOpenChange 
    } = useDisclosure();

    const [isLoading, setIsLoading] = useState(false);

    const [editTitle, setEditTitle] = useState(title);
    const [editDescription, setEditDescription] = useState(description || "");
    const [editDueDate, setEditDueDate] = useState("");
    const [editAssigneeId, setEditAssigneeId] = useState<string>(assigneeId || "");

    const normalizedStatus: TaskStatus = (() => {
        if (!status) return "todo";
        const s = status.toString().toLowerCase();
        if (s === "in_progress" || s === "doing") return "in_progress";
        if (s === "done") return "done";
        return "todo";
    })();

    const currentStatus = statusConfig[normalizedStatus] || statusConfig.todo;

    const getRemainingDays = (dateStr: string) => {
        if (dateStr === "--/--/--" || !dateStr) return null;
        const targetDate = new Date(dateStr);
        const today = new Date();
        targetDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        if (isNaN(targetDate.getTime())) return null;
        const diffTime = targetDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const remainingDays = getRemainingDays(dueDate);
    const isUrgent = remainingDays !== null && remainingDays <= 3;

    const getHeaderColor = () => {
        if (remainingDays === null) return "bg-gray-300";
        if (remainingDays <= 3) return "bg-red-500";
        if (remainingDays <= 7) return "bg-yellow-400";
        return "bg-green-500";
    };

    const headerColor = getHeaderColor();

    const handleDelete = async (onClose: () => void) => {
        if (!id) return;
        setIsLoading(true);
        try {
            const res = await api.tasks[":id"].$delete({ param: { id } });
            if (!res.ok) throw new Error("Delete failed");
            
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("taskCreated"));
            }
            router.refresh();
            onClose();
        } catch (error) {
            console.error(error);
            alert("削除に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEdit = () => {
        setEditTitle(title);
        setEditDescription(description || "");
        setEditAssigneeId(assigneeId || "");
        
        if (dueDate && dueDate !== "--/--/--") {
            const formatted = dueDate.includes("/") ? dueDate.split("/").join("-") : dueDate;
            setEditDueDate(formatted);
        }
        onOpen();
    };

    const handleUpdate = async (onClose: () => void) => {
        if (!id) return;
        setIsLoading(true);
        try {
            const res = await api.tasks[":id"].$patch({
                param: { id },
                json: {
                    title: editTitle,
                    description: editDescription,
                    dueDate: editDueDate || undefined,
                    assigneeId: editAssigneeId || null,
                },
            });

            if (!res.ok) throw new Error("Update failed");

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("taskCreated"));
            }
            router.refresh();
            onClose();
        } catch (error) {
            console.error(error);
            alert("更新に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    const updateTaskStatus = async (serverStatusKey: "TODO" | "IN_PROGRESS" | "DONE") => {
        try {
            const res = await api.tasks[":id"].$patch({
                param: { id: id! },
                json: {
                    status: serverStatusKey,
                },
            });

            if (!res.ok) throw new Error("Status update failed");

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("taskCreated"));
            }
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("ステータス変更に失敗しました");
        }
    };

    const handleStatusChangeData = async (newStatus: TaskStatus) => {
        if (!id) return;

        if (newStatus === "done") {
            onCompleteOpen();
            return; 
        }

        const serverStatusMap: Record<TaskStatus, "TODO" | "IN_PROGRESS" | "DONE"> = {
            todo: "TODO",
            in_progress: "IN_PROGRESS",
            done: "DONE",
        };
        await updateTaskStatus(serverStatusMap[newStatus]);
    };

    const handleConfirmComplete = async (onClose: () => void) => {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999,
        });

        await updateTaskStatus("DONE");
        
        onClose();
    };

    return (
        <>
            <FripCard
                frontTopHeader={
                    <div className={`w-full h-4 ${headerColor} flex items-center justify-center`}/>
                }
                frontTopContent={
                    <div className="h-full relative">
                         <div className="absolute top-0 right-2 z-50">
                            <Dropdown>
                                <DropdownTrigger>
                                    <button 
                                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                                        </svg>
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu 
                                    aria-label="Task Actions" 
                                    onAction={(key) => {
                                        if (key === "edit") handleOpenEdit();
                                        if (key === "delete") onDeleteOpen();
                                    }}
                                >
                                    <DropdownItem key="edit">編集</DropdownItem>
                                    <DropdownItem key="delete" className="text-danger" color="danger">削除</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>

                        <div className="flex flex-col h-full pl-6 pt-3 pr-8">
                            <h2 className="text-lg font-semibold truncate">{title}</h2>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-sm text-gray-500 whitespace-nowrap">{team}</p>
                                
                                {groupId && groupName && (
                                    <Link 
                                        href={`/groups/${groupId}`} 
                                        className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors ml-2 truncate max-w-25"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <p className="px-1 truncate">{groupName}</p>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                }
                frontBottomContent={
                    <div className="w-full px-6 flex justify-between items-end">
                        <div className="flex flex-col gap-2 items-start" onClick={(e) => e.stopPropagation()}>
                            <Dropdown>
                                <DropdownTrigger>
                                    <button 
                                        className={`px-5 py-1 rounded-full text-xs font-medium border transition-transform active:scale-95 ${currentStatus.className} hover:shadow-sm`}
                                    >
                                        {currentStatus.label}
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu 
                                    aria-label="Status Actions" 
                                    onAction={(key) => handleStatusChangeData(key as TaskStatus)}
                                >
                                    <DropdownItem key="todo">未着手</DropdownItem>
                                    <DropdownItem key="in_progress">進行中</DropdownItem>
                                    <DropdownItem key="done">完了</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>

                            <div className="flex items-center text-gray-700 text-sm font-semibold">
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                {dueDate}
                            </div>
                        </div>

                        <div className="text-right pb-0.5 pr-10">
                            {remainingDays !== null ? (
                                <>
                                    <span className="text-xs text-gray-500 mr-1">残り</span>
                                    <span className={`text-lg font-bold ${isUrgent ? "text-red-500" : "text-gray-700"}`}>
                                        {remainingDays}日
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs text-gray-400 mr-1">-</span>
                            )}
                        </div>
                    </div>
                }
                backContent={
                    <div className="text-white px-2 overflow-y-auto h-full w-full">
                        <h2 className="text-lg font-semibold mb-2 text-white">詳細</h2>
                        <p className="text-white text-sm whitespace-pre-wrap">{ description || "詳細はありません"}</p>
                    </div>
                }
                width="300px"
                height="200px"
            />

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">タスクを編集</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <Input
                                        label="タイトル"
                                        value={editTitle}
                                        onValueChange={setEditTitle}
                                        isRequired
                                    />
                                    {members && members.length > 0 && (
                                        <Select 
                                            label="担当者"
                                            placeholder="担当者を選択（任意）"
                                            selectedKeys={editAssigneeId ? [editAssigneeId] : []}
                                            onChange={(e) => setEditAssigneeId(e.target.value)}
                                        >
                                            {members.map((member) => (
                                                <SelectItem key={member.id} textValue={member.name}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar alt={member.name} className="shrink-0" size="sm" src={member.image || undefined} />
                                                        <span className="text-small">{member.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </Select>
                                    )}
                                    <Textarea
                                        label="詳細"
                                        value={editDescription}
                                        onValueChange={setEditDescription}
                                    />
                                    <Input
                                        type="date"
                                        label="期限"
                                        value={editDueDate}
                                        onValueChange={setEditDueDate}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    キャンセル
                                </Button>
                                <Button 
                                    color="primary" 
                                    onPress={() => handleUpdate(onClose)}
                                    isLoading={isLoading}
                                    isDisabled={!editTitle}
                                >
                                    更新する
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            
            {/* タスク完了確認モーダル */}
            <Modal isOpen={isCompleteOpen} onOpenChange={onCompleteOpenChange} placement="center">
                <ModalContent>
                    {(onClose) => (
                        <>
                            {/* <ModalHeader className="flex flex-col gap-1 text-green-600">タスクを完了とする？</ModalHeader> */}
                            <ModalBody>
                                <div className="text-center py-4">
                                    <p className="text-lg font-bold mb-2">素晴らしい！</p>
                                    <p className="text-gray-600">このタスクを完了にしますか？</p>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    まだ
                                </Button>
                                <Button 
                                    className="bg-green-500 text-white font-bold" 
                                    onPress={() => handleConfirmComplete(onClose)}
                                >
                                    完了とする！
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange} placement="center">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">タスクを削除</ModalHeader>
                            <ModalBody>
                                <p>本当にこのタスクを削除しますか？</p>
                                <p className="text-sm text-gray-500">この操作は取り消せません。</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    キャンセル
                                </Button>
                                <Button 
                                    color="danger" 
                                    onPress={() => handleDelete(onClose)}
                                    isLoading={isLoading}
                                >
                                    削除する
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}