import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

// Initialize database connection
function getDb() {
  return new Database(dbPath);
}

// Ensure users table exists with Google support
function initUsersTable() {
  try {
    const db = getDb();
    
    // Create table if not exists
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        password_hash TEXT,
        google_id TEXT,
        email TEXT,
        name TEXT,
        image TEXT
      )
    `).run();
    
    db.close();
  } catch (e) {
    console.error('Failed to init users table:', e);
  }
}

// Only init in production runtime, not during build
if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs') {
  initUsersTable();
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Password',
      credentials: {
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;
        
        const db = getDb();
        
        // Check for existing password-based user
        const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
        
        if (!user) {
          // First time setup - create user with this password
          const hash = bcrypt.hashSync(credentials.password, 10);
          db.prepare('INSERT INTO users (id, password_hash) VALUES (1, ?)').run(hash);
          db.close();
          return { id: '1', name: 'Admin', email: 'admin@local' };
        }
        
        // Verify password
        const userRecord = user as any;
        if (userRecord.password_hash && bcrypt.compareSync(credentials.password, userRecord.password_hash)) {
          db.close();
          return { id: '1', name: userRecord.name || 'Admin', email: userRecord.email || 'admin@local' };
        }
        
        db.close();
        return null;
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const db = getDb();
        
        // Check if user exists by Google ID
        let existingUser = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile?.sub);
        
        if (!existingUser) {
          // Check if any admin user exists (for first-time setup)
          const adminUser = db.prepare('SELECT * FROM users WHERE id = 1').get();
          
          if (!adminUser) {
            // Create new user with Google credentials
            db.prepare(`
              INSERT INTO users (id, google_id, email, name, image) 
              VALUES (1, ?, ?, ?, ?)
            `).run(profile?.sub, profile?.email, profile?.name, profile?.image);
          } else {
            // Link Google to existing admin account
            db.prepare(`
              UPDATE users 
              SET google_id = ?, email = ?, name = ?, image = ?
              WHERE id = 1
            `).run(profile?.sub, profile?.email, profile?.name, profile?.image);
          }
        }
        
        db.close();
        return true;
      }
      
      return true;
    },
    async session({ session, token }) {
      if (session?.user && token) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.provider === 'google') {
        token.provider = 'google';
      }
      return token;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
});

export { handler as GET, handler as POST };
