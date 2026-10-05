import { defineTool } from "@cursor/bdk/tools";
import { prompt } from "@cursor/bdk";
import { z } from "zod";

import {
  coverageStatusSchema,
  saveCampaignSynthesis,
  saveInterviewGuide,
  saveProductBrief,
  saveSessionNarrative,
  sessionStatusSchema,
} from "../lib/store.js";

const userInput = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  jobsToBeDone: z.array(z.string()).optional(),
});

const processInput = z.object({
  name: z.string().min(1),
  steps: z.array(z.string()).optional(),
});

const questionInput = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  why: z.string().min(1),
  probes: z.array(z.string()).optional(),
  successSignal: z.string().optional(),
});

const coverageInput = z.object({
  questionId: z.string().min(1),
  status: coverageStatusSchema,
  evidence: z.string().optional(),
});

const discoveryInput = z.object({
  theme: z.string().min(1),
  evidence: z.string().min(1),
  implication: z.string().min(1),
});

const themeInput = z.object({
  theme: z.string().min(1),
  supportingParticipants: z.array(z.string()).optional(),
  tension: z.string().optional(),
  implication: z.string().min(1),
});

export default defineTool({
  description: prompt`
    Save a discovery record and its markdown document.
    kind product_brief: product, users, and workflow. Replaces the saved brief.
    kind interview_guide: the question guide for one study.
    kind session: coverage, discoveries, and the participant note.
    Send the full coverage list. Raw transcript lines are preserved
    and cannot be edited here. status closed requires markdown.
    kind campaign: the merged synthesis across participants.
    participantCount is counted from stored sessions.
    Do not save a campaign on a partial live line.
  `,
  effect: "write",
  inputSchema: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("product_brief"),
      productName: z.string().min(1),
      summary: z.string().min(1),
      users: z.array(userInput).optional(),
      process: z.array(processInput).optional(),
      openQuestions: z.array(z.string()).optional(),
      markdown: z.string().min(1),
    }),
    z.object({
      kind: z.literal("interview_guide"),
      guideId: z.string().optional(),
      goal: z.string().min(1),
      audience: z.string().min(1),
      questions: z.array(questionInput).min(1),
      markdown: z.string().min(1),
    }),
    z.object({
      kind: z.literal("session"),
      guideId: z.string().optional(),
      participantId: z.string().min(1),
      participantName: z.string().optional(),
      meetingId: z.string().optional(),
      status: sessionStatusSchema.default("in_progress"),
      coverage: z.array(coverageInput).optional(),
      discoveries: z.array(discoveryInput).optional(),
      markdown: z.string().optional(),
    }),
    z.object({
      kind: z.literal("campaign"),
      guideId: z.string().optional(),
      themes: z.array(themeInput).optional(),
      markdown: z.string().min(1),
    }),
  ]),
  dryRunResult: (input) => ({ saved: false, dryRun: true, kind: input.kind }),
  async execute(input, ctx) {
    const kv = ctx.host.kv;
    const artifacts = ctx.artifacts;

    if (input.kind === "product_brief") {
      const product = await saveProductBrief(kv, artifacts, {
        productName: input.productName,
        summary: input.summary,
        users: (input.users ?? []).map((user) => ({
          name: user.name,
          role: user.role,
          jobsToBeDone: user.jobsToBeDone ?? [],
        })),
        process: (input.process ?? []).map((step) => ({
          name: step.name,
          steps: step.steps ?? [],
        })),
        openQuestions: input.openQuestions ?? [],
        markdown: input.markdown,
      });
      return { saved: true, kind: input.kind, productName: product.productName, updatedAt: product.updatedAt };
    }

    if (input.kind === "interview_guide") {
      const guide = await saveInterviewGuide(kv, artifacts, {
        guideId: input.guideId,
        goal: input.goal,
        audience: input.audience,
        questions: input.questions,
        markdown: input.markdown,
      });
      return {
        saved: true,
        kind: input.kind,
        guideId: guide.guideId,
        questionCount: guide.questions.length,
        updatedAt: guide.updatedAt,
      };
    }

    if (input.kind === "session") {
      const session = await saveSessionNarrative(kv, artifacts, {
        guideId: input.guideId,
        participantId: input.participantId,
        participantName: input.participantName,
        meetingId: input.meetingId,
        status: input.status,
        coverage: (input.coverage ?? []).map((item) => ({
          questionId: item.questionId,
          status: item.status,
          evidence: item.evidence ?? "",
        })),
        discoveries: input.discoveries ?? [],
        markdown: input.markdown ?? "",
      });
      return {
        saved: true,
        kind: input.kind,
        guideId: session.guideId,
        participantId: session.participantId,
        status: session.status,
        segmentCount: session.segments.length,
        updatedAt: session.updatedAt,
      };
    }

    const campaign = await saveCampaignSynthesis(kv, artifacts, {
      guideId: input.guideId,
      themes: (input.themes ?? []).map((theme) => ({
        theme: theme.theme,
        supportingParticipants: theme.supportingParticipants ?? [],
        ...(theme.tension ? { tension: theme.tension } : {}),
        implication: theme.implication,
      })),
      markdown: input.markdown,
    });
    return {
      saved: true,
      kind: input.kind,
      guideId: campaign.guideId,
      participantCount: campaign.participantCount,
      updatedAt: campaign.updatedAt,
    };
  },
});
