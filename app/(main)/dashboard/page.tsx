"use client";

import { useEffect, useState, useCallback, use } from "react";
import TaskCard from "@/components/TaskCard";
import CreateMyTask from "@/components/CreateMyTask";
import { CreateTaskGroup } from "@/components/CreateTaskGroup"; // ★追加
import { Divider } from "@heroui/react";
import { CreateTeam } from "@/components/CreateTeam";
import { api } from "@/lib/hono";
import { InferResponseType } from "hono/client";
import Link from "next/link";
import { Button } from "@heroui/button"; // Buttonをインポート

// タスクの型定義
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

// TaskGroup型を追加
interface TaskGroup {
    id: string;
    title: string;
    description: string | null;
}

type TeamsResponse = InferResponseType<typeof api.teams.$get, 200>;

export default function DashboardPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [teams, setTeams] = useState<TeamsResponse>([]);
    const [personalGroups, setPersonalGroups] = useState<TaskGroup[]>([]); // ★追加

    // データ取得関数を定義
    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch("/api/tasks");
            if (res.ok) {
                const data: Task[] = await res.json();

                // ★修正: 完了(DONE)以外のタスクのみをフィルタリング
                const activeTasks = data.filter(t => t.status !== "DONE");

                // 期限が近い順にソート (nullは後ろへ)
                const sortedData = activeTasks.sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                });

                setTasks(sortedData);
            }
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ★追加: 個人フロー取得
    const fetchPersonalGroups = useCallback(async () => {
        try {
            const res = await fetch("/api/task-groups");
            if (res.ok) {
                setPersonalGroups(await res.json());
            }
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        // 初回ロード
        fetchTasks();
        fetchPersonalGroups(); // ★追加

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
    }, [fetchTasks, fetchPersonalGroups]); // ★追加

    // チームデータ取得関数を定義
    const fetchTeams = useCallback(async () => {
        try {
            const res = await api.teams.$get();
            if (res.ok) {
                const data = await res.json();
                setTeams(data);
            }
        } catch (error) {
            console.error("Failed to fetch teams", error);
        }
    }, []);

    useEffect(() => {
        // 初回ロード
        fetchTeams();

        // イベントハンドラー
        const handleTeamCreated = () => {
            fetchTeams();
        };

        // カスタムイベントを購読
        window.addEventListener("teamCreated", handleTeamCreated);

        return () => {
            window.removeEventListener("teamCreated", handleTeamCreated);
        };
    }, [fetchTeams]);

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
                    <div className="ml-auto mt-4 mb-6 flex gap-2"> {/* flex gap-2に変更 */}
                        {/* ★修正: リンク先を /tasks/completed に変更 */}
                        <Button 
                            as={Link} 
                            href="/tasks/completed" 
                            size="sm" 
                            variant="flat" 
                            className="mr-2"
                        >
                            完了済み一覧
                        </Button>

                        <div className="scale-90 origin-right">
                            <CreateTaskGroup onGroupCreated={fetchPersonalGroups} /> {/* チームIDなしで呼び出し */}
                        </div>
                        <CreateMyTask />
                    </div>
                </div>

                {/* ★追加: 個人フロー一覧エリア */}
                <h1 className="text-lg font-medium mb-2">個人フロー</h1>
                <Divider className="mb-6" />
                <div className="mb-10">
                    {personalGroups.length === 0 ? (
                        <p className="text-gray-500 text-sm">作成された個人的なフローはありません</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {personalGroups.map((group) => (
                                <Link href={`/groups/${group.id}`} key={group.id} className="block group">
                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                        <h3 className="font-bold text-gray-800 group-hover:text-blue-600 mb-1">
                                            {group.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 line-clamp-1">
                                            {group.description || "説明なし"}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <h1 className="text-lg font-medium mb-2">あなたのタスク一覧</h1>
                <Divider className="mb-6" />

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
                    <div className="flex overflow-x-auto grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 place-items-center">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex-shrink-0">
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
                <div className="flex">
                    <h1 className="text-lg font-medium mb-2 pt-5">所属チーム一覧</h1>
                    <div className="ml-auto mt-4 mb-6">
                        <CreateTeam />
                    </div>
                </div>
                <Divider className="mb-6" />
                <div className="grid gap-4">
                    {teams.map((team) => (
                        <Link key={team.id} href={`/teams/${team.id}`} className="block">
                            <div className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center group">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{team.name}</h3>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                            {team.role}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500">{team.description}</p>
                                </div>
                                <div className="text-gray-400 group-hover:text-blue-500">
                                    →
                                </div>
                            </div>
                        </Link>
                    ))}
                    {teams.length === 0 && <p className="text-gray-500">所属しているチームはありません</p>}
                </div>
            </div>
        </div>
    );
}