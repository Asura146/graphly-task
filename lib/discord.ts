import { z } from "zod";

// ---------------------------------------------------------------------------
// Webhook URL
// ---------------------------------------------------------------------------

// Discord の webhook URL のみ許可する（任意URLへのリクエスト = SSRF を防ぐ）
const DISCORD_WEBHOOK_URL_REGEX =
    /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/(\d+)\/([\w-]+)$/;

export const discordWebhookUrlSchema = z
    .string()
    .trim()
    .regex(DISCORD_WEBHOOK_URL_REGEX, "Discord の webhook URL を入力してください");

// 表示用: トークン部分を伏せる
export function maskWebhookUrl(url: string): string {
    const match = url.match(DISCORD_WEBHOOK_URL_REGEX);
    if (!match) return "https://discord.com/api/webhooks/••••••";
    const id = match[1];
    return `https://discord.com/api/webhooks/${id.slice(0, 4)}••••/••••••••`;
}

// ---------------------------------------------------------------------------
// 送信
// ---------------------------------------------------------------------------

export type DiscordEmbed = {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    footer?: { text: string };
    timestamp?: string;
};

export type DiscordPayload = {
    username?: string;
    embeds?: DiscordEmbed[];
};

export const MENTION_TYPES = ["none", "everyone", "here"] as const;
export type MentionType = (typeof MENTION_TYPES)[number];
export const MENTION_CONDITIONS = ["always", "urgent"] as const;
export type MentionCondition = (typeof MENTION_CONDITIONS)[number];

export type SendResult =
    | { ok: true }
    | { ok: false; status: number; invalidWebhook: boolean; message: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postOnce(url: string, payload: DiscordPayload, mention: MentionType) {
    // メンションは embed 内では通知されないため content に入れる。
    // allowed_mentions で許可するのは設定で選ばれたものだけにし、それ以外は一切飛ばさない
    const mentionBody =
        mention === "none"
            ? { allowed_mentions: { parse: [] } }
            : { content: `@${mention}`, allowed_mentions: { parse: ["everyone"] } };
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: "graphly-task",
            ...payload,
            ...mentionBody,
        }),
        signal: AbortSignal.timeout(10_000),
    });
}

export async function sendDiscordWebhook(
    url: string,
    payload: DiscordPayload,
    mention: MentionType = "none"
): Promise<SendResult> {
    // 念のため送信直前にも検証する
    if (!DISCORD_WEBHOOK_URL_REGEX.test(url)) {
        return { ok: false, status: 400, invalidWebhook: true, message: "Invalid webhook URL" };
    }

    try {
        let res = await postOnce(url, payload, mention);

        // レート制限: retry_after を1回だけ待って再送
        if (res.status === 429) {
            let retryAfterSec = 1;
            try {
                const body = (await res.json()) as { retry_after?: number };
                if (typeof body.retry_after === "number") retryAfterSec = body.retry_after;
            } catch {
                // ignore
            }
            await sleep(Math.min(Math.max(retryAfterSec, 0), 10) * 1000);
            res = await postOnce(url, payload, mention);
        }

        if (res.ok) return { ok: true };

        const text = await res.text().catch(() => "");
        return {
            ok: false,
            status: res.status,
            // 401/404 は webhook が削除済み・トークン不正
            invalidWebhook: res.status === 401 || res.status === 404,
            message: text.slice(0, 500),
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            invalidWebhook: false,
            message: error instanceof Error ? error.message : String(error),
        };
    }
}

// ---------------------------------------------------------------------------
// Embed 組み立て
// ---------------------------------------------------------------------------

// 1メッセージ内の embed 合計は 6000 文字まで、description は 4096 文字まで。
// embed を2つ載せても収まるよう、1つあたりの description を抑える。
const MAX_DESCRIPTION_LENGTH = 2800;

const COLOR_REMINDER = 0xf59e0b; // amber
const COLOR_DIGEST = 0x3b82f6; // blue
const COLOR_TEST = 0x22c55e; // green

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export type NotificationTask = {
    id: string;
    title: string;
    status: string;
    dueDate: string | null; // YYYY-MM-DD
    daysUntilDue: number | null; // 今日からの日数（負なら期限切れ）
    assigneeName: string | null;
    url: string;
};

export type NotificationContext = {
    scope: "team" | "user";
    ownerName: string; // チーム名 or ユーザー名
    today: string; // YYYY-MM-DD (JST)
    baseUrl: string;
};

