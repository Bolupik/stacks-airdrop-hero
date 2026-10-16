import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const detectCsvColumns = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ sample: z.array(z.array(z.string().max(200)).max(30)).min(1).max(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { detectColumns } = await import("./csv-ai.server");
    try {
      return { ok: true as const, guess: await detectColumns(data.sample) };
    } catch (e) {
      const msg = (e as Error).message ?? "";
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { ok: false as const, error: "AI credits are used up for this workspace." };
      if (status === 429) return { ok: false as const, error: "AI is busy — try again in a minute." };
      return { ok: false as const, error: msg || "Couldn't read the file with AI." };
    }
  });
