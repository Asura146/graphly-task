"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/hono";

export function DeleteAccountButton() {
    const router = useRouter();
    // 1. 現在のセッション（ユーザー情報）を取得
    const { data: session, isPending } = authClient.useSession();

    const handleDeleteAccount = async () => {
        const confirmed = confirm("本当に退会しますか？");
        if (!confirmed) return;
    
        const res = await api.auth["delete-account"].$post();
    
        if (res.ok) {
            alert("退会が完了しました");
            await authClient.signOut();
            router.push("/login");
        } else {
            alert("エラーが発生しました");
        }
    };

    // 読み込み中はボタンを無効化、または非表示にする
    if (isPending) return <button disabled>読み込み中...</button>;
    if (!session) return null;

    return (
        <button 
            onClick={handleDeleteAccount}
            style={{ 
                color: "white", 
                backgroundColor: "#ff4d4f", 
                border: "none", 
                padding: "10px 20px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold"
            }}
        >
            アカウントを完全に削除する
        </button>
    );
}