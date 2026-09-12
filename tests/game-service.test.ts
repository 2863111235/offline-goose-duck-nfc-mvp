import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type Database from "better-sqlite3";
import { createDatabase } from "../lib/db";
import {
  getPlayer,
  getPlayers,
  getTaskCooldown,
  getTasks,
  killPlayer,
  resetGame,
  resolveTask,
  setPhase,
  startTask,
} from "../lib/game-service";

let db: Database.Database;
const now = 1_800_000_000_000;

beforeEach(() => {
  db = createDatabase(":memory:");
  setPhase("action", now, db);
});

afterEach(() => db.close());

test("有效击杀会让目标死亡并启动个人冷却", () => {
  const [bad, , good] = getPlayers(db);
  const response = killPlayer(
    { actorId: bad.id, targetToken: good.nfc_token, requestKey: "kill-1", issuedAt: now, now },
    db,
  );

  assert.equal(response.ok, true);
  assert.equal(getPlayer(good.id, db)?.alive, 0);
  assert.equal(getPlayer(bad.id, db)?.kill_cooldown_until, now + 300_000);
});

test("相同幂等键不会重复结算", () => {
  const [bad, , good] = getPlayers(db);
  const input = { actorId: bad.id, targetToken: good.nfc_token, requestKey: "same", issuedAt: now, now };
  const first = killPlayer(input, db);
  const second = killPlayer(input, db);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  const count = db.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'KILL_SUCCESS'").get() as { count: number };
  assert.equal(count.count, 1);
});

test("同一目标只能被成功击杀一次", () => {
  const [badOne, badTwo, good] = getPlayers(db);
  const first = killPlayer(
    { actorId: badOne.id, targetToken: good.nfc_token, requestKey: "one", issuedAt: now, now },
    db,
  );
  const second = killPlayer(
    { actorId: badTwo.id, targetToken: good.nfc_token, requestKey: "two", issuedAt: now, now },
    db,
  );
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, "TARGET_DEAD");
});

test("非行动阶段拒绝击杀", () => {
  resetGame(now, db);
  const [bad, , good] = getPlayers(db);
  const response = killPlayer(
    { actorId: bad.id, targetToken: good.nfc_token, requestKey: "wrong-phase", issuedAt: now, now },
    db,
  );
  assert.equal(response.code, "WRONG_PHASE");
  assert.equal(getPlayer(good.id, db)?.alive, 1);
});

test("任务需要裁判确认，确认后只冷却该玩家的该任务", () => {
  const [, , player, other] = getPlayers(db);
  const [task] = getTasks(db);
  const started = startTask(
    { playerId: player.id, taskToken: task.nfc_token, requestKey: "task-1", issuedAt: now, now },
    db,
  );
  assert.equal(started.ok, true);

  const run = db.prepare("SELECT id FROM task_runs WHERE status = 'pending'").get() as { id: number };
  const completed = resolveTask(run.id, true, now + 1_000, db);
  assert.equal(completed.ok, true);
  assert.equal(getTaskCooldown(player.id, task.id, db), now + 181_000);
  assert.equal(getTaskCooldown(other.id, task.id, db), 0);
});
