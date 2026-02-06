// server/routes/tasks.ts
import { Hono } from "hono";
import { db } from "@/lib/db";
import { tasks, teams, teamMembers } from "@/db/schema"; 
import { eq, or, and, isNull } from "drizzle-orm";
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
      // 1. まずターゲットとなるタスクを取得して権限チェックを行う
      const [targetTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!targetTask) return c.json({ error: "Task not found" }, 404);

      let isAuthorized = false;

      // 条件A: 自分が作成者、または現在の担当者であればOK
      if (targetTask.creatorId === user.id || targetTask.assigneeId === user.id) {
        isAuthorized = true;
      } 
      // 条件B: チームタスクの場合、そのチームのメンバーであればOK
      else if (targetTask.teamId) {
        const [member] = await db
          .select()
          .from(teamMembers)
          .where(and(
            eq(teamMembers.teamId, targetTask.teamId),
            eq(teamMembers.userId, user.id)
          ))
          .limit(1);
        
        if (member) isAuthorized = true;
      }

      if (!isAuthorized) {
        return c.json({ error: "Forbidden" }, 403);
      }

      // 2. 権限確認ができたら更新を実行
      const [updatedTask] = await db
        .update(tasks)
        .set({
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId)) // ID指定のみで更新
        .returning();

      return c.json(updatedTask);
    } catch (e) {
      console.error(e);
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