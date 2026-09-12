import type Database from "better-sqlite3";
import { getDatabase } from "@/lib/db";
import {
  phases,
  type ActionResult,
  type GameRow,
  type Phase,
  type PlayerRow,
  type TaskRow,
} from "@/lib/types";

type Db = Database.Database;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function ruleConfig() {
  return {
    killCooldownMs: positiveInt(process.env.KILL_COOLDOWN_SECONDS, 300) * 1000,
    taskCooldownMs: positiveInt(process.env.TASK_COOLDOWN_SECONDS, 180) * 1000,
    confirmWindowMs: positiveInt(process.env.NFC_CONFIRM_WINDOW_SECONDS, 120) * 1000,
  };
}

function result(ok: boolean, code: string, message: string): ActionResult {
  return { ok, code, message };
}

function rememberRequest(
  db: Db,
  requestKey: string,
  kind: string,
  actionResult: ActionResult,
  now: number,
): ActionResult {
  db.prepare(
    `INSERT INTO action_requests (request_key, kind, ok, code, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(requestKey, kind, actionResult.ok ? 1 : 0, actionResult.code, actionResult.message, now);
  return actionResult;
}

function priorRequest(db: Db, requestKey: string): ActionResult | null {
  const row = db
    .prepare("SELECT ok, code, message FROM action_requests WHERE request_key = ?")
    .get(requestKey) as { ok: number; code: string; message: string } | undefined;
  return row ? { ok: row.ok === 1, code: row.code, message: row.message, duplicate: true } : null;
}

export function getGame(db: Db = getDatabase()): GameRow {
  return db.prepare("SELECT * FROM games WHERE id = 1").get() as GameRow;
}

export function getPlayers(db: Db = getDatabase()): PlayerRow[] {
  return db.prepare("SELECT * FROM players WHERE game_id = 1 ORDER BY id").all() as PlayerRow[];
}

export function getPlayer(id: number, db: Db = getDatabase()): PlayerRow | undefined {
  return db.prepare("SELECT * FROM players WHERE id = ? AND game_id = 1").get(id) as
    | PlayerRow
    | undefined;
}

export function getPlayerByToken(token: string, db: Db = getDatabase()): PlayerRow | undefined {
  return db.prepare("SELECT * FROM players WHERE nfc_token = ? AND game_id = 1").get(token) as
    | PlayerRow
    | undefined;
}

export function getTasks(db: Db = getDatabase()): TaskRow[] {
  return db.prepare("SELECT * FROM tasks WHERE game_id = 1 ORDER BY id").all() as TaskRow[];
}

export function getTaskByToken(token: string, db: Db = getDatabase()): TaskRow | undefined {
  return db.prepare("SELECT * FROM tasks WHERE nfc_token = ? AND game_id = 1").get(token) as
    | TaskRow
    | undefined;
}

export function getTaskCooldown(
  playerId: number,
  taskId: number,
  db: Db = getDatabase(),
): number {
  const row = db
    .prepare("SELECT cooldown_until FROM task_cooldowns WHERE player_id = ? AND task_id = ?")
    .get(playerId, taskId) as { cooldown_until: number } | undefined;
  return row?.cooldown_until || 0;
}

export function listPendingTasks(db: Db = getDatabase()) {
  return db
    .prepare(
      `SELECT tr.id, tr.started_at, p.name AS player_name, t.name AS task_name
       FROM task_runs tr
       JOIN players p ON p.id = tr.player_id
       JOIN tasks t ON t.id = tr.task_id
       WHERE tr.status = 'pending'
       ORDER BY tr.started_at`,
    )
    .all() as Array<{ id: number; started_at: number; player_name: string; task_name: string }>;
}

export function listEvents(limit = 80, db: Db = getDatabase()) {
  return db
    .prepare(
      `SELECT e.id, e.type, e.detail, e.created_at,
              a.name AS actor_name, target.name AS target_name, t.name AS task_name
       FROM events e
       LEFT JOIN players a ON a.id = e.actor_player_id
       LEFT JOIN players target ON target.id = e.target_player_id
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.game_id = 1
       ORDER BY e.id DESC LIMIT ?`,
    )
    .all(limit) as Array<{
      id: number;
      type: string;
      detail: string;
      created_at: number;
      actor_name: string | null;
      target_name: string | null;
      task_name: string | null;
    }>;
}

export function killPlayer(
  input: {
    actorId: number;
    targetToken: string;
    requestKey: string;
    issuedAt: number;
    now?: number;
  },
  db: Db = getDatabase(),
): ActionResult {
  const now = input.now ?? Date.now();
  const config = ruleConfig();

  return db.transaction(() => {
    const previous = priorRequest(db, input.requestKey);
    if (previous) return previous;

    const game = getGame(db);
    const actor = getPlayer(input.actorId, db);
    const target = getPlayerByToken(input.targetToken, db);

    let answer: ActionResult;
    if (!actor) answer = result(false, "ACTOR_NOT_FOUND", "请先选择本局身份");
    else if (!target) answer = result(false, "TARGET_NOT_FOUND", "这个名牌未绑定到当前场次");
    else if (now - input.issuedAt > config.confirmWindowMs || input.issuedAt > now + 5_000)
      answer = result(false, "CONFIRMATION_EXPIRED", "确认页面已过期，请重新碰触名牌");
    else if (game.phase !== "action") answer = result(false, "WRONG_PHASE", "当前不是行动阶段");
    else if (!actor.alive) answer = result(false, "ACTOR_DEAD", "你当前已死亡，不能击杀");
    else if (actor.role !== "bad") answer = result(false, "NO_PERMISSION", "你的角色没有击杀权限");
    else if (actor.id === target.id) answer = result(false, "SELF_TARGET", "不能击杀自己");
    else if (!target.alive) answer = result(false, "TARGET_DEAD", "目标已经死亡");
    else if (actor.role === target.role) answer = result(false, "SAME_TEAM", "不能击杀同阵营玩家");
    else if (actor.kill_cooldown_until > now)
      answer = result(
        false,
        "KILL_COOLDOWN",
        `击杀冷却中，还需 ${Math.ceil((actor.kill_cooldown_until - now) / 1000)} 秒`,
      );
    else {
      const changed = db
        .prepare("UPDATE players SET alive = 0 WHERE id = ? AND alive = 1")
        .run(target.id);
      if (changed.changes !== 1) {
        answer = result(false, "TARGET_DEAD", "目标刚刚已被其他玩家击杀");
      } else {
        db.prepare("UPDATE players SET kill_cooldown_until = ? WHERE id = ?").run(
          now + config.killCooldownMs,
          actor.id,
        );
        db.prepare(
          `INSERT INTO events
             (game_id, type, actor_player_id, target_player_id, detail, created_at)
           VALUES (1, 'KILL_SUCCESS', ?, ?, ?, ?)`,
        ).run(actor.id, target.id, JSON.stringify({ requestKey: input.requestKey }), now);
        answer = result(true, "KILL_SUCCESS", `击杀成功：${target.name}`);
      }
    }

    return rememberRequest(db, input.requestKey, "kill", answer, now);
  })();
}

export function startTask(
  input: {
    playerId: number;
    taskToken: string;
    requestKey: string;
    issuedAt: number;
    now?: number;
  },
  db: Db = getDatabase(),
): ActionResult {
  const now = input.now ?? Date.now();
  const config = ruleConfig();

  return db.transaction(() => {
    const previous = priorRequest(db, input.requestKey);
    if (previous) return previous;

    const game = getGame(db);
    const player = getPlayer(input.playerId, db);
    const task = getTaskByToken(input.taskToken, db);
    let answer: ActionResult;

    if (!player) answer = result(false, "PLAYER_NOT_FOUND", "请先选择本局身份");
    else if (!task) answer = result(false, "TASK_NOT_FOUND", "这个任务标签未绑定到当前场次");
    else if (now - input.issuedAt > config.confirmWindowMs || input.issuedAt > now + 5_000)
      answer = result(false, "CONFIRMATION_EXPIRED", "任务页面已过期，请重新碰触标签");
    else if (game.phase !== "action") answer = result(false, "WRONG_PHASE", "当前不是行动阶段");
    else if (!player.alive) answer = result(false, "PLAYER_DEAD", "死亡玩家不能开始任务");
    else {
      const pending = db
        .prepare(
          "SELECT id FROM task_runs WHERE player_id = ? AND task_id = ? AND status = 'pending'",
        )
        .get(player.id, task.id);
      const cooldownUntil = getTaskCooldown(player.id, task.id, db);

      if (pending) answer = result(false, "TASK_PENDING", "该任务正在等待裁判确认");
      else if (cooldownUntil > now)
        answer = result(
          false,
          "TASK_COOLDOWN",
          `该任务冷却中，还需 ${Math.ceil((cooldownUntil - now) / 1000)} 秒`,
        );
      else {
        db.prepare(
          `INSERT INTO task_runs (game_id, task_id, player_id, status, started_at)
           VALUES (1, ?, ?, 'pending', ?)`,
        ).run(task.id, player.id, now);
        db.prepare(
          `INSERT INTO events (game_id, type, actor_player_id, task_id, detail, created_at)
           VALUES (1, 'TASK_STARTED', ?, ?, ?, ?)`,
        ).run(player.id, task.id, JSON.stringify({ requestKey: input.requestKey }), now);
        answer = result(true, "TASK_STARTED", `${task.name} 已开始，请完成实体任务后等待裁判确认`);
      }
    }

    return rememberRequest(db, input.requestKey, "task", answer, now);
  })();
}

export function resolveTask(
  runId: number,
  approve: boolean,
  now = Date.now(),
  db: Db = getDatabase(),
): ActionResult {
  return db.transaction(() => {
    const run = db
      .prepare(
        `SELECT tr.*, p.name AS player_name, t.name AS task_name
         FROM task_runs tr
         JOIN players p ON p.id = tr.player_id
         JOIN tasks t ON t.id = tr.task_id
         WHERE tr.id = ?`,
      )
      .get(runId) as
      | {
          id: number;
          player_id: number;
          task_id: number;
          status: string;
          player_name: string;
          task_name: string;
        }
      | undefined;

    if (!run) return result(false, "RUN_NOT_FOUND", "找不到这条任务记录");
    if (run.status !== "pending") return result(false, "RUN_RESOLVED", "这条任务已经处理过");

    const status = approve ? "completed" : "rejected";
    db.prepare("UPDATE task_runs SET status = ?, resolved_at = ? WHERE id = ?").run(status, now, run.id);

    if (approve) {
      db.prepare(
        `INSERT INTO task_cooldowns (player_id, task_id, cooldown_until)
         VALUES (?, ?, ?)
         ON CONFLICT(player_id, task_id) DO UPDATE SET cooldown_until = excluded.cooldown_until`,
      ).run(run.player_id, run.task_id, now + ruleConfig().taskCooldownMs);
    }

    db.prepare(
      `INSERT INTO events (game_id, type, actor_player_id, task_id, detail, created_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
    ).run(
      approve ? "TASK_COMPLETED" : "TASK_REJECTED",
      run.player_id,
      run.task_id,
      JSON.stringify({ runId }),
      now,
    );

    return result(
      true,
      approve ? "TASK_COMPLETED" : "TASK_REJECTED",
      approve ? `${run.player_name} 完成了 ${run.task_name}` : `${run.player_name} 的任务未通过`,
    );
  })();
}

