import { selectPlayerAction } from "@/app/actions";
import { getGame, getPlayers } from "@/lib/game-service";
import { phaseLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const game = getGame();
  const players = getPlayers();

  return (
    <>
      <p className="eyebrow">Local field test / {game.code}</p>
      <h1>选择你的身份</h1>
      <p className="lead">
        当前阶段：<strong>{phaseLabels[game.phase]}</strong>。第一次进入时选择本人；之后碰触 NFC 名牌或任务点会沿用这个身份。
      </p>

      <section className="grid" aria-label="测试玩家">
        {players.map((player) => (
          <form action={selectPlayerAction} key={player.id}>
            <input type="hidden" name="playerId" value={player.id} />
            <button className="identity-button" type="submit">
              <span>{player.name}</span>
              <strong>选择</strong>
            </button>
          </form>
        ))}
      </section>

      <section className="section card">
        <h2>测试说明</h2>
        <p className="muted">
          这是受监督的局域网 MVP。标签只存网址，所有存活、权限、冷却和任务状态都由电脑上的服务端判断。
        </p>
        <a className="button secondary" href="/admin">进入裁判台</a>
      </section>
    </>
  );
}
