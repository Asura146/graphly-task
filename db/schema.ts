import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status').default('todo'),
  createdAt: timestamp('created_at').defaultNow(),
});