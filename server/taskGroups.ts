import { Hono } from "hono";
import { db } from "@/lib/db";
import { taskGroups, tasks, taskDependencies } from "@/db/schema";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Env } from "@/server";
import { eq } from "drizzle-orm";

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
    })).optional(),
});

export const taskGroupRoute = new Hono<Env>()
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
        const groupTasks = await db.select().from(tasks).where(eq(tasks.taskGroupId, groupId));

        // 3. 依存関係（エッジ）の取得
        const taskIds = groupTasks.map(t => t.id);
        let edges: any[] = [];
        
        if (taskIds.length > 0) {
            const allDeps = await db.select().from(taskDependencies);
            // 簡易的にフィルタリング (本来はSQLで解決するのが望ましい)
            edges = allDeps
                .filter(d => taskIds.includes(d.predecessorId) && taskIds.includes(d.successorId))
                .map(d => ({ id: d.id, source: d.predecessorId, target: d.successorId }));
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

                // 2. 依存関係の更新（既存を削除して作り直すのが簡単）
                // ※ 本来はグループ内の依存関係だけを消すべきだが、ここでは簡易実装
                if (edges) {
                    // グループ内のタスクIDを取得
                    const currentTasks = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.taskGroupId, groupId));
                    const currentTaskIds = currentTasks.map(t => t.id);
                    
                    if (currentTaskIds.length > 0) {
                        // このグループに関連する依存を削除 (predecessorベース)
                        // Note: 厳密にはここをもっと精密にする必要があります
                    }

                    // 新しい依存関係を挿入
                    for (const edge of edges) {
                        // 重複チェックなどはDBのunique制約に任せるか、ON CONFLICT DO NOTHING
                        try {
                            await tx.insert(taskDependencies).values({
                                id: `dep_${nanoid()}`,
                                predecessorId: edge.source,
                                successorId: edge.target,
                            }).onConflictDoNothing();
                        } catch (e) {
                            // ignore duplicate
                        }
                    }
                }
            });
            return c.json({ success: true });
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to save flow" }, 500);
        }
    });
