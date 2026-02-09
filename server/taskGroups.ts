import { Hono } from "hono";
import { db } from "@/lib/db";
import { taskGroups, tasks, taskDependencies, user as users } from "@/db/schema";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Env } from "@/server";
import { eq, and, inArray, isNull, desc } from "drizzle-orm";

const createGroupSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    teamId: z.string().optional(),
});

// フロー保存用のスキーマ
const saveFlowSchema = z.object({
    tasks: z.array(z.object({
        id: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
    })),
    edges: z.array(z.object({
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
    })).optional(),
});

export const taskGroupRoute = new Hono<Env>()
    //　個人のタスクグループ一覧を取得 (GET /api/task-groups/)
    .get("/", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);

        try {
            const groups = await db
                .select()
                .from(taskGroups)
                .where(
                    and(
                        eq(taskGroups.creatorId, user.id),
                        isNull(taskGroups.teamId) // チームに属さないもの
                    )
                )
                .orderBy(desc(taskGroups.createdAt));
            
            return c.json(groups);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to fetch task groups" }, 500);
        }
    })

    // グループ作成
    .post("/", zValidator("json", createGroupSchema), async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);

        const { title, description, teamId } = c.req.valid("json");

        try {
            const [newGroup] = await db.insert(taskGroups).values({
                id: `tg_${nanoid()}`,
                title,
                description: description ?? null,
                creatorId: user.id,
                teamId: teamId ?? null,
            }).returning();

            return c.json(newGroup, 201);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to create group" }, 500);
        }
    })
    // 個別のグループ情報を取得 (タスクとエッジも一緒に)
    .get("/:id", async (c) => {
        const groupId = c.req.param("id");
        
        // 1. グループ情報の取得
        const [group] = await db.select().from(taskGroups).where(eq(taskGroups.id, groupId)).limit(1);
        if (!group) return c.json({ error: "Group not found" }, 404);

        // 2. 所属するタスクの取得
        const groupTasks = await db
            .select({
                id: tasks.id,
                title: tasks.title,
                description: tasks.description,
                status: tasks.status,
                dueDate: tasks.dueDate,
                assigneeId: tasks.assigneeId,
                // React Flow用の座標は必須
                positionX: tasks.positionX,
                positionY: tasks.positionY,
                // ★追加: 担当者名
                assigneeName: users.name,
                teamId: tasks.teamId,
                taskGroupId: tasks.taskGroupId,
            })
            .from(tasks)
            .leftJoin(users, eq(tasks.assigneeId, users.id)) // JOINを追加
            .where(eq(tasks.taskGroupId, groupId));

        // 3. 依存関係（エッジ）の取得
        const taskIds = groupTasks.map(t => t.id);
        let edges: any[] = [];
        
        if (taskIds.length > 0) {
            const allDeps = await db.select().from(taskDependencies);
            // 簡易的にフィルタリング (本来はSQLで解決するのが望ましい)
            edges = allDeps
                .filter(d => taskIds.includes(d.predecessorId) && taskIds.includes(d.successorId))
                .map(d => ({ 
                    id: d.id, 
                    source: d.predecessorId, 
                    target: d.successorId,
                    sourceHandle: d.sourceHandle,
                    targetHandle: d.targetHandle
                }));
        }

        return c.json({ group, tasks: groupTasks, edges });
    })
    // フロー（配置と接続）の保存
    .post("/:id/save", zValidator("json", saveFlowSchema), async (c) => {
        const groupId = c.req.param("id");
        const { tasks: updatedPositions, edges } = c.req.valid("json");

        try {
            await db.transaction(async (tx) => {
                // 1. 座標の更新
                for (const t of updatedPositions) {
                     await tx.update(tasks)
                        .set({ positionX: t.position.x, positionY: t.position.y })
                        .where(eq(tasks.id, t.id));
                }

                // 2. 依存関係の更新（完全洗い替え戦略）
                // まず、このグループに所属するタスクのIDリストを取得
                const groupTasks = await tx
                    .select({ id: tasks.id })
                    .from(tasks)
                    .where(eq(tasks.taskGroupId, groupId));
                
                const groupTaskIds = groupTasks.map(t => t.id);

                if (groupTaskIds.length > 0) {
                    // グループ内のタスク同士を結ぶ依存関係をすべて削除
                    // 「始点」も「終点」もグループ内のタスクであるものを削除対象とする
                    await tx.delete(taskDependencies)
                        .where(and(
                            inArray(taskDependencies.predecessorId, groupTaskIds),
                            inArray(taskDependencies.successorId, groupTaskIds)
                        ));
                }

                // 3. 新しい依存関係を一括挿入
                if (edges && edges.length > 0) {
                    // 万が一フロントエンドから重複データが来ても落ちないように重複排除コードを入れる
                    const uniqueEdges = Array.from(new Map(edges.map(e => [`${e.source}-${e.target}`, e])).values());

                    // ID生成とオブジェクト整形
                    const newEdges = uniqueEdges.map(edge => ({
                        id: `dep_${nanoid()}`,
                        predecessorId: edge.source,
                        successorId: edge.target,
                        sourceHandle: edge.sourceHandle ?? null,
                        targetHandle: edge.targetHandle ?? null,
                    }));

                    // 一括インサート (insert many)
                     if (newEdges.length > 0) {
                        await tx.insert(taskDependencies).values(newEdges);
                     }
                }
            });
            return c.json({ success: true });
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to save flow" }, 500);
        }
    });
