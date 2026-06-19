#!/usr/bin/env node

import { Pool } from "pg"
import { db } from "./lib/db"

async function testPostgres() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
    await pool.query("SELECT 1")
    console.log("PostgreSQL: OK")
    await pool.end()
  } catch (error) {
    console.error("PostgreSQL Error:", error)
  }
}

async function testPrisma() {
  try {
    await db.$queryRaw`SELECT 1`
    console.log("Prisma: OK")
  } catch (error) {
    console.error("Prisma Error:", error)
  }
}

async function runTests() {
  await testPostgres()
  await testPrisma()
}

runTests()
