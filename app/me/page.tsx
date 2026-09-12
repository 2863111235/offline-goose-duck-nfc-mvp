import Link from "next/link";
import { clearPlayerAction } from "@/app/actions";
import { Countdown } from "@/components/Countdown";
import { getGame, getPlayer, getTasks } from "@/lib/game-service";
import { getPlayerSession } from "@/lib/session";
import { phaseLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyStatusPage() {
  const playerId = await getPlayerSession();
  const player = playerId ? getPlayer(playerId) : undefined;
  if (!player) {
    return (
      <section className="card result fail">
        <div className="result-symbol">!</div>
        <h1>尚未选择身份</h1>
        <Link className="button" href="/">返回选择</Link>
      </section>
    );
  }

  const game = getGame();
  const tasks = getTasks();
  return (
    <>
      <p className="eyebrow">Player terminal / {game.code}</p>
      <h1>{player.name}</h1>
      <p className="lead">这是你当前手机上的本局身份。测试时不要把手机转交给其他玩家。</p>

      <section className="grid">
        <article className="card accent">
          <h2>当前状态</h2>
          <div className="status-line"><span>阵营</span><span className={`badge ${player.role}`}>{player.role === "bad" ? "坏人" : "好人"}</span></div>
          <div className="status-line"><span>生命</span><span className={`badge ${player.alive ? "alive" : "dead"}`}>{player.alive ? "存活" : "已死亡"}</span></div>
          <div className="status-line"><span>阶段</span><strong>{phaseLabels[game.phase]}</strong></div>
        </article>
        <article className="card">
          <h2>击杀冷却</h2>
          {player.role === "bad" ? (
            <div className="status-value"><Countdown until={player.kill_cooldown_until} /></div>
          ) : (
            <p className="muted">你的角色没有击杀权限。</p>
          )}
        </article>
      </section>

      <section className="section card">
        <h2>无 NFC 时的测试入口</h2>
        <p className="muted">正式测试时应从实体标签打开。这里保留任务入口，方便先验证网页逻辑。</p>
        <div className="button-row">
          {tasks.map((task) => <Link className="button secondary" href={`/nfc/task/${task.nfc_token}`} key={task.id}>{task.name}</Link>)}
        </div>
      </section>

      <form action={clearPlayerAction} className="section">
        <button className="secondary" type="submit">更换身份</button>
      </form>
    </>
  );
}
