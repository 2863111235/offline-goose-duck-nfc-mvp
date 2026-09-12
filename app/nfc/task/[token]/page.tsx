import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { selectPlayerAction, startTaskAction } from "@/app/actions";
import { Countdown } from "@/components/Countdown";
import { getGame, getPlayer, getPlayers, getTaskByToken, getTaskCooldown } from "@/lib/game-service";
import { getPlayerSession } from "@/lib/session";
import { phaseLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TaskNfcPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const task = getTaskByToken(token);
  if (!task) notFound();
  const currentId = await getPlayerSession();
  const player = currentId ? getPlayer(currentId) : undefined;
  const returnTo = `/nfc/task/${token}`;

  if (!player) {
    return (
      <>
        <p className="eyebrow">Identity required</p>
        <h1>先确认你是谁</h1>
        <p className="lead">任务点已识别，但这台手机还没有本局身份。</p>
        <section className="grid">
          {getPlayers().map((item) => (
            <form action={selectPlayerAction} key={item.id}>
              <input type="hidden" name="playerId" value={item.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="identity-button" type="submit"><span>{item.name}</span><strong>{item.role === "bad" ? "坏人" : "好人"}</strong></button>
            </form>
          ))}
        </section>
      </>
    );
  }

  const game = getGame();
  const cooldownUntil = getTaskCooldown(player.id, task.id);
  const canStart = game.phase === "action" && player.alive === 1 && cooldownUntil <= Date.now();

  return (
    <section className="card nfc-target accent">
      <div className="nfc-icon">TASK</div>
      <p className="eyebrow">任务点已识别</p>
      <h1 className="target-name">{task.name}</h1>
      <p>玩家：<strong>{player.name}</strong> · 阶段：<strong>{phaseLabels[game.phase]}</strong></p>
      <p>该任务冷却：<Countdown until={cooldownUntil} /></p>
      <p className="muted">点击开始后在线下完成任务，最终结果由裁判确认。</p>
      <form action={startTaskAction} className="stack">
        <input type="hidden" name="taskToken" value={token} />
        <input type="hidden" name="requestKey" value={randomUUID()} />
        <input type="hidden" name="issuedAt" value={Date.now()} />
        <button className="full" type="submit" disabled={!canStart}>开始 {task.name}</button>
      </form>
      {!canStart && <p className="muted">当前状态不允许开始，服务端提交时仍会再次校验。</p>}
      <Link className="button secondary full" href="/me">返回我的状态</Link>
    </section>
  );
}
