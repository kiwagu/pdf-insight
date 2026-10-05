---
name: pdf-insight-release
description: Use when a reviewed PDF Insight slice is to be landed on main - the separate landing decision, gates on a clean tree, the squash with its trailer, the AI_LOG commit, and the owner's publish step.
---

# PDF Insight: landing a slice

Three separate steps, each a deliberate decision:

1. **Review.** An independent reviewer returns a verdict on the slice's branch. A "Ready to land"
   verdict approves the code; it is not approval to land it.
2. **Landing.** The maintainer running the process lands the slice on the local `main`, as a
   step of its own, after the verdict: a squash commit, then the slice's AI_LOG commit.
3. **Publishing.** Pushing `main` to GitHub is a further explicit action of the owner. Agents
   never push. The push is what runs CI and the deploy workflows.

## Before landing

- The slice lives on its own branch cut from `main` (`feat/<slice>`); review fixes are commits on
  that same branch.
- The review verdict is Ready to land: no open Critical or Important finding.
- The tree is clean: `git status --porcelain` prints nothing.
- The gates pass on the branch:

```bash
bun install --frozen-lockfile
bun run check
VITE_API_URL=https://example.invalid bun run build
```

## Squash landing

```bash
git switch main
git merge --squash feat/<slice>
git commit -m "<type>(<scope>): <one-line subject>" -m "Squashed-from: feat/<slice> (<short-sha>)"
```

- One commit per slice on `main`: one `-m` with the one-line Conventional Commit subject, and a
  second `-m` with the `Squashed-from` trailer naming the branch and its head commit. No body.
- Keep the branch: it is the step-by-step history the squash collapses.
- If the slice added a workspace (a new `apps/*` or `packages/*`), run
  `bun install --frozen-lockfile` on `main` right after the squash. The lockfile already lists
  the workspace, but `node_modules` has no link for it yet, and `bun run check` fails with
  `command not found` inside the new workspace until it does.
- Run the gates again on `main`: `bun run check` and the build with `VITE_API_URL` set.

## AI_LOG entry

Right after the squash, add the slice's section to `AI_LOG.md` under "Where the AI was wrong and
how it was fixed": review findings that required changes, defects found in the requirements while
implementing, tooling side effects. Write it for a reader who has only the repository. It is a separate
commit on `main`, for example `docs(ai-log): lessons from the domain slice`.

## After the owner publishes `main`

- `ci.yml` runs the gates on every push and pull request.
- `deploy-web.yml` runs on every push to `main`: the gates, the web build with `VITE_API_URL` and
  `VITE_REPOSITORY_URL`, and the GitHub Pages deployment.
- `deploy-api.yml` runs when the push touches `apps/api`, `packages`, `supabase` or the workflow
  itself: the gates, `supabase secrets set`, then `supabase functions deploy analyze`.
- Then check that the Pages site loads and that `GET <VITE_API_URL>/healthz` with an allowed
  `Origin` answers `ok: true`.
