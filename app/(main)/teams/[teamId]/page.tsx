"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/react";
import { Divider } from "@heroui/react"; // Dividerを追加
import Link from "next/link";
import TaskCard from "@/components/TaskCard"; // TaskCardのインポートを確認
import { api } from "@/lib/hono";

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
    // ★修正: APIとの整合性のため string に変更
    status: string;
    dueDate: string | null;
    assigneeId: string | null;
    assigneeName: string | null;
    groupId: string | null;
    groupTitle: string | null;
}

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
    const { teamId } = use(params);
    const router = useRouter();

    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [tasks, setTasks] = useState<TeamTask[]>([]);
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    
    // ★追加: 完了タスクを表示するかどうかのフラグ
    const [showCompleted, setShowCompleted] = useState(false);

    // データ取得処理
    const fetchData = useCallback(async () => {
        try {
            // チーム情報の取得
            const teamRes = await api.teams[":id"].$get({ param: { id: teamId } });
            if (!teamRes.ok) {
                router.push("/dashboard");
                return;
            }
            setTeam(await teamRes.json());

            // メンバーの取得
            const membersRes = await api.teams[":id"].members.$get({ param: { id: teamId } });
            if (membersRes.ok) setMembers(await membersRes.json());

            // タスクの取得
            const tasksRes = await api.teams[":id"].tasks.$get({ param: { id: teamId } });
            if (tasksRes.ok) setTasks(await tasksRes.json());

            // タスクグループの取得
            const groupsRes = await api.teams[":id"]["task-groups"].$get({ param: { id: teamId } });
            if(groupsRes.ok) setTaskGroups(await groupsRes.json());

        } catch (error) {
            console.error(error);
        }
    }, [teamId, router]);

    useEffect(() => {
        fetchData();
        
        // イベントリスナー
        const handleUpdate = () => fetchData();
        window.addEventListener("taskCreated", handleUpdate);
        return () => window.removeEventListener("taskCreated", handleUpdate);
    }, [fetchData]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "--/--/--";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "--/--/--";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    if (!team) return <div className="flex justify-center items-center h-screen">Loading...</div>;

    // ★タスクの振り分け（完了以外 / 完了）
    const activeTasks = tasks.filter(t => t.status !== "DONE");
    const completedTasks = tasks.filter(t => t.status === "DONE");

    // 未割り当てタスク（アクティブ）
    const activeUnassignedTasks = activeTasks.filter(t => !t.assigneeId);
    
    // 未割り当てタスク（完了）
    const completedUnassignedTasks = completedTasks.filter(t => !t.assigneeId);

    return (
        <div className="bg-gray-50 max-w-6xl mx-auto min-h-screen pt-24 px-6 pb-20">
            {/* ヘッダーエリア */}
            <div className="mb-8">
                <Button 
                    variant="light" 
                    className="mb-2 text-gray-500 pl-0 hover:text-gray-800" 
                    onPress={() => router.push("/dashboard")}
                >
                    ← ダッシュボードへ戻る
                </Button>
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{team.name}</h1>
                        <p className="text-gray-500 mt-2">{team.description}</p>
                    </div>
                </div>
            </div>

            {/* --- ここから進行中のタスク表示 --- */}

            {/* 未割り当てタスクエリア (Active) */}
            <div className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-bold text-gray-700">未割り当てのタスク</h2>
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold">
                        {activeUnassignedTasks.length}
                    </span>
                </div>
                
                {activeUnassignedTasks.length === 0 ? (
                    <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-sm">
                        未割り当てのタスクはありません
                    </div>
                ) : (
                    <div className="flex overflow-x-auto pb-4 gap-4">
                        {activeUnassignedTasks.map((task) => (
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
                                    groupId={task.groupId}
                                    groupName={task.groupTitle}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* メンバー別タスク可視化エリア (Active) */}
            <div className="flex flex-col gap-8 mb-12">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-2">メンバーの進捗状況</h2>
                
                {members.map((member) => {
                    const memberTasks = activeTasks.filter(t => t.assigneeId === member.id);
                    
                    return (
                        <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* 左側: メンバー情報 */}
                                <div className="w-full md:w-48 flex-shrink-0 flex flex-col items-center md:items-start border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
                                    <Avatar 
                                        src={member.image || undefined} 
                                        name={member.name} 
                                        className="w-16 h-16 text-large mb-3"
                                    />
                                    <h3 className="font-bold text-gray-800 text-center md:text-left">{member.name}</h3>
                                    <p className="text-xs text-gray-500 mb-1">{member.role}</p>
                                    <div className="mt-2 text-xs">
                                        <span className="font-bold text-blue-600 text-lg">{memberTasks.length}</span> 
                                        <span className="text-gray-400 ml-1">Active Tasks</span>
                                    </div>
                                </div>

                                {/* 右側: タスク一覧 */}
                                <div className="flex-1 overflow-x-auto">
                                    {memberTasks.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-sm min-h-[100px]">
                                            現在担当しているタスクはありません
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
                                                        groupId={task.groupId}
                                                        groupName={task.groupTitle}
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

            {/* --- ここから完了タスク表示エリア --- */}
            
            <div className="mt-16">
                <Button 
                    variant="flat" 
                    color={showCompleted ? "default" : "primary"}
                    className="w-full mb-6 font-semibold"
                    onPress={() => setShowCompleted(!showCompleted)}
                >
                    {showCompleted ? "完了したタスクを隠す" : "完了したタスクを表示する"}
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs ml-2">
                        {completedTasks.length}
                    </span>
                </Button>

                {showCompleted && (
                    <div className="animate-appearance-in">
                        <h2 className="text-xl font-bold text-gray-600 mb-6 border-b pb-2">完了済みタスク</h2>

                        {/* 未割り当て (完了) */}
                        {completedUnassignedTasks.length > 0 && (
                             <div className="mb-8 opacity-75">
                                <h3 className="text-md font-bold text-gray-500 mb-3 ml-2">未割り当て (完了)</h3>
                                <div className="flex overflow-x-auto pb-4 gap-4">
                                    {completedUnassignedTasks.map((task) => (
                                        <div key={task.id} className="flex-shrink-0 transform scale-95 origin-top-left">
                                            <TaskCard
                                                id={task.id}
                                                title={task.title}
                                                description={task.description}
                                                team="担当: 未割り当て"
                                                status={task.status}
                                                dueDate={formatDate(task.dueDate)}
                                                assigneeId={null}
                                                members={members}
                                                groupId={task.groupId}
                                                groupName={task.groupTitle}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* メンバーごと (完了) */}
                        {members.map((member) => {
                            const memberCompletedTasks = completedTasks.filter(t => t.assigneeId === member.id);
                            if (memberCompletedTasks.length === 0) return null;

                            return (
                                <div key={`done-${member.id}`} className="mb-6 opacity-75">
                                    <div className="flex items-center gap-2 mb-3 ml-2">
                                        <Avatar src={member.image || undefined} name={member.name} size="sm" />
                                        <h3 className="text-md font-bold text-gray-600">{member.name}</h3>
                                        <span className="text-xs text-gray-400">({memberCompletedTasks.length}件完了)</span>
                                    </div>
                                    
                                    <div className="flex overflow-x-auto pb-4 gap-4 pl-4 border-l-4 border-gray-200">
                                        {memberCompletedTasks.map((task) => (
                                            <div key={task.id} className="flex-shrink-0 transform scale-95 origin-top-left">
                                                <TaskCard
                                                    id={task.id}
                                                    title={task.title}
                                                    description={task.description}
                                                    team={`担当: ${member.name}`}
                                                    status={task.status}
                                                    dueDate={formatDate(task.dueDate)}
                                                    assigneeId={member.id}
                                                    members={members}
                                                    groupId={task.groupId}
                                                    groupName={task.groupTitle}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {completedTasks.length === 0 && (
                            <div className="text-center text-gray-400 py-4">
                                完了したタスクはありません
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}