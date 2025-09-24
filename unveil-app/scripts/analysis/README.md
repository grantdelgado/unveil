# Warnings Triage System

A comprehensive, read-only analysis system that collects, classifies, and reports warnings from across the development toolchain.

## Quick Start

Run the complete analysis:

```bash
node scripts/analysis/run-warnings-triage.mjs
```

This will:
1. Collect warnings from all tools (Next.js, TypeScript, ESLint, Playwright, Vitest, Markdown, Performance)
2. Unify and classify warnings with priority scoring
3. Generate a comprehensive triage report

## Output Files

- `docs/reports/warnings_triage_YYYYMMDD.md` - Main triage report
- `docs/reports/warnings_triage_YYYYMMDD.csv` - Full warning inventory  
- `docs/reports/warnings/raw/` - Raw tool outputs
- `docs/reports/warnings/json/` - Parsed JSON data

## Individual Collectors

You can also run collectors individually:

```bash
# Build warnings (Next.js/webpack)
node scripts/analysis/collect-build-warnings.mjs

# TypeScript diagnostics
node scripts/analysis/collect-typecheck-warnings.mjs

# ESLint warnings
node scripts/analysis/collect-eslint-warnings.mjs

# Performance/bundle analysis
node scripts/analysis/collect-perf-warnings.mjs

# Test warnings (Vitest)
node scripts/analysis/collect-vitest-warnings.mjs

# Browser console warnings (Playwright)
node scripts/analysis/collect-playwright-warnings.mjs

# Documentation issues (Markdownlint)
node scripts/analysis/collect-mdlint-warnings.mjs
```

## Priority Classification

**P0 (Critical)**: Score ≥70 points
- Security vulnerabilities
- Breaking deprecations
- Bundle size errors >250KB
- Runtime console errors

**P1 (High)**: Score ≥40 points  
- Performance warnings >220KB
- React warnings in core features
- Type issues with runtime impact

**P2 (Medium)**: Score <40 points

- Style/formatting issues
- Documentation problems
- Minor type warnings

## Scoring Factors

- **Severity**: Error (50), Warning (20), Info (5), Advisory (10)
- **Category**: Security (45), Deprecation (40), Performance (30), Runtime (35)
- **Frequency**: Multiple occurrences (+5 each, max +25)
- **File Impact**: Messaging features (+15), Host/Guest routes (+10)

## Integration

### CI/CD
Add to your pipeline:
```yaml
- name: Warning Triage
  run: node scripts/analysis/run-warnings-triage.mjs
  continue-on-error: true # Don't fail builds on warnings
```

### Pre-commit Hook
```json
{
  "scripts": {
    "pre-commit": "node scripts/analysis/run-warnings-triage.mjs --quick"
  }
}
```

### Weekly Reports
Schedule automated runs to track warning trends over time.

## No-Code-Change Guarantee

This system is **read-only**:
- ❌ No application code modifications
- ❌ No configuration changes  
- ❌ No dependency updates
- ❌ No rule modifications
- ✅ Only analysis and reporting

## Recommended Actions

1. **Review P0 issues immediately** - Security/breaking changes
2. **Schedule P1 fixes this sprint** - Quality/performance impact  
3. **Plan P2 items for future sprints** - Technical debt
4. **Track trends weekly** - Prevent warning accumulation
5. **Update team processes** - Based on common patterns

## Troubleshooting

**No warnings found**: This is good! Your codebase is clean.

**Collector fails**: Check tool availability (e.g., `pnpm`, `playwright`, `markdownlint`).

**Missing data**: Some collectors may skip if tools aren't configured.

**Performance**: Large codebases may take 5-10 minutes for full analysis.

## Architecture

```text
run-warnings-triage.mjs (Master orchestrator)
├── collect-*.mjs (Individual tool collectors)  
├── unify-warnings.mjs (Normalization & classification)
└── generate-warnings-report.mjs (Report generation)
```

Each collector outputs:

- Raw logs: `docs/reports/warnings/raw/`
- Structured JSON: `docs/reports/warnings/json/`

The unifier creates a single classified dataset with priority scoring.

The report generator produces human-readable Markdown and CSV exports.
