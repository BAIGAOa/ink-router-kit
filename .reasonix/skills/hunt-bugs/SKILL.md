---
name: hunt-bugs
description: Scan the codebase proactively for bugs — logic errors, edge cases, type unsoundness, resource leaks, concurrency races, and silent data corruption. Produces a ranked, evidence-backed report. Use when user says "find bugs", "audit for bugs", "scan for issues", "check for problems", or wants a fresh pair of eyes on the code.
argument-hint: "Which area to scan (module, pattern, or leave blank for whole project)?"
---

# Hunt Bugs

Proactively find bugs in the codebase. Unlike `/diagnose` (which deep-dives a known failure), this skill **surfaces unknown bugs** by scanning for common failure patterns.

When exploring the codebase, use the project's domain glossary so findings use the right vocabulary, and respect ADRs so you don't flag deliberate trade-offs as bugs.

## The Finding Categories

Every finding must fall into one of these. If it doesn't fit, it's probably not a bug — it's a style opinion or a missing feature. Don't report it.

| Category | What to look for |
|---|---|
| **Logic error** | Wrong operator (`<=` vs `<`), inverted condition, off-by-one, incorrect state transition, wrong default |
| **Edge case crash** | Empty collection, null/undefined dereference, zero division, negative input, overflow, truncation |
| **Type unsoundness** | `as` cast that lies, `any` leak that escapes, missing discriminant check, unsound type predicate |
| **Resource leak** | Unclosed handle (file, DB connection, socket), unsubscribed event/listener, un-released lock |
| **Concurrency race** | Shared mutable state without synchronisation, check-then-act gap, async iterator invalidation |
| **Silent data corruption** | Data loss in error path, partial write on failure, encoding mismatch, rounding accumulation |
| **Wrong error handling** | Swallowed error (`catch {}`), misclassified error, error that leaks internals to user, panic in library code |

## Process

### 1. Scope

If the user passed an argument (file, module, pattern), use it as the target. If not, ask: "Scan the whole project, or a specific area?" For whole-project scans, warn the user it may take time and produce a long report.

### 2. Surface scan — find hot spots

Use the `explore` subagent to walk the target area. Tell it to look for:

- Files with high complexity (deep nesting, long functions, many conditionals)
- Files with dense `as` casts, `!` assertions, or `@ts-ignore` / `@ts-expect-error`
- Files with TODO / FIXME / HACK / XXX comments
- Recent commits that touch error handling or async boundaries
- Functions with many parameters or complex boolean conditions

Return a ranked list of "hot spot" files with one-line rationale per file.

### 3. Deep scan — hunt per category

For each hot spot, read the file and check it against **every category in the table above** that is relevant to its domain (e.g. file I/O code gets resource-leak and silent-corruption checks; async code gets concurrency-race checks; API handlers get wrong-error-handling checks).

**Rules of engagement:**

- **Evidence over instinct.** Every finding must cite the exact line and explain the execution path that triggers the bug. "This looks suspicious" is not a finding.
- **One finding per root cause.** If the same bug pattern repeats (e.g. the same off-by-one in 3 places), report it once with all affected locations.
- **Test the callers.** A function with correct internals can still be buggy if one caller passes arguments in the wrong order or assumes a post-condition the function doesn't guarantee. Trace at least one call site per finding.
- **Check the deletions.** A bug is not just "code that does the wrong thing" — it's also "code that silently doesn't do the right thing." Look for missing validation, missing state transitions, missing cleanup after early return.

### 4. Rank by impact × likelihood

Score each finding:

```
Impact: critical (data loss / security / money)  |  major (wrong output)  |  minor (cosmetic)
Likelihood: certain  |  likely  |  plausible  |  speculative
```

Sort: critical+certain first, minor+speculative last.

### 5. Report

Present findings in this format:

```md
## Finding N: {Short Title}

- **File**: path/to/file.ts:42
- **Category**: Logic error
- **Severity**: major / likely

{
  One paragraph: what the code does, what it should do instead,
  and the exact execution path that demonstrates the gap.
}

**Fix**:
{A one or two sentence fix suggestion, with code sketch if short.
 Do NOT make the edit — this is a report, not a fix.}
```

End with:

```md
**Summary**: N findings — X critical, Y major, Z minor.
                                        (certain: A, likely: B, plausible: C, speculative: D)
```

### 6. Next steps

After the report, ask the user:

> "Which findings should I turn into issues (via `/to-issues`), diagnose further (via `/diagnose`), or fix?"

Do not proceed to fix anything unless the user tells you to.
