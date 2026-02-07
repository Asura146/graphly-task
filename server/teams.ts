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
            // 1. 招待するユーザーが存在するか確認
            const [targetUser] = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

            if (!targetUser) {
                return c.json({ error: "User not found" }, 404);
            }

            // 2. 既にメンバーになっていないか確認
            const [existingMember] = await db
                .select()
                .from(teamMembers)
                .where(and(
                    eq(teamMembers.teamId, teamId),
                    eq(teamMembers.userId, targetUser.id)
                ))
                .limit(1);

            if (existingMember) {
                return c.json({ error: "User is already a member" }, 409);
            }

            // 3. メンバーに追加
            const [newMember] = await db.insert(teamMembers).values({
                id: `tm_${nanoid()}`,
                teamId: teamId,
                userId: targetUser.id,
                role: "MEMBER",
            }).returning();

            return c.json(newMember, 201);
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
            assigneeId: tasks.assigneeId, // 追加: 担当者IDを取得
            assigneeName: users.name, // 担当者名
            // assigneeImage: users.image, // 必要であれば
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.id)) // 担当者がいない場合もあるのでLEFT JOIN
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