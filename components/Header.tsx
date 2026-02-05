"use client";

import Link from "next/link";
import { Button } from "@heroui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";

export default function Header() {
    const router = useRouter();
    const { data: session } = authClient.useSession();

    // サインアウト処理
    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/login");
                    router.refresh();
                },
            },
        });
    };

    return (
        <div className="fixed top-4 left-0 right-0 flex justify-center z-50 px-4">
            <header className="
                w-full max-w-5xl 
                bg-white/60 backdrop-blur-md 
                shadow-lg 
                rounded-full 
                px-6 py-3 
                flex items-center justify-between
                border border-gray-200
            ">
                
                {/* ロゴ部分 */}
                <div className="font-bold text-xl tracking-tight">
                    <Link href="/dashboard">Graphly</Link>
                </div>

                {/* ナビゲーションメニュー */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
                    <Link href="/dashboard" className="hover:text-black transition-colors">
                        ダッシュボード
                    </Link>
                    <Link href="/tasks" className="hover:text-black transition-colors">
                        タスク一覧
                    </Link>
                    <Link href="/settings" className="hover:text-black transition-colors">
                        設定
                    </Link>
                </nav>

                {/* 右側のアクションボタン */}
                <div className="flex items-center gap-3">
                    {session?.user ? (
                        <Dropdown placement="bottom-end">
                            <DropdownTrigger>
                                <div className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
                                    <span className="text-sm font-medium text-gray-700 hidden sm:block">
                                        {session.user.name}
                                    </span>
                                    <Avatar
                                        isBordered
                                        as="button"
                                        className="transition-transform"
                                        size="sm"
                                        src={session.user.image || undefined}
                                        name={session.user.name} // 画像がない場合のイニシャル表示用
                                    />
                                </div>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Profile Actions" variant="flat">
                                <DropdownItem key="profile" className="h-14 gap-2">
                                    <p className="font-semibold">サインイン中:</p>
                                    <p className="font-semibold">{session.user.email}</p>
                                </DropdownItem>
                                <DropdownItem key="logout" color="danger" onPress={handleSignOut}>
                                    ログアウト
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    ) : (
                        // セッション読み込み中
                        <div className="w-8 h-8 rounded-full bg-default-200 animate-pulse"></div>
                    )}
                </div>
            </header>
        </div>
    );
}