"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { api } from "@/lib/hono";
import { Button } from "@heroui/button";

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = use(params);
    const router = useRouter();
    
    // データ保持用
    const [groupData, setGroupData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [edges, setEdges] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            // 1. フローとタスク情報の取得
            // ★修正: task_groups -> ["task-groups"], params -> param, json()取得を追加
            const res = await api["task-groups"][":id"].$get({ param: { id: groupId } });

            if (!res.ok) {
                console.error("Failed to fetch group data");
                // エラー時はダッシュボードに戻すなどの処理
                // router.push("/dashboard"); 
                return;
            }
            
            // レスポンスボディをJSONとしてパース
            const data = await res.json();
            
            setGroupData(data.group);
            setTasks(data.tasks);
            setEdges(data.edges);

            // 2. チームメンバーの取得 (チームIDがある場合のみ)
            // ★修正: data.group が存在することを確認してからアクセス
            if (data.group && data.group.teamId) {
                const membersRes = await api.teams[":id"].members.$get({ param: { id: data.group.teamId } });
                if (membersRes.ok) {
                    const membersData = await membersRes.json();
                    setMembers(membersData);
                }
            }
        } catch (error) {
            console.error(error);
            alert("データの取得に失敗しました");
        } finally {
            setIsLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        fetchData();

        // タスク更新イベント(taskCreated)が発火したらデータを再取得
        const handleUpdate = () => {
            fetchData();
        };

        window.addEventListener("taskCreated", handleUpdate);
        
        // クリーンアップ
        return () => {
            window.removeEventListener("taskCreated", handleUpdate);
        };
    }, [fetchData]);

    if (isLoading) return <div className="flex justify-center items-center h-screen">読み込み中...</div>;
    if (!groupData) return <div className="p-8">フローが見つかりません</div>;

    return (
        <div className="bg-white min-h-screen pt-24 px-6 pb-10">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                         <Button 
                            variant="light" 
                            className="mb-2 text-gray-500 pl-0 hover:text-gray-800" 
                            onPress={() => router.back()}
                        >
                            ← 戻る
                        </Button>
                        <h1 className="text-2xl font-bold text-gray-800">{groupData.title}</h1>
                        <p className="text-gray-500 text-sm mt-1">{groupData.description || "説明なし"}</p>
                    </div>
                </div>

                {/* フローエディタ */}
                <div className="flex-1 w-full relative">
                    <TaskFlow 
                        groupId={groupId}
                        teamId={groupData.teamId}
                        initialTasks={tasks}
                        initialEdges={edges}
                        members={members} // メンバーリストを渡す
                    />
                </div>
            </div>
        </div>
    );
}