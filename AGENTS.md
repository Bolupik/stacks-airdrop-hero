<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Stacks wallet calls go through `@stacks/connect` loaded via dynamic import inside handlers/effects — it touches browser globals and must never run during SSR.
- Chain data comes from the public Hiro API directly from the browser (`src/lib/stacks.ts`) — no backend needed for reads.
- Airdrops execute through a per-user deployed Clarity helper contract (source in `airdropContractSource`), max 200 recipients per tx, with deny-mode FT post-conditions — keeps batches atomic and caps wallet spend.
- Campaign history lives in localStorage until a shared backend is added.
