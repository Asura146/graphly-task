"use client";

import { useEffect, useState, useCallback, use } from "react";
import { AddTeamMember } from "@/components/AddTeamMember";
import { CreateTeamTask } from "./components/CreateTeamTask";
import TaskCard from "@/components/TaskCard";
import { Divider, User } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";

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

interface TeamTask {
    id: string;
    title: string;
    description: string | null;
    status: "todo" | "in_progress" | "done";
    dueDate: string | null;
    assigneeId: string | null; // 追加
    assigneeName: string | null;
}

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
    const { teamId } = use(params);

    const router = useRouter();
    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [tasks, setTasks] = useState<TeamTask[]>([]);
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
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "--/--/--";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "--/--/--";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    if (isLoading) return <div className="flex justify-center py-20">読み込み中...</div>;
    if (!team) return <div className="p-8 text-center">チームが見つかりません</div>;

    return (
        <div className="bg-gray-50 max-w-5xl mx-auto min-h-screen pt-24 px-6 pb-20">
            <div className="mb-6">
                <Button variant="light" className="mb-4 text-gray-500 pl-0 hover:text-gray-800" onPress={() => router.back()}>
                    ← 戻る
                </Button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{team.name}</h1>
                        <p className="text-gray-500 mt-2">{team.description || "説明はありません"}</p>
                    </div>
                </div>
            </div>

            <Divider className="my-6" />

            <div className="mb-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">チームタスク</h2>
                    <CreateTeamTask 
                        teamId={teamId} 
                        members={members} 
                        onTaskCreated={fetchData} 
                    />
                </div>
                
                {tasks.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        タスクはまだありません
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tasks.map((task) => (
                            <div key={task.id}>
                                <TaskCard
                                    id={task.id}
                                    title={task.title}
                                    description={task.description}
                                    team={task.assigneeName ? `担当: ${task.assigneeName}` : "担当: 未割り当て"}
                                    status={task.status}
                                    dueDate={formatDate(task.dueDate)}
                                    // 追加: 担当者情報とメンバー一覧を渡す
                                    assigneeId={task.assigneeId}
                                    members={members}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        チームメンバー
                        <span className="bg-gray-100 text-gray-600 text-sm py-0.5 px-2 rounded-full">{members.length}</span>
                    </h2>
                    <AddTeamMember teamId={teamId} teamName={team.name} onSuccess={fetchData} />
                </div>

                <div className="flex flex-col gap-2">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
                            <User
                                name={member.name}
                                description={member.email}
                                avatarProps={{ src: member.image || undefined, name: member.name.charAt(0) }}
                            />
                            <div className="flex items-center gap-4">
                                <span className={`text-xs px-2 py-1 rounded border ${
                                    member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                                }`}>
                                    {member.role === 'ADMIN' ? '管理者' : 'メンバー'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}