function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_~|>\[\]()])/g, "\\$1");
}

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(ymd: string): string {
    const [y, m, d] = ymd.split("-").map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${m}/${d}(${weekday})`;
}

function taskLine(task: NotificationTask, ctx: NotificationContext, extra?: string): string {
    const title = escapeMarkdown(truncate(task.title, 80));
    const parts: string[] = [task.dueDate ? `期限 ${formatDate(task.dueDate)}` : "期限なし"];
    if (extra) parts.push(extra);
    if (ctx.scope === "team") {
        parts.push(`担当: ${task.assigneeName ? escapeMarkdown(task.assigneeName) : "未割り当て"}`);
    }
    return `• [${title}](${task.url}) — ${parts.join(" ・ ")}`;
}

type Section = { heading: string; lines: string[] };

// セクションを結合し、上限を超える分は「他N件」に丸める
function buildDescription(sections: Section[], max = MAX_DESCRIPTION_LENGTH): string {
    const nonEmpty = sections.filter((s) => s.lines.length > 0);
    const out: string[] = [];
    let length = 0;

    const push = (line: string) => {
        out.push(line);
        length += line.length + 1;
    };

    for (let i = 0; i < nonEmpty.length; i++) {
        const section = nonEmpty[i];
        if (out.length > 0) push("");
        push(`**${section.heading}（${section.lines.length}件）**`);

        // 後続セクションの見出し用に余白を残す
        const reserve = 40 * (nonEmpty.length - i);
        let shown = 0;
        for (const line of section.lines) {
            if (length + line.length + 1 > max - reserve) break;
            push(line);
            shown++;
        }
        const rest = section.lines.length - shown;
        if (rest > 0) push(`…他${rest}件`);
    }
    return out.join("\n");
}

function sortByDueDate(a: NotificationTask, b: NotificationTask): number {
    if (a.dueDate === b.dueDate) return 0;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
}

function footerText(ctx: NotificationContext): string {
    return ctx.scope === "team" ? `チーム: ${ctx.ownerName}` : `${ctx.ownerName} さんの担当タスク`;
}

export function buildDueReminderEmbed(
    tasks: NotificationTask[],
    daysBefore: number,
    ctx: NotificationContext
): DiscordEmbed | null {
    const targets = tasks
        .filter((t) => t.daysUntilDue !== null && t.daysUntilDue <= daysBefore)
        .sort(sortByDueDate);
    if (targets.length === 0) return null;

    const overdue = targets.filter((t) => t.daysUntilDue! < 0);
    const dueToday = targets.filter((t) => t.daysUntilDue === 0);
    const upcoming = targets.filter((t) => t.daysUntilDue! > 0);

    const description = buildDescription([
        {
            heading: "🔴 期限切れ",
            lines: overdue.map((t) => taskLine(t, ctx, `${-t.daysUntilDue!}日超過`)),
        },
        { heading: "🟠 今日が期限", lines: dueToday.map((t) => taskLine(t, ctx)) },
        {
            heading: `🟡 ${daysBefore}日以内に期限`,
            lines: upcoming.map((t) => taskLine(t, ctx, `あと${t.daysUntilDue}日`)),
        },
    ]);

    return {
        title: "⏰ 期限が近いタスク",
        description,
        color: COLOR_REMINDER,
        footer: { text: footerText(ctx) },
    };
}

export function buildDailyDigestEmbed(
    tasks: NotificationTask[],
    ctx: NotificationContext
): DiscordEmbed | null {
    const active = tasks.filter((t) => t.status !== "DONE").sort(sortByDueDate);
    if (active.length === 0) return null;

    const inProgress = active.filter((t) => t.status === "IN_PROGRESS");
    const todo = active.filter((t) => t.status !== "IN_PROGRESS");

    const description = buildDescription([
        { heading: "🚧 進行中", lines: inProgress.map((t) => taskLine(t, ctx)) },
        { heading: "📝 未着手", lines: todo.map((t) => taskLine(t, ctx)) },
    ]);

    return {
        title: `📋 ${formatDate(ctx.today)} の未完了タスク（${active.length}件）`,
        description,
        color: COLOR_DIGEST,
        footer: { text: footerText(ctx) },
    };
}

export function buildTestEmbed(ctx: Omit<NotificationContext, "today">, settingsSummary: string): DiscordEmbed {
    return {
        title: "✅ graphly-task 通知テスト",
        description: `Discord 通知の連携が完了しています。\n\n${settingsSummary}`,
        url: ctx.baseUrl,
        color: COLOR_TEST,
        footer: { text: ctx.scope === "team" ? `チーム: ${ctx.ownerName}` : `${ctx.ownerName} さんの個人通知` },
    };
}

// ---------------------------------------------------------------------------
// 設定 API 用
// ---------------------------------------------------------------------------

export const discordSettingsSchema = z.object({
    // 空欄なら既存の URL を維持する
    webhookUrl: z.union([z.literal(""), discordWebhookUrlSchema]).optional(),
    enabled: z.boolean(),
    notifyHour: z.number().int().min(0).max(23),
    dueReminderEnabled: z.boolean(),
    dueReminderDaysBefore: z.number().int().min(0).max(7),
    dailyDigestEnabled: z.boolean(),
    // 未指定なら既存の値（新規作成時は DB の初期値）を維持する
    mentionType: z.enum(MENTION_TYPES).optional(),
    mentionCondition: z.enum(MENTION_CONDITIONS).optional(),
});

export type DiscordSettings = {
    webhookUrlMasked: string;
    enabled: boolean;
    notifyHour: number;
    dueReminderEnabled: boolean;
    dueReminderDaysBefore: number;
    dailyDigestEnabled: boolean;
    mentionType: MentionType;
    mentionCondition: MentionCondition;
};

export function toMentionType(value: string): MentionType {
    return (MENTION_TYPES as readonly string[]).includes(value) ? (value as MentionType) : "none";
}

export function toMentionCondition(value: string): MentionCondition {
    return (MENTION_CONDITIONS as readonly string[]).includes(value) ? (value as MentionCondition) : "urgent";
}

// クライアントには webhook URL の全文を返さない
export function toDiscordSettings(row: {
    webhookUrl: string;
    enabled: boolean;
    notifyHour: number;
    dueReminderEnabled: boolean;
    dueReminderDaysBefore: number;
    dailyDigestEnabled: boolean;
    mentionType: string;
    mentionCondition: string;
}): DiscordSettings {
    return {
        webhookUrlMasked: maskWebhookUrl(row.webhookUrl),
        enabled: row.enabled,
        notifyHour: row.notifyHour,
        dueReminderEnabled: row.dueReminderEnabled,
        dueReminderDaysBefore: row.dueReminderDaysBefore,
        dailyDigestEnabled: row.dailyDigestEnabled,
        mentionType: toMentionType(row.mentionType),
        mentionCondition: toMentionCondition(row.mentionCondition),
    };
}
