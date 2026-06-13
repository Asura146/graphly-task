"use client";

import { useEffect, useState, useCallback } from "react";
import TaskCard from "@/components/TaskCard";
import { Divider, Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/hono";

interface Task {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    teamId: string | null;
    status?: string;
    teamName?: string | null;
    groupId: string | null;
    groupTitle: string | null;
}

export default function CompletedTasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchTasks = useCallback(async () => {
        try {
            const res = await api.tasks.$get();
            if (res.ok) {
                const data: Task[] = await res.json();
                
                // 完了(DONE)のみをフィルタリング
                const completedTasks = data.filter(t => t.status === "DONE");

                // 日付順にソート（新しい順）
                const sortedData = completedTasks.sort((a, b) => {
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                    return dateB - dateA; // 降順
                });

                setTasks(sortedData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        const handleTaskUpdate = () => fetchTasks();
        window.addEventListener("taskCreated", handleTaskUpdate);
        return () => window.removeEventListener("taskCreated", handleTaskUpdate);
    }, [fetchTasks]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "--/--/--";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "--/--/--";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="bg-gray-100 w-full min-h-screen">
            <div className="pt-24 px-6 max-w-5xl mx-auto pb-20">
                <div className="flex mb-6 items-end justify-between">
                    <div>
                        <Button 
                            variant="light" 
                            className="mb-2 text-gray-500 pl-0 hover:text-gray-800" 
                            onPress={() => router.push("/tasks")}
                        >
                            ← タスク一覧へ戻る
                        </Button>
                        <h1 className="text-2xl font-bold text-gray-600">完了済みタスク</h1>
                    </div>
                </div>

                <Divider className="mb-6" />

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="text-gray-500">読み込み中...</div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <p>完了したタスクはありません。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex justify-center opacity-75 hover:opacity-100 transition-opacity">
                                <TaskCard
                                    id={task.id}
                                    title={task.title}
                                    team={task.teamName || (task.teamId ? "チームタスク" : "個人用")}
                                    status={task.status || "done"}
                                    dueDate={formatDate(task.dueDate)}
                                    description={task.description || ""}
                                    groupId={task.groupId}
                                    groupName={task.groupTitle}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}