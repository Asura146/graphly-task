"use client";

import { useState } from "react";
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Button, Input 
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface AddTeamMemberProps {
    teamId: string;
    teamName: string;
    onSuccess?: () => void; // 追加: 成功時のコールバック
}

export function AddTeamMember({ teamId, teamName, onSuccess }: AddTeamMemberProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleAddMember = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        alert("メンバーを追加しました");
        router.refresh(); 
        if (onSuccess) onSuccess(); // 成功時に実行
        onClose();
        setEmail("");
      } else {
        const error = await res.json();
        alert(error.error || "メンバー追加に失敗しました");
      }
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onPress={onOpen} size="sm" color="primary" className="font-medium">
        ＋ メンバー招待
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>メンバーを追加</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-gray-600">
                    「{teamName}」にユーザーを追加します。<br/>
                    追加したいユーザーのメールアドレスを入力してください。
                  </p>
                  <Input 
                    label="メールアドレス" 
                    type="email"
                    value={email} 
                    onValueChange={setEmail} 
                    placeholder="user@example.com"
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>キャンセル</Button>
                <Button 
                  color="primary" 
                  isLoading={isLoading} 
                  onPress={() => handleAddMember(onClose)}
                  isDisabled={!email}
                >
                  招待を送る
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}