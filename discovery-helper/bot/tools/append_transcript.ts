import { defineTool } from "@cursor/bdk/tools";
import { prompt } from "@cursor/bdk";
import { z } from "zod";

import { appendTranscript, lineSchema, speakerSchema } from "../lib/store.js";

export default defineTool({
  description: prompt`
    Store spoken lines for one participant. Raw lines are kept here;
    do not rewrite them in save_discovery.
    Call this only for lines that are not already stored. If
    transcript-snapshot.json is present, those lines are already stored.
    The same line posted again is a duplicate and is not added twice.
    Pass guideId, participantId, and either text plus speaker, or lines.
  `,
  effect: "write",
  inputSchema: z.object({
    guideId: z.string().optional(),
    participantId: z.string().min(1),
    participantName: z.string().optional(),
    meetingId: z.string().optional(),
    speaker: speakerSchema.optional(),
    text: z.string().optional(),
    spokenAt: z.string().optional(),
    questionId: z.string().optional(),
    lines: z.array(lineSchema).optional(),
  }),
  dryRunResult: () => ({
    appended: false,
    duplicate: false,
    dryRun: true,
  }),
  async execute(input, ctx) {
    const lines = [...(input.lines ?? [])];
    if (input.text?.trim()) {
      lines.push({
        speaker: input.speaker ?? "unknown",
        text: input.text,
        ...(input.spokenAt ? { spokenAt: input.spokenAt } : {}),
        ...(input.questionId ? { questionId: input.questionId } : {}),
      });
    }
    return appendTranscript(ctx.host.kv, {
      guideId: input.guideId,
      participantId: input.participantId,
      participantName: input.participantName,
      meetingId: input.meetingId,
      lines,
    });
  },
});
