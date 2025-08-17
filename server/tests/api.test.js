import request from 'supertest'
import app from '../src/app.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('API', () => {
  it('register → me → logout flow', async () => {
    const email = `u${Date.now()}@ex.com`
    const res = await request(app).post('/api/auth/register').send({
      email, username: `u${Date.now()}`, password: 'password123', name: 'User'
    })
    expect(res.status).toBe(200)
    const agent = request.agent(app) // persist cookie
    await agent.post('/api/auth/login').send({ emailOrUsername: email, password: 'password123' })
    const me = await agent.get('/api/users/me')
    expect(me.status).toBe(200)
    expect(me.body.email).toBe(email)
    const out = await agent.post('/api/auth/logout')
    expect(out.status).toBe(200)
  })

  it('search users requires auth', async () => {
    const r = await request(app).get('/api/users/search?q=a')
    expect(r.status).toBe(401)
  })
})