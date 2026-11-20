"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Switch, Select, SelectItem, addToast } from "@heroui/react";
import { api } from "@/lib/hono";

type DiscordScope = { type: "team"; teamId: string } | { type: "user" };

type DiscordSettings = {
    webhookUrlMasked: string;
    enabled: boolean;
    notifyHour: number;
    dueReminderEnabled: boolean;
    dueReminderDaysBefore: number;
    dailyDigestEnabled: boolean;
};

type DiscordSettingsResponse = {
    configured: boolean;
    canEdit: boolean;
    settings: DiscordSettings | null;
};

type SettingsInput = {
    webhookUrl?: string;
    enabled: boolean;
    notifyHour: number;
    dueReminderEnabled: boolean;
    dueReminderDaysBefore: number;
    dailyDigestEnabled: boolean;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: `${h}:00` }));
const DAYS_OPTIONS = Array.from({ length: 8 }, (_, d) => ({
    key: String(d),
    label: d === 0 ? "当日のみ" : `${d}日前から`,
}));

const DEFAULTS: SettingsInput = {
    enabled: true,
    notifyHour: 9,
    dueReminderEnabled: true,
    dueReminderDaysBefore: 1,
    dailyDigestEnabled: true,
};

// チーム / 個人で呼び出す API を切り替える
function discordApi(scope: DiscordScope) {
    if (scope.type === "team") {
        const param = { id: scope.teamId };
        return {
            get: () => api.teams[":id"].discord.$get({ param }),
            put: (json: SettingsInput) => api.teams[":id"].discord.$put({ param, json }),
            delete: () => api.teams[":id"].discord.$delete({ param }),
            test: () => api.teams[":id"].discord.test.$post({ param }),
        };
    }
    return {
        get: () => api.users.me.discord.$get(),
        put: (json: SettingsInput) => api.users.me.discord.$put({ json }),
        delete: () => api.users.me.discord.$delete(),
        test: () => api.users.me.discord.test.$post(),
    };
}

async function readError(res: Response, fallback: string): Promise<string> {
    try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body.error === "string") return body.error;
        // zod のバリデーションエラー
        if (res.status === 400) return "入力内容を確認してください（Discord の webhook URL のみ登録できます）";
    } catch {
        // ignore
    }
    return fallback;
}

interface DiscordSettingsFormProps {
    scope: DiscordScope;
    onDone?: () => void;
}

