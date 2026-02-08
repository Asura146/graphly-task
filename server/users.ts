import { Hono } from "hono";
import { db } from "@/lib/db";
import { user, teamMembers, tasks, session } from "@/db/schema";
import { eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Env } from "@/server";

const updateUserSchema = z.object({
    name: z.string().min(1, "名前は1文字以上必要です"),
});

export const userRoute = new Hono<Env>()
    // 自分の情報を取得
    .get("/me", async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

        const [userData] = await db
            .select()
            .from(user)
            .where(eq(user.id, currentUser.id))
            .limit(1);

        return c.json(userData);
    })
    // 名前の更新
    .patch("/me", zValidator("json", updateUserSchema), async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

        const { name } = c.req.valid("json");

        try {
            const [updatedUser] = await db
                .update(user)
                .set({ name, updatedAt: new Date() })
                .where(eq(user.id, currentUser.id))
                .returning();
            
            return c.json(updatedUser);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to update user" }, 500);
        }
    })
    // アカウント削除
    .delete("/me", async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

        try {
            await db.transaction(async (tx) => {
                const userId = currentUser.id;

                // 1. チームメンバーから削除
                await tx.delete(teamMembers).where(eq(teamMembers.userId, userId));

                // 2. 自分が担当しているタスクの割り当てを解除 (タスク自体は残す)
                await tx.update(tasks)
                    .set({ assigneeId: null })
                    .where(eq(tasks.assigneeId, userId));

                // 3. セッションの削除
                await tx.delete(session).where(eq(session.userId, userId));

                // 4. ユーザー本体の削除 (cascade設定があればaccount等も消えるが念の為)
                await tx.delete(user).where(eq(user.id, userId));
            });

            return c.json({ success: true });
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to delete account" }, 500);
        }
    });