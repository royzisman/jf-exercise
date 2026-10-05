import { createHash } from "node:crypto";

import type { ArtifactsApi } from "@cursor/bdk/artifacts";
import type { HostKvApi } from "@cursor/bdk/kv";
import { z } from "zod";

/** Raw lines kept per participant. Older lines drop first; notes stay. */
export const MAX_SEGMENTS = 1000;
const MAX_LINE_CHARS = 16_000;
const MAX_LINES_PER_CALL = 1000;

export const speakerSchema = z.enum(["interviewer", "participant", "unknown"]);
export const coverageStatusSchema = z.enum(["untouched", "partial", "saturated"]);
export const sessionStatusSchema = z.enum(["in_progress", "closed"]);

const userSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  jobsToBeDone: z.array(z.string()).default([]),
});

const processSchema = z.object({
  name: z.string().min(1),
  steps: z.array(z.string()).default([]),
});

const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  why: z.string().min(1),
  probes: z.array(z.string()).default([]),
  successSignal: z.string().default(""),
});

const segmentSchema = z.object({
  id: z.string(),
  speaker: speakerSchema,
  text: z.string(),
  spokenAt: z.string().optional(),
  questionId: z.string().optional(),
  truncated: z.boolean().optional(),
});

const coverageSchema = z.object({
  questionId: z.string().min(1),
  status: coverageStatusSchema,
  evidence: z.string().default(""),
});

const discoverySchema = z.object({
  theme: z.string().min(1),
  evidence: z.string().min(1),
  implication: z.string().min(1),
});

const themeSchema = z.object({
  theme: z.string().min(1),
  supportingParticipants: z.array(z.string()).default([]),
  tension: z.string().optional(),
  implication: z.string().min(1),
});

export const productBriefSchema = z.object({
  kind: z.literal("product_brief"),
  productName: z.string().min(1),
  summary: z.string().min(1),
  users: z.array(userSchema).default([]),
  process: z.array(processSchema).default([]),
  openQuestions: z.array(z.string()).default([]),
  markdown: z.string().min(1),
  updatedAt: z.string(),
});

export const interviewGuideSchema = z.object({
  kind: z.literal("interview_guide"),
  guideId: z.string(),
  goal: z.string().min(1),
  audience: z.string().min(1),
  questions: z.array(questionSchema).min(1),
  markdown: z.string().min(1),
  updatedAt: z.string(),
});

const profileSchema = z.object({
  participantName: z.string(),
  meetingId: z.string().optional(),
  status: sessionStatusSchema,
  updatedAt: z.string(),
});

const notesSchema = z.object({
  coverage: z.array(coverageSchema).default([]),
  discoveries: z.array(discoverySchema).default([]),
  markdown: z.string().default(""),
  updatedAt: z.string(),
});

const segmentsSchema = z.object({
  segments: z.array(segmentSchema).default([]),
  trimmed: z.boolean().default(false),
  updatedAt: z.string(),
});

export const sessionRecordSchema = z.object({
  kind: z.literal("session"),
  guideId: z.string(),
  participantId: z.string(),
  participantName: z.string(),
  meetingId: z.string().optional(),
  status: sessionStatusSchema,
  segments: z.array(segmentSchema).default([]),
  trimmed: z.boolean().default(false),
  coverage: z.array(coverageSchema).default([]),
  discoveries: z.array(discoverySchema).default([]),
  markdown: z.string().default(""),
  updatedAt: z.string(),
});

export const campaignSchema = z.object({
  kind: z.literal("campaign"),
  guideId: z.string(),
  participantCount: z.number().int(),
  themes: z.array(themeSchema).default([]),
  markdown: z.string().min(1),
  updatedAt: z.string(),
});

export const coachNoteSchema = z.object({
  meetingId: z.string(),
  participantId: z.string(),
  guideId: z.string(),
  participantName: z.string(),
  text: z.string(),
  updatedAt: z.string(),
});

export type ProductBrief = z.infer<typeof productBriefSchema>;
export type InterviewGuide = z.infer<typeof interviewGuideSchema>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export type CampaignRecord = z.infer<typeof campaignSchema>;
export type CoachNote = z.infer<typeof coachNoteSchema>;
export type Coverage = z.infer<typeof coverageSchema>;
export type Segment = z.infer<typeof segmentSchema>;

export const lineSchema = z.object({
  speaker: speakerSchema.default("unknown"),
  text: z.string().min(1),
  spokenAt: z.string().optional(),
  questionId: z.string().optional(),
});

export type TranscriptLine = z.infer<typeof lineSchema>;

