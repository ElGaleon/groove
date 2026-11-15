# CLAUDE.md — openspec/

Spec-driven workflow (OpenSpec, `schema: spec-driven` in `config.yaml`).

- `specs/<capability>/spec.md` — the current truth: requirements + scenarios per capability
  (vinyl-collection, discogs-integration, localization, record-ownership, purchase-map, …).
- `changes/<change>/` — in-flight work: `proposal.md` (why/what), `design.md` (how),
  `tasks.md` (checklist), `specs/` (delta specs: ADDED / MODIFIED / REMOVED requirements).
- `changes/archive/` — finished changes. Don't edit archived changes.

## Workflow (skills in `.claude/skills`, commands in `.claude/commands/opsx`)

1. `/opsx:explore` — think a problem through (no code).
2. `/opsx:propose` — create a change with proposal, design, specs and tasks.
3. `/opsx:apply` — implement tasks in order, ticking `tasks.md` as each is done.
4. `/opsx:sync` — merge delta specs into `specs/` without archiving.
5. `/opsx:archive` — sync and move the finished change into `archive/`.

Rules: keep code and specs consistent — if implementation diverges, update the change's
artifacts (`/opsx:update`) rather than leaving them stale. Match the existing style: headings
and keywords in English (`### Requirement:`, `#### Scenario:`, **WHEN/THEN**, SHALL), prose in
Italian. Scenarios should be testable (they map to pytest / vitest / Playwright tests).
