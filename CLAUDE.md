# CLAUDE.md: Church Workflow Backend

NestJS 10 + TypeScript + MongoDB (Mongoose). Modules in `src/modules`, schemas in `src/schemas`, shared helpers in `src/common`, one-off scripts in `src/scripts`.

## Non-negotiable: zero errors, zero warnings

Lint is part of the definition of done. Before reporting any task complete, run these from this directory and fix every problem they report. Never leave errors or warnings for later, and never claim work is done without running them.

```bash
npm run lint        # Must exit 0. Warnings fail the run (--max-warnings 0)
npm run typecheck   # Must exit 0
npm run build       # Must succeed before anything is deployed
```

- `npm run lint:fix` applies safe automatic fixes. Re-run `npm run lint` afterwards.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck and build on every PR and push. A red CI must never be merged or deployed.
- Never silence a problem to make it pass: no `eslint-disable`, `// @ts-ignore`, `// @ts-nocheck`, `as any` casts to dodge an error, or loosening rules in the ESLint config. If a rule is genuinely wrong for a case, stop and ask the user. `@ts-expect-error` is allowed only with a description of at least 10 characters.
- Do not introduce new warnings in files you touch, and fix existing ones in code you edit.

## Coding style rules (enforced by ESLint)

1. **Every function has braces, opening and closing.** This applies to function declarations, function expressions, methods and arrow functions. No implicit-return arrows.
   ```ts
   // Wrong
   const double = (n: number) => n * 2;
   items.map((i) => i.id);

   // Right
   const double = (n: number) => {
     return n * 2;
   };
   items.map((i) => {
     return i.id;
   });
   ```
   Enforced by `arrow-body-style: always`.
2. **Every `if` / `else` / `for` / `while` has braces**, even for a single statement (`curly: all`). Use 1TBS brace style: `} else {` on one line, no single-line blocks (`brace-style`).
3. No `else { if (...) }`. Use `else if` (`no-lonely-if`).
4. **No `console.*`** in committed code (`no-console`). Use the project logger or remove it.
5. **Comments start with a capital letter** (`capitalized-comments`). No `TODO` / `FIXME` at the start of a comment (`no-warning-comments`). Track those in the issue tracker.
6. **No unused variables or imports.** Prefix intentionally unused parameters with `_`.
7. Prefer real types over `any`. It is not blocked by lint, but do not add new `any` without a good reason.
8. Formatting is Prettier. Do not hand-format against it.

## Workflow rules

- Read a file before editing it, and match the conventions already used nearby.
- Keep changes scoped to the task. No drive-by refactors or reformatting of untouched code.
- Pre-commit hooks (Husky) run lint on staged files. Do not bypass them (`--no-verify`).
- Never apply database schema changes, run migrations, or edit schema definition files unless the user explicitly asks for it in that moment.

## Backend specifics

- Lint covers `src`, `apps`, `libs` and `test`. Prettier runs through ESLint (`prettier/prettier`), with single quotes and trailing commas.
- Validate all request input with DTOs using `class-validator`. Keep controllers thin and put logic in services.
- Do not log with `console.*`. Use the Nest `Logger`.
- Scripts under `src/scripts` follow the same lint rules as the rest of the code.
