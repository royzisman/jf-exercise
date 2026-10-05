import { defineArtifacts } from "@cursor/bdk/artifacts";
import { z } from "zod";

export default defineArtifacts({
  kinds: {
    "product-brief": {
      description: "Saved product, users, and workflow.",
      schema: z.object({ productName: z.string(), summary: z.string() }),
    },
    "interview-guide": {
      description: "Question guide for one discovery study.",
      schema: z.object({
        guideId: z.string(),
        goal: z.string(),
        audience: z.string(),
        questionCount: z.number(),
      }),
    },
    "participant-discovery": {
      description: "Discovery note for one participant.",
      schema: z.object({
        guideId: z.string(),
        participantId: z.string(),
        participantName: z.string(),
        status: z.string(),
      }),
    },
    "campaign-synthesis": {
      description: "Discovery synthesis merged across participants.",
      schema: z.object({
        guideId: z.string(),
        participantCount: z.number(),
        themeCount: z.number(),
      }),
    },
    "live-coach": {
      description: "Latest coaching reply for one live interview.",
      schema: z.object({
        meetingId: z.string(),
        participantId: z.string(),
        guideId: z.string(),
      }),
    },
  },
});
