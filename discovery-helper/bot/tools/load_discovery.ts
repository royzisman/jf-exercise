import { defineTool } from "@cursor/bdk/tools";
import { prompt } from "@cursor/bdk";
import { z } from "zod";

import {
  campaignInputs,
  loadCampaign,
  loadCoach,
  loadGuide,
  loadProduct,
  loadSession,
  roster,
  slug,
} from "../lib/store.js";

export default defineTool({
  description: prompt`
    Read the saved discovery record before you advise.
    view product: the product, users, and workflow.
    view guide: one interview guide (guideId).
    view session: one participant, including transcript lines (guideId, participantId).
    view roster: who has a session on a guide.
    view campaign_inputs: every participant note without raw lines, for a merge.
    view campaign: the saved cross-user synthesis.
    view coach: the last live coaching reply for a meeting.
    A missing record returns found false. Do not invent one.
  `,
  effect: "read",
  inputSchema: z.object({
    view: z.enum([
      "product",
      "guide",
      "session",
      "roster",
      "campaign_inputs",
      "campaign",
      "coach",
    ]),
    guideId: z.string().optional(),
    participantId: z.string().optional(),
    meetingId: z.string().optional(),
  }),
  async execute(input, ctx) {
    const kv = ctx.host.kv;
    if (input.view === "product") {
      const product = await loadProduct(kv);
      return product ? { view: "product" as const, found: true, product } : { view: "product" as const, found: false };
    }

    if (input.view === "coach") {
      if (!input.meetingId || !input.participantId) {
        throw new Error("coach requires meetingId and participantId.");
      }
      const coach = await loadCoach(kv, input.meetingId, input.participantId);
      return coach
        ? {
            view: "coach" as const,
            found: true,
            meetingId: slug(input.meetingId),
            participantId: slug(input.participantId),
            coach,
          }
        : { view: "coach" as const, found: false };
    }

    const guideId = input.guideId?.trim() || "default";

    if (input.view === "guide") {
      const guide = await loadGuide(kv, guideId);
      return guide
        ? { view: "guide" as const, found: true, guide }
        : { view: "guide" as const, found: false, guideId: slug(guideId) };
    }

    if (input.view === "campaign") {
      const campaign = await loadCampaign(kv, guideId);
      return campaign
        ? { view: "campaign" as const, found: true, campaign }
        : { view: "campaign" as const, found: false, guideId: slug(guideId) };
    }

    if (input.view === "roster") {
      return { view: "roster" as const, found: true, ...(await roster(kv, guideId)) };
    }

    if (input.view === "campaign_inputs") {
      return { view: "campaign_inputs" as const, found: true, ...(await campaignInputs(kv, guideId)) };
    }

    if (!input.participantId?.trim()) {
      throw new Error("session requires participantId.");
    }
    const session = await loadSession(kv, guideId, input.participantId);
    return session
      ? { view: "session" as const, found: true, session }
      : {
          view: "session" as const,
          found: false,
          guideId: slug(guideId),
          participantId: slug(input.participantId),
        };
  },
});
