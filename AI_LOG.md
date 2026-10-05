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

### Slice 1: workspace scaffold, shared configs, CI, hygiene gate

- **A gate that could never fail.** The first hygiene script piped `git ls-files` into
  `xargs grep`, discarded stderr and treated every nonzero exit as "no match". The review
  reproduced an `xargs` exit code 123 followed by `hygiene: OK`. Fixed by scanning with `git grep`
  directly and mapping exit codes explicitly (0 found, 1 clean, anything else is a scan error that
  fails the gate), with negative tests for each path.
- **A gate that leaked what it found.** The secret scan printed the matching lines, which would
  copy a real key into CI logs. Fixed to print only `file:line`.
- **Hooks rules skipped custom hooks.** The shared ESLint React config applied `react-hooks` rules
  to `.tsx` files only, so a custom hook in a `.ts` file got no `rules-of-hooks` check. The review
  proved it with a conditional `useEffect` probe. Fixed by applying the hooks rules to both
  extensions and keeping the JSX-only rules separate.
- **Tooling side effect.** Turborepo 2.11 writes an `AGENTS.md` file into the repository on
  agent-driven runs; Claude noticed the untracked file and switched the `agentGuidance` option off
  so nothing unexpected lands in commits.
- **Plan inconsistency.** The plan named the third TypeScript config `worker.json` in one place and
  `function.json` in two others; Claude picked the name the rest of the plan depended on and
  flagged the discrepancy instead of guessing silently.
