// Builds docs/test-report.md from the Vitest JSON results + v8 coverage
// summary. Run via `npm run test:report`. The output is written to be pasted
// straight into the dissertation's Testing chapter.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = JSON.parse(readFileSync(path.join(root, "coverage/test-results.json"), "utf8"));
const coverage = JSON.parse(readFileSync(path.join(root, "coverage/coverage-summary.json"), "utf8"));

const date = new Date().toLocaleDateString("en-CA");
const lines = [];

lines.push("# Test Report — Capacity-Aware Sprint Planning System");
lines.push("");
lines.push(`**Generated:** ${date} · \`npm run test:report\``);
lines.push("");
lines.push(
  `**Result: ${results.numPassedTests}/${results.numTotalTests} tests passing** across ${results.testResults.length} files (${results.numFailedTests} failed).`
);
lines.push("");
lines.push(
  "Unit tests exercise the pure planning logic (capacity chain, multi-project factors, shrinkage, forecast signals, redaction whitelists); integration tests run against a dedicated PostgreSQL test database (`sprint_planner_test`), migrated and reseeded from `prisma/seed.ts` before every run. The HTTP-level authorisation boundary is covered separately by the 48-check suite in `scripts/authz-check.sh` (`npm run check:authz`), which exercises the running API with manager / developer / client tokens, including negative content scans of client responses for developer names."
);
lines.push("");

// --- per-file tables -------------------------------------------------------
const files = [...results.testResults].sort((a, b) => a.name.localeCompare(b.name));
for (const file of files) {
  const rel = path.relative(root, file.name);
  const ok = file.assertionResults.every((t) => t.status === "passed");
  lines.push(`## ${rel} ${ok ? "✅" : "❌"}`);
  lines.push("");
  lines.push("| Test | Result | ms |");
  lines.push("|---|---|---:|");
  for (const t of file.assertionResults) {
    const name = [...(t.ancestorTitles ?? []), t.title].join(" › ");
    const mark = t.status === "passed" ? "pass" : t.status === "failed" ? "**FAIL**" : t.status;
    lines.push(`| ${name.replace(/\|/g, "\\|")} | ${mark} | ${Math.round(t.duration ?? 0)} |`);
  }
  lines.push("");
}

// --- coverage --------------------------------------------------------------
const pct = (o) => `${o.pct}%`;
const total = coverage.total;
lines.push("## Coverage (src/services + src/lib)");
lines.push("");
lines.push("| | Statements | Branches | Functions | Lines |");
lines.push("|---|---:|---:|---:|---:|");
lines.push(
  `| **Total** | ${pct(total.statements)} | ${pct(total.branches)} | ${pct(total.functions)} | ${pct(total.lines)} |`
);
for (const [file, cov] of Object.entries(coverage)) {
  if (file === "total") continue;
  const rel = path.relative(root, file);
  lines.push(
    `| ${rel} | ${pct(cov.statements)} | ${pct(cov.branches)} | ${pct(cov.functions)} | ${pct(cov.lines)} |`
  );
}
lines.push("");
lines.push(
  "Coverage is scoped to the analytical core (`src/services/**`, `src/lib/**`); React components and API route handlers are exercised by the authz suite and manual browser verification rather than unit coverage."
);
lines.push("");

writeFileSync(path.join(root, "docs/test-report.md"), lines.join("\n"));
console.log(
  `docs/test-report.md written — ${results.numPassedTests}/${results.numTotalTests} passing, total line coverage ${total.lines.pct}%`
);
