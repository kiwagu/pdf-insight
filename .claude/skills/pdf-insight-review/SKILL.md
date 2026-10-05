---
name: pdf-insight-review
description: Use when reviewing a PDF Insight slice (a branch diff against main) before it lands - the rubric for spec compliance, code quality and security, severities with file:line evidence, and the report format.
---

# PDF Insight: slice review

Every slice is reviewed against its requirements by an independent reviewer before it lands.
The reviewer did not write the code, and the author's report is a set of claims to verify, not
evidence.

## Inputs

- The slice's requirements.
- The change: `git log --oneline main..<branch>` and `git diff main...<branch>`.
- The gates, run on the branch: `bun install`, `bun run check`, and the tests of the touched
  workspaces.

## 1. Spec compliance

- **Missing**: a requirement with no code or no test.
- **Extra**: code, files, dependencies or behaviour the requirements did not ask for.
- **Misunderstood**: code that does something other than what a requirement means; quote both
  the requirement and the code.
- A defect that the requirements themselves mandate is reported as Important and labelled as such.

## 2. Code quality

- Separation: the domain stays pure, adapters live in the apps, ports are function-typed
  properties, and contracts are the only shared types (`.cursor/rules/hexagonal-boundaries.mdc`).
- Errors: every failure path ends in a defined error code; nothing is swallowed; only retryable
  errors are retried.
- Tests assert behaviour: they failed before the code existed (ask for the failing run), cover the
  negative paths, and would fail on a credible regression. A test that mirrors the implementation
  or only checks that a mock was called is a finding.
- Conventions: `.ts` extensions in relative imports, literal i18n keys with catalog parity, no
  `any`, no `console.log`, reuse over parallel implementations, one-line commit subjects.
- Docs: a changed export, command or env variable is reflected in the workspace README.

## 3. Security

- Secrets: no key, token or filled env file in the diff or the branch history; `bun run hygiene`
  is green.
- CORS: exact allow-list; a foreign or missing origin gets 403 and no CORS headers.
- Limits: body cap, rate limit, the schema caps on page text and images, the browser file checks.
- Injection: PDF content reaches the model only as data inside `<document>`; model output is
  schema-validated and rendered as text, never as HTML.

## Evidence

Prove each finding with a command, a failing test or a small probe (`bun -e '...'`, `curl`) and
quote its output, or quote the exact line. A claim without evidence is a question, not a finding.

## Severity

- **Critical**: wrong or unsafe behaviour, a leaked secret, data loss. Blocks landing.
- **Important**: the slice cannot be trusted until it is fixed (a missing requirement, an
  untested path, a broken gate). Blocks landing.
- **Minor**: polish. May be deferred with a note.

## Output format

```text
Verdict: Ready to land | Needs fixes

1. [Critical | Important | Minor] <short title>
   Where: path/to/file.ts:42
   Evidence: <command and output, or the quoted line>
   Why it matters: <one or two sentences>
   Fix: <the smallest change that resolves it>

Checked and fine: <what was verified, with the commands run>
```

## Re-review after a fix

Give each earlier finding a verdict, ADDRESSED or NOT ADDRESSED, with evidence. Inspect only the
fix diff for new breakage; anything outside it is an out-of-scope observation, not a blocker.
