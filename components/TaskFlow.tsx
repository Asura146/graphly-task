"use client";

// 修正: ComponentProps を追加でインポート
import { useCallback, useState, useMemo, ComponentProps } from 'react';
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
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@heroui/button';
import { Input } from '@heroui/react';
import TaskCard, { Member } from './TaskCard';

interface TaskFlowProps {
    groupId: string;
    teamId: string | null;
    initialTasks: any[];
    initialEdges: any[];
    members?: Member[]; // 担当者割り当て用に追加
}

// カスタムノードコンポーネント
const CardNode = ({ data }: NodeProps) => {
    // 修正: data.taskProps を TaskCard の Props としてキャスト
    const taskProps = data.taskProps as ComponentProps<typeof TaskCard>;
    
    // ★修正: フロー図用に表示サイズを縮小 (0.6倍)
    const scale = 0.6;
    const originalWidth = 300;
    const originalHeight = 200;

    return (
        <div 
            className="relative"
            // ノードの実効サイズ（エッジの接続点計算に使われるサイズ）をスケール後に合わせる
            style={{ 
                width: originalWidth * scale, 
                height: originalHeight * scale 
            }}
        >
            {/* 上、左、右、下の接続ポイント (z-indexを追加してカードの上に表示) */}
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 z-50" />
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 z-50" />
            
            {/* コンテンツ全体を縮小表示 */}
            <div style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: '0 0', // 左上基準で縮小
                width: originalWidth, 
                height: originalHeight 
            }}>
                <TaskCard 
                    {...taskProps} 
                />
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 z-50" />
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 z-50" />
        </div>
    );
};


export default function TaskFlow({ groupId, teamId, initialTasks, initialEdges, members = [] }: TaskFlowProps) {
    
    // カスタムノードの登録
    const nodeTypes = useMemo(() => ({ card: CardNode }), []);

    // DB形式のデータをReactFlow形式に変換
    const initialNodes: Node[] = initialTasks.map(t => ({
        id: t.id,
        type: 'card', // カスタムノードを使用
        position: { x: t.positionX, y: t.positionY },
        data: { 
            // TaskCardに渡すPropsをdataオブジェクトに格納
            taskProps: {
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "--/--/--",
                assigneeId: t.assigneeId,
                team: t.assigneeName ? `担当: ${t.assigneeName}` : "未割り当て",
                members: members, // 担当者変更用リスト
            }
        },
        // ★修正: styleでの固定幅指定を削除 (CardNode側で制御するため)
    }));

    const flowEdges: Edge[] = initialEdges.map(e => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#b1b1b7', strokeWidth: 2 },
    }));

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
    
    // 新規タスク用のState
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // エッジ接続時のハンドラ
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#b1b1b7', strokeWidth: 2 } }, eds)),
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
                    teamId: teamId,     
                    taskGroupId: groupId, 
                }),
            });

            if (res.ok) {
                const newTask = await res.json();
                // 新しいノードを追加するときもカスタムノードとして追加
                const newNode: Node = {
                    id: newTask.id,
                    type: 'card',
                    position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
                    data: { 
                        taskProps: {
                            id: newTask.id,
                            title: newTask.title,
                            description: newTask.description,
                            status: "todo",
                            dueDate: "--/--/--",
                            team: "未割り当て",
                            members: members
                        }
                    },
                    style: { width: 300 }
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
        <div style={{ width: '100%', height: 'calc(100vh - 200px)', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f9fafb' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes} // カスタムノードを登録
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                minZoom={0.2} 
            >
                <Controls />
                <MiniMap style={{ height: 100 }} zoomable pannable />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                
                {/* 操作パネル */}
                <Panel position="top-right" className="flex gap-2 bg-white/80 p-2 rounded-lg shadow-sm backdrop-blur-sm">
                    <Button size="sm" color="primary" onPress={handleSave}>
                        配置を保存
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