const PRODUCT_KEY = "product";

export function slug(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new Error("An id is required.");
  }
  return cleaned.slice(0, 80);
}

export function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function guideKey(guideId: string): string {
  return `guide:${guideId}`;
}

function sessionKey(guideId: string, participantId: string): string {
  return `session:${guideId}:${participantId}`;
}

function profileKey(guideId: string, participantId: string): string {
  return `profile:${guideId}:${participantId}`;
}

function notesKey(guideId: string, participantId: string): string {
  return `notes:${guideId}:${participantId}`;
}

function segmentsKey(guideId: string, participantId: string): string {
  return `segments:${guideId}:${participantId}`;
}

function campaignKey(guideId: string): string {
  return `campaign:${guideId}`;
}

function guideIndexKey(): string {
  return "index:guides";
}

function sessionIndexKey(guideId: string): string {
  return `index:sessions:${guideId}`;
}

export function coachKey(meetingId: string, participantId: string): string {
  return `coach:${meetingId}:${participantId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function readJson<S extends z.ZodTypeAny>(
  kv: HostKvApi,
  key: string,
  schema: S,
): Promise<z.infer<S> | undefined> {
  const value = await kv.get(key);
  if (value === undefined) {
    return undefined;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

async function readIds(kv: HostKvApi, key: string): Promise<string[]> {
  const value = await kv.get(key);
  const parsed = z.array(z.string()).safeParse(value);
  return parsed.success ? parsed.data : [];
}

async function rememberId(kv: HostKvApi, key: string, id: string): Promise<void> {
  const ids = await readIds(kv, key);
  if (!ids.includes(id)) {
    ids.push(id);
    await kv.put(key, ids);
  }
}

function segmentId(line: { speaker: string; spokenAt?: string; text: string }): string {
  return createHash("sha256")
    .update(`${line.speaker}\n${line.spokenAt ?? ""}\n${line.text}`)
    .digest("hex")
    .slice(0, 16);
}

function clipLine(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_LINE_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, MAX_LINE_CHARS), truncated: true };
}

export async function loadProduct(kv: HostKvApi): Promise<ProductBrief | undefined> {
  return readJson(kv, PRODUCT_KEY, productBriefSchema);
}

export async function loadGuide(kv: HostKvApi, guideId: string): Promise<InterviewGuide | undefined> {
  return readJson(kv, guideKey(slug(guideId)), interviewGuideSchema);
}

export async function loadSession(
  kv: HostKvApi,
  guideIdInput: string,
  participantIdInput: string,
): Promise<SessionRecord | undefined> {
  const guideId = slug(guideIdInput);
  const participantId = slug(participantIdInput);
  const [profile, notes, segments] = await Promise.all([
    readJson(kv, profileKey(guideId, participantId), profileSchema),
    readJson(kv, notesKey(guideId, participantId), notesSchema),
    readJson(kv, segmentsKey(guideId, participantId), segmentsSchema),
  ]);
  if (!profile && !notes && !segments) {
    return undefined;
  }
  const updatedAt = [profile?.updatedAt, notes?.updatedAt, segments?.updatedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return {
    kind: "session",
    guideId,
    participantId,
    participantName: profile?.participantName ?? participantId,
    ...(profile?.meetingId ? { meetingId: profile.meetingId } : {}),
    status: profile?.status ?? "in_progress",
    segments: segments?.segments ?? [],
    trimmed: segments?.trimmed ?? false,
    coverage: notes?.coverage ?? [],
    discoveries: notes?.discoveries ?? [],
    markdown: notes?.markdown ?? "",
    updatedAt: updatedAt ?? nowIso(),
  };
}

export async function loadCampaign(kv: HostKvApi, guideId: string): Promise<CampaignRecord | undefined> {
  return readJson(kv, campaignKey(slug(guideId)), campaignSchema);
}

export async function loadCoach(
  kv: HostKvApi,
  meetingId: string,
  participantId: string,
): Promise<CoachNote | undefined> {
  return readJson(kv, coachKey(slug(meetingId), slug(participantId)), coachNoteSchema);
}

export async function saveCoach(kv: HostKvApi, note: CoachNote): Promise<void> {
  await kv.put(coachKey(note.meetingId, note.participantId), toJson(note));
}

async function rememberParticipant(kv: HostKvApi, guideId: string, participantId: string): Promise<void> {
  await rememberId(kv, sessionIndexKey(guideId), participantId);
  await rememberId(kv, guideIndexKey(), guideId);
}

export async function listParticipantIds(kv: HostKvApi, guideId: string): Promise<string[]> {
  return readIds(kv, sessionIndexKey(slug(guideId)));
}

type AppendOutcome = {
  appended: boolean;
  duplicate: boolean;
  tagged: boolean;
  truncated: boolean;
  addedCount: number;
  duplicateCount: number;
  guideId: string;
  participantId: string;
  participantName: string;
  meetingId?: string;
  status: SessionRecord["status"];
  segmentCount: number;
  trimmed: boolean;
  recentSegments: Segment[];
  coverage: Coverage[];
  discoveries: SessionRecord["discoveries"];
  guide: {
    guideId: string;
    goal: string;
    audience: string;
    questions: Array<{ id: string; prompt: string; why: string; probes: string[] }>;
  } | null;
  product: { productName: string; summary: string } | null;
};

export async function appendTranscript(
  kv: HostKvApi,
  input: {
    guideId?: string;
    participantId: string;
    participantName?: string;
    meetingId?: string;
    lines: TranscriptLine[];
  },
): Promise<AppendOutcome> {
  if (input.lines.length === 0) {
    throw new Error("Provide at least one transcript line.");
  }
  if (input.lines.length > MAX_LINES_PER_CALL) {
    throw new Error(`Send at most ${MAX_LINES_PER_CALL} lines per call.`);
  }

  const guideId = slug(input.guideId?.trim() || "default");
  const participantId = slug(input.participantId);
  const meetingId = input.meetingId?.trim() ? slug(input.meetingId) : undefined;
  const updatedAt = nowIso();
  const existing = await loadSession(kv, guideId, participantId);
  const session: SessionRecord = existing ?? {
    kind: "session",
    guideId,
    participantId,
    participantName: input.participantName?.trim() || participantId,
    meetingId,
    status: "in_progress",
    segments: [],
    trimmed: false,
    coverage: [],
    discoveries: [],
    markdown: "",
    updatedAt,
  };

  if (input.participantName?.trim()) {
    session.participantName = input.participantName.trim();
  }
  if (meetingId) {
    session.meetingId = meetingId;
  }

  let addedCount = 0;
  let duplicateCount = 0;
  let tagged = false;
  let truncated = false;

  for (const line of input.lines) {
    const clipped = clipLine(line.text.trim());
    if (!clipped.text) {
      continue;
    }
    truncated = truncated || clipped.truncated;
    const id = segmentId({ speaker: line.speaker, spokenAt: line.spokenAt, text: clipped.text });
    const prior = session.segments.find((segment) => segment.id === id);
    if (prior) {
      duplicateCount += 1;
      if (line.questionId && !prior.questionId) {
        prior.questionId = slug(line.questionId);
        tagged = true;
      }
      continue;
    }
    const segment: Segment = {
      id,
      speaker: line.speaker,
      text: clipped.text,
      ...(line.spokenAt ? { spokenAt: line.spokenAt } : {}),
      ...(line.questionId ? { questionId: slug(line.questionId) } : {}),
      ...(clipped.truncated ? { truncated: true } : {}),
    };
    session.segments.push(segment);
    addedCount += 1;
  }

  let trimmed = session.trimmed;
  if (session.segments.length > MAX_SEGMENTS) {
    session.segments.splice(0, session.segments.length - MAX_SEGMENTS);
    trimmed = true;
  }
  session.trimmed = trimmed;
  if (addedCount > 0) {
    session.status = "in_progress";
  }
  session.updatedAt = updatedAt;
  await kv.put(
    segmentsKey(guideId, participantId),
    toJson({ segments: session.segments, trimmed: session.trimmed, updatedAt }),
  );
  await kv.put(
    profileKey(guideId, participantId),
    toJson({
      participantName: session.participantName,
      ...(session.meetingId ? { meetingId: session.meetingId } : {}),
      status: session.status,
      updatedAt,
    }),
  );
  await rememberParticipant(kv, guideId, participantId);

  const guide = await loadGuide(kv, guideId);
  const product = await loadProduct(kv);
  const recent = session.segments.slice(-12);

  return {
    appended: addedCount > 0 || tagged,
    duplicate: duplicateCount > 0 && addedCount === 0,
    tagged,
    truncated,
    addedCount,
    duplicateCount,
    guideId,
    participantId,
    participantName: session.participantName,
    ...(session.meetingId ? { meetingId: session.meetingId } : {}),
    status: session.status,
    segmentCount: session.segments.length,
    trimmed: session.trimmed,
    recentSegments: recent,
    coverage: session.coverage,
    discoveries: session.discoveries,
    guide: guide
      ? {
          guideId: guide.guideId,
          goal: guide.goal,
          audience: guide.audience,
          questions: guide.questions.map((question) => ({
            id: question.id,
            prompt: question.prompt,
            why: question.why,
            probes: question.probes,
          })),
        }
      : null,
    product: product ? { productName: product.productName, summary: product.summary } : null,
  };
}

async function tagDocument(
  artifacts: ArtifactsApi,
  input: {
    kind: string;
    key: string;
    title: string;
    data: any;
    markdown: string;
  },
): Promise<void> {
  await artifacts.tag({
    kind: input.kind,
    key: input.key,
    title: input.title,
    data: input.data,
    contents: input.markdown,
    contentType: "text/markdown",
  });
}

export async function saveProductBrief(
  kv: HostKvApi,
  artifacts: ArtifactsApi,
  input: {
    productName: string;
    summary: string;
    users: ProductBrief["users"];
    process: ProductBrief["process"];
    openQuestions: string[];
    markdown: string;
  },
): Promise<ProductBrief> {
  const record: ProductBrief = {
    kind: "product_brief",
    productName: input.productName.trim(),
    summary: input.summary.trim(),
    users: input.users,
    process: input.process,
    openQuestions: input.openQuestions,
    markdown: input.markdown,
    updatedAt: nowIso(),
  };
  const parsed = productBriefSchema.parse(record);
  await kv.put(PRODUCT_KEY, toJson(parsed));
  await tagDocument(artifacts, {
    kind: "product-brief",
    key: PRODUCT_KEY,
    title: parsed.productName,
    data: toJson({ productName: parsed.productName, summary: parsed.summary }),
    markdown: parsed.markdown,
  });
  return parsed;
}

export async function saveInterviewGuide(
  kv: HostKvApi,
  artifacts: ArtifactsApi,
  input: {
    guideId?: string;
    goal: string;
    audience: string;
    questions: Array<{
      id: string;
      prompt: string;
      why: string;
      probes?: string[];
      successSignal?: string;
    }>;
    markdown: string;
  },
): Promise<InterviewGuide> {
  const guideId = slug(input.guideId?.trim() || "default");
  const record: InterviewGuide = {
    kind: "interview_guide",
    guideId,
    goal: input.goal.trim(),
    audience: input.audience.trim(),
    questions: input.questions.map((question) => ({
      id: slug(question.id),
      prompt: question.prompt.trim(),
      why: question.why.trim(),
      probes: question.probes ?? [],
      successSignal: question.successSignal?.trim() ?? "",
    })),
    markdown: input.markdown,
    updatedAt: nowIso(),
  };
  const parsed = interviewGuideSchema.parse(record);
  await kv.put(guideKey(guideId), toJson(parsed));
  await rememberId(kv, guideIndexKey(), guideId);
  await tagDocument(artifacts, {
    kind: "interview-guide",
    key: guideKey(guideId),
    title: `Guide ${guideId}`,
    data: toJson({
      guideId,
      goal: parsed.goal,
      audience: parsed.audience,
      questionCount: parsed.questions.length,
    }),
    markdown: parsed.markdown,
  });
  return parsed;
}

export async function saveSessionNarrative(
  kv: HostKvApi,
  artifacts: ArtifactsApi,
  input: {
    guideId?: string;
    participantId: string;
    participantName?: string;
    meetingId?: string;
    status: SessionRecord["status"];
    coverage: SessionRecord["coverage"];
    discoveries: SessionRecord["discoveries"];
    markdown: string;
  },
): Promise<SessionRecord> {
  const guideId = slug(input.guideId?.trim() || "default");
  const participantId = slug(input.participantId);
  const existing = await loadSession(kv, guideId, participantId);
  if (!existing && !input.participantName?.trim()) {
    throw new Error("participantName is required the first time you save this session.");
  }

  const coverage = input.coverage.length > 0 ? input.coverage : (existing?.coverage ?? []);
  const discoveries = input.discoveries.length > 0 ? input.discoveries : (existing?.discoveries ?? []);
  const markdown = input.markdown.trim() ? input.markdown : (existing?.markdown ?? "");
  const meetingId = input.meetingId?.trim()
    ? slug(input.meetingId)
    : existing?.meetingId;

  const record: SessionRecord = {
    kind: "session",
    guideId,
    participantId,
    participantName: input.participantName?.trim() || existing?.participantName || participantId,
    ...(meetingId ? { meetingId } : {}),
    status: input.status,
    segments: existing?.segments ?? [],
    trimmed: existing?.trimmed ?? false,
    coverage: coverage.map((item) => ({
      questionId: slug(item.questionId),
      status: item.status,
      evidence: item.evidence,
    })),
    discoveries,
    markdown,
    updatedAt: nowIso(),
  };

  if (record.status === "closed" && !record.markdown.trim()) {
    throw new Error("A closed session needs the participant discovery markdown.");
  }

  const parsed = sessionRecordSchema.parse(record);
  await kv.put(
    notesKey(guideId, participantId),
    toJson({
      coverage: parsed.coverage,
      discoveries: parsed.discoveries,
      markdown: parsed.markdown,
      updatedAt: parsed.updatedAt,
    }),
  );
  await kv.put(
    profileKey(guideId, participantId),
    toJson({
      participantName: parsed.participantName,
      ...(parsed.meetingId ? { meetingId: parsed.meetingId } : {}),
      status: parsed.status,
      updatedAt: parsed.updatedAt,
    }),
  );
  await rememberParticipant(kv, guideId, participantId);
  if (parsed.markdown.trim()) {
    await tagDocument(artifacts, {
      kind: "participant-discovery",
      key: sessionKey(guideId, participantId),
      title: `${parsed.participantName} discovery`,
      data: toJson({
        guideId,
        participantId,
        participantName: parsed.participantName,
        status: parsed.status,
      }),
      markdown: parsed.markdown,
    });
  }
  return parsed;
}

export async function saveCampaignSynthesis(
  kv: HostKvApi,
  artifacts: ArtifactsApi,
  input: {
    guideId?: string;
    themes: CampaignRecord["themes"];
    markdown: string;
  },
): Promise<CampaignRecord> {
  const guideId = slug(input.guideId?.trim() || "default");
  const participantIds = await listParticipantIds(kv, guideId);
  if (participantIds.length === 0) {
    throw new Error("No participant sessions are stored for this guide yet.");
  }
  const record: CampaignRecord = {
    kind: "campaign",
    guideId,
    participantCount: participantIds.length,
    themes: input.themes.map((theme) => ({
      ...theme,
      supportingParticipants: theme.supportingParticipants.map((id) => slug(id)),
    })),
    markdown: input.markdown,
    updatedAt: nowIso(),
  };
  const parsed = campaignSchema.parse(record);
  await kv.put(campaignKey(guideId), toJson(parsed));
  await rememberId(kv, guideIndexKey(), guideId);
  await tagDocument(artifacts, {
    kind: "campaign-synthesis",
    key: campaignKey(guideId),
    title: `Discovery synthesis ${guideId}`,
    data: toJson({
      guideId,
      participantCount: parsed.participantCount,
      themeCount: parsed.themes.length,
    }),
    markdown: parsed.markdown,
  });
  return parsed;
}

export async function roster(kv: HostKvApi, guideIdInput: string) {
  const guideId = slug(guideIdInput);
  const ids = await listParticipantIds(kv, guideId);
  const participants = [];
  for (const participantId of ids) {
    const session = await loadSession(kv, guideId, participantId);
    if (!session) {
      participants.push({ participantId, unreadable: true as const });
      continue;
    }
    participants.push({
      participantId: session.participantId,
      participantName: session.participantName,
      status: session.status,
      segmentCount: session.segments.length,
      hasDocument: session.markdown.trim().length > 0,
      updatedAt: session.updatedAt,
    });
  }
  const campaign = await loadCampaign(kv, guideId);
  return {
    guideId,
    participantCount: ids.length,
    participants,
    ...(campaign ? { campaignUpdatedAt: campaign.updatedAt } : {}),
  };
}

export async function campaignInputs(kv: HostKvApi, guideIdInput: string) {
  const guideId = slug(guideIdInput);
  const guide = await loadGuide(kv, guideId);
  const ids = await listParticipantIds(kv, guideId);
  const sessions = [];
  for (const participantId of ids) {
    const session = await loadSession(kv, guideId, participantId);
    if (!session) {
      sessions.push({ participantId, unreadable: true as const });
      continue;
    }
    sessions.push({
      participantId: session.participantId,
      participantName: session.participantName,
      status: session.status,
      meetingId: session.meetingId ?? null,
      segmentCount: session.segments.length,
      trimmed: session.trimmed,
      coverage: session.coverage,
      discoveries: session.discoveries,
      markdown: session.markdown,
      updatedAt: session.updatedAt,
    });
  }
  return {
    guideId,
    participantCount: ids.length,
    guide: guide
      ? {
          goal: guide.goal,
          audience: guide.audience,
          questions: guide.questions.map((question) => ({
            id: question.id,
            prompt: question.prompt,
          })),
        }
      : null,
    sessions,
  };
}
