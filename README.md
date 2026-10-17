# Stacks Airdrop Hero

Platforms like STX.City offer popular no-code tooling within the Stacks ecosystem. Their airdrop feature allows creators to batch-send SIP-010 tokens to target wallets based on snapshots, lists, or CSV uploads without having to write code from scratch.

Replicating and building an improved version of a Stacks batch-airdrop tool involves breaking down how it works under the hood and mapping out how to build a clone or competitor.

Part 1: How an Airdrop Tool Like STX.City Works

A batch-airdrop application typically consists of three primary layers: Data/Snapshots, Smart Contracts (Execution), and the Frontend/UX.

1. The Data Layer (Snapshot Engine)

Before any token moves, the app needs to know who gets what.

 * NFT/Token Holder Queries: If a user wants to airdrop to holders of a specific SIP-009 NFT collection or SIP-010 token, the backend queries an indexer (like the Hiro API) to fetch the current holder list and balances.

 * Custom Lists (CSV): If it's a manual drop, the app parses an uploaded CSV containing [wallet_address, amount].

2. The Execution Layer (Smart Contracts vs. Direct Calls)

On Stacks, batch transfers can be executed via two main design patterns:

 * The Smart Contract (Batch Transfer Contract): A deployed Clarity contract that accepts a list of recipients and amounts, loops through them, and executes stx-transfer? or calls the SIP-010 transfer function for each recipient in a single transaction.

   * Note on Stacks/Clarity: Clarity does not have traditional unbounded loops (for / while) to prevent infinite execution, meaning loops must use bounded functions like fold or be restricted to a specific maximum array length per transaction.

 * Frontend Batching (Multicall / Sequential Transactions): Alternatively, the frontend constructs a sequence of individual transaction payloads and prompts the user's wallet (e.g., Leather or Xverse) to sign them sequentially or use multi-transaction batching if supported.

3. The Frontend / Interface Layer

 * Users connect via Stacks Connect (@stacks/connect).

 * A step-by-step wizard: Select Token ➔ Select Target (NFT collection, token, or CSV) ➔ Preview Allocations ➔ Execute Airdrop.

 * An Airdrop Checker (similar to STX.City's tracker) allows recipients to connect their wallets later and see what they've been sent across different campaigns.

Part 2: How to Copy and Build Your Own Version

To build a competing or alternative airdrop app on Stacks, you can break development down into four core milestones:

Step 1: Set Up the Stacks Development Environment

 * Tooling: Use Clarinet (the standard development framework for Clarity smart contracts).

 * Libraries: Install @stacks/transactions and @stacks/connect in your frontend project (Next.js or React) to handle wallet connections and transaction building.

Step 2: Build the Snapshot Backend or Integration

Instead of building a heavy indexer from scratch, leverage existing infrastructure:

 * Use the Hiro API or Leather/Xverse developer tools to pull token holder data.

 * Write a lightweight Node.js/TypeScript script or API route that takes an NFT contract address, fetches all current owners, aggregates how many each wallet holds, and formats it into an array of objects: [{ address: "SP...", amount: 100 }, ...].

Step 3: Write the Clarity Batch-Transfer Contract

If you choose a smart contract-driven approach, you will write a Clarity contract that handles the distribution. A simplified conceptual layout involves a map or a list passed to a public function:

;; Example concept for a batch SIP-010 transfer helper

(define-public (batch-transfer (amounts (list 200 uint)) (recipients (list 200 principal)))

    (begin

        ;; Assert sender permissions, check balances, 

        ;; and use fold to iterate through the lists securely

        (ok true)

    )

)



 * Design Tip: Keep array size limits reasonable (e.g., max 100–200 addresses per transaction) to avoid hitting Stacks block limit constraints or running out of execution cost.

Step 4: Design a Clean, No-Code Frontend

Make the UX smoother or more feature-rich than existing alternatives. Key differentiators could include:

 * Multi-token support: Allow airdropping both fungible tokens and NFTs in one go.

 * Vesting/Claim links: Instead of forcing the project creator to pay all gas fees upfront via a "push" drop, offer a Claim Page (Pull Airdrop) where users sign a message or pay a tiny gas fee to claim their tokens using a Merkle tree proof.

 * Transparent Analytics: Build an integrated dashboard where users can track historical airdrops (just like an on-chain receipt ledger).

Where do you want to start?

Would you like to map out the Clarity smart contract logic for batch transfers, or set up the frontend wallet connection and snapshot script first?



I want to work this up

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stacks-airdrop-hero.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/68d8d70d-3c37-486f-9492-181316e931e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
