'use client';
import { authClient } from "@/lib/auth-client";

export function UserInfo() {
    const { data: session, isPending } = authClient.useSession();

    if (isPending) return <p>読み込み中...</p>;
    if (!session) return <p>ログインしていません</p>;

    return (
        <div>
            <p>こんにちは、{session.user.name}さん</p>
            <button onClick={() => authClient.signOut()}>ログアウト</button>
        </div>
    );
}