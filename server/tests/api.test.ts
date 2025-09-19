import { test, describe } from 'node:test'
import { strict as assert } from 'node:assert'
import request from 'supertest'
import app from '../src/app.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('API', async () => {
  test('register → me → logout flow', async () => {
    const email = `u${Date.now()}@ex.com`
    const res = await request(app).post('/api/auth/register').send({
      email, username: `u${Date.now()}`, password: 'password123', name: 'User'
    })
    assert.equal(res.status, 200)
    const agent = request.agent(app) // persist cookie
    await agent.post('/api/auth/login').send({ emailOrUsername: email, password: 'password123' })
    const me = await agent.get('/api/users/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.email, email)
    const out = await agent.post('/api/auth/logout')
    assert.equal(out.status, 200)
  })

  test('search users requires auth', async () => {
    const r = await request(app).get('/api/users/search?q=a')
    assert.equal(r.status, 401)
  })
})
