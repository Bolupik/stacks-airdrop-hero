import { HIRO, isAddressForNet, type Net } from "@/lib/stacks";

export type NftHolder = { address: string; balance: bigint };
const PAGE_SIZE = 200;
export const MAX_NFT_SNAPSHOT = 5000;
let nextRequestAt = 0;

async function paceRequest() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + 1500;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

async function read<T>(net: Net, path: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await paceRequest();
    let response: Response;
    try {
      response = await fetch(HIRO[net] + path, { signal: AbortSignal.timeout(30000) });
    } catch {
      throw new Error("NFT data service could not be reached. Please wait a minute and retry; no partial snapshot was imported.");
    }
    if (response.status === 429 && attempt < 2) {
      const seconds = Number(response.headers.get("retry-after"));
      const wait = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) : 15;
      nextRequestAt = Math.max(nextRequestAt, Date.now() + wait * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`NFT data unavailable (${response.status}). Please retry shortly.`);
    return response.json() as Promise<T>;
  }
  throw new Error("NFT data service is busy. Please retry shortly.");
}

export async function fetchNftAssets(net: Net, contract: string): Promise<string[]> {
  const [address = "", name = "", extra] = contract.trim().split(".");
  if (extra || !isAddressForNet(address, net) || !/^[a-zA-Z][\w-]*$/.test(name)) throw new Error(`Enter a valid ${net} NFT collection contract: address.contract-name.`);
  const data = await read<{ non_fungible_tokens: { name: string }[] }>(net, `/v2/contracts/interface/${address}/${name}`);
  const assets = data.non_fungible_tokens?.map((asset) => `${address}.${name}::${asset.name}`) ?? [];
  if (!assets.length) throw new Error("This contract does not define an NFT asset.");
  return assets;
}

// Hiro has no collection-wide holder endpoint: enumerate minted token IDs,
// then resolve each ID's most recent canonical mint/transfer/burn event.
export async function fetchNftHolders(net: Net, asset: string, onProgress?: (message: string) => void): Promise<NftHolder[]> {
  const encoded = encodeURIComponent(asset);
  const ids = new Set<string>();
  let offset = 0;
  while (true) {
    const page = await read<{ total: number; results: { value: { hex: string } }[] }>(net, `/extended/v1/tokens/nft/mints?asset_identifier=${encoded}&limit=${PAGE_SIZE}&offset=${offset}`);
    if (!Number.isInteger(page.total) || !Array.isArray(page.results)) throw new Error("NFT mint data was incomplete. No snapshot was imported.");
    if (page.total > MAX_NFT_SNAPSHOT) throw new Error(`This asset has more than ${MAX_NFT_SNAPSHOT.toLocaleString()} mint events. Use an externally prepared holder CSV for larger collections; no partial snapshot was imported.`);
    for (const entry of page.results) {
      if (!entry.value?.hex) throw new Error("NFT mint data is missing a token ID.");
      ids.add(entry.value.hex);
    }
    offset += page.results.length;
    onProgress?.(`Reading minted NFTs: ${offset} / ${page.total}`);
    if (offset >= page.total) break;
    if (!page.results.length) throw new Error("NFT mint history was incomplete. Please retry.");
  }
  const values = [...ids];
  const owners = new Map<string, bigint>();
  let next = 0;
  let done = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(6, values.length) }, async () => {
    while (next < values.length && !failed) {
      const value = values[next++];
      if (!value) continue;
      try {
        const history = await read<{ results: { asset_event_type: string; recipient: string | null }[] }>(net, `/extended/v1/tokens/nft/history?asset_identifier=${encoded}&value=${encodeURIComponent(value)}&limit=1&offset=0`);
        const latest = history.results?.[0];
        if (!latest || !["mint", "transfer", "burn"].includes(latest.asset_event_type)) throw new Error("Could not resolve every NFT owner. No partial snapshot was imported.");
        if (latest.asset_event_type !== "burn") {
          if (!latest.recipient) throw new Error("NFT ownership data is missing a recipient.");
          owners.set(latest.recipient, (owners.get(latest.recipient) ?? 0n) + 1n);
        }
        onProgress?.(`Resolving current NFT owners: ${++done} / ${values.length}`);
      } catch (error) { failed = true; throw error; }
    }
  }));
  return [...owners].map(([address, balance]) => ({ address, balance }));
}