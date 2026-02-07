import {
  pgTable,
  text,
  timestamp,
  boolean,
  varchar,
  integer,
  doublePrecision,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. ユーザーテーブル
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  role: text("role"),
  banned: boolean("banned"),
});

// 2. セッションテーブル
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
});

// 3. アカウントテーブル (Googleログインやパスワード情報を保持)
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
      .notNull()
      .references(() => user.id,{ onDelete: "cascade"}),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// 4. 検証テーブル (メール確認やパスワードリセット用)
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// 5. Teams Table ---
export const teams = pgTable("teams", {
  id: varchar("id", { length: 255 }).primaryKey(), // cuidやuuidを想定
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 6. Team Members Table (中間テーブル) ---
export const teamMembers = pgTable("team_members", {
  id: varchar("id", { length: 255 }).primaryKey(),
  teamId: varchar("team_id", { length: 255 })
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 })
    .notNull(), // better-authのuser.idを参照
  role: varchar("role", { length: 50 }).default("MEMBER").notNull(), // ADMIN, MEMBER
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// ★追加 9. Task Groups Table (タスクをまとめるコンテナ) ---
export const taskGroups = pgTable("task_groups", {
  id: varchar("id", { length: 255 }).primaryKey(),
  teamId: varchar("team_id", { length: 255 })
    .references(() => teams.id, { onDelete: "cascade" }), // チームに属する場合
  creatorId: varchar("creator_id", { length: 255 }).notNull(), // 個人利用の場合も考慮
  
  title: text("title").notNull(),
  description: text("description"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. Tasks Table ---
export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  // teamIdがnullの場合は「個人タスク」として扱う
  teamId: varchar("team_id", { length: 255 })
    .references(() => teams.id, { onDelete: "cascade" }),
  
  // ★追加: タスクグループへの参照
  taskGroupId: varchar("task_group_id", { length: 255 })
    .references(() => taskGroups.id, { onDelete: "set null" }),

  creatorId: varchar("creator_id", { length: 255 }).notNull(), // 作成者
  assigneeId: varchar("assignee_id", { length: 255 }), // 担当者

  title: text("title").notNull(),
  description: text("description"), // チケット裏面の詳細
  status: varchar("status", { length: 50 }).default("TODO").notNull(), // TODO, IN_PROGRESS, DONE
  dueDate: timestamp("due_date"),

  // ReactFlow用の座標データ
  positionX: doublePrecision("position_x").default(0).notNull(),
  positionY: doublePrecision("position_y").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 8. Task Dependencies Table (自己参照多対多) ---
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id", { length: 255 }).primaryKey(),
  predecessorId: varchar("predecessor_id", { length: 255 })
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  successorId: varchar("successor_id", { length: 255 })
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
}, (t) => [
  // 依存関係の重複防止（配列形式）
  unique().on(t.predecessorId, t.successorId),
]);

// --- Relations (Drizzle Relation API) ---
// クエリを書きやすくするためのリレーション定義

// 追加 relation
export const taskGroupRelations = relations(taskGroups, ({ many }) => ({
  tasks: many(tasks),
}));

export const taskRelations = relations(tasks, ({ one, many }) => ({
  team: one(teams, { fields: [tasks.teamId], references: [teams.id] }),
  taskGroup: one(taskGroups, { fields: [tasks.taskGroupId], references: [taskGroups.id] }), // 追加
  dependencies: many(taskDependencies, { relationName: "successor" }), // 自分が後続のケース
  precedents: many(taskDependencies, { relationName: "predecessor" }), // 自分が先行のケース
}));

export const taskDependencyRelations = relations(taskDependencies, ({ one }) => ({
  predecessor: one(tasks, {
    fields: [taskDependencies.predecessorId],
    references: [tasks.id],
    relationName: "predecessor",
  }),
  successor: one(tasks, {
    fields: [taskDependencies.successorId],
    references: [tasks.id],
    relationName: "successor",
  }),
}));