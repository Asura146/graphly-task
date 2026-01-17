'use client';
import { useEffect, useState } from 'react';
import { hc } from 'hono/client';
import type { AppType } from '@/server';

// 型安全なクライアントの作成
const client = hc<AppType>('/');

export default function Home() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      const res = await client.api.tasks.$get();
      const data = await res.json();
      setTasks(data);
    };
    fetchTasks();
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </main>
  );
}