require('dotenv').config();
const express = require('express');
const db = require('./database');

const app = express();
app.use(express.json());

// SQLite stores completed as 0 or 1. The API returns a true/false value.
function formatTask(row) {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    completed: row.completed === 1,
    createdAt: row.created_at
  };
}

function getId(req, res) {
  const rawId = req.params.id;
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: 'The task id must be a positive whole number.' });
    return null;
  }
  return id;
}

function validateTask(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Please send a JSON object.' };
  }
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 100) {
    return { error: 'Title is required and must be 1 to 100 characters.' };
  }
  if (typeof body.course !== 'string' || !body.course.trim() || body.course.trim().length > 60) {
    return { error: 'Course is required and must be 1 to 60 characters.' };
  }
  if (body.completed !== undefined && typeof body.completed !== 'boolean') {
    return { error: 'Completed must be true or false.' };
  }
  return {
    task: {
      title: body.title.trim(),
      course: body.course.trim(),
      completed: body.completed === true ? 1 : 0
    }
  };
}

// A small message if someone opens the base URL in a browser
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Study Tasks API is running. Go to /tasks to see the tasks.' });
});

// GET /tasks - get all tasks
app.get('/tasks', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY id').all();
    res.status(200).json(rows.map(formatTask));
  } catch (error) {
    next(error);
  }
});

// GET /tasks/:id - get one task
app.get('/tasks/:id', (req, res, next) => {
  try {
    const id = getId(req, res);
    if (id === null) return;
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Task not found.' });
    res.status(200).json(formatTask(row));
  } catch (error) {
    next(error);
  }
});

// POST /tasks - create a task
app.post('/tasks', (req, res, next) => {
  try {
    const result = validateTask(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    const { title, course, completed } = result.task;
    const insert = db.prepare('INSERT INTO tasks (title, course, completed) VALUES (?, ?, ?)');
    const info = insert.run(title, course, completed);
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(formatTask(row));
  } catch (error) {
    next(error);
  }
});

// PUT /tasks/:id - replace a task's editable information
app.put('/tasks/:id', (req, res, next) => {
  try {
    const id = getId(req, res);
    if (id === null) return;
    const oldTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!oldTask) return res.status(404).json({ error: 'Task not found.' });

    const result = validateTask(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    const { title, course, completed } = result.task;
    db.prepare('UPDATE tasks SET title = ?, course = ?, completed = ? WHERE id = ?')
      .run(title, course, completed, id);
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.status(200).json(formatTask(row));
  } catch (error) {
    next(error);
  }
});

// DELETE /tasks/:id - delete a task
app.delete('/tasks/:id', (req, res, next) => {
  try {
    const id = getId(req, res);
    if (id === null) return;
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Task not found.' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// If the route does not exist
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Handle bad JSON and unexpected server/database errors
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
}

module.exports = app;
