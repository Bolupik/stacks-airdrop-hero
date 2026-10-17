import { Link } from "@tanstack/react-router";
import { useWallet } from "@/lib/wallet";
import { shortAddr } from "@/lib/stacks";

export function SiteHeader() {
  const { net, address, addresses, connect, disconnect } = useWallet();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="font-display text-2xl font-semibold tracking-tight">
          Geschenk<span className="text-primary">.</span>
        </Link>
        <nav className="flex gap-1">
          <Link to="/" className="tab" activeProps={{ "data-active": "true" } as never} activeOptions={{ exact: true }}>
            Airdrop
          </Link>
          <Link to="/history" className="tab" activeProps={{ "data-active": "true" } as never}>
            History
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {addresses.length ? (
            <button className="btn btn-ghost !px-3 !py-1.5 font-mono text-xs" onClick={disconnect} title="Disconnect">
              {address ? shortAddr(address) : `no ${net} address`}
            </button>
          ) : (
            <button className="btn btn-primary !px-4 !py-1.5" onClick={() => connect().catch(() => {})}>
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
