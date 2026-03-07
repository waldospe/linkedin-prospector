import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initDb();
  }
  return db;
}

function initDb() {
  if (!db) return;
  
  // Accounts table
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

  // Contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      linkedin_url TEXT,
      company TEXT,
      title TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'pending',
      pipedrive_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sequences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      steps TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      sequence_id INTEGER,
      step_number INTEGER DEFAULT 1,
      action_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      scheduled_at DATETIME,
      executed_at DATETIME,
      error TEXT,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      replied_at DATETIME,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    )
  `);

  // Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      variables TEXT DEFAULT 'firstName,company,title'
    )
  `);

  // Daily stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      connections_sent INTEGER DEFAULT 0,
      messages_sent INTEGER DEFAULT 0,
      replies_received INTEGER DEFAULT 0
    )
  `);

  // Config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      admin_password_hash TEXT,
      unipile_api_key TEXT,
      unipile_dsn TEXT,
      pipedrive_api_key TEXT,
      daily_limit INTEGER DEFAULT 20,
      message_delay_min INTEGER DEFAULT 15,
      message_delay_max INTEGER DEFAULT 20
    )
  `);

  // Insert default config
  const cfg = db.prepare('SELECT id FROM config WHERE id = 1').get();
  if (!cfg) {
    db.prepare('INSERT INTO config (id) VALUES (1)').run();
  }

  // Insert default templates
  const templates = db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number };
  if (templates.count === 0) {
    const defaultTemplates = [
      {
        name: 'Connection Request',
        subject: '',
        body: "Hi {{firstName}},\n\nI've been working in growth functions for agencies for 20 years and would love to connect with fellow agency leaders like yourself.\n\nBest,\nJeff",
        variables: 'firstName'
      },
      {
        name: 'Follow-up #1',
        subject: '',
        body: "Hey {{firstName}},\n\nWanted to reach out about helping {{company}} with growth. We've helped agencies like Reckon and Gigasavvy scale their outbound.\n\nWorth a brief conversation?\n\nJeff",
        variables: 'firstName,company'
      },
      {
        name: 'Follow-up #2',
        subject: '',
        body: "{{firstName}},\n\nQuick question - what's your biggest challenge with new business development right now?\n\nWe've been solving this for agencies and I'd love to share what's working.\n\nJeff",
        variables: 'firstName'
      }
    ];
    
    const insert = db.prepare('INSERT INTO templates (name, subject, body, variables) VALUES (?, ?, ?, ?)');
    for (const t of defaultTemplates) {
      insert.run(t.name, t.subject, t.body, t.variables);
    }
  }
}

// Account operations
export const accounts = {
  getAll: () => {
    return getDb().prepare('SELECT * FROM accounts ORDER BY connected_at DESC').all();
  },
  getByUnipileId: (id: string) => {
    return getDb().prepare('SELECT * FROM accounts WHERE unipile_account_id = ?').get(id);
  },
  create: (data: { unipile_account_id: string; name: string }) => {
    return getDb().prepare('INSERT INTO accounts (unipile_account_id, name) VALUES (?, ?)')
      .run(data.unipile_account_id, data.name);
  },
  updateStatus: (id: string, status: string) => {
    return getDb().prepare('UPDATE accounts SET status = ?, last_check = CURRENT_TIMESTAMP WHERE unipile_account_id = ?')
      .run(status, id);
  }
};

