import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/lib/wallet";

vi.mock("@/lib/connect", () => ({
  loadConnect: async () => ({
    getLocalStorage: () => ({ addresses: { stx: [
      { address: "ST1TESTNET" },
      { address: "SP1MAINNET" },
    ] } }),
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Mainnet-only wallet", () => {
  it("uses mainnet even when a returning user previously selected testnet", async () => {
    localStorage.setItem("geschenk:net", "testnet");
    const states: ReturnType<typeof useWallet>[] = [];
    function Probe() {
      states.push(useWallet());
      return null;
    }
    await act(async () => {
      render(<WalletProvider><Probe /></WalletProvider>);
    });
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((state) => state.net === "mainnet")).toBe(true);
    expect(states.at(-1)?.address).toBe("SP1MAINNET");
    expect(localStorage.getItem("geschenk:net")).toBe("mainnet");
    expect(states.at(-1)).not.toHaveProperty("setNet");
  });
});