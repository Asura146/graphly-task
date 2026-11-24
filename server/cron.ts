import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { Env } from "@/server";
import { runScheduledNotifications } from "@/lib/notifications";

function isValidCronSecret(authorization: string | undefined): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret || !authorization) return false;

    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(authorization);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const cronRoute = new Hono<Env>()
    // 定期通知 (scheduler コンテナから10分おきに呼ばれる)
    .post("/discord", async (c) => {
        if (!isValidCronSecret(c.req.header("Authorization"))) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        try {
            const summary = await runScheduledNotifications(new Date());
            return c.json(summary, 200);
        } catch (error) {
            console.error("[discord] scheduled run failed:", error);
            return c.json({ error: "Failed to run scheduled notifications" }, 500);
        }
    });
