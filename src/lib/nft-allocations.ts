import { isAddressForNet, type Net } from "@/lib/stacks";

export function allocateNftHolders(
  holders: { address: string; balance: bigint }[],
  net: Net,
  sender: string,
  amount: bigint,
  distribution: "equal" | "proportional",
  minimum: bigint,
) {
  if (amount <= 0n || minimum < 0n) throw new Error("Enter a positive amount and a non-negative minimum holding.");
  const unique = new Map<string, bigint>();
  for (const holder of holders) {
    if (holder.address.includes(".") || holder.address === sender || !isAddressForNet(holder.address, net) || holder.balance <= 0n) continue;
    unique.set(holder.address, (unique.get(holder.address) ?? 0n) + holder.balance);
  }
  const eligible = [...unique].filter(([, count]) => count >= minimum);
  const total = eligible.reduce((sum, [, count]) => sum + count, 0n);
  return eligible.map(([address, count]) => ({ address, amount: distribution === "equal" ? amount : amount * count / total }))
    .filter((row) => row.amount > 0n);
}