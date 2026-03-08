# Project Agent Notes

- In Svelte template handlers (`on:click`, `on:keydown`, etc.), do not use TypeScript assertions with `as`.
- If type narrowing is needed for handler logic, move it into `<script lang="ts">` helper functions.
- Chat responses must always be in Russian.
- Code comments must always be in English.

## Reuse-First Rule (Anti-Copy-Paste)

Before adding any new method, helper, or feature logic:
1. Search for existing similar code first (helpers, utils, formatters, selectors, store actions, component-local functions).
2. Analyze whether existing code can be reused directly or generalized with minimal refactor.
3. If reuse/generalization is possible, prefer refactor + reuse over new duplicate logic.
4. If adding new code is still required, briefly document why existing code was not suitable.

Practical workflow:
- Start with targeted search (`rg`) by domain terms and behavior, not only exact names.
- Check nearby modules first (same feature folder), then shared libs (`src/lib/**`).
- Look for both explicit duplicates and logical duplicates (same behavior with different naming).
- When duplication is detected, propose and implement a small consolidation helper at the most stable shared layer.

## Non-obvious Bug Localization Protocol

Use this protocol only when:
- the bug source is not obvious from code inspection, or
- the first fix/search iteration did not resolve the issue.

Steps:
1. Reproduce exactly:
- lock one deterministic scenario (timestamp, roles, profile, wheel type, location, UI action sequence).
- avoid changing multiple variables at once.

2. Freeze output boundaries:
- identify final wrong output (UI/render/data object field).
- add one log at the final output boundary to capture incorrect values with context identifiers.

3. Move upstream by stages:
- split pipeline into 2-4 stages (input -> transform -> merge -> output).
- add 1-2 focused logs per iteration at stage boundaries, not inside every loop.
- each log must include stable correlation keys: `ts`, target/body id, source type, stage name.

4. Compare expected invariants:
- define numeric/logical invariants per stage (monotonicity, angle continuity, key matching, enabled flags, etc.).
- log only invariant violations or suspicious thresholds to reduce noise.

5. Isolate origin:
- if stage N is valid and N+1 is invalid, localize bug to transformation between them.
- explicitly mark safe zones (“validated, no anomaly”) to avoid re-checking them.

6. Cache vs compute check (mandatory for cached pipelines):
- log cached stats and fresh recompute stats for the same input.
- if cached bad + fresh good => invalidate cache path.
- if both bad => solver/algorithm issue.

7. Remove noisy diagnostics:
- once root cause is found, remove broad anomaly logs.
- keep only minimal targeted guards useful for regression detection.

8. Deliver fix with verification:
- implement smallest fix at root cause point.
- rerun deterministic scenario and confirm logs/invariants are clean.

Developer collaboration requirement:
- For each diagnostic iteration, ask the developer to save full expanded logs into `tmp/` as a separate file.
- After each iteration, explicitly request and reference the exact path (example: `tmp/anomaly-4.txt`).
- Use these files as the canonical evidence between iterations.
