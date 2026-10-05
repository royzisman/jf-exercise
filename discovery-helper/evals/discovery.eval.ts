import { defineEval, includes } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "plan-guide",
      description: "Loads context, then saves an interview guide without storing a transcript.",
      async test(t) {
        await t.send(
          "Load discovery context. If no product brief is saved, use the clinic product and save a brief. Then design and save an interview guide with id clinic-visits for receptionists who book pet visits. Do not append a transcript.",
        );
        t.succeeded();
        t.loadedSkill("host-discovery-session");
        t.calledTool("load_discovery");
        t.calledTool("save_discovery", { input: { kind: "interview_guide", guideId: "clinic-visits" } });
        t.notCalledTool("append_transcript");
      },
    },
    {
      id: "coach-line",
      description: "Stores one spoken line and coaches the next question.",
      async test(t) {
        await t.send(
          "This spoken line is not stored yet. Append it, then coach my next question. Do not write a campaign synthesis.\n\nGuide id: clinic-visits\nParticipant id: riley\nParticipant name: Riley Chen\nSpeaker: participant\nText: Last Tuesday I searched three last names before I found the right owner, and the visit form does not show which vet is free.",
        );
        t.succeeded();
        t.loadedSkill("host-discovery-session");
        t.toolOrder(["append_transcript", "save_discovery"]);
        t.calledTool("append_transcript", {
          input: { participantId: "riley", speaker: "participant" },
        });
        t.calledTool("save_discovery", { input: { kind: "session", participantId: "riley" } });
        t.check(t.reply, includes(/Next:/));
      },
    },
  ],
});
