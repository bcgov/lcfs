import pg from 'pg'

const { Client } = pg

export const playwrightTasks = {
  log(message) {
    console.log(message)
  },
  table(rows) {
    console.table(rows)
  },
  async clearComplianceReports() {
    const client = new Client({
      user:
        process.env.PLAYWRIGHT_DB_USER || process.env.DB_CYPRESS_USER || 'lcfs',
      host:
        process.env.PLAYWRIGHT_DB_HOST ||
        process.env.DB_CYPRESS_HOST ||
        'localhost',
      database:
        process.env.PLAYWRIGHT_DB_NAME || process.env.DB_CYPRESS_NAME || 'lcfs',
      password:
        process.env.PLAYWRIGHT_DB_PASSWORD ||
        process.env.DB_CYPRESS_PASSWORD ||
        'development_only',
      port: Number(
        process.env.PLAYWRIGHT_DB_PORT || process.env.DB_PORT || '5432'
      )
    })

    await client.connect()
    try {
      await client.query('truncate compliance_report cascade;')
      return 'Compliance reports cleared'
    } finally {
      await client.end()
    }
  }
}
