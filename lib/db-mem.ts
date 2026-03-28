// Multi-user in-memory database

declare global {
  var __DB_MEMORY__: {
    users: any[];
    contacts: any[];
    sequences: any[];
    queue: any[];
    templates: any[];
    stats: any[];
    settings: any[];
    nextId: number;
  } | undefined;
}

// Initialize global memory
const memory = global.__DB_MEMORY__ || {
  users: [
    { 
      id: 1, 
      name: 'Jeff', 
      email: 'jeff@moco.inc', 
      role: 'admin',
      unipile_api_key: null,
      unipile_dsn: null,
      pipedrive_api_key: null,
      daily_limit: 20,
      message_delay_min: 15,
      message_delay_max: 20,
      send_schedule: {
        mon: { enabled: true, start: '08:00', end: '17:00' },
        tue: { enabled: true, start: '08:00', end: '17:00' },
        wed: { enabled: true, start: '08:00', end: '17:00' },
        thu: { enabled: true, start: '08:00', end: '17:00' },
        fri: { enabled: true, start: '08:00', end: '17:00' },
        sat: { enabled: false, start: '08:00', end: '12:00' },
        sun: { enabled: false, start: '08:00', end: '12:00' },
      }
    }
  ],
  contacts: [] as any[],
  sequences: [] as any[],
  queue: [] as any[],
  templates: [
    { id: 1, user_id: null, name: 'Connection Request', subject: '', body: "Hi {{firstName}},\n\nI've been working in growth functions for agencies for 20 years and would love to connect with fellow agency leaders like yourself.\n\nBest,\nJeff", variables: 'firstName' },
    { id: 2, user_id: null, name: 'Follow-up #1', subject: '', body: "Hey {{firstName}},\n\nWanted to reach out about helping {{company}} with growth. We've helped agencies like Reckon and Gigasavvy scale their outbound.\n\nWorth a brief conversation?\n\nJeff", variables: 'firstName,company' },
    { id: 3, user_id: null, name: 'Follow-up #2', subject: '', body: "{{firstName}},\n\nQuick question - what's your biggest challenge with new business development right now?\n\nWe've been solving this for agencies and I'd love to share what's working.\n\nJeff", variables: 'firstName' }
  ],
  stats: [] as any[],
  settings: [],
  nextId: 4
};

if (!global.__DB_MEMORY__) {
  global.__DB_MEMORY__ = memory;
}

// Helper to get current user from cookie
type UserContext = { userId: number; role: string } | null;

// User operations
export const users = {
  getAll: () => memory.users,
  getById: (id: number) => memory.users.find(u => u.id === id),
  create: (data: any) => {
    const user = { 
      id: memory.nextId++, 
      role: 'user',
      daily_limit: 20,
      message_delay_min: 15,
      message_delay_max: 20,
      send_schedule: {
        mon: { enabled: true, start: '08:00', end: '17:00' },
        tue: { enabled: true, start: '08:00', end: '17:00' },
        wed: { enabled: true, start: '08:00', end: '17:00' },
        thu: { enabled: true, start: '08:00', end: '17:00' },
        fri: { enabled: true, start: '08:00', end: '17:00' },
        sat: { enabled: false, start: '08:00', end: '12:00' },
        sun: { enabled: false, start: '08:00', end: '12:00' },
      },
      ...data 
    };
    memory.users.push(user);
    return user;
  },
  update: (id: number, data: any) => {
    const user = memory.users.find(u => u.id === id);
    if (user) Object.assign(user, data);
    return user;
  },
  delete: (id: number) => {
    memory.users = memory.users.filter(u => u.id !== id);
  }
};

// Contact operations (filtered by user_id)
export const contacts = {
  getAll: (userId?: number) => userId ? memory.contacts.filter(c => c.user_id === userId) : memory.contacts,
  getById: (id: number, userId?: number) => {
    const c = memory.contacts.find(c => c.id === id);
    if (userId && c?.user_id !== userId) return null;
    return c;
  },
  getByStatus: (status: string, userId?: number) => {
    const filtered = memory.contacts.filter(c => c.status === status);
    return userId ? filtered.filter(c => c.user_id === userId) : filtered;
  },
  create: (data: any) => {
    const contact = { id: memory.nextId++, ...data, created_at: new Date().toISOString() };
    memory.contacts.push(contact);
    return contact;
  },
  updateStatus: (id: number, status: string, userId?: number) => {
    const c = memory.contacts.find(c => c.id === id);
    if (c && (!userId || c.user_id === userId)) c.status = status;
  },
  delete: (id: number, userId?: number) => {
    const c = memory.contacts.find(c => c.id === id);
    if (c && (!userId || c.user_id === userId)) {
      memory.contacts = memory.contacts.filter(c => c.id !== id);
    }
  }
};

