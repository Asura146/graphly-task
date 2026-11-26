import { Hono } from "hono";
import { db } from "@/lib/db";
import { teams, teamMembers, user as users, tasks, taskGroups, discordWebhooks, teamLinks } from "@/db/schema"
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid"
import { Env } from "@/server"
import { eq, desc, and } from "drizzle-orm"
import { discordSettingsSchema, toDiscordSettings } from "@/lib/discord"
import { sendTestNotification } from "@/lib/notifications"

const createTeamSchema = z.object({
    name: z.string().min(1,"チーム名は必須です。"),
    description: z.string().optional(),
});

// メンバー招待用スキーマ
const inviteMemberSchema = z.object({
    email: z.string().email("有効なメールアドレスを入力してください"),
});

// リンク集用スキーマ (javascript: などを防ぐため http/https のみ許可)
const linkSchema = z.object({
    title: z.string().trim().min(1, "タイトルは必須です").max(100),
    url: z
        .string()
        .trim()
        .max(2048, "URLが長すぎます")
        .url("有効なURLを入力してください")
        .refine((v) => /^https?:\/\//i.test(v), "http:// または https:// のURLのみ登録できます"),
    description: z.string().trim().max(500).optional(),
});

// チームの ADMIN かどうか
async function isTeamAdmin(teamId: string, userId: string) {
    const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);
    return !!member && member.role === "ADMIN";
}

async function getTeamWebhook(teamId: string) {
    const [webhook] = await db
        .select()
        .from(discordWebhooks)
        .where(eq(discordWebhooks.teamId, teamId))
        .limit(1);
    return webhook;
}

