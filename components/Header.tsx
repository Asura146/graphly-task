"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";

export default function Header() {
    const router = useRouter();
    const { data: session } = authClient.useSession();
    
    // ★追加: モバイルメニューの開閉状態
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // ★追加: ナビゲーション項目を配列化（重複を防ぐため）
    const navItems = [
        { label: "ダッシュボード", href: "/dashboard" },
        { label: "タスク一覧", href: "/tasks" },
        { label: "設定", href: "/settings" },
    ];

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
        // ★修正: flex-colにして、下にメニューを出せるようにする
        <div className="fixed top-4 left-0 right-0 flex flex-col items-center z-50 px-4 pointer-events-none">
            {/* ヘッダー本体 (ポインターイベントを受け付けるように pointer-events-auto を追加) */}
            <header className="
                pointer-events-auto
                w-full max-w-5xl 
                bg-white/80 backdrop-blur-md 
                shadow-lg 
                rounded-full 
                px-6 py-3 
                flex items-center justify-between
                border border-gray-200
                relative
                z-50
            ">
                
                {/* ロゴ部分 */}
                <div className="font-bold text-xl tracking-tight">
                    <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>Graphly</Link>
                </div>

                {/* --- デスクトップ用メニュー (md以上で表示) --- */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
                    {navItems.map((item) => (
                        <Link key={item.href} href={item.href} className="hover:text-black transition-colors">
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* 右側のアクションボタン */}
                <div className="flex items-center gap-3">
                    {session?.user ? (
                        <>
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
                                            name={session.user.name} 
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

                            {/* --- ★追加: ハンバーガーメニューボタン (md未満で表示) --- */}
                            <Button
                                isIconOnly
                                variant="light"
                                className="md:hidden min-w-10 w-10 h-10 text-gray-600"
                                onPress={() => setIsMenuOpen(!isMenuOpen)}
                            >
                                {isMenuOpen ? (
                                    // 閉じるアイコン (X)
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    // ハンバーガーアイコン (三本線)
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                    </svg>
                                )}
                            </Button>
                        </>
                    ) : (
                        // セッション読み込み中
                        <div className="w-8 h-8 rounded-full bg-default-200 animate-pulse"></div>
                    )}
                </div>
            </header>

            {/* モバイルドロップダウンメニュー */}
            {isMenuOpen && (
                <div className="
                    pointer-events-auto
                    w-full max-w-5xl 
                    mt-2 
                    bg-white/90 backdrop-blur-xl 
                    shadow-xl 
                    rounded-2xl 
                    border border-gray-200 
                    p-4 
                    flex flex-col gap-2
                    md:hidden
                    animate-appearance-in
                ">
                    {navItems.map((item) => (
                        <Link 
                            key={item.href} 
                            href={item.href} 
                            className="
                                block w-full px-4 py-3 
                                text-gray-700 font-medium 
                                hover:bg-gray-100 rounded-xl transition-colors
                            "
                            onClick={() => setIsMenuOpen(false)} // リンククリックで閉じる
                        >
                            {item.label}
                        </Link>
                    ))}

                </div>
            )}
        </div>
    );
}