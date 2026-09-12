import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { killAction, selectPlayerAction } from "@/app/actions";
import { Countdown } from "@/components/Countdown";
import { getGame, getPlayer, getPlayerByToken, getPlayers } from "@/lib/game-service";
import { getPlayerSession } from "@/lib/session";
import { phaseLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayerNfcPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = getPlayerByToken(token);
  if (!target) notFound();

  const currentId = await getPlayerSession();
  const actor = currentId ? getPlayer(currentId) : undefined;
  const returnTo = `/nfc/player/${token}`;

  if (!actor) {
    return (
      <>
        <p className="eyebrow">Identity required</p>
        <h1>先确认你是谁</h1>
        <p className="lead">名牌已识别，但这台手机还没有本局身份。</p>
        <section className="grid">
          {getPlayers().map((player) => (
            <form action={selectPlayerAction} key={player.id}>
              <input type="hidden" name="playerId" value={player.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="identity-button" type="submit"><span>{player.name}</span><strong>选择</strong></button>
            </form>
          ))}
        </section>
      </>
    );
  }

  const game = getGame();
  const canAttempt = game.phase === "action" && actor.alive === 1 && actor.role === "bad" && target.alive === 1;

  return (
    <section className={`card nfc-target ${target.alive ? "accent" : "danger"}`}>
      <div className="nfc-icon">NFC</div>
      <p className="eyebrow">目标名牌已识别</p>
      <h1 className="target-name">{target.name}</h1>
      <p>操作者：<strong>{actor.name}</strong> · 阶段：<strong>{phaseLabels[game.phase]}</strong></p>
      {!target.alive && <p className="badge dead">目标已经死亡</p>}
      {actor.role === "bad" && <p>你的击杀冷却：<Countdown until={actor.kill_cooldown_until} /></p>}

      <form action={killAction} className="stack">
        <input type="hidden" name="targetToken" value={token} />
        <input type="hidden" name="requestKey" value={randomUUID()} />
        <input type="hidden" name="issuedAt" value={Date.now()} />
        <button className="danger full" type="submit" disabled={!canAttempt}>确认击杀 {target.name}</button>
      </form>
      {!canAttempt && <p className="muted">当前状态不满足击杀条件，服务端提交时仍会再次校验。</p>}
      <Link className="button secondary full" href="/me">返回我的状态</Link>
    </section>
  );
}
