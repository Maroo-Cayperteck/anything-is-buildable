<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Auto-Push & Sync Policy
- Whenever any updates or edits are made to this project, automatically stage, commit, and push them to GitHub on the `restore-working-version` branch (`git push origin HEAD:restore-working-version` or `git push origin restore-working-version`) immediately without waiting for the user to ask.
- Never force-push or rewrite already-pushed commits. If `origin/restore-working-version` is ahead, fetch and merge (`git merge origin/restore-working-version`, never rebase published commits) before pushing.
- After every push, verify that `git status` is clean, `git diff origin/restore-working-version` is empty, and `git rev-parse HEAD` matches `git rev-parse origin/restore-working-version` so the remote branch files match the local machine.
