const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// Use a file so the tasks are still there after restarting the server.
const file = path.resolve(process.env.DB_FILE || './data/tasks.db');
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new DatabaseSync(file);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    course TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
