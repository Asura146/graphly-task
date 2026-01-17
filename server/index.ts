import { Hono } from 'hono';
import { db } from '@/db';
import { tasks } from '@/db/schema';

const app = new Hono().basePath('/api');

const route = app.get('/tasks', async (c) => {
  const allTasks = await db.select().from(tasks);
  return c.json(allTasks);
});

export type AppType = typeof route;
export default app;