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

  // Pre-migration backup for safety (only if migrating)
  if (currentVersion > 0 && currentVersion < 16) {
    try {
      const backupPath = dbPath + `.pre-v${currentVersion + 1}.bak`;
      const fs = require('fs');
      if (!fs.existsSync(backupPath)) {
        db.backup(backupPath);
        console.log(`[db] Pre-migration backup: ${backupPath}`);
      }
    } catch (e: any) {
      console.error('[db] Backup failed (continuing):', e.message);
    }
  }

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

  if (currentVersion === 13) {
    // === Feature 1: Contact timeline events ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS contact_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        details TEXT,
        message_preview TEXT,
        sequence_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_contact_events_contact ON contact_events(contact_id, created_at DESC)`);

    // === Feature 2: Contact notes ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS contact_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // === Feature 3: Campaigns ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        team_id INTEGER REFERENCES teams(id),
        name TEXT NOT NULL,
        description TEXT,
        sequence_id INTEGER REFERENCES sequences(id),
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(campaign_id, contact_id)
      )
    `);

    // === Feature 5: Warmup tracking ===
    // Add warmup columns to users
    const uCols = db.pragma('table_info(users)') as any[];
    if (!uCols.find((c: any) => c.name === 'warmup_enabled')) {
      db.exec(`ALTER TABLE users ADD COLUMN warmup_enabled INTEGER DEFAULT 0`);
    }
    if (!uCols.find((c: any) => c.name === 'warmup_start_date')) {
      db.exec(`ALTER TABLE users ADD COLUMN warmup_start_date DATE`);
    }
    if (!uCols.find((c: any) => c.name === 'warmup_current_limit')) {
      db.exec(`ALTER TABLE users ADD COLUMN warmup_current_limit INTEGER`);
    }

    db.exec('UPDATE schema_version SET version = 14');
  }

  if (currentVersion === 14) {
    // Inbox handled state
    const cCols = db.pragma('table_info(contacts)') as any[];
    if (!cCols.find((c: any) => c.name === 'inbox_status')) {
      db.exec(`ALTER TABLE contacts ADD COLUMN inbox_status TEXT DEFAULT 'unread'`);
    }
    db.exec('UPDATE schema_version SET version = 15');
  }

  if (currentVersion === 15) {
    // Billing / subscriptions
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL REFERENCES teams(id),
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_subs_team ON subscriptions(team_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_subs_stripe ON subscriptions(stripe_subscription_id)`);

    // Add stripe_customer_id to teams
    const tCols = db.pragma('table_info(teams)') as any[];
    if (!tCols.find((c: any) => c.name === 'stripe_customer_id')) {
      db.exec(`ALTER TABLE teams ADD COLUMN stripe_customer_id TEXT`);
    }

    // Add retry_count to queue for auto-retry
    const qCols = db.pragma('table_info(queue)') as any[];
    if (!qCols.find((c: any) => c.name === 'retry_count')) {
      db.exec(`ALTER TABLE queue ADD COLUMN retry_count INTEGER DEFAULT 0`);
    }

    // Performance indexes for common queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(user_id, status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_user_status ON queue(user_id, status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_contact ON queue(contact_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_sequence ON queue(sequence_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON queue(user_id, status, scheduled_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date, user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_campaign_contacts ON campaign_contacts(campaign_id, contact_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON contact_notes(contact_id)`);

    db.exec('UPDATE schema_version SET version = 16');
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
  getStatsForSequences: (userId: number, seqIds: number[]) => {
    const stats: Record<number, { totalContacts: number; byStage: Record<string, number>; queueCompleted: number; queueTotal: number }> = {};
    for (const id of seqIds) stats[id] = { totalContacts: 0, byStage: {}, queueCompleted: 0, queueTotal: 0 };
    if (seqIds.length === 0) return stats;

    const placeholders = seqIds.map(() => '?').join(',');

    // Stage breakdown: distinct contacts per (sequence, status)
    const stageRows = getDb().prepare(`
      SELECT q.sequence_id, c.status, COUNT(DISTINCT c.id) as cnt
      FROM queue q
      JOIN contacts c ON c.id = q.contact_id
      WHERE q.sequence_id IN (${placeholders}) AND q.user_id = ?
      GROUP BY q.sequence_id, c.status
    `).all(...seqIds, userId) as Array<{ sequence_id: number; status: string; cnt: number }>;

    for (const row of stageRows) {
      const s = stats[row.sequence_id];
      if (!s) continue;
      s.byStage[row.status] = row.cnt;
      s.totalContacts += row.cnt;
    }

    // Queue progress per sequence (excludes paused, since paused work isn't pending toward "done")
    const progressRows = getDb().prepare(`
      SELECT sequence_id,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COUNT(*) as total
      FROM queue
      WHERE sequence_id IN (${placeholders}) AND user_id = ?
      GROUP BY sequence_id
    `).all(...seqIds, userId) as Array<{ sequence_id: number; completed: number; total: number }>;

    for (const row of progressRows) {
      const s = stats[row.sequence_id];
      if (!s) continue;
      s.queueCompleted = row.completed;
      s.queueTotal = row.total;
    }

    return stats;
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
  markRetryable: (id: number, userId: number, error: string) => {
    const MAX_RETRIES = 3;
    const item = getDb().prepare('SELECT retry_count FROM queue WHERE id = ? AND user_id = ?').get(id, userId) as any;
    const retryCount = (item?.retry_count || 0) + 1;
    if (retryCount >= MAX_RETRIES) {
      // Permanent failure after max retries
      return getDb().prepare('UPDATE queue SET status = ?, error = ?, retry_count = ? WHERE id = ? AND user_id = ?')
        .run('failed', `[permanent after ${MAX_RETRIES} retries] ${error}`, retryCount, id, userId);
    }
    // Schedule retry with exponential backoff: 5min, 15min, 45min
    const delayMs = 5 * 60 * 1000 * Math.pow(3, retryCount - 1);
    const retryAt = new Date(Date.now() + delayMs).toISOString();
    return getDb().prepare('UPDATE queue SET status = ?, error = ?, retry_count = ?, scheduled_at = ? WHERE id = ? AND user_id = ?')
      .run('pending', error, retryCount, retryAt, id, userId);
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

// ─── Contact Events (Timeline) ───────────────────────────────────

export const contactEvents = {
  log: (userId: number, contactId: number, eventType: string, details?: string, messagePreview?: string, sequenceName?: string) => {
    return getDb().prepare(`
      INSERT INTO contact_events (user_id, contact_id, event_type, details, message_preview, sequence_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, contactId, eventType, details || null, messagePreview?.slice(0, 200) || null, sequenceName || null);
  },
  getForContact: (contactId: number, limit: number = 50) => {
    return getDb().prepare(`
      SELECT ce.*, u.name as user_name FROM contact_events ce
      LEFT JOIN users u ON ce.user_id = u.id
      WHERE ce.contact_id = ?
      ORDER BY ce.created_at DESC LIMIT ?
    `).all(contactId, limit);
  },
};

// ─── Contact Notes ───────────────────────────────────────────────

export const contactNotes = {
  create: (userId: number, contactId: number, content: string) => {
    return getDb().prepare(`
      INSERT INTO contact_notes (user_id, contact_id, content)
      VALUES (?, ?, ?)
    `).run(userId, contactId, content);
  },
  getForContact: (contactId: number) => {
    return getDb().prepare(`
      SELECT cn.*, u.name as user_name FROM contact_notes cn
      LEFT JOIN users u ON cn.user_id = u.id
      WHERE cn.contact_id = ?
      ORDER BY cn.created_at DESC
    `).all(contactId);
  },
  update: (id: number, userId: number, content: string) => {
    return getDb().prepare('UPDATE contact_notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(content, id, userId);
  },
  delete: (id: number, userId: number) => {
    return getDb().prepare('DELETE FROM contact_notes WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

// ─── Campaigns ───────────────────────────────────────────────────

export const campaigns = {
  create: (userId: number, teamId: number, data: { name: string; description?: string; sequence_id?: number }) => {
    return getDb().prepare(`
      INSERT INTO campaigns (user_id, team_id, name, description, sequence_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, teamId, data.name, data.description || null, data.sequence_id || null);
  },
  getAll: (userId: number) => {
    return getDb().prepare(`
      SELECT c.*, s.name as sequence_name,
        (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id) as contact_count
      FROM campaigns c
      LEFT JOIN sequences s ON c.sequence_id = s.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(userId);
  },
  getById: (id: number, userId: number) => {
    return getDb().prepare(`
      SELECT c.*, s.name as sequence_name FROM campaigns c
      LEFT JOIN sequences s ON c.sequence_id = s.id
      WHERE c.id = ? AND c.user_id = ?
    `).get(id, userId);
  },
  update: (id: number, userId: number, data: { name?: string; description?: string; status?: string; sequence_id?: number }) => {
    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.sequence_id !== undefined) { fields.push('sequence_id = ?'); params.push(data.sequence_id); }
    params.push(id, userId);
    return getDb().prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
  },
  delete: (id: number, userId: number) => {
    return getDb().prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(id, userId);
  },
  addContacts: (campaignId: number, contactIds: number[]) => {
    const insert = getDb().prepare('INSERT OR IGNORE INTO campaign_contacts (campaign_id, contact_id) VALUES (?, ?)');
    for (const id of contactIds) insert.run(campaignId, id);
  },
  removeContact: (campaignId: number, contactId: number) => {
    return getDb().prepare('DELETE FROM campaign_contacts WHERE campaign_id = ? AND contact_id = ?').run(campaignId, contactId);
  },
  getContacts: (campaignId: number) => {
    return getDb().prepare(`
      SELECT co.* FROM contacts co
      JOIN campaign_contacts cc ON cc.contact_id = co.id
      WHERE cc.campaign_id = ?
      ORDER BY co.created_at DESC
    `).all(campaignId);
  },
  getStats: (campaignId: number, userId: number) => {
    const db = getDb();
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM campaign_contacts WHERE campaign_id = ?').get(campaignId) as any)?.cnt || 0;
    const byStatus = db.prepare(`
      SELECT co.status, COUNT(*) as cnt FROM contacts co
      JOIN campaign_contacts cc ON cc.contact_id = co.id
      WHERE cc.campaign_id = ?
      GROUP BY co.status
    `).all(campaignId) as Array<{ status: string; cnt: number }>;
    const connectedStatuses = ['connected', 'msg_sent', 'replied', 'engaged'];
    const connected = byStatus.filter(r => connectedStatuses.includes(r.status)).reduce((s, r) => s + r.cnt, 0);
    const replied = byStatus.filter(r => ['replied', 'engaged'].includes(r.status)).reduce((s, r) => s + r.cnt, 0);
    const queueStats = db.prepare(`
      SELECT
        SUM(CASE WHEN q.status = 'completed' THEN 1 ELSE 0 END) as completed,
        COUNT(*) as total
      FROM queue q
      JOIN campaign_contacts cc ON q.contact_id = cc.contact_id
      WHERE cc.campaign_id = ? AND q.user_id = ?
    `).get(campaignId, userId) as any;
    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.cnt])),
      connected,
      replied,
      replyRate: connected > 0 ? Math.round((replied / connected) * 100) : 0,
      connectRate: total > 0 ? Math.round((connected / total) * 100) : 0,
      queueCompleted: queueStats?.completed || 0,
      queueTotal: queueStats?.total || 0,
      completionPct: queueStats?.total > 0 ? Math.round((queueStats.completed / queueStats.total) * 100) : 0,
    };
  },
};

// ─── Sequence Performance Analytics ──────────────────────────────

export const sequenceAnalytics = {
  getStepPerformance: (sequenceId: number, userId: number) => {
    return getDb().prepare(`
      SELECT
        q.step_number,
        q.action_type,
        q.template_variant,
        COUNT(*) as total,
        SUM(CASE WHEN q.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN q.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN q.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM queue q
      WHERE q.sequence_id = ? AND q.user_id = ?
      GROUP BY q.step_number, q.action_type, q.template_variant
      ORDER BY q.step_number, q.template_variant
    `).all(sequenceId, userId);
  },
  getConversionFunnel: (sequenceId: number, userId: number) => {
    // How many contacts made it to each step
    return getDb().prepare(`
      SELECT
        q.step_number,
        q.action_type,
        COUNT(DISTINCT q.contact_id) as contacts,
        SUM(CASE WHEN q.status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM queue q
      WHERE q.sequence_id = ? AND q.user_id = ?
      GROUP BY q.step_number, q.action_type
      ORDER BY q.step_number
    `).all(sequenceId, userId);
  },
  getVariantPerformance: (sequenceId: number, userId: number) => {
    // For A/B testing: how does each variant perform
    const db = getDb();
    return db.prepare(`
      SELECT
        q.step_number,
        q.template_variant as variant,
        COUNT(DISTINCT q.contact_id) as sent,
        (SELECT COUNT(DISTINCT q2.contact_id) FROM queue q2
         WHERE q2.sequence_id = q.sequence_id AND q2.user_id = q.user_id
         AND q2.template_variant = q.template_variant
         AND q2.step_number = q.step_number
         AND q2.contact_id IN (
           SELECT co.id FROM contacts co WHERE co.status IN ('replied','engaged') AND co.user_id = q.user_id
         )) as replies
      FROM queue q
      WHERE q.sequence_id = ? AND q.user_id = ? AND q.template_variant IS NOT NULL
      GROUP BY q.step_number, q.template_variant
      ORDER BY q.step_number, q.template_variant
    `).all(sequenceId, userId);
  },
  getOverview: (userId: number) => {
    // Per-sequence summary for the analytics page
    return getDb().prepare(`
      SELECT
        s.id, s.name,
        COUNT(DISTINCT q.contact_id) as total_contacts,
        SUM(CASE WHEN q.status = 'completed' AND q.action_type = 'connection' THEN 1 ELSE 0 END) as invites_sent,
        SUM(CASE WHEN q.status = 'completed' AND q.action_type = 'message' THEN 1 ELSE 0 END) as messages_sent,
        (SELECT COUNT(*) FROM contacts co
         JOIN queue q2 ON co.id = q2.contact_id
         WHERE q2.sequence_id = s.id AND q2.user_id = ?
         AND co.status IN ('connected','msg_sent','replied','engaged')
         AND co.user_id = ?) as connected,
        (SELECT COUNT(*) FROM contacts co
         JOIN queue q2 ON co.id = q2.contact_id
         WHERE q2.sequence_id = s.id AND q2.user_id = ?
         AND co.status IN ('replied','engaged')
         AND co.user_id = ?) as replied
      FROM sequences s
      JOIN queue q ON q.sequence_id = s.id AND q.user_id = ?
      WHERE s.active = 1
      GROUP BY s.id
      ORDER BY total_contacts DESC
    `).all(userId, userId, userId, userId, userId);
  },
};

// ─── Warmup & Account Health ─────────────────────────────────────

export const warmup = {
  getStatus: (userId: number) => {
    const user = getDb().prepare('SELECT warmup_enabled, warmup_start_date, warmup_current_limit, daily_limit FROM users WHERE id = ?').get(userId) as any;
    if (!user || !user.warmup_enabled) return null;

    const startDate = new Date(user.warmup_start_date);
    const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    // Ramp: start at 5, increase by 3 per day, cap at daily_limit
    const targetLimit = Math.min(5 + daysSinceStart * 3, user.daily_limit);
    // Update current limit
    if (targetLimit !== user.warmup_current_limit) {
      getDb().prepare('UPDATE users SET warmup_current_limit = ? WHERE id = ?').run(targetLimit, userId);
    }
    return {
      enabled: true,
      startDate: user.warmup_start_date,
      daysSinceStart,
      currentLimit: targetLimit,
      maxLimit: user.daily_limit,
      complete: targetLimit >= user.daily_limit,
    };
  },
  enable: (userId: number) => {
    getDb().prepare('UPDATE users SET warmup_enabled = 1, warmup_start_date = date(\'now\'), warmup_current_limit = 5 WHERE id = ?').run(userId);
  },
  disable: (userId: number) => {
    getDb().prepare('UPDATE users SET warmup_enabled = 0, warmup_current_limit = NULL WHERE id = ?').run(userId);
  },
  getEffectiveLimit: (userId: number): number => {
    const user = getDb().prepare('SELECT warmup_enabled, warmup_current_limit, daily_limit FROM users WHERE id = ?').get(userId) as any;
    if (!user) return 20;
    if (user.warmup_enabled && user.warmup_current_limit) return user.warmup_current_limit;
    return user.daily_limit || 20;
  },
};

// ─── Subscriptions / Billing ─────────────────────────────────────

export const subscriptions = {
  getByTeam: (teamId: number) => {
    return getDb().prepare('SELECT * FROM subscriptions WHERE team_id = ? ORDER BY created_at DESC LIMIT 1').get(teamId) as any;
  },
  getByStripeSubscriptionId: (stripeSubId: string) => {
    return getDb().prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as any;
  },
  create: (data: { team_id: number; stripe_customer_id: string; stripe_subscription_id: string; plan: string; status: string; current_period_start?: string; current_period_end?: string }) => {
    return getDb().prepare(`
      INSERT INTO subscriptions (team_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.team_id, data.stripe_customer_id, data.stripe_subscription_id, data.plan, data.status, data.current_period_start || null, data.current_period_end || null);
  },
  update: (stripeSubId: string, data: { status?: string; plan?: string; current_period_start?: string; current_period_end?: string; cancel_at_period_end?: boolean }) => {
    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.plan !== undefined) { fields.push('plan = ?'); params.push(data.plan); }
    if (data.current_period_start) { fields.push('current_period_start = ?'); params.push(data.current_period_start); }
    if (data.current_period_end) { fields.push('current_period_end = ?'); params.push(data.current_period_end); }
    if (data.cancel_at_period_end !== undefined) { fields.push('cancel_at_period_end = ?'); params.push(data.cancel_at_period_end ? 1 : 0); }
    params.push(stripeSubId);
    return getDb().prepare(`UPDATE subscriptions SET ${fields.join(', ')} WHERE stripe_subscription_id = ?`).run(...params);
  },
  getPlanForUser: (userId: number): { plan: string; status: string; periodEnd: string | null } => {
    const user = getDb().prepare('SELECT team_id FROM users WHERE id = ?').get(userId) as any;
    if (!user?.team_id) return { plan: 'free', status: 'active', periodEnd: null };
    const sub = getDb().prepare('SELECT * FROM subscriptions WHERE team_id = ? AND status IN (\'active\',\'trialing\') ORDER BY created_at DESC LIMIT 1').get(user.team_id) as any;
    if (!sub) return { plan: 'free', status: 'active', periodEnd: null };
    return { plan: sub.plan, status: sub.status, periodEnd: sub.current_period_end };
  },
};

export const accountHealth = {
  getScore: (userId: number) => {
    const db = getDb();
    // Last 30 days stats
    const recentQueue = db.prepare(`
      SELECT
        SUM(CASE WHEN action_type = 'connection' AND status = 'completed' THEN 1 ELSE 0 END) as invites_sent,
        SUM(CASE WHEN action_type = 'connection' AND status = 'failed' THEN 1 ELSE 0 END) as invites_failed,
        SUM(CASE WHEN action_type = 'message' AND status = 'completed' THEN 1 ELSE 0 END) as messages_sent,
        SUM(CASE WHEN action_type = 'message' AND status = 'failed' THEN 1 ELSE 0 END) as messages_failed
      FROM queue WHERE user_id = ? AND executed_at >= datetime('now', '-30 days')
    `).get(userId) as any;

    const contactStats = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM contacts
      WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
      GROUP BY status
    `).all(userId) as Array<{ status: string; cnt: number }>;

    const statusMap = Object.fromEntries(contactStats.map(r => [r.status, r.cnt]));
    const invitesSent = recentQueue?.invites_sent || 0;
    const invitesFailed = recentQueue?.invites_failed || 0;
    const messagesSent = recentQueue?.messages_sent || 0;
    const messagesFailed = recentQueue?.messages_failed || 0;
    const connected = (statusMap.connected || 0) + (statusMap.msg_sent || 0) + (statusMap.replied || 0) + (statusMap.engaged || 0);
    const declined = statusMap.invite_declined || 0;
    const optedOut = statusMap.opted_out || 0;

    // Acceptance rate
    const acceptRate = invitesSent > 0 ? Math.round((connected / invitesSent) * 100) : 0;
    // Error rate
    const totalActions = invitesSent + invitesFailed + messagesSent + messagesFailed;
    const errorRate = totalActions > 0 ? Math.round(((invitesFailed + messagesFailed) / totalActions) * 100) : 0;
    // Negative signal rate
    const negativeRate = invitesSent > 0 ? Math.round(((declined + optedOut) / invitesSent) * 100) : 0;

    // Score: 100 - penalties
    let score = 100;
    if (acceptRate < 20 && invitesSent > 10) score -= 25;
    else if (acceptRate < 40 && invitesSent > 10) score -= 10;
    if (errorRate > 20) score -= 20;
    else if (errorRate > 10) score -= 10;
    if (negativeRate > 10) score -= 20;
    else if (negativeRate > 5) score -= 10;
    score = Math.max(0, Math.min(100, score));

    let level: 'excellent' | 'good' | 'caution' | 'danger' = 'excellent';
    if (score < 50) level = 'danger';
    else if (score < 70) level = 'caution';
    else if (score < 90) level = 'good';

    const warnings: string[] = [];
    if (acceptRate < 20 && invitesSent > 10) warnings.push('Very low connection acceptance rate — review your targeting or message.');
    if (errorRate > 20) warnings.push('High error rate — some messages are failing to send.');
    if (negativeRate > 10) warnings.push('High opt-out/decline rate — reduce volume or improve personalization.');
    if (invitesFailed > 5) warnings.push(`${invitesFailed} connection requests failed in the last 30 days.`);

    return {
      score, level, acceptRate, errorRate, negativeRate, warnings,
      invitesSent, connected, messagesSent, declined, optedOut,
      invitesFailed, messagesFailed,
    };
  },
};
