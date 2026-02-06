// server/routes/tasks.ts
import { Hono } from "hono";
import { db } from "@/lib/db";
import { tasks, teams } from "@/db/schema"; // teams を追加
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
const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
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
    // selectで取得するフィールドを明示し、teamsと結合
    const data = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        teamId: tasks.teamId,
        status: tasks.status,
        creatorId: tasks.creatorId,
        assigneeId: tasks.assigneeId,
        teamName: teams.name, // チーム名を取得
      })
      .from(tasks)
      .leftJoin(teams, eq(tasks.teamId, teams.id)) // チームテーブルと結合
      .where(
        or(
          eq(tasks.assigneeId, userId),
          and(isNull(tasks.teamId), eq(tasks.creatorId, userId))
        )
      );

    return c.json(data);
  })

  //タスク新規作成
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
  })


  //タスク編集 (PATCH)
  .patch("/:id", zValidator("json", updateTaskSchema), async (c) => {
    const user = c.get("user");
    const taskId = c.req.param("id");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = c.req.valid("json");

    try {
      const [updatedTask] = await db
        .update(tasks)
        .set({
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.id, taskId),
            // セキュリティ: 自分の個人タスクか、チームタスクであること
            // (本来はチームメンバーかどうかの判定を入れるのがベスト)
            or(eq(tasks.creatorId, user.id), eq(tasks.assigneeId, user.id))
          )
        )
        .returning();

      if (!updatedTask) return c.json({ error: "Task not found or forbidden" }, 404);
      return c.json(updatedTask);
    } catch (e) {
      return c.json({ error: "Update failed" }, 500);
    }
  })

  // タスク削除 (DELETE)
  .delete("/:id", async (c) => {
    const user = c.get("user");
    const taskId = c.req.param("id");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const [deletedTask] = await db
        .delete(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.creatorId, user.id) // 作成者のみ削除可能とする
          )
        )
        .returning();

      if (!deletedTask) return c.json({ error: "Task not found or forbidden" }, 404);
      return c.json({ success: true, id: deletedTask.id });
    } catch (e) {
      return c.json({ error: "Delete failed" }, 500);
    }
  });