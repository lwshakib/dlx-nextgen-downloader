# Generic Multi-Commit Workflow

This guide provides instructions for an AI to perform multiple individual file commits quickly and efficiently on any project.

## Instructions for AI

When asked to commit and push changes, follow these exact steps:

1. **Check Status**: First, run `git status` to see all modified, added, or deleted files in the working directory.
2. **Analyze Changes**: For each file listed in the status, determine a concise, descriptive commit message explaining the specific change made to that file.
3. **Construct Command**: Build a single command line string that chains the `git add` and `git commit` commands for each individual file using semicolons (`;`). End the chain with a `git push`.
   - *Format:* `git add <file1>; git commit -m "<message1>"; git add <file2>; git commit -m "<message2>"; ... ; git push`
4. **Execute**: Run the constructed combined command in the terminal to commit and push everything at once.

## Example Scenario

If `git status` shows that `src/index.ts` and `package.json` were modified, the AI should construct and run a command exactly like this:

```powershell
git add src/index.ts; git commit -m "feat: implement new authentication flow"; git add package.json; git commit -m "chore: add jsonwebtoken dependency"; git push
```

By following this exact pattern, the AI ensures a clean, per-file commit history while completing the entire push process as fast as possible.
