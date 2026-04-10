import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

function getTodayInTimezone(timezone?: string): string {
  if (!timezone) return new Date().toISOString().split('T')[0];
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

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
    db.exec('INSERT INTO schema_version (version) VALUES (13)');
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

  if (currentVersion === 7) {
    // v7 -> v8: Add A/B testing columns to queue
    const qCols = db.pragma('table_info(queue)') as any[];
    if (qCols && !qCols.find((c: any) => c.name === 'template_variant')) {
      db.exec(`ALTER TABLE queue ADD COLUMN template_variant TEXT`);
    }
    db.exec('UPDATE schema_version SET version = 8');
  }

  if (currentVersion === 8) {
    const cCols = db.pragma('table_info(contacts)') as any[];
    if (cCols && !cCols.find((c: any) => c.name === 'avatar_url')) {
      db.exec(`ALTER TABLE contacts ADD COLUMN avatar_url TEXT`);
    }
    db.exec('UPDATE schema_version SET version = 9');
  }

  if (currentVersion === 9) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6B7280',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, name)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS contact_labels (
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (contact_id, label_id)
      )
    `);
    db.exec('UPDATE schema_version SET version = 10');
  }

  if (currentVersion === 10) {
    // Add email preference + last_login columns to users
    const uCols = db.pragma('table_info(users)') as any[];
    if (uCols && !uCols.find((c: any) => c.name === 'last_login')) {
      db.exec(`ALTER TABLE users ADD COLUMN last_login DATETIME`);
    }
    if (uCols && !uCols.find((c: any) => c.name === 'email_daily_digest')) {
      db.exec(`ALTER TABLE users ADD COLUMN email_daily_digest INTEGER DEFAULT 1`);
    }
    if (uCols && !uCols.find((c: any) => c.name === 'email_reply_alerts')) {
      db.exec(`ALTER TABLE users ADD COLUMN email_reply_alerts INTEGER DEFAULT 1`);
    }
    if (uCols && !uCols.find((c: any) => c.name === 'digest_send_hour')) {
      db.exec(`ALTER TABLE users ADD COLUMN digest_send_hour INTEGER DEFAULT 8`);
    }
    if (uCols && !uCols.find((c: any) => c.name === 'last_digest_sent')) {
      db.exec(`ALTER TABLE users ADD COLUMN last_digest_sent DATE`);
    }
    db.exec('UPDATE schema_version SET version = 11');
  }

  if (currentVersion === 11) {
    const uCols = db.pragma('table_info(users)') as any[];
    if (uCols && !uCols.find((c: any) => c.name === 'onboarding_schedule_confirmed')) {
      db.exec(`ALTER TABLE users ADD COLUMN onboarding_schedule_confirmed INTEGER DEFAULT 0`);
    }
    if (uCols && !uCols.find((c: any) => c.name === 'onboarding_dismissed')) {
      db.exec(`ALTER TABLE users ADD COLUMN onboarding_dismissed INTEGER DEFAULT 0`);
    }
    const tCols = db.pragma('table_info(teams)') as any[];
    if (tCols && !tCols.find((c: any) => c.name === 'max_seats')) {
      db.exec(`ALTER TABLE teams ADD COLUMN max_seats INTEGER`);
    }
    db.exec('UPDATE schema_version SET version = 12');
  }

  if (currentVersion === 12) {
    const tCols = db.pragma('table_info(teams)') as any[];
    if (tCols && !tCols.find((c: any) => c.name === 'max_seats')) {
      db.exec(`ALTER TABLE teams ADD COLUMN max_seats INTEGER`);
    }
    db.exec('UPDATE schema_version SET version = 13');
  }

  // Activity log
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Teams
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      max_seats INTEGER,
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
      last_login DATETIME,
      email_daily_digest INTEGER DEFAULT 1,
      email_reply_alerts INTEGER DEFAULT 1,
      digest_send_hour INTEGER DEFAULT 8,
      last_digest_sent DATE,
      onboarding_schedule_confirmed INTEGER DEFAULT 0,
      onboarding_dismissed INTEGER DEFAULT 0,
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
      avatar_url TEXT,
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
      template_variant TEXT,
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

  // Labels (team-scoped)
  db.exec(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6B7280',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, name)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_labels (
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, label_id)
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
  create: (name: string, maxSeats?: number) => getDb().prepare('INSERT INTO teams (name, max_seats) VALUES (?, ?)').run(name, maxSeats || null),
  getSeatCount: (teamId: number) => {
    const row = getDb().prepare('SELECT COUNT(*) as count FROM users WHERE team_id = ?').get(teamId) as any;
    return row?.count || 0;
  },
};

// Users
export const users = {
  getAll: () => {
    return getDb().prepare(`
      SELECT u.id, u.name, u.email, u.role, u.team_id, u.unipile_account_id, u.pipedrive_api_key,
             u.daily_limit, u.message_delay_min, u.message_delay_max, u.send_schedule, u.timezone,
             u.last_login, u.email_daily_digest, u.email_reply_alerts, u.digest_send_hour, u.last_digest_sent,
             u.onboarding_schedule_confirmed, u.onboarding_dismissed,
             u.created_at, t.name as team_name
      FROM users u LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY t.name, u.name
    `).all().map(parseUserSchedule);
  },
  getById: (id: number) => {
    const row = getDb().prepare(`
      SELECT id, name, email, role, team_id, unipile_account_id, pipedrive_api_key,
             daily_limit, message_delay_min, message_delay_max, send_schedule, timezone,
             last_login, email_daily_digest, email_reply_alerts, digest_send_hour, last_digest_sent,
             onboarding_schedule_confirmed, onboarding_dismissed,
             created_at
      FROM users WHERE id = ?
    `).get(id);
    return row ? parseUserSchedule(row) : null;
  },
  updateLastLogin: (id: number) => {
    return getDb().prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },
  getPreviousLastLogin: (id: number): string | null => {
    const row = getDb().prepare('SELECT last_login FROM users WHERE id = ?').get(id) as any;
    return row?.last_login || null;
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
  getPaginated: (userId: number, opts: { limit: number; offset: number; status?: string; search?: string; labelIds?: number[] }) => {
    // Build WHERE clause and its params
    let where = 'WHERE c.user_id = ?';
    const whereParams: any[] = [userId];
    if (opts.status && opts.status !== 'all') { where += ' AND c.status = ?'; whereParams.push(opts.status); }
    if (opts.search) { where += ' AND (c.name LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ? OR c.title LIKE ?)'; const s = `%${opts.search}%`; whereParams.push(s, s, s, s, s); }

    // Build label JOIN and its params (bound before WHERE in SQL order)
    let labelJoin = '';
    const labelParams: any[] = [];
    if (opts.labelIds && opts.labelIds.length > 0) {
      const placeholders = opts.labelIds.map(() => '?').join(',');
      labelJoin = `INNER JOIN contact_labels clf ON clf.contact_id = c.id AND clf.label_id IN (${placeholders})`;
      labelParams.push(...opts.labelIds);
    }

    // Count query: labelJoin params come first (JOIN before WHERE in SQL)
    const countParams = [...labelParams, ...whereParams];
    const total = getDb().prepare(`SELECT COUNT(DISTINCT c.id) as count FROM contacts c ${labelJoin} ${where}`).get(...countParams) as any;

    // Rows query: subquery userId, then labelJoin params, then WHERE params, then LIMIT/OFFSET
    const rowParams = [userId, ...labelParams, ...whereParams, opts.limit, opts.offset];
    const rows = getDb().prepare(`
      SELECT DISTINCT c.*, sq.sequence_name, sq.sequence_id as active_sequence_id FROM contacts c
      LEFT JOIN (
        SELECT q.contact_id, s.name as sequence_name, q.sequence_id,
          ROW_NUMBER() OVER (PARTITION BY q.contact_id ORDER BY q.id DESC) as rn
        FROM queue q
        JOIN sequences s ON q.sequence_id = s.id
        WHERE q.user_id = ?
      ) sq ON sq.contact_id = c.id AND sq.rn = 1
      ${labelJoin}
      ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?
    `).all(...rowParams);

    // Attach labels to each contact
    if (rows.length > 0) {
      const contactIds = rows.map((r: any) => r.id);
      const allLabels = contactLabels.getByContacts(contactIds);
      const labelMap = new Map<number, any[]>();
      for (const lbl of allLabels as any[]) {
        if (!labelMap.has(lbl.contact_id)) labelMap.set(lbl.contact_id, []);
        labelMap.get(lbl.contact_id)!.push({ id: lbl.id, name: lbl.name, color: lbl.color });
      }
      for (const row of rows as any[]) {
        row.labels = labelMap.get(row.id) || [];
      }
    }

    return { rows, total: total.count };
  },
  getMatchingIds: (userId: number, opts: { status?: string; search?: string; labelIds?: number[] }) => {
    let where = 'WHERE c.user_id = ?';
    const whereParams: any[] = [userId];
    if (opts.status && opts.status !== 'all') { where += ' AND c.status = ?'; whereParams.push(opts.status); }
    if (opts.search) { where += ' AND (c.name LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ? OR c.title LIKE ?)'; const s = `%${opts.search}%`; whereParams.push(s, s, s, s, s); }

    let labelJoin = '';
    const labelParams: any[] = [];
    if (opts.labelIds && opts.labelIds.length > 0) {
      const placeholders = opts.labelIds.map(() => '?').join(',');
      labelJoin = `INNER JOIN contact_labels clf ON clf.contact_id = c.id AND clf.label_id IN (${placeholders})`;
      labelParams.push(...opts.labelIds);
    }

    const params = [...labelParams, ...whereParams];
    const rows = getDb().prepare(`SELECT DISTINCT c.id FROM contacts c ${labelJoin} ${where}`).all(...params) as Array<{ id: number }>;
    return rows.map(r => r.id);
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
  create: (userId: number, data: { first_name?: string; last_name?: string; name?: string; linkedin_url?: string; company?: string; title?: string; source?: string; pipedrive_id?: string; avatar_url?: string }) => {
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
      INSERT INTO contacts (user_id, first_name, last_name, name, linkedin_url, company, title, source, pipedrive_id, avatar_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(userId, fn, ln, fullName, data.linkedin_url || '', data.company || '', data.title || '', data.source || 'manual', data.pipedrive_id || null, data.avatar_url || null);
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
      ORDER BY CASE q.action_type WHEN 'message' THEN 0 ELSE 1 END, q.scheduled_at
    `).all(userId);
  },
  create: (userId: number, data: { contact_id: number; sequence_id?: number; step_number?: number; action_type: string; message_text?: string; scheduled_at?: string; template_variant?: string }) => {
    return getDb().prepare(`
      INSERT INTO queue (user_id, contact_id, sequence_id, step_number, action_type, message_text, scheduled_at, template_variant)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, data.contact_id, data.sequence_id || null, data.step_number || 1, data.action_type, data.message_text || null, data.scheduled_at || null, data.template_variant || null);
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
  getToday: (userId: number, timezone?: string) => {
    const today = getTodayInTimezone(timezone);
    const row = getDb().prepare('SELECT * FROM daily_stats WHERE date = ? AND user_id = ?').get(today, userId) as any;
    if (!row) {
      getDb().prepare('INSERT OR IGNORE INTO daily_stats (date, user_id) VALUES (?, ?)').run(today, userId);
      return { date: today, user_id: userId, connections_sent: 0, messages_sent: 0, replies_received: 0 };
    }
    return row;
  },
  getTodayTeam: (teamId?: number, timezone?: string) => {
    const today = getTodayInTimezone(timezone);
    const row = getDb().prepare(`
      SELECT ? as date, COALESCE(SUM(connections_sent),0) as connections_sent, COALESCE(SUM(messages_sent),0) as messages_sent, COALESCE(SUM(replies_received),0) as replies_received
      FROM daily_stats ds JOIN users u ON ds.user_id = u.id
      WHERE date = ? ${teamId ? 'AND u.team_id = ?' : ''}
    `).get(...(teamId ? [today, today, teamId] : [today, today])) as any;
    return row || { date: today, connections_sent: 0, messages_sent: 0, replies_received: 0 };
  },
  increment: (field: 'connections_sent' | 'messages_sent' | 'replies_received', userId: number, timezone?: string) => {
    const today = getTodayInTimezone(timezone);
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

// Activity Log
export const activityLog = {
  log: (userId: number, action: string, entityType?: string, entityId?: number, details?: string) => {
    return getDb().prepare('INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)')
      .run(userId, action, entityType || null, entityId || null, details || null);
  },
  getRecent: (limit: number = 50, userId?: number) => {
    if (userId) {
      return getDb().prepare(`
        SELECT al.*, u.name as user_name FROM activity_log al
        JOIN users u ON al.user_id = u.id
        WHERE al.user_id = ? ORDER BY al.created_at DESC LIMIT ?
      `).all(userId, limit);
    }
    return getDb().prepare(`
      SELECT al.*, u.name as user_name FROM activity_log al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT ?
    `).all(limit);
  },
};

// Labels (team-scoped tags for contacts)
export const labels = {
  getByTeam: (teamId: number) => {
    return getDb().prepare('SELECT * FROM labels WHERE team_id = ? ORDER BY name').all(teamId);
  },
  getById: (id: number, teamId: number) => {
    return getDb().prepare('SELECT * FROM labels WHERE id = ? AND team_id = ?').get(id, teamId);
  },
  create: (teamId: number, data: { name: string; color?: string }) => {
    return getDb().prepare('INSERT INTO labels (team_id, name, color) VALUES (?, ?, ?)')
      .run(teamId, data.name.trim(), data.color || '#6B7280');
  },
  update: (id: number, teamId: number, data: { name?: string; color?: string }) => {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name.trim()); }
    if (data.color !== undefined) { fields.push('color = ?'); params.push(data.color); }
    if (fields.length === 0) return;
    params.push(id, teamId);
    return getDb().prepare(`UPDATE labels SET ${fields.join(', ')} WHERE id = ? AND team_id = ?`).run(...params);
  },
  delete: (id: number, teamId: number) => {
    return getDb().prepare('DELETE FROM labels WHERE id = ? AND team_id = ?').run(id, teamId);
  },
  findOrCreate: (teamId: number, name: string, color?: string): number => {
    const trimmed = name.trim();
    const existing = getDb().prepare('SELECT id FROM labels WHERE team_id = ? AND name = ?').get(teamId, trimmed) as any;
    if (existing) return existing.id;
    const result = getDb().prepare('INSERT INTO labels (team_id, name, color) VALUES (?, ?, ?)').run(teamId, trimmed, color || '#6B7280');
    return result.lastInsertRowid as number;
  },
};

// Contact-Label associations
export const contactLabels = {
  getByContact: (contactId: number) => {
    return getDb().prepare(`
      SELECT l.* FROM labels l
      JOIN contact_labels cl ON cl.label_id = l.id
      WHERE cl.contact_id = ?
      ORDER BY l.name
    `).all(contactId);
  },
  getByContacts: (contactIds: number[]) => {
    if (contactIds.length === 0) return [];
    const placeholders = contactIds.map(() => '?').join(',');
    return getDb().prepare(`
      SELECT cl.contact_id, l.id, l.name, l.color FROM labels l
      JOIN contact_labels cl ON cl.label_id = l.id
      WHERE cl.contact_id IN (${placeholders})
      ORDER BY l.name
    `).all(...contactIds);
  },
  add: (contactId: number, labelId: number) => {
    return getDb().prepare('INSERT OR IGNORE INTO contact_labels (contact_id, label_id) VALUES (?, ?)').run(contactId, labelId);
  },
  remove: (contactId: number, labelId: number) => {
    return getDb().prepare('DELETE FROM contact_labels WHERE contact_id = ? AND label_id = ?').run(contactId, labelId);
  },
  setForContact: (contactId: number, labelIds: number[]) => {
    const db = getDb();
    db.prepare('DELETE FROM contact_labels WHERE contact_id = ?').run(contactId);
    const insert = db.prepare('INSERT OR IGNORE INTO contact_labels (contact_id, label_id) VALUES (?, ?)');
    for (const labelId of labelIds) {
      insert.run(contactId, labelId);
    }
  },
  bulkAdd: (contactIds: number[], labelId: number) => {
    const insert = getDb().prepare('INSERT OR IGNORE INTO contact_labels (contact_id, label_id) VALUES (?, ?)');
    for (const contactId of contactIds) {
      insert.run(contactId, labelId);
    }
  },
};
