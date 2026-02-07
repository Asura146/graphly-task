"use client";

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@heroui/button';
import { Input } from '@heroui/react';

interface TaskFlowProps {
    groupId: string;
    teamId: string | null;
    initialTasks: any[];
    initialEdges: any[];
}

export default function TaskFlow({ groupId, teamId, initialTasks, initialEdges }: TaskFlowProps) {
    
    // DB形式のデータをReactFlow形式に変換
    const initialNodes: Node[] = initialTasks.map(t => ({
        id: t.id,
        position: { x: t.positionX, y: t.positionY },
        data: { label: t.title }, // シンプルにタイトルを表示
        // type: 'default', 
        style: { 
            background: '#fff', 
            border: '1px solid #777', 
            borderRadius: '8px', 
            padding: '10px',
            width: 150,
            fontSize: '12px'
        }
    }));

    const flowEdges: Edge[] = initialEdges.map(e => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
    }));

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
    
    // 新規タスク用のState
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // エッジ接続時のハンドラ
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges],
    );

    // 保存処理
    const handleSave = async () => {
        const body = {
            tasks: nodes.map(n => ({
                id: n.id,
                position: n.position
            })),
            edges: edges.map(e => ({
                source: e.source,
                target: e.target
            }))
        };

        try {
            const res = await fetch(`/api/task-groups/${groupId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if(res.ok) {
                alert("フローを保存しました");
            } else {
                alert("保存に失敗しました");
            }
        } catch(e) {
            console.error(e);
            alert("エラーが発生しました");
        }
    };

    // フロー内での簡易タスク追加
    const handleAddTask = async () => {
        if(!newTaskTitle) return;
        setIsAdding(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTaskTitle,
                    teamId: teamId,     // チームID
                    taskGroupId: groupId, // このフローに紐付ける
                }),
            });

            if (res.ok) {
                const newTask = await res.json();
                // ノードに追加
                const newNode: Node = {
                    id: newTask.id,
                    position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
                    data: { label: newTask.title },
                    style: { 
                        background: '#fff', 
                        border: '1px solid #777', 
                        borderRadius: '8px', 
                        padding: '10px',
                        width: 150,
                        fontSize: '12px'
                    }
                };
                setNodes((nds) => nds.concat(newNode));
                setNewTaskTitle("");
            }
        } catch (error) {
            console.error(error);
            alert("タスク追加に失敗しました");
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div style={{ width: '100%', height: '70vh', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f9fafb' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
            >
                <Controls />
                <MiniMap style={{ height: 100 }} zoomable pannable />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                
                {/* 操作パネル */}
                <Panel position="top-right" className="flex gap-2 bg-white/80 p-2 rounded-lg shadow-sm backdrop-blur-sm">
                    <Button size="sm" color="primary" onPress={handleSave}>
                        保存する
                    </Button>
                </Panel>

                {/* タスク追加パネル */}
                <Panel position="top-left" className="bg-white p-3 rounded-xl shadow-md border border-gray-100 flex flex-col gap-2 w-64">
                    <h3 className="text-sm font-bold text-gray-700">タスクを追加</h3>
                    <div className="flex gap-2">
                        <Input 
                            size="sm" 
                            placeholder="タスク名" 
                            value={newTaskTitle}
                            onValueChange={setNewTaskTitle}
                        />
                        <Button 
                            size="sm" 
                            isIconOnly 
                            color="secondary" 
                            onPress={handleAddTask}
                            isLoading={isAdding}
                        >
                            ＋
                        </Button>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}