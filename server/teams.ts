import { Hono } from "hono";
import { db } from "@/lib/db";
// 修正: taskGroups をインポートに追加
import { teams, teamMembers, user as users, tasks, taskGroups } from "@/db/schema"
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid"
import { Env } from "@/server"
import { eq, desc, and } from "drizzle-orm"

const createTeamSchema = z.object({
    name: z.string().min(1,"チーム名は必須です。"),
    description: z.string().optional(),
});

// メンバー招待用スキーマ
const inviteMemberSchema = z.object({
    email: z.string().email("有効なメールアドレスを入力してください"),
});

export const teamRoute = new Hono<Env>()
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

          // 存在しなければプレースホルダユーザーを作成
          if (!targetUser) {
            const newUserId = `user_${nanoid()}`;
            const now = new Date();
            const [created] = await tx.insert(users).values({
              id: newUserId,
              name: email.split("@")[0],
              email,
              emailVerified: false,
              image: null,
              createdAt: now,
              updatedAt: now,
              role: null,
              banned: false,
            }).returning();
            targetUser = created;
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
              role: teamMembers.role, // 自分の役割（ADMIN/MEMBER）も一緒に返すと便利
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
        // 修正: ここも db.select().from(teams) へ変更
        const [team] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .limit(1);
            
        if (!team) return c.json({ error: "Team not found" }, 404);
        return c.json(team);
      })
    
      // 2. そのチームの全タスクを取得 (GET /api/teams/:id/tasks)
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
            
            // ★追加: グループ情報を取得
            groupId: tasks.taskGroupId,
            groupTitle: taskGroups.title,
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.id)) 
          // ★追加: taskGroups と JOIN
          .leftJoin(taskGroups, eq(tasks.taskGroupId, taskGroups.id))
          .where(eq(tasks.teamId, teamId))
          .orderBy(desc(tasks.createdAt));
          
        return c.json(teamTasks);
      })
    
      // 3. チームメンバー一覧の取得 (GET /api/teams/:id/members)
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
      // ★追加: チーム内のタスクグループ一覧取得
      .get("/:id/task-groups", async (c) => {
        const teamId = c.req.param("id");
        const groups = await db
            .select()
            .from(taskGroups)
            .where(eq(taskGroups.teamId, teamId))
            .orderBy(desc(taskGroups.createdAt));
        return c.json(groups);
      });