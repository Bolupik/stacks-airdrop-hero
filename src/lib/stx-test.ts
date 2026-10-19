import { isAddressForNet, toBase } from "@/lib/stacks";

export const TEST_NETWORK = "testnet" as const;
export const TEST_RECIPIENT_COUNT = 3;

export function validateStxTest(sender: string, recipients: string[], amount: string) {
  const errors: string[] = [];
  if (!isAddressForNet(sender, TEST_NETWORK)) errors.push("Connect a testnet STX wallet.");
  if (recipients.length !== TEST_RECIPIENT_COUNT) errors.push("Exactly three recipients are required.");
  const addresses = recipients.map((address) => address.trim());
  addresses.forEach((address, index) => {
    if (!isAddressForNet(address, TEST_NETWORK)) errors.push(`Recipient ${index + 1}: enter a valid testnet address (ST… or SN…).`);
    if (address && sender && address === sender) errors.push(`Recipient ${index + 1}: cannot be your sending wallet.`);
  });
  const filled = addresses.filter(Boolean);
  if (new Set(filled).size !== filled.length) errors.push("Use three different recipient addresses.");
  const base = toBase(amount, 6);
  if (base === null || base <= 0n) errors.push("Enter a positive STX amount with at most six decimal places.");
  return { errors, addresses, amount: base, total: (base ?? 0n) * BigInt(addresses.length) };
}