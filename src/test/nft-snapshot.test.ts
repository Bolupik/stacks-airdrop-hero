import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNftAssets, fetchNftHolders } from "@/lib/nft";
import { c32address } from "c32check";

const owner = c32address(22, "02".repeat(20));
const other = c32address(22, "03".repeat(20));
const contract = `${owner}.collection`;
const asset = `${contract}::nft`;
const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1500 }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("NFT ownership snapshots", () => {
  it("returns every NFT asset class in a collection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ non_fungible_tokens: [{ name: "first" }, { name: "second" }] })));
    expect(await fetchNftAssets("mainnet", contract)).toEqual([`${contract}::first`, `${contract}::second`]);
  });
  it("uses latest owners, counts NFTs per owner, and excludes burned NFTs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/mints?")) return reply({ total: 4, results: [1, 2, 3, 4].map((id) => ({ value: { hex: `0x0${id}` } })) });
      const id = new URL(url).searchParams.get("value");
      return reply({ results: [{ asset_event_type: id === "0x04" ? "burn" : "transfer", recipient: id === "0x03" ? other : owner }] });
    }));
    expect(await fetchNftHolders("mainnet", asset)).toEqual([{ address: owner, balance: 2n }, { address: other, balance: 1n }]);
  });
  it("paginates all mint events and deduplicates reminted IDs", async () => {
    const mock = vi.fn(async (url: string) => {
      if (!url.includes("/mints?")) return reply({ results: [{ asset_event_type: "mint", recipient: owner }] });
      const offset = new URL(url).searchParams.get("offset");
      return reply({ total: 201, results: Array.from({ length: offset === "0" ? 200 : 1 }, () => ({ value: { hex: "0x01" } })) });
    });
    vi.stubGlobal("fetch", mock);
    expect(await fetchNftHolders("mainnet", asset)).toEqual([{ address: owner, balance: 1n }]);
    expect(mock.mock.calls.some(([url]) => url.includes("offset=200"))).toBe(true);
  });
  it("rejects incomplete owner data instead of returning a partial list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/mints?")
      ? reply({ total: 1, results: [{ value: { hex: "0x01" } }] }) : reply({ results: [] })));
    await expect(fetchNftHolders("mainnet", asset)).rejects.toThrow("No partial snapshot");
  });
  it("rejects collections over 5000 mint events without importing a subset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ total: 5001, results: [] })));
    await expect(fetchNftHolders("mainnet", asset)).rejects.toThrow("no partial snapshot");
  });
  it("rejects non-NFT contracts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ non_fungible_tokens: [] })));
    await expect(fetchNftAssets("mainnet", contract)).rejects.toThrow("does not define an NFT");
  });
});