export function setPhase(phase: Phase, now = Date.now(), db: Db = getDatabase()): ActionResult {
  if (!phases.includes(phase)) return result(false, "INVALID_PHASE", "未知阶段");
  db.transaction(() => {
    db.prepare("UPDATE games SET phase = ?, updated_at = ? WHERE id = 1").run(phase, now);
    db.prepare(
      "INSERT INTO events (game_id, type, detail, created_at) VALUES (1, 'PHASE_CHANGED', ?, ?)",
    ).run(JSON.stringify({ phase }), now);
  })();
  return result(true, "PHASE_CHANGED", `阶段已切换为 ${phase}`);
}

export function resetGame(now = Date.now(), db: Db = getDatabase()): ActionResult {
  db.transaction(() => {
    db.prepare("DELETE FROM action_requests").run();
    db.prepare("DELETE FROM task_cooldowns").run();
    db.prepare("DELETE FROM task_runs").run();
    db.prepare("DELETE FROM events").run();
    db.prepare("UPDATE players SET alive = 1, kill_cooldown_until = 0 WHERE game_id = 1").run();
    db.prepare("UPDATE games SET phase = 'preparation', updated_at = ? WHERE id = 1").run(now);
    db.prepare(
      "INSERT INTO events (game_id, type, detail, created_at) VALUES (1, 'GAME_RESET', ?, ?)",
    ).run(JSON.stringify({ reason: "admin-reset" }), now);
  })();
  return result(true, "GAME_RESET", "测试局已重置");
}

