import { Hono } from 'hono'

const app = new Hono().basePath('/api')

const route = app.get('/hello',(c) => {
    return c.json({ message:'Hello from Hono!' })
})

export type AppType = typeof route
export default app