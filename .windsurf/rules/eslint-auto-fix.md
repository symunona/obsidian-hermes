---
description: Always run ESLint with auto-fix on edited files
---

# ESLint Auto-Fix Rule

This rule ensures that all TypeScript/TSX files are automatically linted and fixed when edited.

## When to apply
- After any file edit in the project
- Before commits
- During development

## How to use
1. Run ESLint with auto-fix on all TypeScript files:
   ```bash
   pnpm lint:fix
   ```

2. For specific files:
   ```bash
   eslint path/to/file.ts --fix
   ```

3. The lint:fix script in package.json will automatically fix all fixable issues

## Enforcement
- All edited files should pass ESLint with no warnings
- Use `pnpm lint:fix` to auto-fix issues before committing
- The `lint` script will fail if there are any warnings (max-warnings=0)
