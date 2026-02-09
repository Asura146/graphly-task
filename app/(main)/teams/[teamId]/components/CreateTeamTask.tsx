"use client";

import { useState } from "react";
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Button, Input, Textarea, Select, SelectItem, Avatar
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface Member {
    id: string;
    name: string;
    email: string;
    image: string | null;
}

interface CreateTeamTaskProps {
    teamId: string;
    members: Member[];
    onTaskCreated?: () => void;
}

export function CreateTeamTask({ teamId, members, onTaskCreated }: CreateTeamTaskProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(""); // 空文字なら未割り当て
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (onClose: () => void) => {
    if (!title) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          dueDate: dueDate || undefined,
          teamId,
          // 空文字の場合はnull（未割り当て）として送信
          assigneeId: assigneeId || null, 
        }),
      });

      if (res.ok) {
        if (onTaskCreated) onTaskCreated();
        router.refresh();
        onClose();
        // フォームをリセット
        setTitle("");
        setDescription("");
        setDueDate("");
        setAssigneeId("");
      } else {
        alert("タスク作成に失敗しました");
      }
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
        <Button onPress={onOpen} className="font-medium shadow-md" variant="flat" color="primary">
            ＋ タスクを追加
        </Button>
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
            {(onClose) => (
                <>
                <ModalHeader>チームタスクを作成</ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        <Input 
                            label="タイトル" 
                            value={title} 
                            onValueChange={setTitle} 
                            isRequired
                        />
                        
                        <Select 
                            label="担当者" 
                            placeholder="担当者を選択（任意）"
                            selectedKeys={assigneeId ? [assigneeId] : []}
                            onChange={(e) => setAssigneeId(e.target.value)}
                        >
                            {members.map((member) => (
                                <SelectItem key={member.id} textValue={member.name}>
                                    <div className="flex items-center gap-2">
                                        <Avatar alt={member.name} className="flex-shrink-0" size="sm" src={member.image || undefined} />
                                        <span className="text-small">{member.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </Select>

                        <Textarea 
                            label="詳細" 
                            value={description} 
                            onValueChange={setDescription} 
                        />
                        <Input 
                            type="date"
                            label="期限" 
                            value={dueDate} 
                            onValueChange={setDueDate} 
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>キャンセル</Button>
                    <Button 
                    color="primary" 
                    isLoading={isLoading} 
                    onPress={() => handleCreate(onClose)}
                    isDisabled={!title}
                    >
                    作成
                    </Button>
                </ModalFooter>
                </>
            )}
            </ModalContent>
        </Modal>
    </>
  );
}