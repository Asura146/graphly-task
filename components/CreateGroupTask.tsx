"use client";

import { useState } from "react";
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Button, Input, Textarea, Select, SelectItem, Avatar 
} from "@heroui/react";
import { api } from "@/lib/hono";

interface Member {
    id: string;
    name: string;
    image?: string | null;
}

interface CreateGroupTaskProps {
    teamId: string | null;
    groupId: string;
    members: Member[];
    onTaskCreated: (task: any) => void;
}

export function CreateGroupTask({ teamId, groupId, members, onTaskCreated }: CreateGroupTaskProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      const res = await api.tasks.$post({
        json: {
          title,
          description,
          dueDate: dueDate || undefined,
          assigneeId: assigneeId || undefined,
          teamId,
          taskGroupId: groupId,
        },
      });

      if (res.ok) {
        const newTask = await res.json();
        onTaskCreated(newTask);
        onClose();
        // フォームのリセット
        setTitle("");
        setDescription("");
        setDueDate("");
        setAssigneeId("");
      } else {
        alert("作成に失敗しました");
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
      <Button onPress={onOpen} className="w-full font-semibold shadow-sm bg-black text-white hover:bg-gray-800">
        ＋ タスクを追加
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>フローにタスクを追加</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input 
                    label="タイトル" 
                    value={title} 
                    onValueChange={setTitle} 
                    isRequired
                    placeholder="タスク名を入力"
                  />
                  <Textarea 
                    label="詳細" 
                    value={description} 
                    onValueChange={setDescription} 
                    placeholder="タスクの詳細を入力"
                  />
                  <Input
                    type="date"
                    label="期限"
                    value={dueDate}
                    onValueChange={setDueDate}
                  />
                  {members.length > 0 && (
                      <Select 
                        label="担当者"
                        placeholder="担当者を選択"
                        selectedKeys={assigneeId ? [assigneeId] : []}
                        onChange={(e) => setAssigneeId(e.target.value)}
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
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>キャンセル</Button>
                <Button 
                  className="bg-black text-white hover:bg-gray-800"
                  isLoading={isLoading} 
                  onPress={() => handleCreate(onClose)}
                  isDisabled={!title}
                >
                  追加
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}