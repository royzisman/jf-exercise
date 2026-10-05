import { defineAgent } from "@cursor/bdk";

export default defineAgent({
  name: "Discovery Helper",
  description:
    "Coaches product-discovery interviews, structures transcript lines by question, and merges participant notes into one campaign synthesis.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  // Transcript text is untrusted. Keep the shell off and the harness sandboxed.
  local: { sandbox: true },
  tools: ["read", "grep", "glob", "ls"],
});
