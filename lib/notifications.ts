import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { discordWebhooks, tasks, teams, user as users } from "@/db/schema";
import {
    buildDailyDigestEmbed,
    buildDueReminderEmbed,
    buildTestEmbed,
    DiscordEmbed,
    NotificationContext,
    MentionType,
    NotificationTask,
    sendDiscordWebhook,
    SendResult,
    toMentionCondition,
    toMentionType,
} from "@/lib/discord";

type DiscordWebhook = typeof discordWebhooks.$inferSelect;

// ---------------------------------------------------------------------------
// 日付ユーティリティ（JST固定）
// ---------------------------------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getJstNow(now: Date) {
    const shifted = new Date(now.getTime() + JST_OFFSET_MS);
    return {
        date: shifted.toISOString().slice(0, 10), // YYYY-MM-DD
        hour: shifted.getUTCHours(),
    };
}

// dueDate は <input type="date"> の値を new Date("YYYY-MM-DD") した UTC 0時として保存されている
function dueDateToYmd(dueDate: Date): string {
    return dueDate.toISOString().slice(0, 10);
}

function diffDays(fromYmd: string, toYmd: string): number {
    return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / DAY_MS);
}

export function getBaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
    return url.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// 通知内容の組み立て
// ---------------------------------------------------------------------------

async function getOwnerName(webhook: DiscordWebhook): Promise<string> {
    if (webhook.teamId) {
        const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, webhook.teamId)).limit(1);
        return team?.name ?? "";
    }
    if (webhook.userId) {
        const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, webhook.userId)).limit(1);
        return u?.name ?? "";
    }
    return "";
}

