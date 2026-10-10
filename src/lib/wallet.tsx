import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Net } from "./stacks";

type WalletCtx = {
  net: Net;
  setNet: (n: Net) => void;
  addresses: string[];
  address: string | null; // address matching current network
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<WalletCtx | null>(null);

function pick(addresses: string[], net: Net) {
  return (
    addresses.find((a) => (net === "mainnet" ? /^S[PM]/.test(a) : /^S[TN]/.test(a))) ?? null
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [net, setNetState] = useState<Net>("testnet");
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("geschenk:net");
    if (saved === "mainnet" || saved === "testnet") setNetState(saved);
    import("@stacks/connect").then(({ getLocalStorage }) => {
      const d = getLocalStorage();
      if (d?.addresses?.stx?.length) setAddresses(d.addresses.stx.map((a) => a.address));
    });
  }, []);

  const setNet = useCallback((n: Net) => {
    setNetState(n);
    localStorage.setItem("geschenk:net", n);
  }, []);

  const connect = useCallback(async () => {
    const { connect } = await import("@stacks/connect");
    const res = await connect();
    setAddresses(res.addresses.filter((a) => /^S[PMTN]/.test(a.address)).map((a) => a.address));
  }, []);

  const disconnect = useCallback(async () => {
    const { disconnect } = await import("@stacks/connect");
    disconnect();
    setAddresses([]);
  }, []);

  return (
    <Ctx.Provider value={{ net, setNet, addresses, address: pick(addresses, net), connect, disconnect }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside provider");
  return c;
}
