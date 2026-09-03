import { createPool } from './index.ts';

export async function initializeDatabase() {
  const pool = createPool();
  
  const createTablesSql = `
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(uid),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      estimated_duration INTEGER,
      actual_duration INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS task_steps (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      estimated_duration INTEGER,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS brain_dumps (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(uid),
      raw_text TEXT NOT NULL,
      organized_data JSONB,
      is_processed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memory_items (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(uid),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'note',
      is_parked BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(uid),
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      duration INTEGER NOT NULL,
      actual_duration INTEGER NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(uid),
      title TEXT NOT NULL,
      trigger_time TIMESTAMP NOT NULL,
      is_delivered BOOLEAN DEFAULT FALSE,
      is_acknowledged BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_interactions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(uid),
      interaction_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Ensure indexes for fast query performance
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_memory_items_user_id ON memory_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
  `;

  try {
    console.log("Checking and initializing database tables...");
    await pool.query(createTablesSql);
    console.log("Database tables verified and initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
    // Don't crash the server startup, but log clearly
  }
}
