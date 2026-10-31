# Tests

- **Policy ID:** ENG-TEST-001
- **Version:** 1.1.0
- **Status:** Active
- **Effective Date:** 2026-10-22
- **Owner:** Homelab-Alpha
- **Applies To:** All repositories using GitHub Actions within the organization

> [!IMPORTANT]
>
> This is a living document and may be adjusted based on feedback and project
> priorities.

This document describes the testing standards, structure, and expectations for
the Kairos repository. All contributors are expected to follow these guidelines
when adding or modifying code.

<details>
  <summary>Table of Contents (click to expand)</summary>
  <p>

1. [Tests](#tests)
   1. [Purpose](#purpose)
   2. [Test Location](#test-location)
   3. [Test Types](#test-types)
      1. [Browser Smoke Test](#browser-smoke-test)
      2. [Mocked Home Assistant](#mocked-home-assistant)
      3. [What Is Not Tested](#what-is-not-tested)
   4. [Writing Tests](#writing-tests)
      1. [General Principles](#general-principles)
      2. [Naming Conventions](#naming-conventions)
      3. [Test Structure](#test-structure)
   5. [Running Tests](#running-tests)
   6. [Test Coverage](#test-coverage)
   7. [Tests in Pull Requests](#tests-in-pull-requests)
   8. [Linting and Static Analysis](#linting-and-static-analysis)
   9. [Revision History](#revision-history)

  </p>
</details>

## Purpose

Tests are the primary mechanism for verifying that the card behaves correctly
and continues to do so as the code evolves. A well-tested card makes refactoring
safer, bugs easier to catch, and reviews more confident.

Every contribution that changes behavior, whether a new feature or a bugfix, is
expected to include appropriate test coverage.

## Test Location

All tests live in the `tests/` directory at the root of the repository.

```treeview
tests/
├── smoke.cjs            # Browser smoke test: the card and the editor in Chromium
└── helpers/
    └── mock_hass.cjs    # Mocked Home Assistant and helpers to mount the card
```

## Test Types

The card is one dependency-free JavaScript file with no build step, so the tests
run the real file in a real browser instead of testing functions in isolation.

### Browser Smoke Test

`tests/smoke.cjs` uses Playwright (`playwright-core`) to open the card and the
visual editor in Chromium. Each `test...` function mounts the card with a
configuration, reads the result from the Shadow DOM, and reports one or more
checks.

It covers, among others:

- Price slots, bars, axes, and the summary for normal days and for the days when
  the clock changes (92 and 100 slots).
- Bad data: `unavailable` and `unknown` states, malformed rows, and missing
  tomorrow data.
- Configuration validation in `setConfig`, including rejected and ignored
  options.
- The visual editor: rows, dependencies, and the English and Dutch texts.
- The experimental update button for the dashboard resource.

### Mocked Home Assistant

`tests/helpers/mock_hass.cjs` replaces Home Assistant: it provides `hass`,
sensor states with `today` and `tomorrow` slots, recorder history, and the
language. Tests never make real network calls.

### What Is Not Tested

The smoke test cannot show how the card behaves in Home Assistant or on a real
phone or tablet. Those checks are done by the maintainer on real devices and are
recorded in `docs/project_status.md`. A pull request says clearly what was not
verified.

## Writing Tests

### General Principles

- **Test behavior, not implementation**: Write tests that verify _what_ the card
  shows, not _how_ it does it internally. This makes tests more resilient to
  refactoring.
- **One behavior per check**: Keep each check focused on a single outcome.
  Several comparisons are acceptable when they together verify one logical
  behavior.
- **Test edge cases**: Include tests for empty inputs, missing attributes,
  boundary conditions, and expected failure scenarios.
- **Keep tests independent**: A `test...` function launches its own browser page
  and must not depend on the result of another one.
- **Check the page errors too**: A test that mounts the card also checks that no
  page errors were raised.
- **Mock external dependencies**: Do not make real network calls or use a real
  Home Assistant in tests.

### Naming Conventions

Test functions and checks must use descriptive names that clearly communicate
what is being tested and what the expected outcome is.

| Item             | Convention                               | Example                                   |
| :--------------- | :--------------------------------------- | :---------------------------------------- |
| Test file        | Lowercase, in `tests/`                   | `smoke.cjs`                               |
| Helper file      | Lowercase with underscores               | `mock_hass.cjs`                           |
| Test function    | `test<Topic>` in camel case              | `testDst`, `testSource`                   |
| Check label      | A plain sentence that states the outcome | `title and icon are hidden for nord_pool` |
| Test data helper | Descriptive name in `tests/helpers/`     | `quarterSlots` in `mock_hass.cjs`         |

### Test Structure

Follow the **Arrange – Act – Assert** (AAA) pattern for all tests:

```js
async function testExample() {
  // Arrange
  const { browser, page, errors } = await launch({ width: 1300, height: 900 });
  await installMock(page, { view: "heatmap" }, { tomorrow: true });

  // Act
  const bars = await page.evaluate(
    () => window.card.shadowRoot.querySelectorAll(".bar-el").length
  );

  // Assert
  check("bars are drawn", bars > 0 && errors.length === 0, errors.join(" | "));
  await browser.close();
}
```

- **Arrange**: Launch the page, mount the card or the editor, and set up the
  mock data.
- **Act**: Read or trigger the behavior under test.
- **Assert**: Verify the outcome with `check(label, condition, detail)`.

Register a new `test...` function in the list at the end of `tests/smoke.cjs`.

## Running Tests

Tests are runnable from the root of the repository:

```bash
# Install the dev tooling once
npm ci

# Run the browser smoke test (needs Chromium)
npm run test:smoke

# Use an installed Chromium instead of the Playwright one
CHROMIUM_PATH=/path/to/chromium npm run test:smoke

# Lint and format check (Prettier, textlint, merge conflict markers)
npm run lint

# Repair formatting, wrapping, and terminology, then lint again
npm run lint:fix
```

All tests must pass locally before submitting a pull request. Do not rely on CI
to catch test failures that could have been caught locally.

## Test Coverage

There is no coverage tool. The guideline is to cover behavior, not lines:

- **Card logic** (`kairos_card.js`): Every new option, validation rule, and
  visible behavior gets a check. Price and time zone handling, including the
  days when the clock changes, must be thoroughly tested.
- **Editor**: Every new row has a label and a hint in English and Dutch; the
  translation test fails when one is missing.
- **Scripts** (`scripts/`): They have no automated tests. Run a changed script
  and say in the pull request how you checked it.

> [!IMPORTANT]
>
> A passing test suite alone is not a measure of quality. Prefer meaningful
> checks over checks written to make a number go up.

## Tests in Pull Requests

When submitting a pull request that changes behavior:

- [ ] Include new or updated tests that cover the changed behavior.
- [ ] Ensure all existing tests continue to pass.
- [ ] Describe how you tested your changes in the pull request template under
      the **Testing** section, and say what was not verified (a real Home
      Assistant, a real iPhone or iPad).

Pull requests that introduce behavioral changes without corresponding tests may
be asked to add coverage before the review is completed.

## Linting and Static Analysis

In addition to functional tests, automated quality checks run on every pull
request and on every push to `main`.

| Check                     | Tool                                       | Runs on               |
| :------------------------ | :----------------------------------------- | :-------------------- |
| Code style and formatting | Prettier (`npm run lint`)                  | Pull requests, `main` |
| Grammar and terminology   | textlint (`npm run lint`)                  | Pull requests, `main` |
| Merge conflict markers    | `.github/scripts/lint.sh` (`npm run lint`) | Pull requests, `main` |
| Workflow syntax           | actionlint (Super Linter)                  | `main`                |
| Secret detection          | Gitleaks (Super Linter)                    | `main`                |
| Infrastructure security   | Checkov (Super Linter)                     | `main`                |
| Environment files         | ENV linter (Super Linter)                  | `main`                |
| Browser smoke test        | Playwright (`npm run test:smoke`)          | Pull requests, `main` |

The browser smoke test runs on a pull request only when the card, `tests/`, or
the package files change; the check is still reported, so it can stay required.
Pull requests run the fast npm lint to save Actions minutes; Super Linter runs
the full set on `main`. The Super Linter settings are in
[`.github/super_linter.env`](./../super_linter.env) and the linter configuration
files are in `.github/linters/`. The required checks for a pull request are the
browser smoke test, the npm lint, and GitGuardian.

For more details on the linting setup, see
[code_style_and_standards_guides.md](../docs/code_style_and_standards_guides.md#linting).

## Revision History

| Version | Date       | Author        | Changes                                                                                    |
| :------ | :--------- | :------------ | :----------------------------------------------------------------------------------------- |
| 1.1.0   | 2026-10-25 | Homelab-Alpha | Describe the smoke test, the mocked Home Assistant, and the two-part linting of this card. |
| 1.0.0   | 2026-10-22 | Homelab-Alpha | Initial release.                                                                           |
