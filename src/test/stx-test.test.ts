import { describe, expect, it } from "vitest";
import { c32address } from "c32check";
import { TEST_NETWORK, validateStxTest } from "@/lib/stx-test";

const sender = c32address(26, "01".repeat(20));
const recipients = [2, 3, 4].map((n) => c32address(26, n.toString(16).padStart(2, "0").repeat(20)));

describe("Three-person testnet STX test", () => {
  it("fixes the test network to testnet", () => {
    expect(TEST_NETWORK).toBe("testnet");
  });
  it("accepts exactly three distinct testnet recipients with deterministic amounts", () => {
    expect(validateStxTest(sender, recipients, "0.000001")).toMatchObject({ errors: [], amount: 1n, total: 3n });
  });
  it("rejects the supplied mainnet address", () => {
    expect(validateStxTest(sender, ["SP1AQDVJF18XEFVXMWTRAW9TQ0N2DCN0178FKW03R", ...recipients.slice(1)], "1").errors.length).toBeGreaterThan(0);
  });
  it("rejects fewer than three recipients", () => {
    expect(validateStxTest(sender, recipients.slice(1), "1").errors.length).toBeGreaterThan(0);
  });
  it("rejects duplicate recipients", () => {
    expect(validateStxTest(sender, [recipients[0], recipients[0], recipients[2]], "1").errors.length).toBeGreaterThan(0);
  });
  it("rejects self transfers", () => {
    expect(validateStxTest(sender, [sender, ...recipients.slice(1)], "1").errors.length).toBeGreaterThan(0);
  });
  it.each(["0", "-1", "0.0000001", ""]) ("rejects invalid amount %s", (amount) => {
    expect(validateStxTest(sender, recipients, amount).errors.length).toBeGreaterThan(0);
  });
});