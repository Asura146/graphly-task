import { Hono } from "hono";
import { db } from "@/lib/db";
import { user, teamMembers, tasks, session, discordWebhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Env } from "@/server";
import { nanoid } from "nanoid";
import { discordSettingsSchema, toDiscordSettings } from "@/lib/discord";
import { sendTestNotification } from "@/lib/notifications";

async function getUserWebhook(userId: string) {
    const [webhook] = await db
        .select()
        .from(discordWebhooks)
        .where(eq(discordWebhooks.userId, userId))
        .limit(1);
    return webhook;
}

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
    })
    // 個人の Discord 通知設定の取得
    .get("/me/discord", async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

        try {
            const webhook = await getUserWebhook(currentUser.id);
            return c.json({
                configured: !!webhook,
                canEdit: true,
                settings: webhook ? toDiscordSettings(webhook) : null,
            }, 200);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to fetch Discord settings" }, 500);
        }
    })
    // 個人の Discord 通知設定の登録・更新
    .put("/me/discord", zValidator("json", discordSettingsSchema), async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);
        const { webhookUrl, ...settings } = c.req.valid("json");

        try {
            const existing = await getUserWebhook(currentUser.id);
            if (existing) {
                const [updated] = await db
                    .update(discordWebhooks)
                    .set({
                        ...settings,
                        ...(webhookUrl ? { webhookUrl } : {}),
                        updatedAt: new Date(),
                    })
                    .where(eq(discordWebhooks.id, existing.id))
                    .returning();
                return c.json({ configured: true, canEdit: true, settings: toDiscordSettings(updated) }, 200);
            }

            if (!webhookUrl) {
                return c.json({ error: "Webhook URL は必須です" }, 400);
            }
            const [created] = await db
                .insert(discordWebhooks)
                .values({ id: `dwh_${nanoid()}`, userId: currentUser.id, webhookUrl, ...settings })
                .returning();
            return c.json({ configured: true, canEdit: true, settings: toDiscordSettings(created) }, 200);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to save Discord settings" }, 500);
        }
    })
    // 個人の Discord 連携解除
    .delete("/me/discord", async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

        try {
            await db.delete(discordWebhooks).where(eq(discordWebhooks.userId, currentUser.id));
            return c.json({ success: true }, 200);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to delete Discord settings" }, 500);
        }
    })
    // 個人の Discord テスト送信
    .post("/me/discord/test", async (c) => {
        const currentUser = c.get("user");
        if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

        try {
            const webhook = await getUserWebhook(currentUser.id);
            if (!webhook) return c.json({ error: "Discord 通知が設定されていません" }, 404);

            const result = await sendTestNotification(webhook);
            if (!result.ok) {
                console.error(`[discord] test send failed (status ${result.status}): ${result.message}`);
                return c.json({
                    error: result.invalidWebhook
                        ? "Webhook が見つかりません。URL を確認してください"
                        : "Discord への送信に失敗しました",
                }, 502);
            }
            return c.json({ success: true }, 200);
        } catch (error) {
            console.error(error);
            return c.json({ error: "Failed to send test notification" }, 500);
        }
    });