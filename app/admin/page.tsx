import {
  adminLoginAction,
  correctPlayerAction,
  resetGameAction,
  resolveTaskAction,
  setPhaseAction,
} from "@/app/actions";
import { Countdown } from "@/components/Countdown";
import { getGame, getPlayers, getTasks, listEvents, listPendingTasks } from "@/lib/game-service";
import { isAdmin } from "@/lib/session";
import { phaseLabels, phases } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(timestamp);
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <section className="card result">
        <p className="eyebrow">Referee only</p>
        <h1>裁判台</h1>
        <p className="muted">测试默认 PIN 为 2468；正式使用前请在环境变量中修改。</p>
        <form action={adminLoginAction} className="stack">
          <label>裁判 PIN<input name="pin" type="password" inputMode="numeric" required autoFocus /></label>
          <button type="submit">进入裁判台</button>
        </form>
      </section>
    );
  }

  const game = getGame();
  const players = getPlayers();
  const tasks = getTasks();
  const pending = listPendingTasks();
  const events = listEvents();
  const baseUrl = (process.env.PUBLIC_BASE_URL || "http://电脑局域网IP:3000").replace(/\/$/, "");

  return (
    <>
      <p className="eyebrow">Referee console / {game.code}</p>
      <h1>裁判台</h1>
      <p className="lead">当前阶段：<strong>{phaseLabels[game.phase]}</strong>。所有修正都会写入事件记录。</p>

      <section className="card accent">
        <h2>阶段控制</h2>
        <div className="button-row">
          {phases.map((phase) => (
            <form action={setPhaseAction} key={phase}>
              <input type="hidden" name="phase" value={phase} />
              <button className={phase === game.phase ? "" : "secondary"} type="submit">{phaseLabels[phase]}</button>
            </form>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>玩家与名牌 URL</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>玩家</th><th>状态</th><th>击杀冷却</th><th>NFC 地址</th><th>现场修正</th></tr></thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td><strong>{player.name}</strong><br /><span className={`badge ${player.role}`}>{player.role === "bad" ? "坏人" : "好人"}</span></td>
                  <td><span className={`badge ${player.alive ? "alive" : "dead"}`}>{player.alive ? "存活" : "死亡"}</span></td>
                  <td><Countdown until={player.kill_cooldown_until} /></td>
                  <td className="tiny">{baseUrl}/nfc/player/{player.nfc_token}</td>
                  <td>
                    <form action={correctPlayerAction} className="stack">
                      <input type="hidden" name="playerId" value={player.id} />
                      <select name="correction" aria-label={`${player.name} 修正类型`} defaultValue="revive">
                        <option value="revive">复活</option>
                        <option value="mark_dead">标记死亡</option>
                        <option value="clear_cooldown">清除击杀冷却</option>
                      </select>
                      <input name="reason" placeholder="修正原因" required />
                      <button className="secondary" type="submit">执行修正</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section grid">
        <article className="card">
          <h2>任务点 NFC 地址</h2>
          <div className="stack">
            {tasks.map((task) => (
              <div key={task.id}><strong>{task.name}</strong><div className="tiny">{baseUrl}/nfc/task/{task.nfc_token}</div></div>
            ))}
          </div>
        </article>
        <article className="card">
          <h2>等待确认的任务</h2>
          {pending.length === 0 ? <p className="muted">暂无待确认任务。</p> : pending.map((run) => (
            <div className="event" key={run.id}>
              <strong>{run.player_name} · {run.task_name}</strong>
              <p className="tiny">开始于 {formatTime(run.started_at)}</p>
              <form action={resolveTaskAction} className="button-row">
                <input type="hidden" name="runId" value={run.id} />
                <button name="decision" value="approve" type="submit">确认完成</button>
                <button className="danger" name="decision" value="reject" type="submit">驳回</button>
              </form>
            </div>
          ))}
        </article>
      </section>

      <section className="section card">
        <h2>最近事件</h2>
        {events.map((event) => (
          <div className="event" key={event.id}>
            <div className="event-head"><span className="event-type">{event.type}</span><time>{formatTime(event.created_at)}</time></div>
            <div className="tiny">操作者：{event.actor_name || "—"} · 目标：{event.target_name || "—"} · 任务：{event.task_name || "—"}</div>
          </div>
        ))}
      </section>

      <section className="section card danger">
        <h2>重置测试局</h2>
        <p className="muted">恢复所有玩家存活、清空冷却、任务和旧事件，但保留名牌 URL。</p>
        <form action={resetGameAction}><button className="danger" type="submit">重置本局</button></form>
      </section>
    </>
  );
}
