import { loadConnect } from "@/lib/connect";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Cl, Pc } from "@stacks/transactions";
import { useWallet } from "@/lib/wallet";
import { detectCsvColumns } from "@/lib/csv-ai.functions";
import {
  BATCH_SIZE,
  CONTRACT_NAME,
  STX_CHUNK,
  STX_CONTRACT_NAME,
  TOKEN_CHUNK,
  fetchStxToken,
  isStx,
  stxAirdropContractSource,
  airdropContractSource,
  contractExists,
  explorerTx,
  fetchFtHolders,
  fetchTokenByContract,
  fetchWalletTokens,
  fromBase,
  isAddressForNet,
  saveCampaign,
  shortAddr,
  toBase,
  type Campaign,
  type Net,
  type TokenInfo,
} from "@/lib/stacks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Geschenk — Batch airdrop SIP-010 tokens on Stacks" },
      { name: "description", content: "Send any SIP-010 token to hundreds of Stacks wallets from a CSV, a pasted list or a holder snapshot." },
      { property: "og:title", content: "Geschenk — Batch airdrop SIP-010 tokens on Stacks" },
      { property: "og:description", content: "Send any SIP-010 token to hundreds of Stacks wallets from a CSV, a pasted list or a holder snapshot." },
    ],
  }),
  component: AirdropWizard,
});

type Row = { address: string; amount: bigint };
type Bad = { line: number; raw: string; reason: string };
type BatchState = { status: "idle" | "signing" | "sent" | "error"; txid?: string | undefined; error?: string | undefined };

const STEPS = ["Token", "Recipients", "Review", "Send"];

function AirdropWizard() {
  const { net, address, connect } = useWallet();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [bad, setBad] = useState<Bad[]>([]);

  // reset when network / wallet changes
  useEffect(() => {
    setStep(0);
    setToken(null);
    setRows([]);
    setBad([]);
  }, [net, address]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="eyebrow">SIP-010 batch airdrops · {net}</p>
        <h1 className="text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Give tokens to <span className="text-ribbon italic">everyone</span>, in a few signatures.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Up to {BATCH_SIZE} wallets per transaction. Every batch is all-or-nothing and protected so your wallet can't send more than the total shown.
        </p>
      </section>

      <ol className="flex gap-2 overflow-x-auto">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              i === step ? "border-primary text-foreground" : i < step ? "border-border text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] ${i <= step ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {!address ? (
        <div className="panel flex flex-col items-start gap-4 p-6">
          <h2 className="text-2xl">Connect a Stacks wallet</h2>
          <p className="text-muted-foreground">Leather, Xverse or any Stacks Connect wallet with a {net} address.</p>
          <button className="btn btn-primary" onClick={() => connect().catch(() => {})}>Connect wallet</button>
        </div>
      ) : step === 0 ? (
        <TokenStep net={net} address={address} onPick={(t) => { setToken(t); setStep(1); }} />
      ) : step === 1 && token ? (
        <RecipientsStep
          net={net}
          sender={address}
          token={token}
          onBack={() => setStep(0)}
          onDone={(r, b) => { setRows(r); setBad(b); setStep(2); }}
        />
      ) : step === 2 && token ? (
        <ReviewStep token={token} rows={rows} bad={bad} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      ) : step === 3 && token ? (
        <SendStep net={net} sender={address} token={token} rows={rows} onBack={() => setStep(2)} />
      ) : null}
    </div>
  );
}

