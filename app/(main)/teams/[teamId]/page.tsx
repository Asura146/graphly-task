"use client";

import { useEffect, useState, useCallback, use } from "react";
import { AddTeamMember } from "@/components/AddTeamMember";
import { CreateTeamTask } from "./components/CreateTeamTask";
import TaskCard from "@/components/TaskCard";
import { CreateTaskGroup } from "@/components/CreateTaskGroup"; // 追加
import { Divider, User } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import Link from "next/link"; // 追加

interface Team {
    id: string;
    name: string;
    description: string | null;
}

interface Member {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
}

// 追加: グループの型定義
interface TaskGroup {
    id: string;
    title: string;
    description: string | null;
}

interface TeamTask {
    id: string;
    title: string;
    description: string | null;
    status: "todo" | "in_progress" | "done";
    dueDate: string | null;
    assigneeId: string | null;
    assigneeName: string | null;
}

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
    const { teamId } = use(params);

    const router = useRouter();
    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [tasks, setTasks] = useState<TeamTask[]>([]);
    const [groups, setGroups] = useState<TaskGroup[]>([]); // 追加
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const teamRes = await fetch(`/api/teams/${teamId}`);
            if (teamRes.ok) {
                setTeam(await teamRes.json());
            }

            const memberRes = await fetch(`/api/teams/${teamId}/members`);
            if (memberRes.ok) {
                setMembers(await memberRes.json());
            }

            const taskRes = await fetch(`/api/teams/${teamId}/tasks`);
            if (taskRes.ok) {
                const taskData: TeamTask[] = await taskRes.json();
                setTasks(taskData);
            }
            
            // ★追加: グループ一覧取得
            const groupRes = await fetch(`/api/teams/${teamId}/task-groups`);
            if (groupRes.ok) {
                setGroups(await groupRes.json());
            }

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        fetchData();

        // ★追加: タスク更新イベントを検知してリロード
        const handleTaskUpdate = () => {
            fetchData();
        };

        window.addEventListener("taskCreated", handleTaskUpdate);

        return () => {
            window.removeEventListener("taskCreated", handleTaskUpdate);
        };
    }, [fetchData]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "--/--/--";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "--/--/--";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    // 未割り当てタスクの抽出
    const unassignedTasks = tasks.filter(t => !t.assigneeId);

    if (isLoading) return <div className="flex justify-center py-20">読み込み中...</div>;
    if (!team) return <div className="p-8 text-center">チームが見つかりません</div>;

    return (
        <div className="bg-gray-50 max-w-6xl mx-auto min-h-screen pt-24 px-6 pb-20">
            {/* ヘッダーエリア (既存) */}
            <div className="mb-6">
                <Button variant="light" className="mb-4 text-gray-500 pl-0 hover:text-gray-800" onPress={() => router.back()}>
                    ← 戻る
                </Button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{team.name}</h1>
                        <p className="text-gray-500 mt-2">{team.description || "説明はありません"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <AddTeamMember teamId={teamId} teamName={team.name} onSuccess={fetchData} />
                    </div>
                </div>
            </div>

            <Divider className="my-6" />

            {/* ★追加: タスクフロー(グループ)エリア */}
            <div className="mb-12">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-700">タスクフロー</h2>
                    <CreateTaskGroup teamId={teamId} onGroupCreated={fetchData} />
                </div>

                {groups.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        作成されたフローはありません
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groups.map((group) => (
                            <Link href={`/groups/${group.id}`} key={group.id} className="block group">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all h-full">
                                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 mb-2">
                                        {group.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                        {group.description || "説明なし"}
                                    </p>
                                    <div className="mt-4 text-xs text-blue-500 font-medium group-hover:underline">
                                        フロー図を開く →
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* 新規タスク作成・未割り当てエリア */}
            <div className="mb-12">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-700">未割り当てタスク</h2>
                    <CreateTeamTask 
                        teamId={teamId} 
                        members={members} 
                        onTaskCreated={fetchData} 
                    />
                </div>
                
                {unassignedTasks.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        未割り当てのタスクはありません
                    </div>
                ) : (
                    <div className="flex overflow-x-auto pb-4 gap-4">
                        {unassignedTasks.map((task) => (
                            <div key={task.id} className="flex-shrink-0">
                                <TaskCard
                                    id={task.id}
                                    title={task.title}
                                    description={task.description}
                                    team="担当: 未割り当て"
                                    status={task.status}
                                    dueDate={formatDate(task.dueDate)}
                                    assigneeId={null}
                                    members={members}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* メンバー別タスク可視化エリア */}
            <div className="flex flex-col gap-8">
                <h2 className="text-xl font-bold text-gray-700">メンバーの進捗</h2>
                
                {members.map((member) => {
                    // このメンバーが持っているタスクを抽出
                    const memberTasks = tasks.filter(t => t.assigneeId === member.id);
                    
                    return (
                        <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* 左側: メンバー情報 */}
                                <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
                                    <User
                                        name={member.name}
                                        description={member.email}
                                        avatarProps={{ src: member.image || undefined, size: "lg" }}
                                        className="justify-start"
                                    />
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className={`text-xs px-2 py-1 rounded border ${
                                            member.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-50 text-gray-600 border-gray-100'
                                        }`}>
                                            {member.role === 'ADMIN' ? '管理者' : 'メンバー'}
                                        </span>
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                                            担当タスク: {memberTasks.length}件
                                        </span>
                                    </div>
                                </div>

                                {/* 右側: タスク一覧 (横スクロール) */}
                                <div className="flex-1 overflow-x-auto">
                                    {memberTasks.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-sm py-4">
                                            割り当てられたタスクはありません
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 pb-2">
                                            {memberTasks.map((task) => (
                                                <div key={task.id} className="flex-shrink-0">
                                                    <TaskCard
                                                        id={task.id}
                                                        title={task.title}
                                                        description={task.description}
                                                        team={`担当: ${member.name}`}
                                                        status={task.status}
                                                        dueDate={formatDate(task.dueDate)}
                                                        assigneeId={member.id}
                                                        members={members}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}