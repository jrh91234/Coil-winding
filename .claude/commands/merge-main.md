Merge origin/main into the current branch and resolve conflicts.

Steps:
1. `git fetch origin main`
2. `git merge origin/main`
3. If conflicts: find all conflict markers with `grep -n "<<<<<<< HEAD"` in conflicted files
4. For each conflict: Read both sides, keep BOTH features (our branch + main), merge intelligently
5. Verify no conflict markers remain
6. Commit with message "Merge main and resolve conflicts in [files]"
7. Push to current branch

Key rules:
- NEVER delete features from either side
- When both sides modify the same section, combine both changes
- charts.js is ~2500 lines — use offset/limit to read only conflict areas
- After resolving, verify with `grep "<<<<<<< HEAD"` that no markers remain
