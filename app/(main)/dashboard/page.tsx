"use client";

import { useEffect, useState, useCallback } from "react"; // useCallbackを追加
import TaskCard from "@/components/TaskCard";
import CreateMyTask from "@/components/CreateMyTask";

// タスクの型定義
interface Task {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    teamId: string | null;
    status?: "todo" | "doing" | "done";
}

export default function DashboardPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // データ取得関数を定義
    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch("/api/tasks");
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // 初回ロード
        fetchTasks();

        // イベントハンドラー
        const handleTaskCreated = () => {
            fetchTasks(); 
        };

        // カスタムイベントを購読
        window.addEventListener("taskCreated", handleTaskCreated);

        // クリーンアップ
        return () => {
            window.removeEventListener("taskCreated", handleTaskCreated);
        };
    }, [fetchTasks]);

    // 日付フォーマット用関数
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "--/--/--";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "--/--/--";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="bg-gray-100 w-full min-h-screen">
            <div className="pt-24 px-6 max-w-5xl mx-auto pb-20">
              <div className="flex">
                <h1 className="text-2xl font-bold mt-4 mb-6">ダッシュボード</h1>
                <div className="ml-auto mt-4 mb-6">
                  <CreateMyTask />
                </div>
                
              </div>
                
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="text-gray-500">読み込み中...</div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <p>まだタスクがありません。</p>
                        <p className="text-sm mt-2">ヘッダーの「＋タスクを追加」から作成できます。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 place-items-center">
                        {tasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                title={task.title}
                                team={task.teamId ? "チームタスク" : "個人用"}
                                status={task.status || "todo"}
                                dueDate={formatDate(task.dueDate)}
                                backText={task.description || "詳細情報はありません。"}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}