export const teamRoute = new Hono<Env>()
    //チーム作成API
    .post("/",zValidator("json",createTeamSchema),async(c)=>{
        const user = c.get("user");
        if(!user) return c.json({ error: "Unauthorized" }, 401);

        const { name, description } = c.req.valid("json");
        const teamId = `team_${nanoid()}`;

        try {
            const newTeam = await db.transaction(async (tx) =>{
                const [insertedTeam] = await tx.insert(teams).values({
                    id: teamId,
                    name,
                    description: description ?? null,
                }).returning();

                await tx.insert(teamMembers).values({
                    id: `tm_${nanoid()}`,
                    teamId: teamId,
                    userId: user.id,
                    role: "ADMIN",
                });
                return insertedTeam;
            });

            return c.json(newTeam,201);
        }catch (error){
            console.error(error);
            return c.json({ error: "Failed to create team" }, 500);
        }
    })

    // メンバーかどうかのチェック処理用ミドルウェア
    .use("/:id/*", async (c, next) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);

        const teamId = c.req.param("id");

        if (!teamId) {
            return c.json({ error: "Team ID is required" }, 400);
        }

        try {
            const [member] = await db
                .select()
                .from(teamMembers)
                .where(and(
                    eq(teamMembers.teamId, teamId),
                    eq(teamMembers.userId, user.id)
                ))
                .limit(1);

            if (!member) {
                return c.json({ error: "Team not found or Access denied" }, 404);
            }

            await next(); // メンバーなら通過して、下の各APIへ進む
        } catch (error) {
            console.error("Middleware verification error:", error);
            return c.json({ error: "Internal Server Error" }, 500);
        }
    })


    // メンバー追加API (メールアドレスで招待)
    .post("/:id/members", zValidator("json", inviteMemberSchema), async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);

      const teamId = c.req.param("id");
      const { email } = c.req.valid("json");

      try {
        // トランザクション内でチーム存在確認・権限チェック・ユーザー作成・メンバー追加を一貫して行う
        const result = await db.transaction(async (tx) => {
          // チームが存在するか確認
          const [teamRow] = await tx
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .limit(1);

          if (!teamRow) return { status: 404, body: { error: "Team not found" } };

          // 招待を行うユーザーがそのチームのADMINか確認
          const [inviterMember] = await tx
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
            .limit(1);

          if (!inviterMember || inviterMember.role !== "ADMIN") {
            return { status: 403, body: { error: "Forbidden" } };
          }

          // 招待対象ユーザーが存在するか確認
          let [targetUser] = await tx
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          // 存在しなければ、404を返す
          if (!targetUser) {
            return { status: 403, body: { error: "ユーザが存在しません" } };
          }

          // 既にメンバーになっていないか確認
          const [existingMember] = await tx
            .select()
            .from(teamMembers)
            .where(and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, targetUser.id)
            ))
            .limit(1);

          if (existingMember) {
            return { status: 409, body: { error: "User is already a member" } };
          }

          // メンバーに追加
          const [newMember] = await tx.insert(teamMembers).values({
            id: `tm_${nanoid()}`,
            teamId: teamId,
            userId: targetUser.id,
            role: "MEMBER",
          }).returning();

          return { status: 201, body: newMember };
        });

        if (result.status === 201) return c.json(result.body, 201);
        if (result.status === 403) return c.json(result.body, 403);
        if (result.status === 404) return c.json(result.body, 404);
        if (result.status === 409) return c.json(result.body, 409);

        return c.json({ error: "Failed to add member" }, 500);
      } catch (error) {
        console.error(error);
        return c.json({ error: "Failed to add member" }, 500);
      }
    })
    //所属チーム一覧を取得するAPI
    .get("/", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
    
        try {
          // teamMembers を JOIN して、自分が所属しているチームだけを抽出
          const myTeams = await db
            .select({
              id: teams.id,
              name: teams.name,
              description: teams.description,
              role: teamMembers.role,
              createdAt: teams.createdAt,
            })
            .from(teams)
            .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
            .where(eq(teamMembers.userId, user.id))
            .orderBy(desc(teams.createdAt));
    
          return c.json(myTeams);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to fetch teams" }, 500);
        }
      })
      .get("/:id", async (c) => {
        const teamId = c.req.param("id");
        const [team] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .limit(1);
            
        if (!team) return c.json({ error: "Team not found" }, 404);
        return c.json(team);
      })
    
      // そのチームの全タスクを取得 (GET /api/teams/:id/tasks)
      .get("/:id/tasks", async (c) => {
        const teamId = c.req.param("id");
        
        const teamTasks = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            status: tasks.status,
            dueDate: tasks.dueDate,
            createdAt: tasks.createdAt,
            assigneeId: tasks.assigneeId, 
            assigneeName: users.name, 
            groupId: tasks.taskGroupId,
            groupTitle: taskGroups.title,
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.id)) 
          .leftJoin(taskGroups, eq(tasks.taskGroupId, taskGroups.id))
          .where(eq(tasks.teamId, teamId))
          .orderBy(desc(tasks.createdAt));
          
        return c.json(teamTasks);
      })
    
      // チームメンバー一覧の取得 (GET /api/teams/:id/members)
      .get("/:id/members", async (c) => {
        const teamId = c.req.param("id");
        const members = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            role: teamMembers.role,
          })
          .from(teamMembers)
          .innerJoin(users, eq(teamMembers.userId, users.id))
          .where(eq(teamMembers.teamId, teamId));
        return c.json(members);
      })
      // チーム内のタスクグループ一覧取得
      .get("/:id/task-groups", async (c) => {
        const teamId = c.req.param("id");
        const groups = await db
            .select()
            .from(taskGroups)
            .where(eq(taskGroups.teamId, teamId))
            .orderBy(desc(taskGroups.createdAt));
        return c.json(groups);
      })

      // リンク集の一覧取得
      .get("/:id/links", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");

        try {
          const isAdmin = await isTeamAdmin(teamId, user.id);
          const links = await db
            .select({
              id: teamLinks.id,
              title: teamLinks.title,
              url: teamLinks.url,
              description: teamLinks.description,
              creatorId: teamLinks.creatorId,
              creatorName: users.name,
              createdAt: teamLinks.createdAt,
            })
            .from(teamLinks)
            .leftJoin(users, eq(teamLinks.creatorId, users.id))
            .where(eq(teamLinks.teamId, teamId))
            .orderBy(desc(teamLinks.createdAt));

          return c.json(
            links.map((link) => ({ ...link, canEdit: isAdmin || link.creatorId === user.id })),
            200
          );
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to fetch links" }, 500);
        }
      })

      // リンクの追加 (メンバー全員)
      .post("/:id/links", zValidator("json", linkSchema), async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");
        const { title, url, description } = c.req.valid("json");

        try {
          const [created] = await db
            .insert(teamLinks)
            .values({
              id: `link_${nanoid()}`,
              teamId,
              creatorId: user.id,
              title,
              url,
              description: description || null,
            })
            .returning();
          return c.json(created, 201);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to create link" }, 500);
        }
      })

      // リンクの更新 (作成者 or ADMIN)
      .put("/:id/links/:linkId", zValidator("json", linkSchema), async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");
        const linkId = c.req.param("linkId");
        const { title, url, description } = c.req.valid("json");

        try {
          const [link] = await db
            .select()
            .from(teamLinks)
            .where(and(eq(teamLinks.id, linkId), eq(teamLinks.teamId, teamId)))
            .limit(1);
          if (!link) return c.json({ error: "Link not found" }, 404);
          if (link.creatorId !== user.id && !(await isTeamAdmin(teamId, user.id))) {
            return c.json({ error: "Forbidden" }, 403);
          }

          const [updated] = await db
            .update(teamLinks)
            .set({ title, url, description: description || null, updatedAt: new Date() })
            .where(eq(teamLinks.id, linkId))
            .returning();
          return c.json(updated, 200);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to update link" }, 500);
        }
      })

      // リンクの削除 (作成者 or ADMIN)
      .delete("/:id/links/:linkId", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");
        const linkId = c.req.param("linkId");

        try {
          const [link] = await db
            .select()
            .from(teamLinks)
            .where(and(eq(teamLinks.id, linkId), eq(teamLinks.teamId, teamId)))
            .limit(1);
          if (!link) return c.json({ error: "Link not found" }, 404);
          if (link.creatorId !== user.id && !(await isTeamAdmin(teamId, user.id))) {
            return c.json({ error: "Forbidden" }, 403);
          }

          await db.delete(teamLinks).where(eq(teamLinks.id, linkId));
          return c.json({ success: true }, 200);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to delete link" }, 500);
        }
      })

      // Discord 通知設定の取得 (メンバーは設定の有無のみ)
      .get("/:id/discord", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");

        try {
          const canEdit = await isTeamAdmin(teamId, user.id);
          const webhook = await getTeamWebhook(teamId);
          return c.json({
            configured: !!webhook,
            canEdit,
            settings: webhook && canEdit ? toDiscordSettings(webhook) : null,
          }, 200);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to fetch Discord settings" }, 500);
        }
      })

      // Discord 通知設定の登録・更新 (ADMIN のみ)
      .put("/:id/discord", zValidator("json", discordSettingsSchema), async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");
        const { webhookUrl, ...settings } = c.req.valid("json");

        try {
          if (!(await isTeamAdmin(teamId, user.id))) {
            return c.json({ error: "Forbidden" }, 403);
          }

          const existing = await getTeamWebhook(teamId);
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
            .values({ id: `dwh_${nanoid()}`, teamId, webhookUrl, ...settings })
            .returning();
          return c.json({ configured: true, canEdit: true, settings: toDiscordSettings(created) }, 200);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to save Discord settings" }, 500);
        }
      })

      // Discord 連携解除 (ADMIN のみ)
      .delete("/:id/discord", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");

        try {
          if (!(await isTeamAdmin(teamId, user.id))) {
            return c.json({ error: "Forbidden" }, 403);
          }
          await db.delete(discordWebhooks).where(eq(discordWebhooks.teamId, teamId));
          return c.json({ success: true }, 200);
        } catch (error) {
          console.error(error);
          return c.json({ error: "Failed to delete Discord settings" }, 500);
        }
      })

      // Discord テスト送信 (ADMIN のみ)
      .post("/:id/discord/test", async (c) => {
        const user = c.get("user");
        if (!user) return c.json({ error: "Unauthorized" }, 401);
        const teamId = c.req.param("id");

        try {
          if (!(await isTeamAdmin(teamId, user.id))) {
            return c.json({ error: "Forbidden" }, 403);
          }
          const webhook = await getTeamWebhook(teamId);
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