async function fetchTargetTasks(webhook: DiscordWebhook, today: string, baseUrl: string): Promise<NotificationTask[]> {
    const ownerCondition = webhook.teamId
        ? eq(tasks.teamId, webhook.teamId)
        : eq(tasks.assigneeId, webhook.userId!);

    const rows = await db
        .select({
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            dueDate: tasks.dueDate,
            teamId: tasks.teamId,
            taskGroupId: tasks.taskGroupId,
            assigneeName: users.name,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .where(and(ownerCondition, ne(tasks.status, "DONE")));

    return rows.map((row) => {
        const dueDate = row.dueDate ? dueDateToYmd(row.dueDate) : null;
        // タスク個別ページが無いので、所属するページへリンクする
        const path = row.taskGroupId
            ? `/groups/${row.taskGroupId}`
            : row.teamId
                ? `/teams/${row.teamId}`
                : "/tasks";
        return {
            id: row.id,
            title: row.title,
            status: row.status,
            dueDate,
            daysUntilDue: dueDate ? diffDays(today, dueDate) : null,
            assigneeName: row.assigneeName,
            url: `${baseUrl}${path}`,
        };
    });
}

const MENTION_LABELS: Record<MentionType, string> = { none: "なし", everyone: "@everyone", here: "@here" };

// 設定に応じて、今回の送信でメンションするかを決める
function resolveMention(webhook: DiscordWebhook, hasUrgent: boolean): MentionType {
    const type = toMentionType(webhook.mentionType);
    if (type === "none") return "none";
    if (toMentionCondition(webhook.mentionCondition) === "urgent" && !hasUrgent) return "none";
    return type;
}

async function buildScheduledEmbeds(
    webhook: DiscordWebhook,
    today: string
): Promise<{ embeds: DiscordEmbed[]; hasUrgent: boolean }> {
    const baseUrl = getBaseUrl();
    const ctx: NotificationContext = {
        scope: webhook.teamId ? "team" : "user",
        ownerName: await getOwnerName(webhook),
        today,
        baseUrl,
    };
    const targetTasks = await fetchTargetTasks(webhook, today, baseUrl);

    const embeds: DiscordEmbed[] = [];
    if (webhook.dueReminderEnabled) {
        const embed = buildDueReminderEmbed(targetTasks, webhook.dueReminderDaysBefore, ctx);
        if (embed) embeds.push(embed);
    }
    if (webhook.dailyDigestEnabled) {
        const embed = buildDailyDigestEmbed(targetTasks, ctx);
        if (embed) embeds.push(embed);
    }
    // 期限切れ or 今日が期限のタスクがあるか
    const hasUrgent = targetTasks.some((t) => t.daysUntilDue !== null && t.daysUntilDue <= 0);
    return { embeds, hasUrgent };
}

// ---------------------------------------------------------------------------
// テスト送信
// ---------------------------------------------------------------------------

export async function sendTestNotification(webhook: DiscordWebhook): Promise<SendResult> {
    const ownerName = await getOwnerName(webhook);
    const lines = [
        `通知: ${webhook.enabled ? "有効" : "無効"}`,
        `通知時刻: 毎日 ${webhook.notifyHour}:00（JST）`,
        `期限リマインダー: ${webhook.dueReminderEnabled
            ? webhook.dueReminderDaysBefore === 0
                ? "オン（当日のみ）"
                : `オン（${webhook.dueReminderDaysBefore}日前から）`
            : "オフ"}`,
        `タスク一覧: ${webhook.dailyDigestEnabled ? "オン" : "オフ"}`,
        `メンション: ${MENTION_LABELS[toMentionType(webhook.mentionType)]}${toMentionType(webhook.mentionType) === "none"
            ? ""
            : toMentionCondition(webhook.mentionCondition) === "urgent"
                ? "（期限切れ・当日期限があるときのみ）"
                : "（毎回）"}`,
    ];
    const embed = buildTestEmbed(
        { scope: webhook.teamId ? "team" : "user", ownerName, baseUrl: getBaseUrl() },
        lines.join("\n")
    );
    // メンションが届くか確認できるよう、テスト送信では条件に関わらずメンションを付ける
    return sendDiscordWebhook(webhook.webhookUrl, { embeds: [embed] }, toMentionType(webhook.mentionType));
}

// ---------------------------------------------------------------------------
// 定期実行
// ---------------------------------------------------------------------------

export type ScheduledRunSummary = {
    date: string;
    hour: number;
    targets: number;
    sent: number;
    skippedEmpty: number;
    failed: number;
    disabled: number;
};

export async function runScheduledNotifications(now: Date = new Date()): Promise<ScheduledRunSummary> {
    const { date: today, hour } = getJstNow(now);
    const notSentToday = or(isNull(discordWebhooks.lastNotifiedDate), ne(discordWebhooks.lastNotifiedDate, today));

    const targets = await db
        .select()
        .from(discordWebhooks)
        .where(and(eq(discordWebhooks.enabled, true), eq(discordWebhooks.notifyHour, hour), notSentToday));

    const summary: ScheduledRunSummary = {
        date: today,
        hour,
        targets: targets.length,
        sent: 0,
        skippedEmpty: 0,
        failed: 0,
        disabled: 0,
    };

    for (const webhook of targets) {
        try {
            // 先に「今日送った」印を付けて確保する（同時実行されても二重送信しない）
            const [claimed] = await db
                .update(discordWebhooks)
                .set({ lastNotifiedDate: today })
                .where(and(eq(discordWebhooks.id, webhook.id), notSentToday))
                .returning({ id: discordWebhooks.id });
            if (!claimed) continue;

            const { embeds, hasUrgent } = await buildScheduledEmbeds(webhook, today);
            if (embeds.length === 0) {
                summary.skippedEmpty++;
                continue;
            }

            const result = await sendDiscordWebhook(
                webhook.webhookUrl,
                { embeds },
                resolveMention(webhook, hasUrgent)
            );
            if (result.ok) {
                summary.sent++;
                continue;
            }

            summary.failed++;
            if (result.invalidWebhook) {
                // webhook が削除済み → 設定を無効化
                await db
                    .update(discordWebhooks)
                    .set({ enabled: false, updatedAt: new Date() })
                    .where(eq(discordWebhooks.id, webhook.id));
                summary.disabled++;
                console.error(`[discord] webhook ${webhook.id} is invalid (status ${result.status}); disabled.`);
            } else {
                // 一時的な失敗 → 次回の実行（同じ時間帯内）で再送できるよう印を戻す
                await db
                    .update(discordWebhooks)
                    .set({ lastNotifiedDate: webhook.lastNotifiedDate })
                    .where(eq(discordWebhooks.id, webhook.id));
                console.error(`[discord] failed to send webhook ${webhook.id} (status ${result.status}): ${result.message}`);
            }
        } catch (error) {
            summary.failed++;
            console.error(`[discord] error while processing webhook ${webhook.id}:`, error);
        }
    }

    return summary;
}
