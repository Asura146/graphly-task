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

type TaskStatus = "todo" | "in_progress" | "done";

interface TaskCardProps {
    id?: string; // 編集・削除のためにIDが必要
    title?: string;
    description?: string | null; // 編集用に説明を受け取る
    team?: string;
    status?: TaskStatus;
    dueDate?: string;
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
}: TaskCardProps) {
    const router = useRouter();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const { 
        isOpen: isDeleteOpen, 
        onOpen: onDeleteOpen, 
        onOpenChange: onDeleteOpenChange 
    } = useDisclosure();
    const [isLoading, setIsLoading] = useState(false);

    // 編集フォームの状態
    const [editTitle, setEditTitle] = useState(title);
    const [editDescription, setEditDescription] = useState(description || "");
    const [editDueDate, setEditDueDate] = useState("");

    // ステータスの正規化処理
    // APIから "IN_PROGRESS" (大文字) が来る場合や、"doing" などの表記揺れを吸収する
    const normalizedStatus: TaskStatus = (() => {
        if (!status) return "todo";
        const s = status.toString().toLowerCase(); // 小文字化
        if (s === "in_progress" || s === "doing") return "in_progress";
        if (s === "done") return "done";
        return "todo";
    })();

    const currentStatus = statusConfig[normalizedStatus] || statusConfig.todo;

    // 残り日数の計算（既存ロジック）
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
    const isUrgent = remainingDays !== null && remainingDays <= 3 && remainingDays >= 0;

    // 期限に応じたヘッダー色の決定
    const getHeaderColor = () => {
        if (remainingDays === null) return "bg-gray-300";
        if (remainingDays <= 3) return "bg-red-500";
        if (remainingDays <= 7) return "bg-yellow-400";
        return "bg-green-500";
    };

    const headerColor = getHeaderColor();

    // 削除処理（モーダル用）
    const handleDelete = async (onClose: () => void) => {
        if (!id) return;

        setIsLoading(true);
        try {
            const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            
            // ダッシュボード更新通知
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("taskCreated"));
            }
            router.refresh();
            onClose(); // モーダルを閉じる
        } catch (error) {
            console.error(error);
            alert("削除に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    // 編集モーダルを開く準備
    const handleOpenEdit = () => {
        setEditTitle(title);
        setEditDescription(description || ""); // 親から渡された description をここで入れ直す
        
        if (dueDate && dueDate !== "--/--/--") {
            const formatted = dueDate.includes("/") ? dueDate.split("/").join("-") : dueDate;
            setEditDueDate(formatted);
        }
        onOpen();
    };

    // 更新処理
    const handleUpdate = async (onClose: () => void) => {
        console.log("1. handleUpdateが呼ばれました");
        console.log("2. 現在のID:", id); // ここが undefined なら親コンポーネントを確認
        
        if (!id) {
            console.error("3. IDがないため中断しました");
            return;
        }
    
        console.log("4. APIリクエストを開始します...");
        setIsLoading(true);
        if (!id) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editTitle,
                    description: editDescription,
                    dueDate: editDueDate || undefined,
                }),
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

    // クイックステータス変更
    const handleStatusChange = async (newStatus: TaskStatus) => {
        if (!id) return;
        
        // サーバー用ステータスマップ
        const serverStatusMap: Record<string, string> = {
            todo: "TODO",
            in_progress: "IN_PROGRESS", // キーを 'in_progress' に統一
            done: "DONE",
        };

        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: serverStatusMap[newStatus],
                }),
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

    return (
        <>
            <FripCard
                frontTopHeader={
                    <div className={`w-full h-4 ${headerColor} flex items-center justify-center`}/>
                }
                frontTopContent={
                    <div className="h-full relative">
                         {/* 右上のメニューボタン */}
                         <div className="absolute top-0 right-2 z-50">
                            <Dropdown>
                                <DropdownTrigger>
                                    <button 
                                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                                        onClick={(e) => e.stopPropagation()} // カードの反転を防止
                                    >
                                        {/* 三点リーダーアイコン */}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                                        </svg>
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu 
                                    aria-label="Task Actions" 
                                    onAction={(key) => {
                                        if (key === "edit") handleOpenEdit();
                                        if (key === "delete") onDeleteOpen(); // 削除モーダルを開く
                                    }}
                                >
                                    <DropdownItem key="edit">編集</DropdownItem>
                                    <DropdownItem key="delete" className="text-danger" color="danger">削除</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>

                        <div className="flex items-center h-full pl-6 pt-3 pr-8">
                            <h2 className="text-lg font-semibold truncate">{title}</h2>
                            <p className="ml-auto text-sm pt-1 text-gray-500 whitespace-nowrap">{team}</p>
                        </div>
                    </div>
                }
                frontBottomContent={
                    <div className="w-full px-6 flex justify-between items-end">
                        <div className="flex flex-col gap-2 items-start" onClick={(e) => e.stopPropagation()}>
                            {/* ステータス表示 - クリックで変更可能なドロップダウンにする */}
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
                                    onAction={(key) => handleStatusChange(key as TaskStatus)}
                                >
                                    <DropdownItem key="todo">未着手</DropdownItem>
                                    <DropdownItem key="in_progress">進行中</DropdownItem>
                                    <DropdownItem key="done">完了</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>

                            {/* 期限表示 */}
                            <div className="flex items-center text-gray-700 text-sm font-semibold">
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                {dueDate}
                            </div>
                        </div>

                        {/* 残り日数 */}
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

            {/* 編集用モーダル */}
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

            {/* 削除確認用モーダル */}
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