// Sequence operations
export const sequences = {
  getAll: (userId?: number) => {
    const filtered = memory.sequences.filter(s => s.user_id === userId);
    // Include global templates
    return [...filtered, ...memory.sequences.filter(s => s.user_id === null)];
  },
  getById: (id: number, userId?: number) => {
    const s = memory.sequences.find(s => s.id === id);
    if (!s) return null;
    if (s.user_id === null) return s; // Global template
    if (userId && s.user_id !== userId) return null;
    return s;
  },
  create: (data: any) => {
    const seq = { 
      id: memory.nextId++, 
      ...data, 
      created_at: new Date().toISOString() 
    };
    memory.sequences.push(seq);
    return seq;
  },
  update: (id: number, data: any, userId?: number) => {
    const s = memory.sequences.find(s => s.id === id);
    if (s && s.user_id !== null && (!userId || s.user_id === userId)) {
      Object.assign(s, data);
    }
    return s;
  },
  delete: (id: number, userId?: number) => {
    const s = memory.sequences.find(s => s.id === id);
    if (s && s.user_id !== null && (!userId || s.user_id === userId)) {
      memory.sequences = memory.sequences.filter(s => s.id !== id);
    }
  }
};

// Queue operations
export const queue = {
  getAll: (userId?: number) => {
    if (!userId) return memory.queue;
    return memory.queue.filter(q => {
      const contact = memory.contacts.find(c => c.id === q.contact_id);
      return contact?.user_id === userId;
    });
  },
  getPending: (userId?: number) => {
    const pending = memory.queue.filter(q => q.status === 'pending');
    if (!userId) return pending;
    return pending.filter(q => {
      const contact = memory.contacts.find(c => c.id === q.contact_id);
      return contact?.user_id === userId;
    });
  },
  create: (data: any) => {
    const item = { id: memory.nextId++, ...data, created_at: new Date().toISOString() };
    memory.queue.push(item);
    return item;
  },
  updateStatus: (id: number, status: string, error?: string) => {
    const q = memory.queue.find(q => q.id === id);
    if (q) {
      q.status = status;
      if (error) q.error = error;
    }
  }
};

// Template operations (can be global or per-user)
export const templates = {
  getAll: (userId?: number) => {
    const userTemplates = memory.templates.filter(t => t.user_id === userId);
    const globalTemplates = memory.templates.filter(t => t.user_id === null);
    return [...globalTemplates, ...userTemplates];
  },
  getById: (id: number) => memory.templates.find(t => t.id === id),
  create: (data: any) => {
    const t = { id: memory.nextId++, ...data };
    memory.templates.push(t);
    return t;
  },
  update: (id: number, data: any, userId?: number) => {
    const t = memory.templates.find(t => t.id === id);
    if (t && (!userId || t.user_id === userId || t.user_id === null)) {
      Object.assign(t, data);
    }
    return t;
  },
  delete: (id: number, userId?: number) => {
    const t = memory.templates.find(t => t.id === id);
    if (t && t.user_id !== null && (!userId || t.user_id === userId)) {
      memory.templates = memory.templates.filter(t => t.id !== id);
    }
  }
};

// Stats operations
export const stats = {
  getDaily: (days = 30, userId?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const userStats = memory.stats.filter(s => !userId || s.user_id === userId);
    return userStats.length > 0 ? userStats : [{ date: today, user_id: userId, connections_sent: 0, messages_sent: 0, replies_received: 0 }];
  },
  getToday: (userId?: number) => {
    const today = new Date().toISOString().split('T')[0];
    let row = memory.stats.find(s => s.date === today && (!userId || s.user_id === userId));
    if (!row) {
      row = { date: today, user_id: userId, connections_sent: 0, messages_sent: 0, replies_received: 0 };
      memory.stats.push(row);
    }
    return row;
  },
  increment: (field: 'connections_sent' | 'messages_sent' | 'replies_received', userId?: number) => {
    const today = new Date().toISOString().split('T')[0];
    let row = memory.stats.find(s => s.date === today && (!userId || s.user_id === userId));
    if (!row) {
      row = { date: today, user_id: userId, connections_sent: 0, messages_sent: 0, replies_received: 0 };
      memory.stats.push(row);
    }
    row[field]++;
  }
};

// Default export
export default { users, contacts, sequences, queue, templates, stats, memory };
