## Breaking changes are encouraged

This project is very early stage, breaking things are encouraged and adviced.
No need for fallbacks, migrations and backward compatability.
The database can freely be cleaned and seeded as many times as needed.

## Disposable database

This project is pre-production. Local and test databases are disposable.

Prefer updating the baseline migration and resetting/reseeding the database. Do not add migrations, compatibility code, or data preservation unless explicitly requested.

## Mobile app

This is an iOS and Android app, not web. Test using an iOS simulator and computer use.

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies

## Effect

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

## Alchemy

When writing Alchemy v2 code, inspect @repos/alchemy/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Alchemy patterns.
