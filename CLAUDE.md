# CLAUDE.md

## Spec-driven development with OpenSpec

This project uses **OpenSpec** for spec-driven development. Specs and change proposals live in the `openspec/` directory:

- `openspec/specs/` — the current, authoritative specs per capability (e.g. `dev-runtime`, `api-docs`, `env-validation`).
- `openspec/changes/` — in-progress change proposals (proposal, design, tasks, delta specs). Completed changes are moved to `openspec/changes/archive/`.
- `openspec/config.yaml` — OpenSpec configuration.

Workflow: propose a change (`/opsx:propose`), implement its tasks (`/opsx:apply`), sync delta specs into the main specs (`/opsx:sync`), then archive the change (`/opsx:archive`).

Before implementing a feature, check `openspec/specs/` for existing requirements and `openspec/changes/` for an active change covering it. Non-trivial features should go through an OpenSpec change proposal rather than being coded directly.
