/**
 * Automated screenshot capture for the dissertation figures.
 *
 * Run via `npm run screenshots` (which reseeds the DEMO database first so the
 * engineered numbers — Angelo at 161%, Sprint 1 forecast ~70% high — are live).
 * Starts the dev server itself if nothing is listening on :3000.
 *
 * Output: docs/screenshots/NN-name.png (1440×900 viewport, light theme) plus a
 * regenerated docs/screenshots/MANIFEST.md describing every figure. Captures
 * marked `element` are clean card/section crops for use as report figures;
 * `full` is a full-page scroll capture; `viewport` is the visible fold only.
 *
 * The script never mutates the seed: the actual-hours dialog is dismissed with
 * Escape (its cancel path), and the simulator is a read-only what-if.
 */
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "docs", "screenshots");
const VIEWPORT = { width: 1440, height: 900 };
const WIDE_VIEWPORT = { width: 2600, height: 900 }; // Kanban: 8 × 260px columns overflow 1440
const PASSWORD = "password123";

const SPRINT_1 = "Sprint 1 · PDP experience";
const SPRINT_0 = "Sprint 0 · Performance hardening";
const NOYZ = "NOYZ Storefront";

interface ManifestRow {
  file: string;
  role: string;
  route: string;
  shows: string;
  caption: string;
  mode: "full" | "viewport" | "element";
  note?: string;
}
const manifest: ManifestRow[] = [];

// ---------------------------------------------------------------------------
// Dev server management — start it only if nothing is listening.
// ---------------------------------------------------------------------------
async function serverUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await serverUp()) {
    console.log("dev server already running");
    return null;
  }
  console.log("starting dev server…");
  const proc = spawn("npm", ["run", "dev"], { stdio: "ignore", detached: false });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await serverUp()) {
      console.log("dev server ready");
      return proc;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  proc.kill();
  throw new Error("dev server did not become ready within 90s");
}

// ---------------------------------------------------------------------------
// Capture helpers
// ---------------------------------------------------------------------------

/** Wait for network idle AND for every loading skeleton to unmount. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => document.querySelectorAll(".animate-pulse").length === 0,
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForTimeout(600); // let Recharts finish its entry animation
}

/** The shadcn Card containing the given text (cards are never nested here). */
function card(page: Page, text: string): Locator {
  return page.locator("div.bg-card", { hasText: text }).first();
}

async function shotPage(
  page: Page,
  row: Omit<ManifestRow, "mode"> & { mode?: ManifestRow["mode"] }
): Promise<void> {
  const mode = row.mode ?? "full";
  await page.screenshot({
    path: path.join(OUT_DIR, row.file),
    fullPage: mode === "full",
  });
  manifest.push({ ...row, mode });
  console.log(`  ✓ ${row.file}`);
}

async function shotElement(
  target: Locator,
  page: Page,
  row: Omit<ManifestRow, "mode">
): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await target.screenshot({ path: path.join(OUT_DIR, row.file) });
  manifest.push({ ...row, mode: "element" });
  console.log(`  ✓ ${row.file}`);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
async function openContext(browser: Browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
    baseURL: BASE,
  });
  // Pin next-themes to light regardless of OS setting.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("theme", "light");
    } catch {}
  });
  return context;
}

