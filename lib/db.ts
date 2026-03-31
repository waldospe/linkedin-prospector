import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb();
  }
  return db;
}

function initDb() {
  if (!db) return;

  // Schema version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  const version = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;

  const currentVersion = version?.version || 0;

  if (currentVersion < 2) {
    // Drop old v1 tables if they exist
    const oldTables = ['daily_stats', 'messages', 'queue', 'templates', 'sequences', 'contacts', 'accounts', 'config'];
    for (const t of oldTables) {
      db.exec(`DROP TABLE IF EXISTS ${t}`);
    }
    db.exec('DELETE FROM schema_version');
    db.exec('INSERT INTO schema_version (version) VALUES (7)');
  }

  if (currentVersion >= 2 && currentVersion < 4) {
    // v2 -> v3: Split name into first_name + last_name
    const cols = db.pragma('table_info(contacts)') as any[];
    if (cols && !cols.find((c: any) => c.name === 'first_name')) {
      db.exec(`ALTER TABLE contacts ADD COLUMN first_name TEXT DEFAULT ''`);
      db.exec(`ALTER TABLE contacts ADD COLUMN last_name TEXT DEFAULT ''`);
      const rows = db.prepare('SELECT id, name FROM contacts').all() as any[];
      const update = db.prepare('UPDATE contacts SET first_name = ?, last_name = ? WHERE id = ?');
      for (const row of rows) {
        const parts = (row.name || '').trim().split(/\s+/);
        update.run(parts[0] || '', parts.slice(1).join(' ') || '', row.id);
      }
    }
    // v3 -> v4: Migrate old statuses to new funnel stages
    db.exec(`UPDATE contacts SET status = 'new' WHERE status = 'pending'`);
    db.exec(`UPDATE contacts SET status = 'msg_sent' WHERE status = 'messaged'`);
    // Add message_template column to queue for resolved template text
    const qCols = db.pragma('table_info(queue)') as any[];
    if (qCols && !qCols.find((c: any) => c.name === 'message_text')) {
      db.exec(`ALTER TABLE queue ADD COLUMN message_text TEXT`);
    }
    db.exec('UPDATE schema_version SET version = 4');
  }

  if (currentVersion === 4) {
    const uCols = db.pragma('table_info(users)') as any[];
    if (uCols && !uCols.find((c: any) => c.name === 'timezone')) {
      db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'America/Los_Angeles'`);
    }
    db.exec('UPDATE schema_version SET version = 5');
  }

  if (currentVersion === 5) {
    // v5 -> v6: Add visibility + shared_with_user_ids to sequences
    const sCols = db.pragma('table_info(sequences)') as any[];
    if (sCols && !sCols.find((c: any) => c.name === 'visibility')) {
      db.exec(`ALTER TABLE sequences ADD COLUMN visibility TEXT DEFAULT 'private'`);
      db.exec(`ALTER TABLE sequences ADD COLUMN shared_with_user_ids TEXT DEFAULT ''`);
    }
    db.exec('UPDATE schema_version SET version = 6');
  }

  if (currentVersion === 6) {
    // v6 -> v7: Add invite_token and invite_status to users
    const uCols = db.pragma('table_info(users)') as any[];
    if (uCols && !uCols.find((c: any) => c.name === 'invite_token')) {
      db.exec(`ALTER TABLE users ADD COLUMN invite_token TEXT`);
      db.exec(`ALTER TABLE users ADD COLUMN invite_status TEXT DEFAULT 'active'`);
    }
    db.exec('UPDATE schema_version SET version = 7');
  }

  // Teams
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      team_id INTEGER REFERENCES teams(id),
      unipile_account_id TEXT,
      pipedrive_api_key TEXT,
      daily_limit INTEGER DEFAULT 20,
      message_delay_min INTEGER DEFAULT 15,
      message_delay_max INTEGER DEFAULT 20,
      send_schedule TEXT DEFAULT '{"mon":{"enabled":true,"start":"08:00","end":"17:00"},"tue":{"enabled":true,"start":"08:00","end":"17:00"},"wed":{"enabled":true,"start":"08:00","end":"17:00"},"thu":{"enabled":true,"start":"08:00","end":"17:00"},"fri":{"enabled":true,"start":"08:00","end":"17:00"},"sat":{"enabled":false,"start":"08:00","end":"12:00"},"sun":{"enabled":false,"start":"08:00","end":"12:00"}}',
      timezone TEXT DEFAULT 'America/Los_Angeles',
      invite_token TEXT,
      invite_status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Global config (admin-only: Unipile credentials)
  db.exec(`
    CREATE TABLE IF NOT EXISTS global_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      unipile_api_key TEXT,
      unipile_dsn TEXT DEFAULT 'api21.unipile.com:15135'
    )
  `);

  // Contacts
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      linkedin_url TEXT,
      company TEXT,
      title TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'new',
      pipedrive_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sequences
  db.exec(`
    CREATE TABLE IF NOT EXISTS sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      steps TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      visibility TEXT DEFAULT 'private',
      shared_with_user_ids TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Queue
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
      step_number INTEGER DEFAULT 1,
      action_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      message_text TEXT,
      scheduled_at DATETIME,
      executed_at DATETIME,
      error TEXT
    )
  `);

  // Messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      replied_at DATETIME
    )
  `);

  // Templates (user_id NULL = global, shared_with_team = 1 means visible to team)
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      team_id INTEGER REFERENCES teams(id),
      shared_with_team INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      variables TEXT DEFAULT 'firstName,company,title'
    )
  `);

  // Daily stats (per-user)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connections_sent INTEGER DEFAULT 0,
      messages_sent INTEGER DEFAULT 0,
      replies_received INTEGER DEFAULT 0,
      PRIMARY KEY (date, user_id)
    )
  `);

  // Unipile accounts cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unipile_account_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_check DATETIME
    )
  `);

  // Fix any contacts still stuck on old "pending" status
  db.exec(`UPDATE contacts SET status = 'new' WHERE status = 'pending'`);

  // Seed data
  seedData();
}

function seedData() {
  if (!db) return;

  // Seed team
  const teamExists = db.prepare('SELECT id FROM teams LIMIT 1').get();
  if (!teamExists) {
    db.prepare('INSERT INTO teams (name) VALUES (?)').run('Moco');
  }

  // Seed global config
  const cfgExists = db.prepare('SELECT id FROM global_config WHERE id = 1').get();
  if (!cfgExists) {
    db.prepare('INSERT INTO global_config (id) VALUES (1)').run();
  }

  // Seed users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const defaultPassword = bcrypt.hashSync('changeme', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, team_id, unipile_account_id)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    insertUser.run('Jeff', 'jeff@moco.inc', defaultPassword, 'admin', 'pending');
    insertUser.run('Andy', 'andy@moco.inc', defaultPassword, 'user', 'pending');
    insertUser.run('Robert', 'robert@moco.inc', defaultPassword, 'user', 'pending');
    insertUser.run('Kyle', 'kyle@moco.inc', defaultPassword, 'user', null);
    insertUser.run('Erin', 'erin@moco.inc', defaultPassword, 'user', null);
  }

  // Seed default templates (global, shared with team)
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number };
  if (templateCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO templates (user_id, team_id, shared_with_team, name, subject, body, variables)
      VALUES (NULL, 1, 1, ?, ?, ?, ?)
    `);
    insertTemplate.run(
      'Connection Request', '',
      "Hi {{firstName}},\n\nI've been working in growth functions for agencies for 20 years and would love to connect with fellow agency leaders like yourself.\n\nBest,\nJeff",
      'firstName'
    );
    insertTemplate.run(
      'Follow-up #1', '',
      "Hey {{firstName}},\n\nWanted to reach out about helping {{company}} with growth. We've helped agencies like Reckon and Gigasavvy scale their outbound.\n\nWorth a brief conversation?\n\nJeff",
      'firstName,company'
    );
    insertTemplate.run(
      'Follow-up #2', '',
      "{{firstName}},\n\nQuick question - what's your biggest challenge with new business development right now?\n\nWe've been solving this for agencies and I'd love to share what's working.\n\nJeff",
      'firstName'
    );
  }
}

