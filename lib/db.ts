import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class AppDatabase extends DatabaseSync {
  transaction<T>(operation: () => T): () => T {
    return () => {
      this.exec("BEGIN IMMEDIATE");
      try {
        const value = operation();
        this.exec("COMMIT");
        return value;
      } catch (error) {
        try {
          this.exec("ROLLBACK");
        } catch {
          // Preserve the original transaction error if rollback is unnecessary or fails.
        }
        throw error;
      }
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __gooseDuckDb: AppDatabase | undefined;
}

function token(): string {
  return randomBytes(16).toString("hex");
}

export function initializeDatabase(db: AppDatabase, filename = ":memory:"): AppDatabase {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      code TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('preparation', 'action', 'meeting', 'paused', 'ended')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('good', 'bad')),
      alive INTEGER NOT NULL DEFAULT 1 CHECK (alive IN (0, 1)),
      nfc_token TEXT NOT NULL UNIQUE,
      kill_cooldown_until INTEGER NOT NULL DEFAULT 0,
      UNIQUE (game_id, name)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      nfc_token TEXT NOT NULL UNIQUE,
      UNIQUE (game_id, name)
    );

    CREATE TABLE IF NOT EXISTS task_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      player_id INTEGER NOT NULL REFERENCES players(id),
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'rejected')),
      started_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS task_cooldowns (
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      cooldown_until INTEGER NOT NULL,
      PRIMARY KEY (player_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS action_requests (
      request_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
      code TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      actor_player_id INTEGER REFERENCES players(id),
      target_player_id INTEGER REFERENCES players(id),
      task_id INTEGER REFERENCES tasks(id),
      detail TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status, started_at);
  `);

  const existing = db.prepare("SELECT id FROM games WHERE id = 1").get();
  if (!existing) {
    const now = Date.now();
    const seed = db.transaction(() => {
      db.prepare(
        "INSERT INTO games (id, code, phase, created_at, updated_at) VALUES (1, 'TEST01', 'preparation', ?, ?)",
      ).run(now, now);

      const insertPlayer = db.prepare(
        "INSERT INTO players (game_id, name, role, nfc_token) VALUES (1, ?, ?, ?)",
      );
      insertPlayer.run("红鸭", "bad", token());
      insertPlayer.run("黄鸭", "bad", token());
      insertPlayer.run("蓝鹅", "good", token());
      insertPlayer.run("绿鹅", "good", token());

      const insertTask = db.prepare(
        "INSERT INTO tasks (game_id, name, nfc_token) VALUES (1, ?, ?)",
      );
      insertTask.run("任务点 A", token());
      insertTask.run("任务点 B", token());

      db.prepare(
        "INSERT INTO events (game_id, type, detail, created_at) VALUES (1, 'GAME_CREATED', ?, ?)",
      ).run(JSON.stringify({ source: "initial-seed" }), now);
    });
    seed();
  }

  return db;
}

export function createDatabase(filename: string): AppDatabase {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }
  return initializeDatabase(new AppDatabase(filename), filename);
}

export function getDatabase(): AppDatabase {
  if (!globalThis.__gooseDuckDb) {
    const filename = process.env.DATABASE_PATH || "./data/goose-duck.sqlite";
    globalThis.__gooseDuckDb = createDatabase(filename);
  }
  return globalThis.__gooseDuckDb;
}
