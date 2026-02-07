"use client";

import { useEffect, useState, use } from "react";
import TaskFlow from "@/components/TaskFlow";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";

export default function GroupFlowPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = use(params);
    const router = useRouter();
    
    // データ保持用
    const [groupData, setGroupData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [edges, setEdges] = useState<any[]>([]);
    // ★追加
    const [members, setMembers] = useState<any[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchGroup = async () => {
            try {
                // 1. フローとタスク情報の取得
                const res = await fetch(`/api/task-groups/${groupId}`);
                if (res.ok) {
                    const data = await res.json();
                    setGroupData(data.group);
                    
                    // タスクデータに担当者名が含まれているか確認（API側ですでにJOIN済みの想定）
                    setTasks(data.tasks);
                    setEdges(data.edges);

                    // 2. チームメンバーの取得 (チームIDがある場合のみ)
                    if (data.group.teamId) {
                        const memberRes = await fetch(`/api/teams/${data.group.teamId}/members`);
                        if (memberRes.ok) {
                            setMembers(await memberRes.json());
                        }
                    }
                } else {
                    alert("フロー情報の取得に失敗しました");
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGroup();
    }, [groupId]);

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