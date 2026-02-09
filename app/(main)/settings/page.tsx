"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Divider } from "@heroui/react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from "@heroui/modal";

export default function SettingsPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // 削除確認モーダル用
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    // ユーザー情報の取得
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/users/me");
                if (res.ok) {
                    const data = await res.json();
                    setName(data.name);
                }
            } catch (error) {
                console.error("Failed to fetch user");
            } finally {
                setIsLoading(false);
            }
        };
        fetchUser();
    }, []);

    // 名前更新処理
    const handleUpdateName = async () => {
        setIsUpdating(true);
        try {
            const res = await fetch("/api/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            if (res.ok) {
                // ★修正: ページ全体をリロードしてヘッダーの表示を確実に更新する
                window.location.reload();
            } else {
                alert("更新に失敗しました");
            }
        } catch (error) {
            console.error(error);
            alert("エラーが発生しました");
        } finally {
            setIsUpdating(false);
        }
    };

    // アカウント削除処理
    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch("/api/users/me", {
                method: "DELETE",
            });

            if (res.ok) {
                // 削除成功したらトップページなどへ強制リダイレクト
                window.location.href = "/"; 
            } else {
                alert("削除に失敗しました");
            }
        } catch (error) {
            console.error(error);
            alert("エラーが発生しました");
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen">読み込み中...</div>;
    }

    return (
        <div className="bg-gray-100 min-h-screen pt-24 px-6 pb-20">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">アカウント設定</h1>

                {/* プロフィール設定セクション */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 mb-8">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">プロフィール設定</h2>
                    <div className="flex flex-col gap-4">
                        <Input
                            label="表示名"
                            value={name}
                            onValueChange={setName}
                            placeholder="あなたの名前"
                            variant="bordered"
                        />
                        <div className="flex justify-end mt-2">
                            <Button 
                                color="primary" 
                                onPress={handleUpdateName}
                                isLoading={isUpdating}
                                disabled={!name}
                            >
                                更新する
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 危険なエリア */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100">
                    <h2 className="text-lg font-bold text-red-600 mb-2">Danger Zone</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        アカウントを削除すると、元に戻すことはできません。所属しているチームからは脱退扱いとなり、あなたが作成した個人タスクは全て削除されます。
                    </p>
                    
                    <div className="flex justify-end">
                        <Button 
                            color="danger" 
                            variant="flat"
                            onPress={onOpen}
                        >
                            アカウントを削除する
                        </Button>
                    </div>
                </div>
            </div>

            {/* 削除確認モーダル */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 text-danger">警告: アカウント削除</ModalHeader>
                            <ModalBody>
                                <p className="font-bold">本当にアカウントを削除しますか？</p>
                                <p className="text-sm text-gray-600">
                                    この操作は完全に取り消すことができません。あなたのデータは永久に失われます。
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    キャンセル
                                </Button>
                                <Button 
                                    color="danger" 
                                    isLoading={isDeleting}
                                    onPress={handleDeleteAccount}
                                >
                                    削除を実行
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}