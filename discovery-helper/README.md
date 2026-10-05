# Discovery helper

A product-discovery coach. It learns the product, the users, and the workflow, helps you design an interview, and turns a Teams transcript into notes.

During a call it coaches only you: what you just heard, the gap, and the single next question. When the interview ends it writes that person's discovery note and merges it into one synthesis across everyone in the study.

Playground and HTTP chat are always on. There is no Teams app in this kit, so the call itself stays in Teams. This agent receives transcript text. It does not join the meeting and it does not run speech-to-text.

## Defaults

- Product seed: the Spring Petclinic app in this repository. A saved brief replaces it.
- Model: `grok-4.5` with high effort.
- Channels: playground, HTTP, and `POST /v1/channels/teams/transcript`.
- No MCP servers. Set `TEAMS_WEBHOOK_TOKEN` to require a bearer token on the webhook.

## Run

From this directory, with Node 22:

```bash
npx bdk serve --dir . --mode single --dev
```

Model turns need a Cursor credential (`bdk login` or `CURSOR_API_KEY`). Tool checks do not.

Open the playground at `http://127.0.0.1:3000/playground`. Ask it to draft a guide, or paste a spoken line.

## Feed a Teams transcript

Point a relay (live captions, a Graph transcript export, or a manual forward) at:

```bash
curl -sS -X POST http://127.0.0.1:3000/v1/channels/teams/transcript \
  -H 'content-type: application/json' \
  --data-binary @fixtures/teams-chunk.json
```

The route answers `202` and starts a coaching turn. The same `meetingId` and `participantId` stay on one session, titled `Discovery · {name}`. Watch that session in the playground.

Send several cues as `lines`: `{ "speaker", "text", "spokenAt?", "questionId?" }`. Posting the same line again does not duplicate it.

End the interview with `"final": true`. The agent closes that person's note and refreshes the campaign synthesis.

In a multi-agent host the path is `/discovery-helper/v1/channels/teams/transcript`.

## Documents

Saved notes are artifacts:

- `product-brief`
- `interview-guide`
- `participant-discovery` — one person
- `campaign-synthesis` — every person on that guide
- `live-coach` — the latest coaching reply for a meeting

## Checks

```bash
npx bdk validate --dir .
npx bdk info --dir . --json
npx bdk call append_transcript --dir . --input '{"participantId":"riley","participantName":"Riley Chen","speaker":"participant","text":"Last Tuesday I searched three last names."}'
npm run check
```
