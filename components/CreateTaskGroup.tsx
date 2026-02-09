"use client";

import { useState } from "react";
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Button, Input, Textarea 
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface CreateTaskGroupProps {
    teamId?: string | null;
    onGroupCreated?: () => void;
}

export function CreateTaskGroup({ teamId, onGroupCreated }: CreateTaskGroupProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/task-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, teamId }),
      });

      if (res.ok) {
        if(onGroupCreated) onGroupCreated();
        router.refresh(); 
        onClose();
        setTitle("");
        setDescription("");
      } else {
        alert("作成に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onPress={onOpen} color="primary" variant="flat" className="font-medium shadow-md">
        ＋ タスクグループ作成
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>タスクフロー(グループ)を作成</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input 
                    label="タイトル" 
                    value={title} 
                    onValueChange={setTitle} 
                    placeholder="例: 会員登録機能の実装フロー"
                    isRequired
                  />
                  <Textarea 
                    label="説明" 
                    value={description} 
                    onValueChange={setDescription} 
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