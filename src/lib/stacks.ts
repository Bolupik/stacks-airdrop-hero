import { validateStacksAddress } from "@stacks/transactions";

export type Net = "mainnet" | "testnet";

export const HIRO: Record<Net, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

export const SIP010_TRAIT: Record<Net, string> = {
  mainnet: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait",
  testnet: "ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait",
};

export const BATCH_SIZE = 200;
export const CONTRACT_NAME = "geschenk-airdrop-v1";

export function airdropContractSource(net: Net) {
  return `;; Geschenk batch airdrop — sends one SIP-010 token to up to ${BATCH_SIZE} recipients.
;; Atomic: if any single transfer fails, the whole batch is rolled back.
(use-trait ft-trait '${SIP010_TRAIT[net]})

(define-constant ERR-EMPTY (err u100))
(define-constant ERR-TRANSFER-FAILED (err u101))

(define-private (send-one
    (r {to: principal, amount: uint})
    (acc {token: <ft-trait>, failed: uint}))
  (let ((token (get token acc)))
    (match (contract-call? token transfer (get amount r) tx-sender (get to r) none)
      ok-val acc
      err-val (merge acc {failed: (+ (get failed acc) u1)}))))

(define-public (airdrop
    (token <ft-trait>)
    (recipients (list ${BATCH_SIZE} {to: principal, amount: uint})))
  (let ((result (fold send-one recipients {token: token, failed: u0})))
    (asserts! (> (len recipients) u0) ERR-EMPTY)
    (asserts! (is-eq (get failed result) u0) ERR-TRANSFER-FAILED)
    (ok (len recipients))))
`;
}

export const explorerTx = (txid: string, net: Net) =>
  `https://explorer.hiro.so/txid/${txid.startsWith("0x") ? txid : "0x" + txid}?chain=${net}`;

export function isAddressForNet(addr: string, net: Net) {
  if (!validateStacksAddress(addr)) return false;
  const p = addr.slice(0, 2).toUpperCase();
  return net === "mainnet" ? p === "SP" || p === "SM" : p === "ST" || p === "SN";
}

export function shortAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-5)}` : a;
}

// --- amounts ---------------------------------------------------------------
export function toBase(amount: string, decimals: number): bigint | null {
  const s = amount.trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const [w, f = ""] = s.split(".");
  if (f.length > decimals) return null;
  return BigInt((w || "0") + f.padEnd(decimals, "0"));
}

export function fromBase(v: bigint, decimals: number): string {
  const neg = v < 0n;
  const s = (neg ? -v : v).toString().padStart(decimals + 1, "0");
  const w = s.slice(0, s.length - decimals);
  const f = decimals ? s.slice(-decimals).replace(/0+$/, "") : "";
  return (neg ? "-" : "") + Number(w).toLocaleString("en-US") + (f ? "." + f : "");
}

// --- Hiro API ---------------------------------------------------------------
async function hiro<T>(net: Net, path: string): Promise<T> {
  const r = await fetch(HIRO[net] + path);
  if (!r.ok) throw new Error(`Hiro API ${r.status} on ${path}`);
  return r.json() as Promise<T>;
}

export type TokenInfo = {
  contractId: string;
  assetName: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string | undefined;
  balance?: bigint | undefined;
};

export async function fetchWalletTokens(net: Net, address: string): Promise<TokenInfo[]> {
  const data = await hiro<{ fungible_tokens: Record<string, { balance: string }> }>(
    net,
    `/extended/v1/address/${address}/balances`,
  );
  const entries = Object.entries(data.fungible_tokens ?? {}).filter(([, v]) => BigInt(v.balance) > 0n);
  return Promise.all(
    entries.map(async ([key, v]) => {
      const [contractId = "", assetName = ""] = key.split("::");
      const meta = await fetchTokenMeta(net, contractId).catch(() => null);
      return {
        contractId,
        assetName,
        name: meta?.name ?? contractId.split(".")[1] ?? contractId,
        symbol: meta?.symbol ?? assetName.toUpperCase(),
        decimals: meta?.decimals ?? 6,
        image: meta?.image,
        balance: BigInt(v.balance),
      };
    }),
  );
}

async function fetchTokenMeta(net: Net, contractId: string) {
  const m = await hiro<{ name?: string; symbol?: string; decimals?: number; image_uri?: string; image_thumbnail_uri?: string }>(
    net,
    `/metadata/v1/ft/${contractId}`,
  );
  return { name: m.name, symbol: m.symbol, decimals: m.decimals, image: m.image_thumbnail_uri ?? m.image_uri };
}

export async function fetchTokenByContract(net: Net, contractId: string, holder?: string): Promise<TokenInfo> {
  const [addr = "", name = ""] = contractId.split(".");
  const iface = await hiro<{ fungible_tokens: { name: string }[] }>(net, `/v2/contracts/interface/${addr}/${name}`);
  const assetName = iface.fungible_tokens?.[0]?.name;
  if (!assetName) throw new Error("That contract doesn't define a fungible token.");
  const meta = await fetchTokenMeta(net, contractId).catch(() => null);
  let balance: bigint | undefined;
  if (holder) {
    const b = await hiro<{ fungible_tokens: Record<string, { balance: string }> }>(net, `/extended/v1/address/${holder}/balances`).catch(() => null);
    const v = b?.fungible_tokens?.[`${contractId}::${assetName}`];
    balance = v ? BigInt(v.balance) : 0n;
  }
  return {
    contractId,
    assetName,
    name: meta?.name ?? name,
    symbol: meta?.symbol ?? assetName.toUpperCase(),
    decimals: meta?.decimals ?? 6,
    image: meta?.image,
    balance,
  };
}

export async function fetchFtHolders(
  net: Net,
  contractId: string,
  max = 5000,
  onProgress?: (n: number, total: number) => void,
): Promise<{ address: string; balance: bigint }[]> {
  const out: { address: string; balance: bigint }[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total && out.length < max) {
    const page = await hiro<{ total: number; results: { address: string; balance: string }[] }>(
      net,
      `/extended/v1/tokens/ft/${contractId}/holders?limit=200&offset=${offset}`,
    );
    total = page.total;
    for (const r of page.results) out.push({ address: r.address, balance: BigInt(r.balance) });
    offset += 200;
    onProgress?.(out.length, total);
    if (page.results.length === 0) break;
  }
  return out;
}

export async function fetchTxStatus(net: Net, txid: string): Promise<string> {
  const id = txid.startsWith("0x") ? txid : "0x" + txid;
  const t = await hiro<{ tx_status: string }>(net, `/extended/v1/tx/${id}`).catch(() => null);
  return t?.tx_status ?? "pending";
}

export async function contractExists(net: Net, contractId: string) {
  const [a = "", n = ""] = contractId.split(".");
  const r = await fetch(`${HIRO[net]}/v2/contracts/interface/${a}/${n}`);
  return r.ok;
}

// --- campaigns (local history) ---------------------------------------------
export type Campaign = {
  id: string;
  createdAt: number;
  net: Net;
  sender: string;
  token: { contractId: string; symbol: string; decimals: number };
  recipients: number;
  total: string; // base units
  batches: { txid?: string | undefined; size: number; total: string }[];
};

const KEY = "geschenk:campaigns";
export function loadCampaigns(): Campaign[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function saveCampaign(c: Campaign) {
  const all = loadCampaigns().filter((x) => x.id !== c.id);
  localStorage.setItem(KEY, JSON.stringify([c, ...all]));
}