// ============================================================
// Data access layer
// ============================================================

// Teams
export const teams = {
  getAll: () => getDb().prepare('SELECT * FROM teams ORDER BY name').all(),
  getById: (id: number) => getDb().prepare('SELECT * FROM teams WHERE id = ?').get(id),
  create: (name: string) => getDb().prepare('INSERT INTO teams (name) VALUES (?)').run(name),
};

// Users
export const users = {
  getAll: () => {
    return getDb().prepare(`
      SELECT id, name, email, role, team_id, unipile_account_id, pipedrive_api_key,
             daily_limit, message_delay_min, message_delay_max, send_schedule, timezone, created_at
      FROM users ORDER BY name
    `).all().map(parseUserSchedule);
  },
  getById: (id: number) => {
    const row = getDb().prepare(`
      SELECT id, name, email, role, team_id, unipile_account_id, pipedrive_api_key,
             daily_limit, message_delay_min, message_delay_max, send_schedule, timezone, created_at
      FROM users WHERE id = ?
    `).get(id);
    return row ? parseUserSchedule(row) : null;
  },
  getByEmail: (email: string) => {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  },
  getByTeam: (teamId: number) => {
    return getDb().prepare(`
      SELECT id, name, email, role, team_id, unipile_account_id, pipedrive_api_key,
             daily_limit, message_delay_min, message_delay_max, send_schedule, timezone, created_at
      FROM users WHERE team_id = ? ORDER BY name
    `).all(teamId).map(parseUserSchedule);
  },
  create: (data: {
    name: string; email: string; password: string; role?: string;
    team_id?: number; unipile_account_id?: string;
  }) => {
    const hash = bcrypt.hashSync(data.password, 10);
    return getDb().prepare(`
      INSERT INTO users (name, email, password_hash, role, team_id, unipile_account_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.name, data.email, hash, data.role || 'user', data.team_id || null, data.unipile_account_id || null);
  },
  update: (id: number, data: Record<string, any>) => {
    // Handle password separately
    if (data.password) {
      data.password_hash = bcrypt.hashSync(data.password, 10);
      delete data.password;
    }
    // Serialize send_schedule if it's an object
    if (data.send_schedule && typeof data.send_schedule === 'object') {
      data.send_schedule = JSON.stringify(data.send_schedule);
    }
    const fields = Object.entries(data).filter(([_, v]) => v !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
    const values = fields.map(([_, v]) => v);
    return getDb().prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, id);
  },
  delete: (id: number) => {
    return getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  },
  verifyPassword: (email: string, password: string) => {
    const user = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role, team_id: user.team_id };
  },
  createWithInvite: (data: {
    name: string; email: string; role?: string; team_id?: number;
  }) => {
    const token = crypto.randomUUID();
    const tempHash = bcrypt.hashSync(crypto.randomUUID(), 10); // placeholder password
    return {
      result: getDb().prepare(`
        INSERT INTO users (name, email, password_hash, role, team_id, invite_token, invite_status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(data.name, data.email, tempHash, data.role || 'user', data.team_id || null, token),
      token,
    };
  },
  getByInviteToken: (token: string) => {
    return getDb().prepare('SELECT * FROM users WHERE invite_token = ?').get(token) as any;
  },
  activateInvite: (token: string, password: string) => {
    const hash = bcrypt.hashSync(password, 10);
    return getDb().prepare('UPDATE users SET password_hash = ?, invite_token = NULL, invite_status = ? WHERE invite_token = ?')
      .run(hash, 'active', token);
  },
};

function parseUserSchedule(row: any) {
  if (row && row.send_schedule && typeof row.send_schedule === 'string') {
    try { row.send_schedule = JSON.parse(row.send_schedule); } catch { /* keep as string */ }
  }
  return row;
}

// Global config (admin-only)
export const globalConfig = {
  get: () => getDb().prepare('SELECT * FROM global_config WHERE id = 1').get() as any,
  update: (data: { unipile_api_key?: string; unipile_dsn?: string }) => {
    const fields = Object.entries(data).filter(([_, v]) => v !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
    const values = fields.map(([_, v]) => v);
    return getDb().prepare(`UPDATE global_config SET ${setClause} WHERE id = 1`).run(...values);
  },
};

// Contacts (always scoped to user, or all for team view)
export const contacts = {
  getAll: (userId: number) => {
    return getDb().prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  },
  getPaginated: (userId: number, opts: { limit: number; offset: number; status?: string; search?: string }) => {
    let where = 'WHERE user_id = ?';
    const params: any[] = [userId];
    if (opts.status && opts.status !== 'all') { where += ' AND status = ?'; params.push(opts.status); }
    if (opts.search) { where += ' AND (name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ? OR title LIKE ?)'; const s = `%${opts.search}%`; params.push(s, s, s, s, s); }
    const total = getDb().prepare(`SELECT COUNT(*) as count FROM contacts ${where}`).get(...params) as any;
    params.push(opts.limit, opts.offset);
    const rows = getDb().prepare(`SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params);
    return { rows, total: total.count };
  },
  getAllTeam: (teamId?: number) => {
    return getDb().prepare(`
      SELECT c.*, u.name as user_name FROM contacts c
      JOIN users u ON c.user_id = u.id
      ${teamId ? 'WHERE u.team_id = ?' : ''}
      ORDER BY c.created_at DESC
    `).all(...(teamId ? [teamId] : []));
  },
  getById: (id: number, userId: number) => {
    return getDb().prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(id, userId);
  },
  getByStatus: (status: string, userId: number) => {
    return getDb().prepare('SELECT * FROM contacts WHERE status = ? AND user_id = ?').all(status, userId);
  },
  create: (userId: number, data: { first_name?: string; last_name?: string; name?: string; linkedin_url?: string; company?: string; title?: string; source?: string; pipedrive_id?: string }) => {
    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    // Auto-generate name from first/last if not provided, or split name into first/last
    let fullName = data.name || '';
    let fn = firstName;
    let ln = lastName;
    if (fullName && !fn && !ln) {
      const parts = fullName.trim().split(/\s+/);
      fn = parts[0] || '';
      ln = parts.slice(1).join(' ') || '';
    } else if (!fullName) {
      fullName = [fn, ln].filter(Boolean).join(' ');
    }
    return getDb().prepare(`
      INSERT INTO contacts (user_id, first_name, last_name, name, linkedin_url, company, title, source, pipedrive_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(userId, fn, ln, fullName, data.linkedin_url || '', data.company || '', data.title || '', data.source || 'manual', data.pipedrive_id || null);
  },
  bulkCreate: (userId: number, rows: Array<{ first_name?: string; last_name?: string; name?: string; linkedin_url?: string; company?: string; title?: string; source?: string }>) => {
    const insert = getDb().prepare(`
      INSERT INTO contacts (user_id, first_name, last_name, name, linkedin_url, company, title, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `);
    const tx = getDb().transaction((items: typeof rows) => {
      const ids: number[] = [];
      for (const data of items) {
        let fn = data.first_name || '';
        let ln = data.last_name || '';
        let fullName = data.name || '';
        if (fullName && !fn && !ln) {
          const parts = fullName.trim().split(/\s+/);
          fn = parts[0] || '';
          ln = parts.slice(1).join(' ') || '';
        } else if (!fullName) {
          fullName = [fn, ln].filter(Boolean).join(' ');
        }
        if (!fn && !ln && !fullName) continue;
        const result = insert.run(userId, fn, ln, fullName, data.linkedin_url || '', data.company || '', data.title || '', data.source || 'import');
        ids.push(result.lastInsertRowid as number);
      }
      return ids;
    });
    return tx(rows);
  },
  update: (id: number, userId: number, data: Record<string, any>) => {
    // If first/last name changed, update full name too
    if ((data.first_name !== undefined || data.last_name !== undefined) && data.name === undefined) {
      const existing = getDb().prepare('SELECT first_name, last_name FROM contacts WHERE id = ? AND user_id = ?').get(id, userId) as any;
      if (existing) {
        const fn = data.first_name !== undefined ? data.first_name : existing.first_name;
        const ln = data.last_name !== undefined ? data.last_name : existing.last_name;
        data.name = [fn, ln].filter(Boolean).join(' ');
      }
    }
    const fields = Object.entries(data).filter(([_, v]) => v !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
    const values = fields.map(([_, v]) => v);
    return getDb().prepare(`UPDATE contacts SET ${setClause} WHERE id = ? AND user_id = ?`).run(...values, id, userId);
  },
  updateStatus: (id: number, status: string, userId: number) => {
    return getDb().prepare('UPDATE contacts SET status = ? WHERE id = ? AND user_id = ?').run(status, id, userId);
  },
  delete: (id: number, userId: number) => {
    return getDb().prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(id, userId);
  },
  getFunnelCounts: (userId: number) => {
    return getDb().prepare(`
      SELECT status, COUNT(*) as count
      FROM contacts WHERE user_id = ?
      GROUP BY status
    `).all(userId) as Array<{ status: string; count: number }>;
  },
  getFunnelCountsTeam: (teamId?: number) => {
    return getDb().prepare(`
      SELECT c.status, COUNT(*) as count
      FROM contacts c
      JOIN users u ON c.user_id = u.id
      ${teamId ? 'WHERE u.team_id = ?' : ''}
      GROUP BY c.status
    `).all(...(teamId ? [teamId] : [])) as Array<{ status: string; count: number }>;
  },
};

// Sequences (user's own + shared with them)
export const sequences = {
  getAll: (userId: number) => {
    // Return: own sequences + team-shared + specifically shared with this user
    return getDb().prepare(`
      SELECT s.*, u.name as owner_name FROM sequences s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ?
         OR s.visibility = 'team'
         OR (s.visibility = 'specific' AND (',' || s.shared_with_user_ids || ',') LIKE '%,' || ? || ',%')
      ORDER BY s.created_at DESC
    `).all(userId, String(userId));
  },
  getById: (id: number, userId?: number) => {
    // Allow access if owned, team-shared, or specifically shared
    const seq = getDb().prepare('SELECT s.*, u.name as owner_name FROM sequences s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(id) as any;
    if (!seq) return null;
    if (!userId) return seq;
    if (seq.user_id === userId) return seq;
    if (seq.visibility === 'team') return seq;
    if (seq.visibility === 'specific') {
      const ids = (seq.shared_with_user_ids || '').split(',').map((s: string) => s.trim());
      if (ids.includes(String(userId))) return seq;
    }
    return null;
  },
  create: (userId: number, name: string, steps: any[], visibility?: string, sharedWithUserIds?: string) => {
    return getDb().prepare('INSERT INTO sequences (user_id, name, steps, visibility, shared_with_user_ids) VALUES (?, ?, ?, ?, ?)')
      .run(userId, name, JSON.stringify(steps), visibility || 'private', sharedWithUserIds || '');
  },
  update: (id: number, userId: number, data: { name?: string; steps?: any[]; active?: boolean; visibility?: string; shared_with_user_ids?: string }, isAdmin?: boolean) => {
    const seq = getDb().prepare('SELECT * FROM sequences WHERE id = ?').get(id) as any;
    if (!seq) return null;
    if (!isAdmin && seq.user_id !== userId) return null;

    const updates: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.steps !== undefined) { updates.push('steps = ?'); values.push(JSON.stringify(data.steps)); }
    if (data.active !== undefined) { updates.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (data.visibility !== undefined) { updates.push('visibility = ?'); values.push(data.visibility); }
    if (data.shared_with_user_ids !== undefined) { updates.push('shared_with_user_ids = ?'); values.push(data.shared_with_user_ids); }
    if (updates.length === 0) return seq;

    values.push(id);
    getDb().prepare(`UPDATE sequences SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return getDb().prepare('SELECT * FROM sequences WHERE id = ?').get(id);
  },
  delete: (id: number, userId: number, isAdmin?: boolean) => {
    const seq = getDb().prepare('SELECT * FROM sequences WHERE id = ?').get(id) as any;
    if (!seq) return false;
    if (!isAdmin && seq.user_id !== userId) return false;
    getDb().prepare('DELETE FROM sequences WHERE id = ?').run(id);
    return true;
  },
};

// Queue (scoped to user)
export const queue = {
  getAll: (userId: number) => {
    return getDb().prepare(`
      SELECT q.*, c.name as contact_name, c.linkedin_url, c.first_name, c.last_name, c.company, c.title,
             s.name as sequence_name
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sequences s ON q.sequence_id = s.id
      WHERE q.user_id = ?
      ORDER BY q.scheduled_at
    `).all(userId);
  },
  getAllTeam: (teamId?: number) => {
    return getDb().prepare(`
      SELECT q.*, c.name as contact_name, c.linkedin_url, s.name as sequence_name, u.name as user_name
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sequences s ON q.sequence_id = s.id
      JOIN users u ON q.user_id = u.id
      ${teamId ? 'WHERE u.team_id = ?' : ''}
      ORDER BY q.scheduled_at
    `).all(...(teamId ? [teamId] : []));
  },
  getPending: (userId: number) => {
    return getDb().prepare(`
      SELECT q.*, c.name as contact_name, c.linkedin_url, c.first_name, c.last_name, c.company, c.title,
             s.name as sequence_name, s.steps as sequence_steps
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sequences s ON q.sequence_id = s.id
      WHERE q.user_id = ? AND q.status = 'pending'
      ORDER BY q.scheduled_at
    `).all(userId);
  },
  create: (userId: number, data: { contact_id: number; sequence_id?: number; step_number?: number; action_type: string; message_text?: string; scheduled_at?: string }) => {
    return getDb().prepare(`
      INSERT INTO queue (user_id, contact_id, sequence_id, step_number, action_type, message_text, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, data.contact_id, data.sequence_id || null, data.step_number || 1, data.action_type, data.message_text || null, data.scheduled_at || null);
  },
  updateStatus: (id: number, status: string, userId: number, error?: string) => {
    if (error) {
      return getDb().prepare('UPDATE queue SET status = ?, error = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .run(status, error, id, userId);
    }
    if (status === 'completed') {
      return getDb().prepare('UPDATE queue SET status = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .run(status, id, userId);
    }
    return getDb().prepare('UPDATE queue SET status = ? WHERE id = ? AND user_id = ?').run(status, id, userId);
  },
  getNextForSequence: (userId: number, contactId: number, sequenceId: number, currentStep: number) => {
    return getDb().prepare(`
      SELECT * FROM queue
      WHERE user_id = ? AND contact_id = ? AND sequence_id = ? AND step_number = ? AND status = 'pending'
    `).get(userId, contactId, sequenceId, currentStep + 1);
  },
  delete: (id: number, userId: number) => {
    return getDb().prepare('DELETE FROM queue WHERE id = ? AND user_id = ?').run(id, userId);
  },
  clearFailed: (userId: number) => {
    return getDb().prepare('DELETE FROM queue WHERE user_id = ? AND status = ?').run(userId, 'failed');
  },
  deleteByContact: (contactId: number, userId: number) => {
    return getDb().prepare('DELETE FROM queue WHERE contact_id = ? AND user_id = ?').run(contactId, userId);
  },
  getLastCompletedForContact: (userId: number, contactId: number) => {
    return getDb().prepare(`
      SELECT q.*, s.steps as sequence_steps FROM queue q
      LEFT JOIN sequences s ON q.sequence_id = s.id
      WHERE q.user_id = ? AND q.contact_id = ? AND q.status = 'completed'
      ORDER BY q.id DESC LIMIT 1
    `).get(userId, contactId) as any;
  },
};

// Messages (scoped to user)
export const messages = {
  getAll: (userId: number) => {
    return getDb().prepare(`
      SELECT m.*, c.name as contact_name
      FROM messages m
      JOIN contacts c ON m.contact_id = c.id
      WHERE m.user_id = ?
      ORDER BY m.sent_at DESC
    `).all(userId);
  },
  create: (userId: number, data: { contact_id: number; content: string }) => {
    return getDb().prepare('INSERT INTO messages (user_id, contact_id, content) VALUES (?, ?, ?)')
      .run(userId, data.contact_id, data.content);
  },
  markReplied: (contactId: number, userId: number) => {
    return getDb().prepare(`
      UPDATE messages SET replied_at = CURRENT_TIMESTAMP
      WHERE contact_id = ? AND user_id = ? AND replied_at IS NULL
    `).run(contactId, userId);
  },
};

// Templates (user's own + team shared + global)
export const templates = {
  getAll: (userId: number, teamId?: number) => {
    return getDb().prepare(`
      SELECT * FROM templates
      WHERE user_id = ?
         OR (team_id = ? AND shared_with_team = 1)
         OR user_id IS NULL
      ORDER BY name
    `).all(userId, teamId || 0);
  },
  getById: (id: number) => {
    return getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id);
  },
  create: (data: { user_id: number; team_id?: number; shared_with_team?: boolean; name: string; subject?: string; body: string; variables?: string }) => {
    return getDb().prepare(`
      INSERT INTO templates (user_id, team_id, shared_with_team, name, subject, body, variables)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.user_id, data.team_id || null, data.shared_with_team ? 1 : 0, data.name, data.subject || '', data.body, data.variables || 'firstName');
  },
  update: (id: number, userId: number, isAdmin: boolean, data: { name?: string; subject?: string; body?: string; variables?: string; shared_with_team?: boolean }) => {
    // Users can edit their own templates; admins can edit any
    const template = getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    if (!template) return null;
    if (!isAdmin && template.user_id !== userId) return null;

    const updates: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.subject !== undefined) { updates.push('subject = ?'); values.push(data.subject); }
    if (data.body !== undefined) { updates.push('body = ?'); values.push(data.body); }
    if (data.variables !== undefined) { updates.push('variables = ?'); values.push(data.variables); }
    if (data.shared_with_team !== undefined) { updates.push('shared_with_team = ?'); values.push(data.shared_with_team ? 1 : 0); }
    if (updates.length === 0) return template;

    values.push(id);
    getDb().prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id);
  },
  delete: (id: number, userId: number, isAdmin: boolean) => {
    const template = getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    if (!template) return false;
    // Global templates (user_id IS NULL) can only be deleted by admin
    if (template.user_id === null && !isAdmin) return false;
    if (!isAdmin && template.user_id !== userId) return false;
    getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
    return true;
  },
};

// Stats (per-user)
export const stats = {
  getDaily: (days: number = 30, userId: number) => {
    return getDb().prepare(`
      SELECT * FROM daily_stats
      WHERE user_id = ? AND date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `).all(userId, days);
  },
  getDailyTeam: (days: number = 30, teamId?: number) => {
    return getDb().prepare(`
      SELECT date, SUM(connections_sent) as connections_sent, SUM(messages_sent) as messages_sent, SUM(replies_received) as replies_received
      FROM daily_stats ds
      JOIN users u ON ds.user_id = u.id
      ${teamId ? 'WHERE u.team_id = ?' : ''}
      AND date >= date('now', '-' || ? || ' days')
      GROUP BY date ORDER BY date DESC
    `).all(...(teamId ? [teamId, days] : [days]));
  },
  getToday: (userId: number) => {
    const today = new Date().toISOString().split('T')[0];
    const row = getDb().prepare('SELECT * FROM daily_stats WHERE date = ? AND user_id = ?').get(today, userId) as any;
    if (!row) {
      getDb().prepare('INSERT OR IGNORE INTO daily_stats (date, user_id) VALUES (?, ?)').run(today, userId);
      return { date: today, user_id: userId, connections_sent: 0, messages_sent: 0, replies_received: 0 };
    }
    return row;
  },
  getTodayTeam: (teamId?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const row = getDb().prepare(`
      SELECT ? as date, COALESCE(SUM(connections_sent),0) as connections_sent, COALESCE(SUM(messages_sent),0) as messages_sent, COALESCE(SUM(replies_received),0) as replies_received
      FROM daily_stats ds JOIN users u ON ds.user_id = u.id
      WHERE date = ? ${teamId ? 'AND u.team_id = ?' : ''}
    `).get(...(teamId ? [today, today, teamId] : [today, today])) as any;
    return row || { date: today, connections_sent: 0, messages_sent: 0, replies_received: 0 };
  },
  increment: (field: 'connections_sent' | 'messages_sent' | 'replies_received', userId: number) => {
    const today = new Date().toISOString().split('T')[0];
    getDb().prepare('INSERT OR IGNORE INTO daily_stats (date, user_id) VALUES (?, ?)').run(today, userId);
    getDb().prepare(`UPDATE daily_stats SET ${field} = ${field} + 1 WHERE date = ? AND user_id = ?`).run(today, userId);
  },
};

// Accounts (Unipile account cache - not user-scoped)
export const accounts = {
  getAll: () => getDb().prepare('SELECT * FROM accounts ORDER BY connected_at DESC').all(),
  getByUnipileId: (id: string) => getDb().prepare('SELECT * FROM accounts WHERE unipile_account_id = ?').get(id),
  create: (data: { unipile_account_id: string; name: string }) => {
    return getDb().prepare('INSERT OR IGNORE INTO accounts (unipile_account_id, name) VALUES (?, ?)')
      .run(data.unipile_account_id, data.name);
  },
  updateStatus: (id: string, status: string) => {
    return getDb().prepare('UPDATE accounts SET status = ?, last_check = CURRENT_TIMESTAMP WHERE unipile_account_id = ?')
      .run(status, id);
  },
};
