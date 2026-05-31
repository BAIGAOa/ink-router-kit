---
name: cover-with-tests
description: Write tests for existing business logic — analyse the code, identify the public behaviour surface, and generate tests at the correct seam. Use when user says "write tests for this", "add test coverage", "cover this with tests", "backfill tests", or has existing code that needs a test suite.
argument-hint: "Which module / file / feature to cover? (leave blank to pick interactively)"
---

# Cover With Tests

Write tests for code that already exists. Unlike `/tdd` (which drives design through tests), this skill **backfills tests** against a stable implementation — you read the code, identify the behaviour it already delivers, and lock it down with tests.

When exploring the codebase, use the project's domain glossary so test names and descriptions use the right vocabulary, and respect ADRs so you don't inadvertently test deprecated or transitional paths.

## Principles

These are non-negotiable. If a test violates one, don't write it.

- **Test behaviour, not implementation.** A test that breaks when you rename an internal function is testing the wrong thing. A test that survives a complete rewrite of the internals is testing the right thing.
- **The interface is the test surface.** Callers and tests cross the same seam. If you need to reach past the public API to get coverage, the module's shape is wrong — flag it, don't work around it.
- **One adapter = hypothetical seam. Two adapters = real seam.** Don't introduce mocks for modules that don't have at least two real implementations.
- **No coverage quotas.** 100% line coverage is a trap. Focus on critical paths, complex logic, and documented behaviour.
- **Don't test what tooling catches.** Don't test TypeScript types, ESLint rules, or obvious invariants the compiler already enforces.

## Process

### 1. Read — understand the public surface

Read the target file(s). Identify:

- **Public exports** — what does the module expose? Functions, classes, methods, constants?
- **Behaviour boundaries** — what are the observable outcomes? (return value, thrown error, side effect through an injected dependency, written file, emitted event)
- **Hidden complexity** — which parts have branching (`if`/`switch`/`match`), recursion, loops, arithmetic, or state transitions? Those earn their weight in tests.
- **Existing test file** — is there already a `*.test.*` or `*.spec.*` next to it? If yes, read it to understand what's already covered and what style the project uses.

Flag any **shallow module** that looks like it was extracted purely for testability (thin wrapper, no real logic). Don't write tests for it — tests for its caller will cover it.

### 2. Decide — which seam to test at

Check each caller pattern:

| If the exported function is called from… | Test at this seam |
|---|---|
| Other modules in the same project | The public export directly |
| An HTTP handler | The handler function (after extracting request parsing from business logic) |
| A React component | Extract logic to a pure function, test that |
| A CLI command | Extract the command handler's logic, test that |
| A database callback / trigger | Extract the business rule to a pure function, test that |

**Default: test the public export.** Only extract a seam if the current shape makes testing impossible without hitting infrastructure.

### 3. Map — list the behaviours to test

Write a list of behaviours, not test cases:

```
Behaviours of calculateDiscount(cart, coupon):
  - applies percentage discount
  - applies fixed-amount discount
  - caps discount at order total
  - returns 0 for empty cart
  - ignores expired coupon
  - stacks with in-progress sale
  - throws on negative coupon value
```

Show the list to the user before writing any code. Ask:

- Are these the right behaviours to lock down?
- Any you don't care about? Any missing?
- Are the error-case behaviours realistic?

Do not proceed without confirmation.

### 4. Write — one behaviour at a time

Write tests one at a time, in priority order:

```
① Happy path (primary behaviour)
② Known edge cases (from code reading or bug history)
③ Error paths (invalid inputs, precondition failures)
④ Boundary conditions (empty, max, off-by-one neighbours)
```

**Each test is one file write.** After writing, run the test suite to confirm it compiles and passes. If the test fails because the code has a bug, flag it as a **found bug** — do not silently adjust the test to match buggy behaviour.

### 5. Report

End with a summary:

```md
**Coverage added**: {N} tests across {M} behaviours.
**Seam**: {module path and public function(s)}
**Findings**:
  - {N} bugs found during testing (if any)
  - {N} shallow modules flagged
  - {N} behaviours deferred (confirmed with user)
```

## Anti-patterns — what to avoid

### Writing one giant test

```
// BAD: One test that checks everything
test("discount works", () => {
  expect(calc(cart, "P10")).toBe(90);
  expect(calc(cart, "FIX10")).toBe(90);
  expect(calc(emptyCart, "P10")).toBe(0);
  expect(calc(cart, expiredCoupon)).toBe(100);
});
```

One assertion fails → you don't know which behaviour broke. Each behaviour gets its own `test()`.

### Reaching into internals

```
// BAD: Uses private method or internal state
test("discount is applied", () => {
  const d = new DiscountEngine();
  d.apply(cart, "P10");
  expect(d.state.applied).toBe(true);
});
```

Tests `apply` by calling `apply` — checks nothing. Test through the public return value or observable effect.

### Testing the framework

```
// BAD: Tests that React/Express/Prisma work
test("renders without crash", () => {
  render(<MyComponent />); // framework already tested this
});
```

If the component has no business logic, it doesn't need a test. If it has logic, extract and test that.

## Integration notes

- If the user says "also add these to CI", point them at `setup-pre-commit` or the project's existing CI config — don't re-implement it here.
- If testing reveals the module is hard to test because of tangled dependencies, flag it for `/improve-codebase-architecture`.
- If a bug is found, suggest running `/diagnose` on it after the test is written.
