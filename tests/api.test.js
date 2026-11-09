const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// Keep tests separate from the normal tasks database.
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-api-'));
const testDb = path.join(testDir, 'test.db');
process.env.DB_FILE = testDb;
const app = require('../server');

function request(base, route, method = 'GET', body) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return fetch(`${base}${route}`, options);
}

test('CRUD, validation, error responses, and database persistence', async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    let response = await request(base, '/');
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /running/);

    response = await request(base, '/tasks');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);

    response = await request(base, '/tasks', 'POST', {
      title: 'Finish React exercises', course: 'Web Development', completed: false
    });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.id, 1);
    assert.equal(created.title, 'Finish React exercises');
    assert.equal(created.completed, false);

    response = await request(base, `/tasks/${created.id}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).course, 'Web Development');

    response = await request(base, '/tasks');
    assert.equal((await response.json()).length, 1);

    response = await request(base, `/tasks/${created.id}`, 'PUT', {
      title: 'Review REST APIs', course: 'Web Development', completed: true
    });
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.equal(updated.completed, true);
    assert.equal(updated.title, 'Review REST APIs');

    // Check with another SQLite connection that the data really reached the file.
    const otherConnection = new DatabaseSync(testDb);
    const stored = otherConnection.prepare('SELECT title, completed FROM tasks WHERE id = 1').get();
    assert.equal(stored.title, 'Review REST APIs');
    assert.equal(stored.completed, 1);
    otherConnection.close();

    response = await request(base, '/tasks', 'POST', { title: '', course: 'Web Development' });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Title/);

    response = await request(base, `/tasks/${created.id}`, 'PUT', {
      title: 'Test', course: 'Web Development', completed: 'yes'
    });
    assert.equal(response.status, 400);

    response = await request(base, '/tasks', 'POST', '{broken JSON');
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /JSON/);

    response = await request(base, '/tasks/not-a-number');
    assert.equal(response.status, 400);

    response = await request(base, '/tasks/99999');
    assert.equal(response.status, 404);

    response = await request(base, '/wrong-route');
    assert.equal(response.status, 404);

    response = await request(base, `/tasks/${created.id}`, 'DELETE');
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');

    response = await request(base, `/tasks/${created.id}`);
    assert.equal(response.status, 404);

    response = await request(base, `/tasks/${created.id}`, 'DELETE');
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    require('../database').close();
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
