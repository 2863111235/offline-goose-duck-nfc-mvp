import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card result fail">
      <div className="result-symbol">?</div>
      <h1>标签无效</h1>
      <p className="muted">这个 NFC 地址没有绑定到当前测试局，可能是旧标签或网址写入错误。</p>
      <Link className="button" href="/">返回首页</Link>
    </section>
  );
}
