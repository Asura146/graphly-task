// server/routes/tasks.ts
import { Hono } from "hono";
import { db } from "@/lib/db";
import { tasks } from "@/db/schema";
import { eq, or, and, isNull, desc } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Env } from "@/server"

// バリデーションスキーマ
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  teamId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().optional(),
});

export const taskRoute = new Hono<Env>() // index.tsと同じ型を渡す
  .get("/", async (c) => {
    const user = c.get("user"); // ミドルウェアでセットされたユーザー

    // ログインしていない場合はエラーを返す
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // あとはユーザーIDを使ってDBから取得
    const userId = user.id;
    const data = await db
      .select()
      .from(tasks)
      .where(
        or(
          eq(tasks.assigneeId, userId),
          and(isNull(tasks.teamId), eq(tasks.creatorId, userId))
        )
      );

    return c.json(data);
  })

  // 2. タスク新規作成
  .post("/", zValidator("json", createTaskSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
  
    const body = c.req.valid("json");
    const isPersonal = !body.teamId; // teamIdがなければ個人タスク
  
    // 担当者の割り当てロジック
    let finalAssigneeId: string | null = null;
  
    if (isPersonal) {
      // 【個人タスク】強制的に自分を担当者にする
      finalAssigneeId = user.id;
    } else {
      // 【チームタスク】指定があればその人、なければnull（宙に浮いた状態）
      finalAssigneeId = body.assigneeId ?? null;
    }
  
    try {
      const [newTask] = await db
        .insert(tasks)
        .values({
          id: `task_${nanoid()}`,
          title: body.title,
          description: body.description ?? null,
          teamId: body.teamId ?? null,
          creatorId: user.id,
          assigneeId: finalAssigneeId, // 決定した担当者IDをセット
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          positionX: 0,
          positionY: 0,
        })
        .returning();
  
      return c.json(newTask, 201);
    } catch (error) {
      return c.json({ error: "Failed to create task" }, 500);
    }
  });