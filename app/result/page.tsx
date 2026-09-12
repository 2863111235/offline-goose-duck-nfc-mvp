import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; message?: string; back?: string }>;
}) {
  const query = await searchParams;
  const ok = query.ok === "1";
  const back = query.back?.startsWith("/") && !query.back.startsWith("//") ? query.back : "/me";
  return (
    <section className={`card result ${ok ? "" : "fail"}`}>
      <div className="result-symbol">{ok ? "✓" : "×"}</div>
      <p className="eyebrow">{ok ? "操作成功" : "操作未生效"}</p>
      <h1>{query.message || "未知结果"}</h1>
      <div className="button-row">
        <Link className="button" href={back}>返回</Link>
        <Link className="button secondary" href="/me">我的状态</Link>
      </div>
    </section>
  );
}
