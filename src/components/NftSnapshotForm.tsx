import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchNftAssets, fetchNftHolders } from "@/lib/nft";
import { allocateNftHolders } from "@/lib/nft-allocations";
import { toBase, type Net, type TokenInfo } from "@/lib/stacks";

export function NftSnapshotForm({ net, sender, token, onDone, onBack }: {
  net: Net; sender: string; token: TokenInfo;
  onDone: (rows: { address: string; amount: bigint }[], bad: []) => void;
  onBack: () => void;
}) {
  const [contract, setContract] = useState("");
  const [assets, setAssets] = useState<string[]>([]);
  const [asset, setAsset] = useState("");
  const [distribution, setDistribution] = useState<"equal" | "proportional">("equal");
  const [amount, setAmount] = useState("");
  const [minimum, setMinimum] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function loadAssets() {
    setBusy(true); setError(""); setProgress("Reading NFT collection…");
    try {
      const result = await fetchNftAssets(net, contract.trim());
      setAssets(result); setAsset(result[0] ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read this collection."); }
    finally { setBusy(false); setProgress(""); }
  }

  async function snapshot() {
    setError("");
    const base = toBase(amount, token.decimals);
    const min = toBase(minimum || "0", 0);
    if (base === null || base <= 0n) return setError(`Enter a positive ${token.symbol} amount with at most ${token.decimals} decimals.`);
    if (min === null) return setError("Minimum NFT holding must be a non-negative whole number.");
    if (!asset || !assets.includes(asset)) return setError("Load an NFT collection first.");
    setBusy(true);
    try {
      const holders = await fetchNftHolders(net, asset, setProgress);
      const rows = allocateNftHolders(holders, net, sender, base, distribution, min);
      if (!rows.length) return setError("No eligible NFT holders remain after your filters.");
      onDone(rows, []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not complete the NFT snapshot."); }
    finally { setBusy(false); setProgress(""); }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1 space-y-1.5 text-sm"><span className="eyebrow">NFT collection contract</span>
        <input className="field w-full font-mono text-xs" placeholder="SP….nft-collection" value={contract} disabled={busy} onChange={(event) => { setContract(event.target.value); setAssets([]); setAsset(""); setError(""); }} />
      </label>
      <Button onClick={loadAssets} variant="outline" disabled={busy || !contract.trim()}>Load collection</Button>
    </div>
    {assets.length > 0 && <label className="block space-y-1.5 text-sm"><span className="eyebrow">NFT asset</span><select className="field w-full" value={asset} disabled={busy} onChange={(event) => setAsset(event.target.value)}>{assets.map((item) => <option key={item} value={item}>{item.split("::")[1]}</option>)}</select></label>}
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="space-y-1.5"><legend className="eyebrow mb-1.5">Distribution</legend><div className="flex gap-2">
        <Button variant={distribution === "equal" ? "secondary" : "outline"} aria-pressed={distribution === "equal"} disabled={busy} onClick={() => setDistribution("equal")}>Equal per wallet</Button>
        <Button variant={distribution === "proportional" ? "secondary" : "outline"} aria-pressed={distribution === "proportional"} disabled={busy} onClick={() => setDistribution("proportional")}>By NFT count</Button>
      </div></fieldset>
      <label className="space-y-1.5 text-sm"><span className="eyebrow">{distribution === "equal" ? `${token.symbol} per wallet` : `Total ${token.symbol} pool`}</span><input className="field w-full" inputMode="decimal" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} /></label>
      <label className="space-y-1.5 text-sm"><span className="eyebrow">Minimum NFTs held (optional)</span><input className="field w-full" inputMode="numeric" placeholder="0" value={minimum} disabled={busy} onChange={(event) => setMinimum(event.target.value)} /></label>
      <p className="text-xs text-muted-foreground self-end">Current indexed owners. Contract-held NFTs and your wallet are excluded. Maximum 5,000 mint events per asset.</p>
    </div>
    {distribution === "proportional" && <p className="text-xs text-muted-foreground">Rounded down to {token.symbol} base units; the remainder stays in your wallet.</p>}
    <p className="text-xs text-muted-foreground">Ownership can change while the snapshot is collected. Escrowed and staked NFTs are not attributed to their depositors.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {progress && <p role="status" className="text-xs font-mono text-accent">{progress}</p>}
    <div className="flex justify-between gap-2"><Button variant="ghost" onClick={onBack} disabled={busy}>Back</Button><Button onClick={snapshot} disabled={busy || !asset}>{busy ? "Reading NFT owners…" : "Take NFT snapshot"}</Button></div>
  </div>;
}