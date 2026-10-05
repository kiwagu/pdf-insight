# AI log

How AI tools took part in building PDF Insight: which tools did what, the prompts that mattered,
and where the AI was wrong and how that was corrected. The entries were written as the work landed,
one per slice.

## Tools

- **Claude Code** (Anthropic) was the working environment. A planning session produced the design
  and a slice-by-slice plan; each slice was then implemented by Claude (Opus 5.5) from a written
  task description, tests first, and landed on `main` only after a review.
- **Codex CLI** (OpenAI, model gpt-6-astra) reviewed every slice independently: it read the diff in
  a read-only sandbox against the task description and a fixed checklist (requirements, code
  quality, security) and returned findings with file and line. Fixes went back through the same
  review before the slice landed.
- **Claude** (Anthropic Messages API, structured outputs) is also the model inside the product: the
  Edge Function asks it for the summary and the structured JSON.

## Key prompts

1. **The task prompt** (per slice): "Read the task description first; it is the requirements, with
   the exact values to use verbatim. Implement exactly what it specifies: write the failing tests
   first, run them, implement, run them green, commit with a one-line Conventional Commit subject,
   review your own diff and report. If anything is unclear, ask before starting; if you are in
   over your head, say so."
2. **The review prompt** (per slice): "Compare the diff against the requirements: missing, extra,
   misunderstood. Treat the report as claims to verify, not as evidence. Cite file:line for every
   finding. Severity: Critical (wrong or unsafe behaviour, a leaked secret), Important (the change
   cannot be trusted until fixed), Minor (polish). If the requirements themselves mandate a
   defect, report it as Important and say so."
3. **The follow-up review prompt** (after a fix): "Give each earlier finding a verdict, addressed
   or not, with evidence. Inspect only the fix diff for new breakage; anything outside it is an
   observation, not a blocker."

The analyzer's own system prompt (the one sent with every model call) is added here once the
API slice exists.

## Where the AI was wrong and how it was fixed
