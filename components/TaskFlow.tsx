"use client";

import { useCallback, useState, useMemo, ComponentProps, useEffect } from 'react';
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
import { Button, addToast } from '@heroui/react';
import TaskCard, { Member } from './TaskCard';
import { CreateGroupTask } from './CreateGroupTask';

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
            {/* 上、左の接続ポイント (target: 入力) */}
            {/* style で top, left をマイナス値にしてカードの外側に少し出す */}
            <Handle 
                type="target" 
                position={Position.Top} 
                id="t-top"
                className="w-3 h-3 bg-blue-500 z-50 rounded-full border border-white" 
                style={{ top: -6 }} 
            />
            <Handle 
                type="target" 
                position={Position.Left} 
                id="t-left"
                className="w-3 h-3 bg-blue-500 z-50 rounded-full border border-white" 
                style={{ left: -6 }} 
            />
            
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

            {/* 右、下の接続ポイント (source: 出力) */}
            {/* style で right, bottom をマイナス値にしてカードの外側に少し出す */}
            <Handle 
                type="source" 
                position={Position.Right} 
                id="s-right"
                className="w-3 h-3 bg-blue-500 z-50 rounded-full border border-white" 
                style={{ right: -6 }} 
            />
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="s-bottom"
                className="w-3 h-3 bg-blue-500 z-50 rounded-full border border-white" 
                style={{ bottom: -6 }} 
            />
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
                groupId: groupId,
                groupName: t.groupTitle
            }
        },
        // ★修正: styleでの固定幅指定を削除 (CardNode側で制御するため)
    }));

    const flowEdges: Edge[] = initialEdges.map(e => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        // ★追加: DBから読み込んだハンドルIDをReact Flowに渡す
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        animated: true,
        style: { stroke: '#b1b1b7', strokeWidth: 2 },
    }));

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
    
    // ★追加: 保存中の状態管理
    const [isSaving, setIsSaving] = useState(false);

    // エッジ接続時のハンドラ
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#b1b1b7', strokeWidth: 2 } }, eds)),
        [setEdges],
    );

    // 保存処理
    const handleSave = async () => {
        if (isSaving) return; // 連打防止
        setIsSaving(true);

        const body = {
            tasks: nodes.map(n => ({
                id: n.id,
                position: n.position
            })),
            // ★修正: エッジ情報にsourceHandle / targetHandleを含める
            edges: edges.map(e => ({
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
            }))
        };

        try {
            const res = await fetch(`/api/task-groups/${groupId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (res.ok) {
                addToast({ title: "配置を保存しました" });
            } else {
                console.error(await res.text());
                addToast({ 
                    title: "保存に失敗しました。",
                    color: "danger"
                });
            }
        } catch(e) {
            console.error(e);
            addToast({ 
                title: "エラーが発生しました",
                color: "danger"
            });
        } finally {
            setIsSaving(false); // 処理終了後に戻す
        }
    };

    // タスク追加後のコールバック (モーダルから呼ばれる)
    const handleTaskCreated = useCallback((newTask: any) => {
        // 新しい担当者の名前を特定
        const assignee = members.find(m => m.id === newTask.assigneeId);
        const assigneeName = assignee ? assignee.name : null;

        const newNode: Node = {
            id: newTask.id,
            type: 'card', 
            // 画面中央付近にランダム配置
            position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
            data: { 
                taskProps: {
                    id: newTask.id,
                    title: newTask.title,
                    description: newTask.description,
                    status: "todo",
                    dueDate: newTask.dueDate ? new Date(newTask.dueDate).toLocaleDateString() : "--/--/--",
                    assigneeId: newTask.assigneeId,
                    team: assigneeName ? `担当: ${assigneeName}` : "未割り当て",
                    members: members // 担当者変更用リスト
                }
            },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [members, setNodes]);

    // ★追加: データの更新を検知してノードに反映させる (位置は維持)
    useEffect(() => {
        setNodes((currentNodes) => 
            initialTasks.map((t) => {
                // 現在表示中のノードがあればその位置を維持し、なければDBの位置を使う
                const existingNode = currentNodes.find((n) => n.id === t.id);
                const position = existingNode ? existingNode.position : { x: t.positionX, y: t.positionY };

                // 担当者名の解決
                const assignee = members.find(m => m.id === t.assigneeId);
                const assigneeName = assignee ? assignee.name : t.assigneeName;

                return {
                    id: t.id,
                    type: 'card',
                    position: position,
                    data: { 
                        taskProps: {
                            id: t.id,
                            title: t.title,
                            description: t.description,
                            status: t.status,
                            dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "--/--/--",
                            assigneeId: t.assigneeId,
                            team: assigneeName ? `担当: ${assigneeName}` : "未割り当て",
                            members: members,
                            groupId: groupId,
                            groupName: t.groupTitle
                        }
                    },
                    // ドラッグ中の状態などがリセットされないよう注意が必要ですが、
                    // 基本的な情報の更新にはこれで対応できます
                };
            })
        );
    }, [initialTasks, members, setNodes, groupId]);

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
                
                {/* 保存ボタン */}
                <Panel position="top-right" className="flex gap-2 bg-white/80 p-2 rounded-lg shadow-sm backdrop-blur-sm">
                    <Button 
                        size='sm'
                        color='success'
                        className='text-white p-4'
                        onPress={handleSave}
                        isLoading={isSaving} // ローディング表示
                    >
                        配置を保存
                    </Button>
                </Panel>

                {/* タスク追加パネル (置き換え) */}
                <Panel position="top-left" className="bg-white p-3 rounded-xl shadow-md border border-gray-100 w-64">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 ml-1">アクション</h3>
                    <CreateGroupTask 
                        teamId={teamId}
                        groupId={groupId}
                        members={members}
                        onTaskCreated={handleTaskCreated}
                    />
                </Panel>
            </ReactFlow>
        </div>
    );
}