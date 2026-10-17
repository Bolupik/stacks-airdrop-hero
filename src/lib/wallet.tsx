import { loadConnect } from "@/lib/connect";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Net } from "./stacks";

type WalletCtx = {
  net: Net;
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
  const net: Net = "mainnet";
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem("geschenk:net", "mainnet");
    loadConnect().then(({ getLocalStorage }) => {
      const d = getLocalStorage();
      if (d?.addresses?.stx?.length) setAddresses(d.addresses.stx.map((a) => a.address));
    });
  }, []);

  const connect = useCallback(async () => {
    const { connect } = await loadConnect();
    const res = await connect();
    setAddresses(res.addresses.filter((a) => /^S[PMTN]/.test(a.address)).map((a) => a.address));
  }, []);

  const disconnect = useCallback(async () => {
    const { disconnect } = await loadConnect();
    disconnect();
    setAddresses([]);
  }, []);

  return (
    <Ctx.Provider value={{ net, addresses, address: pick(addresses, net), connect, disconnect }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside provider");
  return c;
}