async function login(page: Page, email: string, landing: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${landing}`, { timeout: 20_000 });
  await settle(page);
}

/** Open a Radix select and choose the option whose label contains `option`. */
async function choose(page: Page, trigger: Locator, option: string): Promise<void> {
  await trigger.click();
  await page.getByRole("option", { name: option }).first().click();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const startedServer = await ensureServer();
  const browser = await chromium.launch();

  try {
    // ------------------------------------------------------------------ logged out
    console.log("— logged out —");
    const anon = await openContext(browser);
    const anonPage = await anon.newPage();

    await anonPage.goto("/login");
    await anonPage.getByRole("button", { name: "Sign in" }).waitFor();
    await settle(anonPage);
    await shotPage(anonPage, {
      file: "01-login.png",
      role: "logged out",
      route: "/login",
      shows: "Login page with empty email/password form and Cadence branding",
      caption: "Figure: the sign-in screen. Authentication issues a JWT consumed by every API route.",
    });

    await anonPage.goto("/register");
    await anonPage.getByRole("button", { name: "Create account" }).waitFor();
    await settle(anonPage);
    await shotPage(anonPage, {
      file: "02-register.png",
      role: "logged out",
      route: "/register",
      shows: "Registration form (name, email, password)",
      caption:
        "Figure: self-registration. The server pins every new account to the developer role and leaves it unlinked until a manager grants access — fail-closed by design.",
    });
    await anon.close();

    // ------------------------------------------------------------------ manager
    console.log("— manager (admin@sprintplanner.com) —");
    const mgr = await openContext(browser);
    const m = await mgr.newPage();
    await login(m, "admin@sprintplanner.com", "/dashboard");

    await m.getByRole("heading", { name: "Dashboard" }).waitFor();
    await settle(m);
    await shotPage(m, {
      file: "03-manager-dashboard.png",
      role: "manager",
      route: "/dashboard",
      shows: "Stats cards, per-developer capacity summary, at-risk sprints, active sprints",
      caption: "Figure: the manager dashboard aggregating capacity state across all projects.",
    });

    await m.goto("/projects");
    await m.getByText(NOYZ).first().waitFor();
    await settle(m);
    await shotPage(m, {
      file: "04-projects-list.png",
      role: "manager",
      route: "/projects",
      shows: "All three seeded projects with sprint counts",
      caption: "Figure: the project portfolio (demo data derived from real agency work items).",
    });

    await m.getByText(NOYZ).first().click();
    await m.waitForURL("**/projects/**");
    await m.getByText(SPRINT_1).first().waitFor();
    await m.locator("svg.recharts-surface").first().waitFor();
    await settle(m);
    await shotPage(m, {
      file: "05-project-detail.png",
      role: "manager",
      route: "/projects/[id]",
      shows: `${NOYZ}: sprint grid (4 historic + Sprint 1) and the sprint velocity chart`,
      caption:
        "Figure: project detail with the velocity chart comparing planned against completed hours per sprint.",
    });

    // Select Sprint 1 explicitly from the grid, never by ordering.
    await card(m, SPRINT_1).getByRole("link", { name: "View Sprint" }).click();
    await m.waitForURL("**/sprints/**");
    await m.getByText("Sprint Forecast").waitFor();
    await m.getByText("Angelo Perera").first().waitFor();
    await settle(m);
    const sprint1Url = m.url();

    await shotPage(m, {
      file: "06-sprint-overview.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "Top of the sprint page: project/date badges, health badge with recommendation tooltip, burndown and forecast entering the fold",
      caption: `Figure: the ${SPRINT_1} detail page — the engineered overloaded sprint.`,
      mode: "viewport",
    });

    await shotElement(card(m, "Sprint Forecast"), m, {
      file: "07-sprint-forecast-card.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "ForecastCard: failure probability (~70%, High risk), headline, and all five contributor signals with points and plain-English detail",
      caption:
        "Figure: the five-signal sprint forecast. Each contributor is shown with its points and rationale, keeping the model explainable rather than black-box.",
    });

    // NOTE: overloaded capacity cards receive a bg-red override, and the Card's
    // cn()/tailwind-merge drops the conflicting `bg-card` class — so Angelo's
    // card cannot be found via div.bg-card. Target the cards grid directly.
    await m.getByText("Shared with 1 other sprint").first().waitFor();
    await shotElement(
      m.locator('div[class*="lg:grid-cols-4"]').first(),
      m,
      {
        file: "08-capacity-cards.png",
        role: "manager",
        route: "/sprints/[id] (Sprint 1)",
        shows: "Per-developer capacity cards. Angelo: ×1.28 factor badge, 36h active / 22.4h effective (161%), adj. 17.5h (206%), 12h/wk meetings, 'Shared with 1 other sprint · ×0.50 multi-project' naming Sprint 3",
        caption:
          "Figure: per-developer capacity cards showing the full multiplier chain — meetings, buffer, and the cross-sprint allocation factor compose into 22.4h effective capacity.",
        note: "The breakdown lines are always visible on these cards; nothing needed expanding.",
      }
    );

    await m.getByText("Rebalancing Suggestions").waitFor();
    await shotElement(card(m, "Rebalancing Suggestions"), m, {
      file: "09-rebalancing.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "Rebalancing panel: 'Mini cart UX improvements' (6h, medium) from Angelo to Kusalni, with projected utilisation for both (Angelo 134%, Kusalni 99%) and one-click Apply",
      caption:
        "Figure: automated rebalancing suggestion — the lowest-priority task that fits a teammate's remaining headroom is proposed for reassignment, with projected post-move utilisation for both developers.",
    });

    await shotElement(card(m, "Sprint Progress"), m, {
      file: "10-burndown.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "Burndown indicator: expected vs actual progress bars, status badge, day N of M",
      caption: "Figure: burndown comparing calendar-expected progress against completed hours.",
    });

    await m.getByRole("heading", { name: "Tasks" }).scrollIntoViewIfNeeded();
    await settle(m);
    await shotPage(m, {
      file: "11-task-table.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "Task table view: search, status filter, sortable columns, per-row status dropdown, priority badges, real ticket titles",
      caption: "Figure: the sprint task table (table view).",
    });

    // Kanban needs a wider viewport: 8 columns × 260px overflow 1440px.
    // Scoped to the Tasks header: rebalancing suggestion rows share the same
    // "rounded-lg border" classes and carry an Apply button, so an unscoped
    // locator can click Apply and reassign a task in the demo data.
    const toggle = m
      .getByRole("heading", { name: "Tasks" })
      .locator("xpath=..")
      .locator("div.rounded-lg.border button");
    await toggle.nth(1).click();
    await m.getByText("Released to Prod").first().waitFor();
    await m.setViewportSize(WIDE_VIEWPORT);
    await settle(m);
    await shotElement(m.locator("div.flex.gap-4.overflow-x-auto"), m, {
      file: "12-kanban.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "Kanban board with all eight workflow columns (Backlog → Released to Prod) and drag-and-drop task cards",
      caption:
        "Figure: the eight-state Kanban board. Only 'Released to Prod' is terminal for capacity purposes; a paused task still consumes capacity.",
      note: "Captured at a temporarily widened viewport (2600px) so all eight columns are visible — the board scrolls horizontally at the standard 1440px.",
    });
    await m.setViewportSize(VIEWPORT);

    // Actual-hours prompt: trigger from the table, capture, then CANCEL (Escape)
    // so the seed is never mutated.
    await toggle.nth(0).click();
    await m.locator("table tbody tr").first().waitFor();
    await m
      .locator("table tbody tr")
      .first()
      .locator('button[role="combobox"]')
      .click();
    await m.getByRole("option", { name: "Released to Prod" }).click();
    const dialog = m.locator('div[role="dialog"]', { hasText: "How long did it take?" });
    await dialog.waitFor();
    await shotElement(dialog, m, {
      file: "13-actual-hours-prompt.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 1)",
      shows: "The actual-hours dialog raised on any transition to Done: pre-filled with the estimate, Skip and Record hours actions",
      caption:
        "Figure: the actual-hours prompt — the data-collection point that feeds the per-developer estimation-accuracy factor. Skippable so it never blocks the workflow.",
      note: "Dismissed with Escape (the dialog's cancel path) after capture, so the task's status was not changed.",
    });
    await m.keyboard.press("Escape");

    // Retrospective notes carry seeded text only on HISTORIC sprints, so this
    // capture uses Sprint 0 rather than Sprint 1 (recorded as a discrepancy).
    await m.goto("/projects");
    await m.getByText("Aurora Living E-Commerce").first().click();
    await m.waitForURL("**/projects/**");
    await m.getByText(SPRINT_0).first().waitFor();
    await settle(m);
    await card(m, SPRINT_0).getByRole("link", { name: "View Sprint" }).click();
    await m.waitForURL("**/sprints/**");
    await m.getByText("Retrospective Notes").waitFor();
    await m.locator("#retro-notes").waitFor();
    await settle(m);
    await shotElement(card(m, "Retrospective Notes"), m, {
      file: "14-retro-notes.png",
      role: "manager",
      route: "/sprints/[id] (Sprint 0, Aurora Living E-Commerce)",
      shows: "Retrospective notes with the seeded free text, auto-save indicator",
      caption:
        "Figure: sprint retrospective notes (1s-debounce autosave). Manager-authored free text that names individuals — the reason this field is stripped wholesale from client responses.",
      note: "Discrepancy vs. brief: seeded retrospective text exists only on completed sprints, so this shows Sprint 0 · Performance hardening (an Aurora Living E-Commerce sprint), not Sprint 1.",
    });

    // Capacity page with Sprint 1 selected explicitly.
    await m.goto("/capacity");
    await m.getByRole("heading", { name: "Capacity Analysis" }).waitFor();
    await settle(m);
    await choose(m, m.locator('button[role="combobox"]').first(), SPRINT_1);
    await m.getByText("Angelo Perera").first().waitFor();
    await m.locator("svg.recharts-surface").first().waitFor();
    await settle(m);
    await shotPage(m, {
      file: "15-capacity-page.png",
      role: "manager",
      route: "/capacity (Sprint 1 selected)",
      shows: "Capacity bar chart (overloaded bars in red), developer workload table, simulator and heatmap below",
      caption: "Figure: the capacity analysis page for the overloaded sprint.",
    });

    await shotElement(card(m, "Ad-hoc Task Simulator"), m, {
      file: "16-adhoc-simulator-before.png",
      role: "manager",
      route: "/capacity (Sprint 1 selected)",
      shows: "Ad-hoc simulator in its empty state: developer picker, hours input, Simulate button",
      caption:
        "Figure: the ad-hoc what-if simulator before input — testing unplanned work against capacity without creating a task.",
    });

    const sim = card(m, "Ad-hoc Task Simulator");
    await choose(m, sim.locator('button[role="combobox"]'), "Kusalni Perera");
    await sim.locator('input[type="number"]').fill("20");
    await sim.getByRole("button", { name: "Simulate" }).click();
    await m.getByText("would overload this developer").waitFor();
    await settle(m);
    await shotElement(sim, m, {
      file: "17-adhoc-simulator-after.png",
      role: "manager",
      route: "/capacity (Sprint 1 selected)",
      shows: "Simulator result: Kusalni +20h — before/after assigned hours and utilisation, red overload warning",
      caption:
        "Figure: the simulator projecting that 20 additional ad-hoc hours would push the developer over effective capacity — overload detected before any commitment is made.",
    });

    await shotElement(card(m, "Developer Utilisation Across Sprints"), m, {
      file: "18-cross-sprint-heatmap.png",
      role: "manager",
      route: "/capacity",
      shows: "Heatmap grid: every developer × every sprint, colour-coded utilisation percentages",
      caption:
        "Figure: cross-sprint utilisation heatmap making multi-sprint workload patterns visible at a glance.",
    });

    await m.goto("/developers");
    await m.getByText("Angelo Perera").first().waitFor();
    await settle(m);
    await shotPage(m, {
      file: "19-developers-accuracy.png",
      role: "manager",
      route: "/developers",
      shows: "Developer table: weekly capacity, meetings/week, and the estimation factor column (×factor, trend arrow, sample size, confidence) for all five personas",
      caption:
        "Figure: learned estimation-accuracy factors — Angelo ×1.28 (under-estimates, n=15 high confidence), Kusalni ×0.81 (over-estimates), Abdulaziz at n=1 showing Bayesian shrinkage holding the factor near 1.0.",
    });

    await m.goto("/evaluation");
    await m.getByText("Forecast Calibration").waitFor();
    await m.locator("svg.recharts-surface").first().waitFor();
    await settle(m);
    await shotPage(m, {
      file: "20-evaluation.png",
      role: "manager",
      route: "/evaluation",
      shows: "Calibration chart (predicted failure bars vs actual completion line) and the four-sprint table with hit / false-alarm / missed-alarm counters",
      caption:
        "Figure: retroactive forecast evaluation — each completed sprint re-forecast using only data available at its start. 2 correct alarms, 0 false alarms, 0 missed alarms.",
    });

    await m.goto("/admin/users");
    await m.getByText("Accounts and access").waitFor();
    await settle(m);
    await shotPage(m, {
      file: "21-admin-users.png",
      role: "manager",
      route: "/admin/users",
      shows: "All accounts with role, linked developer profile, and client project access; the unlinked-account state visible",
      caption:
        "Figure: Team & Access — where a manager assigns roles, links login accounts to developer profiles, and scopes client access to projects.",
    });
    await mgr.close();

    // ------------------------------------------------------------------ developer
    console.log("— developer (angelo@sprintplanner.com) —");
    const dev = await openContext(browser);
    const d = await dev.newPage();
    await login(d, "angelo@sprintplanner.com", "/my-work");
    await d.getByText("Your current load").waitFor();
    await settle(d);

    await shotPage(d, {
      file: "22-my-work-overview.png",
      role: "developer",
      route: "/my-work",
      shows: "Top of My Work: open tasks (8 / 78h), sprints in flight (2), own estimation accuracy, per-sprint load cards with Sprint 1 at 161% overload",
      caption:
        "Figure: the developer's personal view — the only screen showing one person's total commitment across concurrent sprints. Teammates are absent from the API response, not hidden by the UI.",
      mode: "viewport",
    });

    await shotElement(card(d, "Why your capacity is split"), d, {
      file: "23-my-work-capacity-split.png",
      role: "developer",
      route: "/my-work",
      shows: "The multiplier-chain breakdown: weekly hours − meetings → × sprint weeks → × buffer → × cross-sprint split, reconciling to 22.4h effective",
      caption:
        "Figure: 'Why your capacity is split' — every multiplier in the capacity chain shown first-person, with the arithmetic reconciling to the final effective figure.",
    });

    const myTasks = d.getByRole("heading", { name: "My tasks" }).locator("xpath=..");
    await shotElement(myTasks, d, {
      file: "24-my-work-tasks.png",
      role: "developer",
      route: "/my-work",
      shows: "Personal task list across all sprints — Sprint column in place of Assignee, status changes and actual-hours logging enabled, no edit/delete",
      caption:
        "Figure: the developer's task list. The server strips assignee data for this role, so the table shows a Sprint column instead — a leak is impossible by construction.",
    });
    await dev.close();

    // ------------------------------------------------------------------ client
    console.log("— client (client-ecom@sprintplanner.com) —");
    const cli = await openContext(browser);
    const c = await cli.newPage();
    await login(c, "client-ecom@sprintplanner.com", "/portfolio");
    await c.getByText(NOYZ).first().waitFor();
    await settle(c);

    await shotPage(c, {
      file: "25-portfolio.png",
      role: "client",
      route: "/portfolio",
      shows: "Delivery landing: one project card (NOYZ Storefront) with completion percentage and the softened confidence label",
      caption:
        "Figure: the client's delivery portfolio — completion and a confidence band only. No developer names, utilisation figures, or capacity internals anywhere in the response.",
    });

    await c.getByText(NOYZ).first().click();
    await c.waitForURL("**/portfolio/**");
    await c.getByText("Overall progress").waitFor();
    await c.locator("svg.recharts-surface").first().waitFor();
    await settle(c);
    await shotPage(c, {
      file: "26-portfolio-project.png",
      role: "client",
      route: "/portfolio/[projectId]",
      shows: "Project drill-in: overall progress, in-flight sprint with burndown and confidence band, velocity chart, completed sprints — zero developer names",
      caption:
        "Figure: client project detail. BurndownIndicator and VelocityChart are reused verbatim from the manager UI because they are already free of per-person data — the page's safety is auditable from its import list.",
    });

    // Client forcing a manager route: the route guard bounces them to their
    // landing page (and the API would independently return 403s).
    await c.goto(sprint1Url);
    await c.waitForLoadState("networkidle");
    await c.waitForTimeout(800);
    const landedAt = new URL(c.url()).pathname;
    await shotPage(c, {
      file: "27-client-forbidden.png",
      role: "client",
      route: `/sprints/[id] (Sprint 1) → ${landedAt}`,
      shows: `Result of a client navigating directly to the Sprint 1 URL: the route guard redirects to ${landedAt}`,
      caption:
        "Figure: access denial for the client role. The client-side guard redirects to the delivery portfolio; independently, every sprint API endpoint returns 403 for this role (verified by the 48-check authorisation suite).",
      note: `Observed behaviour: redirect to ${landedAt} rather than a rendered 403 page — the UI guard is cosmetic, the API is the security boundary.`,
    });
    await cli.close();
  } finally {
    await browser.close();
    if (startedServer) {
      startedServer.kill();
      console.log("stopped the dev server this run started");
    }
  }

  writeManifest();
  console.log(`\n${manifest.length} screenshots captured → docs/screenshots/`);
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
function writeManifest() {
  const lines: string[] = [];
  lines.push("# Screenshot Manifest — Dissertation Figures");
  lines.push("");
  lines.push(
    `Generated ${new Date().toLocaleDateString("en-CA")} by \`npm run screenshots\` (reseeds the demo database, then captures via Playwright/Chromium at 1440×900, light theme).`
  );
  lines.push("");
  lines.push(
    "Capture modes: **full** = full-page scroll capture · **viewport** = visible fold only · **element** = cropped card/section (clean figure crops)."
  );
  lines.push("");
  lines.push("| File | Role | Route | Shows | Suggested caption | Mode |");
  lines.push("|---|---|---|---|---|---|");
  const ordered = [...manifest].sort((a, b) => a.file.localeCompare(b.file));
  for (const r of ordered) {
    const esc = (s: string) => s.replace(/\|/g, "\\|");
    lines.push(
      `| ${r.file} | ${r.role} | ${esc(r.route)} | ${esc(r.shows)} | ${esc(r.caption)} | ${r.mode} |`
    );
  }
  const notes = ordered.filter((r) => r.note);
  if (notes.length > 0) {
    lines.push("");
    lines.push("## Notes and discrepancies");
    lines.push("");
    for (const r of notes) lines.push(`- **${r.file}** — ${r.note}`);
  }
  lines.push("");
  writeFileSync(path.join(OUT_DIR, "MANIFEST.md"), lines.join("\n"));
  console.log("  ✓ MANIFEST.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