export function DiscordSettingsForm({ scope, onDone }: DiscordSettingsFormProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<DiscordSettingsResponse | null>(null);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [form, setForm] = useState<SettingsInput>(DEFAULTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const scopeKey = scope.type === "team" ? scope.teamId : "me";

    const applyResponse = (res: DiscordSettingsResponse) => {
        setData(res);
        setWebhookUrl("");
        if (res.settings) {
            const s = res.settings;
            setForm({
                enabled: s.enabled,
                notifyHour: s.notifyHour,
                dueReminderEnabled: s.dueReminderEnabled,
                dueReminderDaysBefore: s.dueReminderDaysBefore,
                dailyDigestEnabled: s.dailyDigestEnabled,
            });
        } else {
            setForm(DEFAULTS);
        }
    };

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await discordApi(scope).get();
            if (res.ok) {
                applyResponse((await res.json()) as DiscordSettingsResponse);
            } else {
                addToast({ title: "Discord 通知設定の取得に失敗しました", color: "danger" });
            }
        } catch (error) {
            console.error(error);
            addToast({ title: "エラーが発生しました", color: "danger" });
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeKey]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await discordApi(scope).put({ ...form, webhookUrl: webhookUrl.trim() });
            if (res.ok) {
                applyResponse((await res.json()) as DiscordSettingsResponse);
                addToast({ title: "Discord 通知設定を保存しました", color: "success" });
            } else {
                addToast({ title: await readError(res, "保存に失敗しました"), color: "danger" });
            }
        } catch (error) {
            console.error(error);
            addToast({ title: "エラーが発生しました", color: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        try {
            const res = await discordApi(scope).test();
            if (res.ok) {
                addToast({ title: "テスト通知を送信しました", color: "success" });
            } else {
                addToast({ title: await readError(res, "テスト送信に失敗しました"), color: "danger" });
            }
        } catch (error) {
            console.error(error);
            addToast({ title: "エラーが発生しました", color: "danger" });
        } finally {
            setIsTesting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Discord 連携を解除しますか？")) return;
        setIsDeleting(true);
        try {
            const res = await discordApi(scope).delete();
            if (res.ok) {
                applyResponse({ configured: false, canEdit: true, settings: null });
                addToast({ title: "Discord 連携を解除しました" });
                onDone?.();
            } else {
                addToast({ title: await readError(res, "連携解除に失敗しました"), color: "danger" });
            }
        } catch (error) {
            console.error(error);
            addToast({ title: "エラーが発生しました", color: "danger" });
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return <p className="text-sm text-gray-500">読み込み中...</p>;
    }

    if (!data) {
        return <p className="text-sm text-gray-500">設定を読み込めませんでした</p>;
    }

    // チームの MEMBER は設定の有無のみ表示
    if (!data.canEdit) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-700">
                    Discord 通知: <span className="font-bold">{data.configured ? "設定済み" : "未設定"}</span>
                </p>
                <p className="text-xs text-gray-500">設定の変更はチームの管理者のみ可能です。</p>
            </div>
        );
    }

    const settings = data.settings;
    const isConfigured = data.configured && !!settings;

    return (
        <div className="flex flex-col gap-5">
            {isConfigured && !settings.enabled && (
                <p className="text-xs text-warning-600 bg-warning-50 rounded-lg px-3 py-2">
                    通知は現在無効です。webhook が削除された場合は自動的に無効になります。
                </p>
            )}

            <Input
                label="Webhook URL"
                variant="bordered"
                value={webhookUrl}
                onValueChange={setWebhookUrl}
                placeholder={isConfigured ? settings.webhookUrlMasked : "https://discord.com/api/webhooks/..."}
                description={
                    isConfigured
                        ? "変更しない場合は空欄のままにしてください"
                        : "Discord のチャンネル設定 → 連携サービス → ウェブフック で作成した URL"
                }
                autoComplete="off"
            />

            <Switch
                isSelected={form.enabled}
                onValueChange={(enabled) => setForm((f) => ({ ...f, enabled }))}
            >
                通知を有効にする
            </Switch>

            <Select
                label="通知時刻（毎日・日本時間）"
                variant="bordered"
                disallowEmptySelection
                selectedKeys={[String(form.notifyHour)]}
                onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (value !== undefined) setForm((f) => ({ ...f, notifyHour: Number(value) }));
                }}
                isDisabled={!form.enabled}
            >
                {HOUR_OPTIONS.map((o) => (
                    <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
            </Select>

            <div className="flex flex-col gap-3">
                <Switch
                    isSelected={form.dueReminderEnabled}
                    onValueChange={(dueReminderEnabled) => setForm((f) => ({ ...f, dueReminderEnabled }))}
                    isDisabled={!form.enabled}
                >
                    期限が近いタスクを通知する
                </Switch>
                <Select
                    label="期限の何日前から通知するか"
                    variant="bordered"
                    disallowEmptySelection
                    selectedKeys={[String(form.dueReminderDaysBefore)]}
                    onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0];
                        if (value !== undefined) setForm((f) => ({ ...f, dueReminderDaysBefore: Number(value) }));
                    }}
                    isDisabled={!form.enabled || !form.dueReminderEnabled}
                >
                    {DAYS_OPTIONS.map((o) => (
                        <SelectItem key={o.key}>{o.label}</SelectItem>
                    ))}
                </Select>
            </div>

            <Switch
                isSelected={form.dailyDigestEnabled}
                onValueChange={(dailyDigestEnabled) => setForm((f) => ({ ...f, dailyDigestEnabled }))}
                isDisabled={!form.enabled}
            >
                未完了タスクの一覧を毎日通知する
            </Switch>

            <div className="flex flex-wrap justify-end gap-2 mt-2">
                {isConfigured && (
                    <>
                        <Button color="danger" variant="light" onPress={handleDelete} isLoading={isDeleting}>
                            連携解除
                        </Button>
                        <Button variant="flat" onPress={handleTest} isLoading={isTesting}>
                            テスト送信
                        </Button>
                    </>
                )}
                <Button
                    color="primary"
                    onPress={handleSave}
                    isLoading={isSaving}
                    isDisabled={!isConfigured && !webhookUrl.trim()}
                >
                    保存
                </Button>
            </div>
            {isConfigured && (
                <p className="text-xs text-gray-400 text-right -mt-3">テスト送信は保存済みの設定で送られます</p>
            )}
        </div>
    );
}
