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

### Slice 2: contracts package (Zod schemas, identifiers)

- **Validation that only looked like validation.** The planned schema checked ISO formats with
  regular expressions, so `2026-02-30`, currency `ZZZ` and language `zz` all passed and would never
  have triggered the single retry the result contract requires. The review proved it with runtime
  probes. Fixed with a calendar-aware ISO date check and membership checks against ISO 639-1 and
  ISO 4217 code lists, plus negative tests for each case.
- **A hand-written list is a stale list.** The first ISO 4217 list was written from memory and
  missed `XAD` (added to the standard in 2025); the review knew the amendment. Fixed by reconciling
  the list against the official maintenance agency's `list-one.xml` (fetched 2026-10-05) and
  recording the source in the file.
- **Strictness has a cost the plan had not priced.** Claude pointed out that a strict membership
  check would reject documents with amounts in withdrawn currencies (for example HRK or BGN).
  Decision: accept withdrawn codes through a second list, because the boundary exists to reject
  garbage, not history.
- **Small API drift.** `z.number().finite()` is deprecated in zod 4 and does nothing, and a type
  cast in the JSON Schema export was unnecessary; lint flagged both. The shared ESLint configuration
  also needed an exception so config files outside a package's `tsconfig` are linted without type
  information.

### Slice 4: i18n package (catalogs, translator, parity gate)

- **Dictionary lookups that trusted the prototype.** The planned translator used `catalog[key]` and
  `key in catalog`, so a missing key named `constructor` or `toString` threw instead of falling back
  to the key, and the parity check could report two catalogs as equal when they were not. The
  review proved it with runtime probes. Fixed with own-property checks and regression tests.
- **A validator that warned on success.** The plan had the parity validator print "catalogs in
  sync" through the warning channel, which turned every lint run into noise. Fixed: success is
  silent, mismatches fail loudly.
- **Drafting shortcut caught.** The plan's Polish catalog was drafted without diacritics; Claude
  wrote proper Polish and corrected a typo in one value.

### Slice 3: domain package (ports, chunking, grounding, use cases)

- **The grounding design had two holes.** The plan grounded every amount against the PDF's text
  layer. Claude noticed that this would silently drop every amount read from a scanned page (an
  annex on a scanned page can change a fee, and such a page has no text layer), and that a sentence
  injected into the text is literally present in it, so grounding could never remove an amount it
  names. Decisions: amounts and dates now carry the page they were found on, grounding keeps items
  attributed to a scanned page, and resistance to injected instructions is the prompt's job, not the
  number check's.
- **A number tokenizer that fused table rows.** On a real contract the planned tokenizer missed 11
  of 44 genuine amounts: rows such as `55 350,00 12 730,50 68 080,50` were read as one number.
  Claude measured it, rewrote the tokenizer to read runs of digit groups, and added a regression
  test (0 of 44 missed).
- **Type-environment details the plan got wrong.** The package needed the DOM library for `Blob`
  and `setTimeout`, and port interfaces declared as methods tripped the `unbound-method` lint rule in
  tests; both were adjusted with the same public names.
