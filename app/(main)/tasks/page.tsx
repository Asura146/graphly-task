"use client";

import { useEffect, useState, useCallback } from "react";
import TaskCard from "@/components/TaskCard";
import { Divider, Button, Spinner } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch("/api/tasks");
            if (res.ok) {
                const data: Task[] = await res.json();
                
                // ★修正: 完了(DONE)以外のタスクのみをフィルタリング
                const activeTasks = data.filter(t => t.status !== "DONE");

                // 期限が近い順にソート
                const sortedData = activeTasks.sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
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
            <div className="pt-24 px-6 max-w-6xl mx-auto pb-20">
                <div className="flex mb-6 items-end justify-between">
                    <div>
                        <Button 
                            variant="light" 
                            className="mb-2 text-gray-500 pl-0 hover:text-gray-800" 
                            onPress={() => router.push("/dashboard")}
                        >
                            ← ダッシュボードへ戻る
                        </Button>
                        <h1 className="text-2xl font-bold">タスク一覧 (未完了)</h1>
                    </div>
                    {/* 完了済みへのリンク */}
                    <div className="mb-1">
                        <Button
                            as={Link}
                            href="/tasks/completed"
                            color="success"
                            variant="flat"
                            size="sm"
                        >
                            完了済みタスクを見る
                        </Button>
                    </div>
                </div>

                <Divider className="mb-6" />

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <Spinner size="lg" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <p>未完了のタスクはありません。</p>
                        <div className="mt-4">
                            <Button 
                                as={Link}
                                href="/tasks/completed"
                                variant="light"
                                color="primary"
                            >
                                完了済みのタスクを確認する
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2  lg:grid-cols-4 gap-4">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex justify-center">
                                <TaskCard
                                    id={task.id}
                                    title={task.title}
                                    team={task.teamName || (task.teamId ? "チームタスク" : "個人用")}
                                    status={task.status || "todo"}
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