/* ---------------------------------- Step 1 --------------------------------- */
function TokenStep({ net, address, onPick }: { net: Net; address: string; onPick: (t: TokenInfo) => void }) {
  const [tokens, setTokens] = useState<TokenInfo[] | null>(null);
  const [manual, setManual] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [stx, setStx] = useState<TokenInfo | null>(null);
  useEffect(() => {
    setTokens(null);
    setStx(null);
    fetchStxToken(net, address).then(setStx).catch(() => {});
    fetchWalletTokens(net, address).then(setTokens).catch(() => setTokens([]));
  }, [net, address]);

  async function lookup() {
    setErr("");
    if (!/^S[A-Z0-9]+\.[a-zA-Z][\w-]*$/.test(manual.trim())) return setErr("Use the format SP….token-name");
    setBusy(true);
    try {
      onPick(await fetchTokenByContract(net, manual.trim(), address));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel space-y-6 p-5 sm:p-6">
      <div>
        <h2 className="text-2xl">Which token are you giving?</h2>
        <p className="text-sm text-muted-foreground">Tokens in your wallet on {net}.</p>
      </div>
      <button
        onClick={() => stx && onPick(stx)}
        disabled={!stx}
        className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary"
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary font-mono text-xs text-primary-foreground">STX</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Stacks (STX)</div>
          <div className="text-xs text-muted-foreground">Native coin — no token contract needed</div>
        </div>
        <div className="text-right font-mono text-sm">{stx ? fromBase(stx.balance ?? 0n, 6) : "…"} <span className="text-muted-foreground">STX</span></div>
      </button>
      {tokens === null ? (
        <p className="text-sm text-muted-foreground">Loading your tokens…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No SIP-010 tokens found in this wallet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tokens.map((t) => (
            <button
              key={t.contractId}
              onClick={() => onPick(t)}
              className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary"
            >
              {t.image ? (
                <img src={t.image} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-mono text-xs">{t.symbol.slice(0, 3)}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{t.name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{shortAddr(t.contractId)}</div>
              </div>
              <div className="text-right font-mono text-sm">
                {fromBase(t.balance ?? 0n, t.decimals)} <span className="text-muted-foreground">{t.symbol}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2 border-t border-border pt-5">
        <label className="eyebrow">Or paste a token contract</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field font-mono" placeholder="SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-ghost" disabled={busy} onClick={lookup}>{busy ? "Looking up…" : "Use token"}</button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- Step 2 --------------------------------- */
function parseList(text: string, decimals: number, net: Net, sender: string, fixed?: string): { rows: Row[]; bad: Bad[] } {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true, delimiter: "" });
  const map = new Map<string, bigint>();
  const bad: Bad[] = [];
  parsed.data.forEach((cells, i) => {
    const c: string[] = cells.flatMap((x) => x.split(/\s+/)).map((x) => x.trim()).filter(Boolean);
    if (!c.length) return;
    const addr = c[0]!;
    if (i === 0 && !/^S[A-Z0-9]/i.test(addr)) return; // header row
    if (!isAddressForNet(addr, net)) { bad.push({ line: i + 1, raw: cells.join(","), reason: `Not a valid ${net} address` }); return; }
    if (addr === sender) { bad.push({ line: i + 1, raw: cells.join(","), reason: "That's your own wallet" }); return; }
    const amtStr = fixed ?? c[1];
    if (!amtStr) { bad.push({ line: i + 1, raw: cells.join(","), reason: "Missing amount" }); return; }
    const amt = toBase(amtStr, decimals);
    if (amt === null || amt <= 0n) { bad.push({ line: i + 1, raw: cells.join(","), reason: amt === null && amtStr.includes(".") && (amtStr.split(".")[1]?.length ?? 0) > decimals ? `Too many decimals (max ${decimals})` : "Invalid amount" }); return; }
    map.set(addr, (map.get(addr) ?? 0n) + amt);
  });
  return { rows: [...map].map(([address, amount]) => ({ address, amount })), bad };
}

function RecipientsStep({
  net, sender, token, onBack, onDone,
}: { net: Net; sender: string; token: TokenInfo; onBack: () => void; onDone: (r: Row[], b: Bad[]) => void }) {
  const [mode, setMode] = useState<"list" | "snapshot">("list");
  const [text, setText] = useState("");
  const [useFixed, setUseFixed] = useState(false);
  const [fixed, setFixed] = useState("");
  // snapshot
  const [snapContract, setSnapContract] = useState("");
  const [dist, setDist] = useState<"equal" | "proportional">("equal");
  const [snapAmount, setSnapAmount] = useState("");
  const [minBal, setMinBal] = useState("");
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");

  const [csv, setCsv] = useState<{ name: string; rows: string[][]; addr: number; amt: number | null; header: boolean; note: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  async function onFile(f: File) {
    setErr("");
    if (f.size > 5_000_000) return setErr("File is too large (max 5 MB).");
    const raw = await f.text();
    const rows = Papa.parse<string[]>(raw.trim(), { skipEmptyLines: true }).data.filter((r) => r.some((c) => c.trim()));
    if (!rows.length) return setErr("That file is empty.");
    const width = Math.max(...rows.map((r) => r.length));
    if (width < 2) { setText(raw); return; } // plain address list — no columns to detect
    setAiBusy(true);
    setCsv(null);
    try {
      const sample = rows.slice(0, 10).map((r) => r.slice(0, 30).map((c) => c.slice(0, 200)));
      const res = await detectCsvColumns({ data: { sample } });
      if (!res.ok) { setErr(res.error); setCsv({ name: f.name, rows, addr: 0, amt: 1, header: false, note: "Pick the columns yourself." }); return; }
      const g = res.guess;
      const ok = (i: number | null) => i === null || (i >= 0 && i < width);
      setCsv({ name: f.name, rows, addr: ok(g.addressColumn) ? g.addressColumn : 0, amt: ok(g.amountColumn) ? g.amountColumn : null, header: g.hasHeader, note: g.note });
    } catch {
      setErr("Couldn't reach the AI reader. Pick the columns yourself.");
      setCsv({ name: f.name, rows, addr: 0, amt: 1, header: false, note: "" });
    } finally {
      setAiBusy(false);
    }
  }

  function applyCsv() {
    if (!csv) return;
    const body = (csv.header ? csv.rows.slice(1) : csv.rows)
      .map((r) => `${(r[csv.addr] ?? "").trim()}${csv.amt !== null ? "," + (r[csv.amt] ?? "").trim().replace(/,/g, "") : ""}`)
      .join("\n");
    setText(body);
    if (csv.amt === null) setUseFixed(true);
    setCsv(null);
  }

  function continueList() {
    setErr("");
    if (useFixed && toBase(fixed, token.decimals) === null) return setErr("Enter a valid amount per wallet");
    const { rows, bad } = parseList(text, token.decimals, net, sender, useFixed ? fixed : undefined);
    if (!rows.length) return setErr("No valid recipients found.");
    onDone(rows, bad);
  }

  async function runSnapshot() {
    setErr("");
    const id = snapContract.trim();
    if (!/^S[A-Z0-9]+\.[a-zA-Z][\w-]*$/.test(id)) return setErr("Use the format SP….token-name");
    const amt = toBase(snapAmount, token.decimals);
    if (!amt || amt <= 0n) return setErr("Enter an amount");
    try {
      setProgress("Reading token…");
      const snapTok = await fetchTokenByContract(net, id);
      const min = minBal ? toBase(minBal, snapTok.decimals) : 0n;
      if (min === null) return setErr("Invalid minimum balance");
      const holders = (await fetchFtHolders(net, id, 5000, (n, t) => setProgress(`Fetched ${n} / ${t} holders…`)))
        .filter((h) => !h.address.includes(".") && h.address !== sender && h.balance > 0n && h.balance >= min);
      if (!holders.length) { setProgress(""); return setErr("No eligible holders."); }
      let rows: Row[];
      if (dist === "equal") rows = holders.map((h) => ({ address: h.address, amount: amt }));
      else {
        const sum = holders.reduce((a, h) => a + h.balance, 0n);
        rows = holders.map((h) => ({ address: h.address, amount: (amt * h.balance) / sum })).filter((r) => r.amount > 0n);
      }
      setProgress("");
      onDone(rows, []);
    } catch (e) {
      setProgress("");
      setErr((e as Error).message);
    }
  }

  return (
    <div className="panel space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">Who receives {token.symbol}?</h2>
          <p className="text-sm text-muted-foreground">Duplicates are merged automatically.</p>
        </div>
        <div className="flex rounded-full border border-border p-1">
          <button className="tab" data-active={mode === "list"} onClick={() => setMode("list")}>CSV / list</button>
          <button className="tab" data-active={mode === "snapshot"} onClick={() => setMode("snapshot")}>Holder snapshot</button>
        </div>
      </div>

      {mode === "list" ? (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground hover:border-primary">
            <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            {aiBusy ? "Reading your file with AI…" : <>Upload any CSV — AI finds the address and amount columns</>}
          </label>
          {csv && (() => {
            const width = Math.max(...csv.rows.map((r) => r.length));
            const head = csv.header ? csv.rows[0]! : null;
            const label = (i: number) => `Column ${i + 1}${head?.[i] ? ` · ${head[i]}` : ""}`;
            const preview = (csv.header ? csv.rows.slice(1) : csv.rows).slice(0, 5);
            return (
              <div className="space-y-3 rounded-xl border border-primary/60 p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{csv.name} · {csv.rows.length.toLocaleString()} rows</span>
                  {csv.note && <span className="text-xs text-muted-foreground">AI: {csv.note}</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1"><span className="eyebrow">Address column</span>
                    <select className="field" value={csv.addr} onChange={(e) => setCsv({ ...csv, addr: Number(e.target.value) })}>
                      {Array.from({ length: width }, (_, i) => <option key={i} value={i}>{label(i)}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1"><span className="eyebrow">Amount column</span>
                    <select className="field" value={csv.amt ?? -1} onChange={(e) => setCsv({ ...csv, amt: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>
                      <option value={-1}>None — same amount for all</option>
                      {Array.from({ length: width }, (_, i) => <option key={i} value={i}>{label(i)}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input type="checkbox" className="accent-primary" checked={csv.header} onChange={(e) => setCsv({ ...csv, header: e.target.checked })} />
                    First row is a header
                  </label>
                </div>
                <table className="w-full font-mono text-xs">
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="truncate py-1.5 pr-3">{shortAddr(r[csv.addr] ?? "")}</td>
                        <td className="py-1.5 text-right">{csv.amt !== null ? r[csv.amt] : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end gap-2">
                  <button className="btn btn-ghost" onClick={() => setCsv(null)}>Discard</button>
                  <button className="btn btn-primary" onClick={applyCsv}>Use these columns</button>
                </div>
              </div>
            );
          })()}
          <textarea
            className="field min-h-48 font-mono text-xs"
            placeholder={`${net === "mainnet" ? "SP" : "ST"}2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7, 100\n${net === "mainnet" ? "SP" : "ST"}1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE, 250.5`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <input type="checkbox" checked={useFixed} onChange={(e) => setUseFixed(e.target.checked)} className="accent-primary" />
            Same amount for everyone (ignore amount column)
            {useFixed && <input className="field !w-36 font-mono" placeholder="100" value={fixed} onChange={(e) => setFixed(e.target.value)} />}
          </label>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="eyebrow">Holders of token</label>
            <input className="field font-mono" placeholder="SP….token-contract" value={snapContract} onChange={(e) => setSnapContract(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="eyebrow">Distribution</label>
            <div className="flex rounded-full border border-border p-1">
              <button className="tab flex-1" data-active={dist === "equal"} onClick={() => setDist("equal")}>Equal</button>
              <button className="tab flex-1" data-active={dist === "proportional"} onClick={() => setDist("proportional")}>Proportional</button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="eyebrow">{dist === "equal" ? `${token.symbol} per wallet` : `Total ${token.symbol} pool`}</label>
            <input className="field font-mono" placeholder="100" value={snapAmount} onChange={(e) => setSnapAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="eyebrow">Minimum holding (optional)</label>
            <input className="field font-mono" placeholder="0" value={minBal} onChange={(e) => setMinBal(e.target.value)} />
          </div>
          <p className="self-end text-xs text-muted-foreground">Contracts and your own wallet are excluded. Up to 5,000 holders.</p>
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}
      {progress && <p className="font-mono text-xs text-accent">{progress}</p>}

      <div className="flex justify-between gap-2">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" disabled={!!progress || aiBusy || !!csv} onClick={mode === "list" ? continueList : runSnapshot}>
          {mode === "list" ? "Review" : "Take snapshot"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Step 3 --------------------------------- */
function ReviewStep({ token, rows, bad, onBack, onNext }: { token: TokenInfo; rows: Row[]; bad: Bad[]; onBack: () => void; onNext: () => void }) {
  const total = useMemo(() => rows.reduce((a, r) => a + r.amount, 0n), [rows]);
  const batches = Math.ceil(rows.length / (isStx(token) ? STX_CHUNK : TOKEN_CHUNK));
  const feeReserve = isStx(token) ? BigInt(batches) * 100_000n : 0n; // ~0.1 STX per tx for fees
  const short = token.balance !== undefined && total + feeReserve > token.balance;

  function exportCsv() {
    const csv = "address,amount\n" + rows.map((r) => `${r.address},${fromBase(r.amount, token.decimals).replace(/,/g, "")}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `geschenk-${token.symbol}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Recipients", rows.length.toLocaleString()],
          ["Total", `${fromBase(total, token.decimals)} ${token.symbol}`],
          ["Transactions", batches.toString()],
          ["Your balance", token.balance !== undefined ? `${fromBase(token.balance, token.decimals)}` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4">
            <div className="eyebrow">{k}</div>
            <div className="mt-1 truncate font-mono text-lg">{v}</div>
          </div>
        ))}
      </div>
      {short && <p className="rounded-xl border border-destructive/50 p-3 text-sm text-destructive">{isStx(token) ? "Your STX balance doesn't cover the total plus about 0.1 STX per transaction for fees." : "Your balance is lower than the total. Reduce amounts or top up first."}</p>}
      {bad.length > 0 && (
        <details className="panel p-4 text-sm">
          <summary className="cursor-pointer text-accent">{bad.length} line(s) skipped</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
            {bad.slice(0, 50).map((b) => <li key={b.line}>#{b.line} {b.raw} — {b.reason}</li>)}
          </ul>
        </details>
      )}
      <div className="panel max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left"><th className="eyebrow p-3">#</th><th className="eyebrow p-3">Wallet</th><th className="eyebrow p-3 text-right">{token.symbol}</th></tr>
          </thead>
          <tbody className="font-mono text-xs">
            {rows.slice(0, 500).map((r, i) => (
              <tr key={r.address} className="border-t border-border">
                <td className="p-3 text-muted-foreground">{i + 1}</td>
                <td className="p-3"><span className="sm:hidden">{shortAddr(r.address)}</span><span className="hidden sm:inline">{r.address}</span></td>
                <td className="p-3 text-right">{fromBase(r.amount, token.decimals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && <p className="p-3 text-xs text-muted-foreground">+ {rows.length - 500} more</p>}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={exportCsv}>Export CSV</button>
          <button className="btn btn-primary" disabled={short || !rows.length} onClick={onNext}>Continue</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Step 4 --------------------------------- */
function SendStep({ net, sender, token, rows, onBack }: { net: Net; sender: string; token: TokenInfo; rows: Row[]; onBack: () => void }) {
  const stxMode = isStx(token);
  const cName = stxMode ? STX_CONTRACT_NAME : CONTRACT_NAME;
  const chunkSize = stxMode ? STX_CHUNK : TOKEN_CHUNK;
  const storageKey = `geschenk:contract:${stxMode ? "stx:" : ""}${net}:${sender}`;
  const [contract, setContract] = useState("");
  const [contractState, setContractState] = useState<"checking" | "missing" | "deploying" | "ready">("checking");
  const [deployTx, setDeployTx] = useState("");
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const chunks = useMemo(() => {
    const out: Row[][] = [];
    for (let i = 0; i < rows.length; i += chunkSize) out.push(rows.slice(i, i + chunkSize));
    return out;
  }, [rows, chunkSize]);
  const [states, setStates] = useState<BatchState[]>(() => chunks.map(() => ({ status: "idle" })));
  const [campaignId] = useState(() => `${Date.now()}`);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) ?? `${sender}.${cName}`;
    setContract(saved);
    contractExists(net, saved).then((ok) => setContractState(ok ? "ready" : "missing")).catch(() => setContractState("missing"));
  }, [net, sender, storageKey]);

  // poll deployment
  useEffect(() => {
    if (contractState !== "deploying") return;
    const t = setInterval(async () => {
      if (await contractExists(net, contract)) setContractState("ready");
    }, 10000);
    return () => clearInterval(t);
  }, [contractState, net, contract]);

  async function deploy() {
    setErr("");
    try {
      const { request } = await loadConnect();
      const res = await request("stx_deployContract", {
        name: cName,
        clarityCode: stxMode ? stxAirdropContractSource() : airdropContractSource(net),
        clarityVersion: 3,
        network: net,
      });
      const id = `${sender}.${cName}`;
      localStorage.setItem(storageKey, id);
      setContract(id);
      setDeployTx(res.txid ?? "");
      setContractState("deploying");
    } catch (e) {
      setErr((e as Error).message ?? "Deployment cancelled");
    }
  }

  async function useCustom() {
    setErr("");
    const id = custom.trim();
    if (!(await contractExists(net, id).catch(() => false))) return setErr("Contract not found on " + net);
    localStorage.setItem(storageKey, id);
    setContract(id);
    setContractState("ready");
  }

  function persist(next: BatchState[]) {
    const total = rows.reduce((a, r) => a + r.amount, 0n);
    const c: Campaign = {
      id: campaignId,
      createdAt: Number(campaignId),
      net,
      sender,
      token: { contractId: token.contractId, symbol: token.symbol, decimals: token.decimals },
      recipients: rows.length,
      total: total.toString(),
      batches: chunks.map((ch, i) => ({ txid: next[i]?.txid, size: ch.length, total: ch.reduce((a, r) => a + r.amount, 0n).toString() })),
    };
    saveCampaign(c);
  }

  async function sendBatch(i: number) {
    const set = (s: BatchState) =>
      setStates((prev) => {
        const next = prev.map((p, j) => (j === i ? s : p));
        if (s.status === "sent") persist(next);
        return next;
      });
    set({ status: "signing" });
    try {
      const chunk = chunks[i]!;
      const total = chunk.reduce((a, r) => a + r.amount, 0n);
      const [tAddr = "", tName = ""] = token.contractId.split(".");
      const { request } = await loadConnect();
      const list = Cl.list(chunk.map((r) => Cl.tuple({ to: Cl.principal(r.address), amount: Cl.uint(r.amount) })));
      const res = await request("stx_callContract", {
        contract: contract as `${string}.${string}`,
        functionName: "airdrop",
        functionArgs: stxMode ? [list] : [Cl.contractPrincipal(tAddr, tName), list],
        network: net,
        postConditions: [
          stxMode
            ? Pc.principal(sender).willSendEq(total).ustx()
            : Pc.principal(sender).willSendEq(total).ft(token.contractId as `${string}.${string}`, token.assetName),
        ],
        postConditionMode: "deny",
      });
      set({ status: "sent", txid: res.txid });
    } catch (e) {
      set({ status: "error", error: (e as Error).message ?? "Cancelled" });
    }
  }

  const sentCount = states.filter((s) => s.status === "sent").length;

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5 sm:p-6">
        <p className="eyebrow">1 · Airdrop contract</p>
        {contractState === "checking" && <p className="text-sm text-muted-foreground">Checking for your airdrop contract…</p>}
        {contractState === "ready" && (
          <p className="text-sm">Ready: <span className="font-mono text-accent break-all">{contract}</span></p>
        )}
        {contractState === "deploying" && (
          <p className="text-sm text-muted-foreground">
            Deploying… this usually takes a few minutes.{" "}
            {deployTx && <a className="text-accent underline" href={explorerTx(deployTx, net)} target="_blank" rel="noreferrer">View transaction</a>}
          </p>
        )}
        {contractState === "missing" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Geschenk sends batches through a small helper contract in your own wallet. Deploy it once per network — it's reused for every future airdrop.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={deploy}>Deploy helper contract</button>
              <details className="w-full text-sm">
                <summary className="cursor-pointer text-muted-foreground">View contract code / use an existing one</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-background p-3 font-mono text-[11px] text-muted-foreground">{airdropContractSource(net)}</pre>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input className="field font-mono" placeholder="SP….geschenk-airdrop-v1" value={custom} onChange={(e) => setCustom(e.target.value)} />
                  <button className="btn btn-ghost" onClick={useCustom}>Use this contract</button>
                </div>
              </details>
            </div>
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>

      <div className="panel space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow">2 · Sign batches</p>
          <p className="font-mono text-xs text-muted-foreground">{sentCount}/{chunks.length} sent</p>
        </div>
        {chunks.map((ch, i) => {
          const s = states[i] ?? { status: "idle" as const };
          const total = ch.reduce((a, r) => a + r.amount, 0n);
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Batch {i + 1}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {ch.length} wallets · {fromBase(total, token.decimals)} {token.symbol}
                </div>
                {s.status === "error" && <div className="text-xs text-destructive">{s.error}</div>}
              </div>
              {s.status === "sent" && s.txid ? (
                <a className="btn btn-ghost !py-1.5 text-success" href={explorerTx(s.txid, net)} target="_blank" rel="noreferrer">Sent ↗</a>
              ) : (
                <button className="btn btn-primary !py-1.5" disabled={contractState !== "ready" || s.status === "signing"} onClick={() => sendBatch(i)}>
                  {s.status === "signing" ? "Check wallet…" : s.status === "error" ? "Retry" : "Sign & send"}
                </button>
              )}
            </div>
          );
        })}
        {sentCount === chunks.length && (
          <p className="text-sm text-success">
            All batches submitted. Track them in <Link to="/history" className="underline">History</Link>.
          </p>
        )}
      </div>
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
    </div>
  );
}
