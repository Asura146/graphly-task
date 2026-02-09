"use client";

import { useState } from "react";
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Button, Input, Textarea 
} from "@heroui/react";
import { api } from "@/lib/hono";
import { useRouter } from "next/navigation";

export function CreateTeam() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      const res = await api.teams.$post({
        json: { name, description },
      });

      if (res.ok) {
        // チーム作成イベントを発行してダッシュボードに通知
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("teamCreated"));
        }
        
        router.refresh(); // チームリストを更新
        onClose();
        setName("");
        setDescription("");
      }
    } catch (error) {
      alert("チーム作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onPress={onOpen} color="primary" variant="flat">＋ チームを作成</Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>新規チーム作成</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input 
                    label="チーム名" 
                    value={name} 
                    onValueChange={setName} 
                    placeholder="例: 開発プロジェクトA"
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
                  isDisabled={!name}
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