// Contact operations
export const contacts = {
  getAll: () => {
    return getDb().prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  },
  getById: (id: number) => {
    return getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  },
  getByStatus: (status: string) => {
    return getDb().prepare('SELECT * FROM contacts WHERE status = ?').all(status);
  },
  create: (data: { name: string; linkedin_url?: string; company?: string; title?: string; source?: string; pipedrive_id?: string }) => {
    return getDb().prepare(`
      INSERT INTO contacts (name, linkedin_url, company, title, source, pipedrive_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.name, data.linkedin_url || '', data.company || '', data.title || '', data.source || 'manual', data.pipedrive_id || null);
  },
  updateStatus: (id: number, status: string) => {
    return getDb().prepare('UPDATE contacts SET status = ? WHERE id = ?').run(status, id);
  },
  delete: (id: number) => {
    return getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id);
  }
};

// Sequence operations
export const sequences = {
  getAll: () => {
    return getDb().prepare('SELECT * FROM sequences ORDER BY created_at DESC').all();
  },
  getById: (id: number) => {
    return getDb().prepare('SELECT * FROM sequences WHERE id = ?').get(id);
  },
  create: (name: string, steps: any[]) => {
    return getDb().prepare('INSERT INTO sequences (name, steps) VALUES (?, ?)')
      .run(name, JSON.stringify(steps));
  },
  update: (id: number, name: string, steps: any[], active: boolean) => {
    return getDb().prepare('UPDATE sequences SET name = ?, steps = ?, active = ? WHERE id = ?')
      .run(name, JSON.stringify(steps), active ? 1 : 0, id);
  },
  delete: (id: number) => {
    return getDb().prepare('DELETE FROM sequences WHERE id = ?').run(id);
  }
};

// Queue operations
export const queue = {
  getAll: () => {
    return getDb().prepare(`
      SELECT q.*, c.name as contact_name, c.linkedin_url, s.name as sequence_name
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sequences s ON q.sequence_id = s.id
      ORDER BY q.scheduled_at
    `).all();
  },
  getPending: () => {
    return getDb().prepare(`
      SELECT q.*, c.name as contact_name, c.linkedin_url, s.name as sequence_name
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN sequences s ON q.sequence_id = s.id
      WHERE q.status = 'pending'
      ORDER BY q.scheduled_at
    `).all();
  },
  create: (data: { contact_id: number; sequence_id?: number; step_number?: number; action_type: string; scheduled_at?: string }) => {
    return getDb().prepare(`
      INSERT INTO queue (contact_id, sequence_id, step_number, action_type, scheduled_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.contact_id, data.sequence_id || null, data.step_number || 1, data.action_type, data.scheduled_at || null);
  },
  updateStatus: (id: number, status: string, error?: string) => {
    if (error) {
      return getDb().prepare('UPDATE queue SET status = ?, error = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, error, id);
    }
    if (status === 'completed') {
      return getDb().prepare('UPDATE queue SET status = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, id);
    }
    return getDb().prepare('UPDATE queue SET status = ? WHERE id = ?').run(status, id);
  }
};

// Message operations
export const messages = {
  getAll: () => {
    return getDb().prepare(`
      SELECT m.*, c.name as contact_name
      FROM messages m
      JOIN contacts c ON m.contact_id = c.id
      ORDER BY m.sent_at DESC
    `).all();
  },
  create: (data: { contact_id: number; content: string }) => {
    return getDb().prepare('INSERT INTO messages (contact_id, content) VALUES (?, ?)')
      .run(data.contact_id, data.content);
  },
  markReplied: (contactId: number) => {
    return getDb().prepare(`
      UPDATE messages SET replied_at = CURRENT_TIMESTAMP 
      WHERE contact_id = ? AND replied_at IS NULL
    `).run(contactId);
  }
};

// Template operations
export const templates = {
  getAll: () => {
    return getDb().prepare('SELECT * FROM templates ORDER BY name').all();
  },
  getById: (id: number) => {
    return getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id);
  },
  create: (data: { name: string; subject?: string; body: string; variables?: string }) => {
    return getDb().prepare('INSERT INTO templates (name, subject, body, variables) VALUES (?, ?, ?, ?)')
      .run(data.name, data.subject || '', data.body, data.variables || 'firstName');
  },
  update: (id: number, data: { name: string; subject?: string; body: string; variables?: string }) => {
    return getDb().prepare('UPDATE templates SET name = ?, subject = ?, body = ?, variables = ? WHERE id = ?')
      .run(data.name, data.subject || '', data.body, data.variables || 'firstName', id);
  },
  delete: (id: number) => {
    return getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
  }
};

// Stats operations
export const stats = {
  getDaily: (days = 30) => {
    return getDb().prepare(`
      SELECT * FROM daily_stats 
      WHERE date >= date('now', '-${days} days')
      ORDER BY date DESC
    `).all();
  },
  getToday: () => {
    const today = new Date().toISOString().split('T')[0];
    const row = getDb().prepare('SELECT * FROM daily_stats WHERE date = ?').get(today) as any;
    if (!row) {
      getDb().prepare('INSERT OR IGNORE INTO daily_stats (date) VALUES (?)').run(today);
      return { date: today, connections_sent: 0, messages_sent: 0, replies_received: 0 };
    }
    return row;
  },
  increment: (field: 'connections_sent' | 'messages_sent' | 'replies_received') => {
    const today = new Date().toISOString().split('T')[0];
    getDb().prepare('INSERT OR IGNORE INTO daily_stats (date) VALUES (?)').run(today);
    getDb().prepare(`UPDATE daily_stats SET ${field} = ${field} + 1 WHERE date = ?`).run(today);
  }
};

// Config operations
export const config = {
  get: () => {
    return getDb().prepare('SELECT * FROM config WHERE id = 1').get();
  },
  update: (data: any) => {
    const fields = Object.entries(data).filter(([_, v]) => v !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
    const values = fields.map(([_, v]) => v);
    return getDb().prepare(`UPDATE config SET ${setClause} WHERE id = 1`).run(...values);
  },
  setPassword: (hash: string) => {
    return getDb().prepare('UPDATE config SET admin_password_hash = ? WHERE id = 1').run(hash);
  }
};
