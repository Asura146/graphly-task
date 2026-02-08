"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Input, Textarea } from "@heroui/input";

export default function CreateMyTask() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // フォームの状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = async (onClose: () => void) => {
    if (!title) return;

    setIsLoading(true);
    try {
        // API エンドポイントに合わせてリクエストを作成
        // server/tasks.ts の POST / ルートに対応
        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                description,
                dueDate: dueDate || undefined,
                // teamId を送らないことで個人タスクとして扱われる
            }),
        });

        if (!res.ok) {
            throw new Error("Failed to create task");
        }

        // 成功したらフォームをリセットし、画面を更新してモーダルを閉じる
        setTitle("");
        setDescription("");
        setDueDate("");
        
        // ★追加: タスク作成イベントを発行してダッシュボードに通知
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("taskCreated"));
        }
        
        router.refresh(); // リストの再取得
        onClose();
    } catch (error) {
        console.error("Error creating task:", error);
        alert("タスクの作成に失敗しました");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      <Button onPress={onOpen} color="primary" variant="flat" className="font-medium shadow-md">
        ＋ タスクを追加
      </Button>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                新しい個人タスクを作成
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input
                    label="タイトル"
                    placeholder="例: レポート作成"
                    value={title}
                    onValueChange={setTitle}
                    isRequired
                  />
                  
                  <Textarea
                    label="詳細"
                    placeholder="タスクの詳細を入力（任意）"
                    value={description}
                    onValueChange={setDescription}
                  />

                  <Input
                    type="date"
                    label="期限"
                    value={dueDate}
                    onValueChange={setDueDate}
                    placeholder="日付を選択"
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  キャンセル
                </Button>
                <Button 
                    color="primary" 
                    onPress={() => handleSubmit(onClose)}
                    isLoading={isLoading}
                    isDisabled={!title}
                >
                  追加する
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}