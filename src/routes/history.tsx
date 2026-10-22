import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { explorerTx, fetchTxStatus, fromBase, loadCampaigns, shortAddr, type Campaign } from "@/lib/stacks";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Airdrop history — Geschenk" },
      { name: "description", content: "Every airdrop you've sent with Geschenk, with live on-chain status per batch." },
      { property: "og:title", content: "Airdrop history — Geschenk" },
      { property: "og:description", content: "Every airdrop you've sent with Geschenk, with live on-chain status per batch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    const all = loadCampaigns();
    setItems(all);
    all.forEach((c) =>
      c.batches.forEach((b) => {
        if (b.txid) fetchTxStatus(c.net, b.txid).then((s) => setStatus((p) => ({ ...p, [b.txid!]: s })));
      }),
    );
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Ledger</p>
        <h1 className="text-4xl font-semibold">Airdrop history</h1>
        <p className="text-sm text-muted-foreground">Saved in this browser.</p>
      </div>
      {items === null ? null : items.length === 0 ? (
        <div className="panel p-6 text-muted-foreground">
          No airdrops yet. <Link to="/app" className="text-accent underline">Start one</Link>.
        </div>
      ) : (
        items.map((c) => (
          <div key={c.id} className="panel space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl">
                {fromBase(BigInt(c.total), c.token.decimals)} {c.token.symbol}
                <span className="ml-2 font-sans text-sm text-muted-foreground">to {c.recipients} wallets</span>
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {c.net} · {new Date(c.createdAt).toLocaleString()} · from {shortAddr(c.sender)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.batches.map((b, i) => {
                const s = b.txid ? status[b.txid] ?? "…" : "not sent";
                const tone = s === "success" ? "text-success" : s.startsWith("abort") ? "text-destructive" : "text-muted-foreground";
                return b.txid ? (
                  <a key={i} href={explorerTx(b.txid, c.net)} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 font-mono text-xs hover:border-primary">
                    #{i + 1} <span className={tone}>{s}</span>
                  </a>
                ) : (
                  <span key={i} className="rounded-full border border-dashed border-border px-3 py-1 font-mono text-xs text-muted-foreground">#{i + 1} not sent</span>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
