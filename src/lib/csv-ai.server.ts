import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const schema = z.object({
  addressColumn: z.number().int().describe("0-based index of the column holding Stacks wallet addresses"),
  amountColumn: z.number().int().nullable().describe("0-based index of the token amount column, or null if none"),
  hasHeader: z.boolean().describe("true if the first row is a header row"),
  note: z.string().describe("one short sentence explaining the choice"),
});
export type ColumnGuess = z.infer<typeof schema>;

export async function detectColumns(sample: string[][]): Promise<ColumnGuess> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app.");
  const runId = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runId.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    output: Output.object({ schema }),
    instructions:
      "You inspect CSV samples for a Stacks token airdrop. Identify the column with Stacks addresses (start with SP, SM, ST or SN) and the column with the amount to send (a number; ignore balances only if a clearer amount/reward column exists). Columns are 0-based.",
    messages: [{ role: "user", content: `CSV rows (JSON array of rows):\n${JSON.stringify(sample)}` }],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.output;
}
