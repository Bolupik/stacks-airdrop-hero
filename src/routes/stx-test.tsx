import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cl, Pc } from "@stacks/transactions";
import { Button } from "@/components/ui/button";
import { loadConnect } from "@/lib/connect";
import { contractExists, explorerTx, fetchStxToken, fetchTxStatus, fromBase, HIRO, isAddressForNet, saveCampaign, STX_CONTRACT_NAME, stxAirdropContractSource } from "@/lib/stacks";
import { TEST_NETWORK, validateStxTest } from "@/lib/stx-test";

export const Route = createFileRoute("/stx-test")({
  head: () => ({ meta: [
    { title: "Three-person STX test — Geschenk" },
    { name: "description", content: "Deploy your STX batch helper and verify a three-recipient test on Stacks testnet." },
    { property: "og:title", content: "Three-person STX test — Geschenk" },
    { property: "og:description", content: "Wallet-approved STX contract deployment and three-recipient testnet batch." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: StxTestPage,
});

function StxTestPage() {
  const [sender, setSender] = useState("");
  const [recipients, setRecipients] = useState(["", "", ""]);
  const [amount, setAmount] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deployTx, setDeployTx] = useState("");
  const [batchTx, setBatchTx] = useState("");
  const [deployStatus, setDeployStatus] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const contract = `${sender}.${STX_CONTRACT_NAME}`;
  const validation = validateStxTest(sender, recipients, amount);

  useEffect(() => {
    if (!sender) return;
    let cancelled = false;
    const check = async () => {
      try {
        const token = await fetchStxToken(TEST_NETWORK, sender);
        const exists = await contractExists(TEST_NETWORK, contract);
        if (!cancelled) { setBalance(token.balance ?? 0n); setReady(exists); }
        for (const [txid, update] of [[deployTx, setDeployStatus], [batchTx, setBatchStatus]] as const) {
          if (!txid) continue;
          const status = await fetchTxStatus(TEST_NETWORK, txid);
          if (!cancelled) update(status);
        }
      } catch { if (!cancelled) setError("Could not refresh testnet status. Retrying shortly."); }
    };
    void check();
    const timer = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [sender, contract, deployTx, batchTx]);

  async function connectTestnet() {
    setBusy(true); setError("");
    try {
      const { request } = await loadConnect();
      const result = await request({ enableLocalStorage: false }, "stx_getAddresses", { network: TEST_NETWORK });
      const address = result.addresses.find((item) => isAddressForNet(item.address, TEST_NETWORK))?.address;
      if (!address) throw new Error("Switch your wallet to testnet, then connect again. No testnet STX address was returned.");
      setSender(address); setReady(false); setDeployTx(""); setBatchTx(""); setDeployStatus(""); setBatchStatus(""); setBalance(null); setApproved(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Wallet connection cancelled."); }
    finally { setBusy(false); }
  }

  async function deploy() {
    if (!isAddressForNet(sender, TEST_NETWORK) || ready || busy) return;
    setBusy(true); setError("");
    try {
      const { request } = await loadConnect();
      const result = await request("stx_deployContract", {
        address: sender, name: STX_CONTRACT_NAME, clarityCode: stxAirdropContractSource(),
        clarityVersion: 3, network: TEST_NETWORK, postConditionMode: "deny", postConditions: [],
      });
      if (!result.txid) throw new Error("Wallet returned no transaction ID. Check your wallet before retrying.");
      setDeployTx(result.txid); setDeployStatus("pending");
    } catch (e) { setError(e instanceof Error ? e.message : "Deployment cancelled."); }
    finally { setBusy(false); }
  }

  async function send() {
    if (busy || batchTx || !ready || !approved || validation.errors.length || validation.amount === null) return;
    setBusy(true); setError("");
    try {
      const current = await fetchStxToken(TEST_NETWORK, sender);
      if ((current.balance ?? 0n) < validation.total + 100000n) throw new Error("Keep at least 0.1 testnet STX available beyond the batch total for fees.");
      const response = await fetch(`${HIRO[TEST_NETWORK]}/v2/contracts/source/${sender}/${STX_CONTRACT_NAME}`);
      if (!response.ok) throw new Error("Could not verify your testnet helper contract.");
      const deployed = await response.json() as { source?: string };
      if (deployed.source?.trim() !== stxAirdropContractSource().trim()) throw new Error("Existing helper code differs from the expected STX contract. No batch was sent.");
      const { request } = await loadConnect();
      const result = await request("stx_callContract", {
        address: sender, contract: `${sender}.${STX_CONTRACT_NAME}`, functionName: "airdrop", network: TEST_NETWORK,
        functionArgs: [Cl.list(validation.addresses.map((address) => Cl.tuple({ to: Cl.principal(address), amount: Cl.uint(validation.amount ?? 0n) })))],
        postConditionMode: "deny", postConditions: [Pc.principal(sender).willSendEq(validation.total).ustx()],
      });
      if (!result.txid) throw new Error("Wallet returned no transaction ID. Check your wallet before retrying.");
      setBatchTx(result.txid); setBatchStatus("pending");
      saveCampaign({ id: `testnet-${result.txid}`, createdAt: Date.now(), net: TEST_NETWORK, sender,
        token: { contractId: "STX", symbol: "STX", decimals: 6 }, recipients: 3, total: validation.total.toString(),
        batches: [{ txid: result.txid, size: 3, total: validation.total.toString() }],
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Batch cancelled."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-8">
    <section className="space-y-3">
      <p className="eyebrow">Testnet only · STX</p>
      <h1 className="text-4xl font-semibold">Three-person STX test</h1>
      <p className="text-sm text-muted-foreground">Uses testnet STX, not real funds. Both transactions require your wallet approval.</p>
      <Link to="/" className="text-accent underline text-sm">Return to mainnet airdrops</Link>
    </section>
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-2xl">1 · Testnet wallet</h2>
      <Button onClick={connectTestnet} disabled={busy || !!batchTx}>Connect testnet wallet</Button>
      {sender && <div className="space-y-2"><p className="font-mono text-xs break-all">{sender}</p><p className="text-sm text-muted-foreground">Available: {balance === null ? "Checking…" : `${fromBase(balance, 6)} testnet STX`}</p></div>}
    </section>
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-2xl">2 · STX helper contract</h2>
      {sender && <p className="font-mono text-xs break-all">{contract}</p>}
      <Button disabled={!sender || busy || ready || (!!deployTx && !deployStatus.startsWith("abort") && !deployStatus.startsWith("dropped"))} onClick={deploy}>{ready ? "Contract confirmed" : "Deploy on testnet"}</Button>
      {deployTx && <p className="text-sm"><a className="text-accent underline" href={explorerTx(deployTx, TEST_NETWORK)} target="_blank" rel="noreferrer">Deployment: {deployStatus || "pending"}</a></p>}
      <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">STX contract code</summary><pre className="mt-3 max-h-64 overflow-auto bg-secondary p-3 font-mono text-xs">{stxAirdropContractSource()}</pre></details>
    </section>
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-2xl">3 · Recipients and review</h2>
      <div className="space-y-3 max-w-xl">
        {recipients.map((value, index) => <label key={index} className="block space-y-1 text-sm">Recipient {index + 1}<input className="field w-full font-mono text-xs" value={value} placeholder="ST… testnet address" disabled={busy || !!batchTx} onChange={(event) => { setRecipients((prev) => prev.map((address, i) => i === index ? event.target.value : address)); setApproved(false); }} /></label>)}
        <label className="block space-y-1 text-sm">STX per person<input className="field w-full" inputMode="decimal" value={amount} disabled={busy || !!batchTx} onChange={(event) => { setAmount(event.target.value); setApproved(false); }} /></label>
      </div>
      {(amount || recipients.some(Boolean)) && validation.errors.length > 0 && <ul className="space-y-1 text-sm text-destructive" role="alert">{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
      <p className="font-mono text-sm">Batch total: {fromBase(validation.total, 6)} testnet STX · 3 recipients</p>
      <p className="text-sm text-muted-foreground">Keep 0.1 testnet STX extra for fees. Review the actual fee in your wallet.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={approved} disabled={busy || !!batchTx || !!validation.errors.length} onChange={(event) => setApproved(event.target.checked)} />I confirm these three recipients and the testnet STX total.</label>
      <Button onClick={send} disabled={busy || !ready || !approved || !!validation.errors.length || !!batchTx}>{busy ? "Check wallet…" : "Sign three-person test"}</Button>
      {batchTx && <div className="space-y-2 text-sm"><p className={batchStatus === "success" ? "text-success" : "text-muted-foreground"}>{batchStatus === "success" ? "Three-recipient batch confirmed on testnet." : `Batch status: ${batchStatus || "pending"}`}</p><a href={explorerTx(batchTx, TEST_NETWORK)} target="_blank" rel="noreferrer" className="text-accent underline">View transaction and recipient transfers</a><p><Link to="/history" className="text-accent underline">View receipt in History</Link></p></div>}
    </section>
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
  </div>;
}