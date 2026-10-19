import { c32address } from "c32check";
import { describe, expect, it } from "vitest";
import { allocateNftHolders } from "@/lib/nft-allocations";

const sender = c32address(22, "01".repeat(20));
const a = c32address(22, "02".repeat(20));
const b = c32address(22, "03".repeat(20));
const holders = [{ address: a, balance: 2n }, { address: b, balance: 1n }];

describe("NFT holder airdrop allocations", () => {
  it("pays each unique wallet equally regardless of NFT count", () => {
    expect(allocateNftHolders([...holders, { address: a, balance: 1n }], "mainnet", sender, 100n, "equal", 0n))
      .toEqual([{ address: a, amount: 100n }, { address: b, amount: 100n }]);
  });
  it("weights a proportional pool by the number of NFTs held", () => {
    expect(allocateNftHolders(holders, "mainnet", sender, 300n, "proportional", 0n))
      .toEqual([{ address: a, amount: 200n }, { address: b, amount: 100n }]);
  });
  it("filters minimum NFT counts after grouping owners", () => {
    expect(allocateNftHolders(holders, "mainnet", sender, 100n, "equal", 2n)).toEqual([{ address: a, amount: 100n }]);
  });
  it("excludes sender, contract owners, invalid addresses and wrong-network owners", () => {
    const excluded = [sender, `${a}.escrow`, "invalid", c32address(26, "04".repeat(20))].map((address) => ({ address, balance: 10n }));
    expect(allocateNftHolders([...holders, ...excluded], "mainnet", sender, 100n, "equal", 0n)).toHaveLength(2);
  });
  it("never allocates more than the pool after integer rounding", () => {
    const rows = allocateNftHolders(holders, "mainnet", sender, 10n, "proportional", 0n);
    expect(rows.map((row) => row.amount)).toEqual([6n, 3n]);
  });
});