export function correctPlayer(
  playerId: number,
  action: "revive" | "mark_dead" | "clear_cooldown",
  reason: string,
  now = Date.now(),
  db: Db = getDatabase(),
): ActionResult {
  const player = getPlayer(playerId, db);
  if (!player) return result(false, "PLAYER_NOT_FOUND", "找不到玩家");
  if (!reason.trim()) return result(false, "REASON_REQUIRED", "修正必须填写原因");

  db.transaction(() => {
    if (action === "revive") db.prepare("UPDATE players SET alive = 1 WHERE id = ?").run(playerId);
    else if (action === "mark_dead")
      db.prepare("UPDATE players SET alive = 0 WHERE id = ?").run(playerId);
    else db.prepare("UPDATE players SET kill_cooldown_until = 0 WHERE id = ?").run(playerId);

    db.prepare(
      `INSERT INTO events (game_id, type, target_player_id, detail, created_at)
       VALUES (1, 'ADMIN_CORRECTION', ?, ?, ?)`,
    ).run(
      playerId,
      JSON.stringify({ action, reason: reason.trim(), before: { alive: player.alive, killCooldownUntil: player.kill_cooldown_until } }),
      now,
    );
  })();
  return result(true, "PLAYER_CORRECTED", `${player.name} 的状态已修正`);
}
