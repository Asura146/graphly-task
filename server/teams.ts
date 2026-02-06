import { Hono } from "hono";
import { db } from "@/lib/db";
import { teams,teamMembers } from "@/db/schema"
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid"
import { Env } from "@/server"
import { eq, desc } from "drizzle-orm"

const createTeamSchema = z.object({
    name: z.string().min(1,"チーム名は必須です。"),
    description: z.string().optional(),
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
      });