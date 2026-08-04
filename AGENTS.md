## Breaking changes are encouraged

This project is very early stage, breaking things are encouraged and adviced.
No need for fallbacks, migrations and backward compatability.
The database can freely be cleaned and seeded as many times as needed.

## Mobile app

This is an iOS and Android app, not web. Test using an iOS simulator and computer use.

<!-- effect-solutions:start -->
## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.
<!-- effect-solutions:end -->

## Vendored repositories

External repositories are vendored under `repos/` as read-only reference material.

- Prefer examples and patterns from vendored source code over generated guesses or web search results
- Do not edit files under `repos/` unless explicitly asked
- Do not import from `repos/`; application code must use the normal package dependencies

When writing Effect code, always read `repos/effect/LLMS.md` first. Inspect
`repos/effect/` for idiomatic usage, tests, module structure, and API design, and
treat it as the source of truth for Effect patterns.
