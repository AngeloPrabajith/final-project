# Capacity-Aware Sprint Planning System

> CS6P05NM — Final Year Project · London Metropolitan University

A web application for **capacity-aware sprint planning with predictive overload detection**. Unlike conventional task trackers, this system actively models developer workload, flags overload risk before it materialises, and provides data-driven recommendations to help engineering teams plan more realistic sprints.

---

## What Makes This Different

Most sprint planning tools (Jira, Trello, Asana) are fundamentally **task trackers**. They show you what work exists but give you no signal about whether your team can actually deliver it. This system is built around a different premise:

> **Can the team actually deliver this sprint?**

Every feature is designed to answer that question — before the sprint starts, not after it fails.

| Common Tools | This System |
|---|---|
| Assign tasks freely, no capacity check | Flags overload the moment you exceed effective capacity |
| Binary done/not-done tracking | Sprint health score (0–100) with degradation breakdown |
| Manual workload balancing | Automated rebalancing suggestions with one-click apply |
| No historical analysis | Sprint velocity chart showing planned vs completed across all sprints |
| No sprint lifecycle closure | Retrospective notes with auto-save per sprint |
| Table-only task view | Kanban board with drag-and-drop status management |
| One view for everyone | Manager, developer and client each get a different application, enforced server-side |

---

## Feature Overview

### Role-Based Access *(new)*

Three roles, three different applications behind one login screen. Access is **enforced server-side** — every API route resolves the caller's role, scopes its queries, and returns 403 rather than relying on the UI to hide things.

| | Project Manager | Developer | Client |
|---|---|---|---|
| Lands on | `/dashboard` | `/my-work` | `/portfolio` |
| Sees | Everything — capacity, forecasts, evaluation, all projects | Only their own workload | Only projects granted to them |
| Can change | Everything | Status + actual hours on their own tasks | Nothing |
| Per-developer data | Full | Own only | **None** |

**Developer — "My Work".** Their tasks across every sprint, their own utilisation per in-flight sprint, their own estimation factor, and a *"Why your capacity is split"* breakdown showing every multiplier the engine applies — hours after meetings, planning buffer, the `1/(N+1)` allocation split, and the context-switch penalty — with the arithmetic reconciling to the final figure. This is the only view in the system that shows one person's **total** commitment across concurrent sprints, which is precisely the multi-project case the interim report names as unaddressed by existing tools. Teammates are invisible: not hidden by the UI, but absent from the API response.

**Client — "Delivery".** Progress on their projects only: completion percentage, sprint burndown, velocity history, and a delivery-confidence traffic light. The forecast is deliberately reduced to a band — the full object's `headline` reads *"70% chance this sprint misses commitment"* and each contributor's `detail` string interpolates developer names, so it is withheld wholesale rather than filtered.

**Manager — "Team & Access".** Set roles, link a login to a developer profile, and grant clients project access. Guards against demoting the last manager and against the unique-constraint collision when re-linking.

**How identity works.** `User` (login) and `Developer` (capacity entity) are separate models joined by a nullable, unique `Developer.userId`. An account can exist without a developer profile — self-registration creates exactly that — and until a manager links it, it can read nothing. Access is deny-by-default throughout: an unrecognised role normalises to `client`, and a client with no `ProjectClient` grants sees an empty portfolio rather than everything.

Verify it yourself:

```bash
npm run check:authz
```

48 checks covering status codes, row-level scoping, ownership, the field allow-list, and a content scan of every client-facing response for developer names and capacity internals.

---

### Predictive Layer

**Per-developer estimation-accuracy factor**
Every developer accrues a learned factor = `Σ actual / Σ estimated` across their completed tasks over the last 90 days. Bayesian shrinkage toward 1.0 for small samples (pseudo-count `k = max(0, 10 − n)`) prevents a new hire with two tasks from getting a wild factor. Factor > 1 means the developer under-estimates; factor < 1 means they over-estimate. The factor is surfaced as a badge on the capacity cards and in a dedicated column on the developers page, with `low / medium / high` confidence and an `improving / stable / degrading` trend when there's enough sample.

**Sprint forecast (probability + contributors)**
A forward-looking probability score (0–100%) shown on every sprint page. Unlike the static health score, the forecast combines five signals into a weighted model:

| Signal | Max | What it measures |
|---|---:|---|
| Team utilisation | 40 | Peak adjusted utilisation across developers (factor-aware) |
| Ad-hoc history | 20 | Fraction of unplanned hours in the project's last 2 completed sprints |
| Velocity trend | 15 | Completion rate across the project's last 3 historical sprints |
| Days remaining | 15 | Gap between hours remaining and time left at team pace |
| Estimation accuracy | 10 | Weighted team-factor deviation from 1.0, asymmetrically penalising under-estimators |

Raw points are squashed through `1 − exp(−raw / 40)` into a probability, banded as `low / moderate / high / critical`. Every contributor is displayed with its points and a plain-English detail line, so the forecast is explainable rather than black-box.

**"How long did it actually take?" prompt**
When a task transitions to Done (table dropdown or Kanban drag), a small dialog asks for the actual hours, pre-filled with the estimate. A Skip button keeps friction low when you don't know or don't care. Each confirmed answer feeds the next forecast.

**`DeveloperActivity` — ready for GitHub ingestion** *(Phase 2)*
A separate table captures per-day commit / PR / review counts. Today it's populated by the seed with 12 weeks of believable mock data. Phase 2 will swap in a live GitHub client writing into the same table via `POST /api/activity/ingest`. The `(source, externalRef)` unique constraint makes webhook dedup a one-line change.

**Multi-project capacity modelling** *(new)*
A developer assigned to N other concurrent sprints has each sprint's effective capacity scaled by `1 / (N + 1)` (allocation factor) and `1 − 0.20 × max(0, N − 1)` (context-switch penalty, literature-supported). The capacity card on the sprint page shows "Shared with 2 other sprints · ×0.27 multi-project" when this kicks in (allocation 1/3 × context-switch 0.80). Closes the "multi-project environments" gap the interim report explicitly names.

**Meeting-load capacity adjustment** *(new)*
Each developer has a `meetingHoursPerWeek` field (default 0) that is subtracted from weekly hours before the buffer is applied. Surfaces as a column on the developers page and a tiny line on each capacity card. Phase 2 replaces the static field with live Google Calendar OAuth fetching real meeting hours per week.

**Forecast-vs-actual evaluation** *(new)*
The `/evaluation` page recomputes forecasts retroactively for every completed sprint, using only data that existed at sprint start (no leakage). Displays predicted failure probability against actual completion rate, classifies outcomes as met / partial / missed, and reports calibration metrics (hits, false alarms, missed alarms). Strongest single artefact for the final-report evaluation section. Methodology in [docs/forecast-evaluation.md](docs/forecast-evaluation.md).

---

### Capacity Engine

**Configurable Capacity Buffer per Sprint**
Each sprint has a `capacityBuffer` field (default 20%). Rather than judging work against raw hours, the engine compares it with effective capacity: weekly hours minus meetings, times sprint weeks, times `(1 − buffer)`, times the multi-project factor (full formula under [Core Algorithms](#capacity--overload-detection)). The buffer mirrors real agile practice: teams plan to ~80% to leave room for code review and interruptions (meetings are subtracted separately). The buffer is adjustable per sprint (0–40%) via a slider in the sprint form.

**Done Task Exclusion**
Only tasks in **Released to Prod** (`status = "done"`) are excluded from capacity calculations. Every other status counts against a developer's load: Backlog, To Do, In Progress, **Paused**, QA, UAT and Ready for Prod. Paused work still counts because the task is still assigned to that developer. This keeps utilisation honest as work is completed during the sprint.

**Overload Warning Toasts**
When a task is added and it pushes a developer over their effective capacity, a non-blocking warning toast fires immediately — no need to navigate to the capacity page to find out.

---

### Sprint Intelligence

**Sprint Health Score (0–100)**
A computed score shown on every sprint page as a colour-coded badge. It starts at 100 and loses points for each overloaded developer, each developer at or above 80%, and a team average above 85% (formula under [Core Algorithms](#sprint-health-score)). The status comes from the score:
- `healthy` (green): 70 or above
- `at-risk` (amber): 40 to 69
- `overloaded` (red): below 40

A tooltip explains the current state and shows overloaded/at-risk developer counts.

**Burndown Indicator**
Compares *expected progress* (based on calendar days elapsed) against *actual progress* (done task hours / total task hours). Shows four states: Ahead of Schedule, On Track, Behind, At Risk. Displayed as dual progress bars on every sprint page.

**Workload Rebalancing Suggestions**
When a sprint is at-risk or overloaded, a collapsible panel automatically appears suggesting specific tasks to move between developers. The algorithm:
1. Finds overloaded developers and their lowest-priority moveable tasks
2. Finds developers with remaining headroom
3. Generates suggestions with projected utilisation after the move
4. Each suggestion has an **Apply** button that reassigns the task in one click

**Sprint Retrospective Notes**
A collapsible card at the bottom of every sprint page with a free-text area for retrospective notes (what went well, what to improve, action items). Auto-saves with a 1-second debounce and shows a "Saved ✓" confirmation.

---

### Task Management

**Task Priority** (`low` / `medium` / `high` / `critical`)
Colour-coded badges on every task row and Kanban card. Priority is set during task creation and drives both visual hierarchy and the rebalancing algorithm (which prefers to move lower-priority tasks first).

**Kanban Board View**
Toggle between a traditional table view and a full Kanban board directly on the sprint detail page. The board renders eight droppable columns — **Backlog**, **To Do**, **In Progress**, **Paused**, **QA**, **UAT**, **Ready for Prod**, **Released to Prod** — defined in a single source of truth (`src/lib/task-statuses.ts`); only *Released to Prod* is terminal for capacity and estimation-accuracy purposes. A column picker lets you hide/show columns (saved to `localStorage`, along with the view preference). Drag a card to a new column to update its status instantly.

Task cards show:
- Priority as a coloured left border (red → grey)
- Assignee initials avatar
- Hours estimate badge
- Ad-hoc / Planned type badge
- Edit and delete buttons on hover

**Sortable Table Columns**
In table view, click any of Title, Assignee, Hours, or Priority headers to sort. Click again to reverse direction. Priority sort uses the canonical order (critical → high → medium → low), not alphabetical.

**Ad-hoc Task Simulator**
A "what-if" tool on the Capacity page: select a developer, enter hypothetical hours, and see in real time whether that addition would cause overload — before creating any task.

---

### Analytics

**Sprint Velocity Chart**
On the project detail page, a grouped bar chart shows *Planned hours* vs *Completed hours* for every sprint in the project (oldest to newest). A dashed amber reference line marks the average velocity. Completion rate percentages appear as labels above each completed bar.

**Developer Capacity Heatmap**
On the Capacity Analysis page, a colour-coded grid shows every developer's utilisation percentage across all sprints simultaneously. Colours: green (<60%), yellow (60–80%), amber (80–100%), red (>100% — overloaded). Makes cross-sprint workload patterns immediately visible.

**Capacity Bar Chart**
Per-sprint bar chart comparing each developer's capacity hours against assigned hours. Overloaded bars render in red; healthy bars in blue.

**At-Risk Sprints Dashboard**
The main dashboard surfaces any sprint with a health score below 70, showing sprint name, project, score badge, and overloaded developer count — all linkable to the relevant sprint page.

---

### UX & Settings

**Dark Mode**
Full dark mode support via `next-themes`. Toggle between Light, Dark, and System preference from the user menu (bottom-left) or from the Settings page.

**Settings Page** (`/settings`)
Four sections:
- **Appearance** — theme selection with visual cards
- **Profile** — name, email, and role (read-only)
- **Sprint Defaults** — default capacity buffer slider; new sprints pre-fill from this preference
- **Notifications** — toggle for overload warning toasts

**User Menu**
Clicking the user name in the sidebar footer opens a flyout with theme picker, settings link, and logout — accessible from every page without leaving the current view.

**Search & Filter**
Task table supports free-text search (title or assignee name) and status filter simultaneously. Capacity page has a developer filter (All / Overloaded Only / Healthy Only).

**Empty States**
Meaningful empty state illustrations and messages when no sprints or tasks exist, with contextual calls-to-action.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19 |
| UI Components | Base UI, Shadcn UI, Tailwind CSS v4 |
| Drag & Drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Data Fetching | TanStack Query (React Query) |
| Charts | Recharts |
| Theming | next-themes |
| Backend | Next.js API Routes (TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Authentication | JWT (jsonwebtoken + bcryptjs) |

---

## Getting Started

### Prerequisites

- **Node.js 20.19+** with npm. Prisma 7's engines require Node `^20.19`, `^22.12` or `24+`.
- **Docker Desktop**, which runs PostgreSQL 16 through Docker Compose.
- **bash, curl and python3**, needed only for `npm run check:authz`. All three ship with macOS and most Linux distributions.

### Quick start

With Docker Desktop running:

```bash
npm install
cp .env.example .env
npm run demo
```

`npm run demo` starts PostgreSQL, waits for it, applies the migrations (`prisma migrate deploy`), reseeds the demo data and starts the dev server. Open [http://localhost:3000](http://localhost:3000) and sign in with one of the [demo credentials](#demo-credentials).

The seed sets sprint dates relative to the day it runs, so reseed before any demo or screenshot session: re-run `npm run demo`, or `npm run db:seed` if the server is already up.

### Manual setup (alternative)

**1. Install dependencies**

```bash
npm install
```

**2. Start Docker Desktop.**

**3. Configure environment**

```bash
cp .env.example .env
```

`.env` must contain:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sprint_planner?schema=public"
JWT_SECRET="your-secret-here"
```

**4. Start the database**

```bash
npm run db:up      # starts PostgreSQL via Docker Compose
```

Wait ~5 seconds, then:

**5. Migrate and seed**

```bash
npm run db:setup   # runs prisma migrate dev + prisma db seed
```

Or separately:

```bash
npm run db:migrate
npm run db:seed
```

**6. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Credentials

All passwords are `password123`.

| Email | Role | What it demonstrates |
|---|---|---|
| `admin@sprintplanner.com` | Manager | Full access — the original application |
| `lead@sprintplanner.com` | Manager | Second manager account |
| `angelo@sprintplanner.com` | Developer | **The interesting one.** Overloaded (161% — yet only 45% of nominal hours), ×1.28 under-estimator, 12h/wk meetings, two concurrent sprints |
| `kusalni@sprintplanner.com` | Developer | Over-estimator (×0.81) — the opposite sign |
| `abdulaziz@sprintplanner.com` | Developer | New hire — low-confidence factor, shrinkage visible |
| `nomal@` / `saajid@sprintplanner.com` | Developer | Accurate estimator / improving trend |
| `newdev@sprintplanner.com` | Developer | **No linked profile** — the fail-closed empty state |
| `client-ecom@sprintplanner.com` | Client | One project, and it's the at-risk one |
| `client-mobile@sprintplanner.com` | Client | Two projects — the many-to-many grant |
| `client-new@sprintplanner.com` | Client | **No grants** — deny-by-default empty state |

### Seeded Personas (predictive-layer demo)

The seed intentionally builds a team with distinct estimation behaviours so the predictive layer has meaningful signal immediately after install. Sprint dates pivot around today: the four historic sprints are always complete, and the three current sprints are always in flight, regardless of when you seed.

| Developer | Weekly hours | Meetings/wk | Persona | Live factor |
|---|---:|---:|---|---:|
| Angelo Perera | 40 | 12 | Chronic under-estimator | ×1.28 (n = 15) |
| Nomal Ariyarathna | 35 | 6 | Accurate | ×1.02 (n = 13) |
| Kusalni Perera | 30 | 4 | Over-estimator (sandbagger) | ×0.81 (n = 14) |
| Abdulaziz Roshan | 25 | 8 | New hire (shrinkage pulls one sample towards 1.0) | ×1.01 (n = 1) |
| Saajid Jiffrey | 35 | 5 | Improving trend | ×1.16 (n = 12) |

**Demo walkthrough (60 seconds):**
1. Open `/developers` — scan the Estimation Factor column to see each persona.
2. Open Sprint 1 (*PDP experience*) — forecast card shows **70% · High risk**. Angelo's card shows 36h against 22.4h effective (161%), the `×1.28` factor badge, and an adjusted utilisation of 206%. A rebalancing suggestion proposes moving a 6h task to Kusalni.
3. Open Sprint 2 (*Email & integrations*) — the healthy contrast: health 100, forecast **22% · Low**, burndown **ahead** on the day you seed (50% done vs 36% expected at day 5), settling to on track from day 6 (50% vs 43%), every developer under 80%.
4. Move any task in Sprint 1 to Done → the "How long did it take?" dialog appears → confirm or skip. The forecast and factor refetch automatically.

---

## Testing

The Vitest suite needs the Docker database to be running (`npm run db:up`).

| Command | What it does |
|---|---|
| `npm test` | Runs the Vitest suite: 138 tests in 14 files (10 unit, 4 integration). |
| `npm run test:report` | Runs the same suite with coverage and writes [docs/test-report.md](docs/test-report.md): a pass/fail table per test, plus line coverage for `src/services` and `src/lib` (76.8% at submission). |
| `npm run check:authz` | Runs 48 HTTP-level access-control checks with manager, developer and client tokens. **The dev server must be running against the seeded database.** One check changes a task's status, so run `npm run db:seed` afterwards. Needs bash, curl and python3. |
| `npx tsc --noEmit` | Strict type check across the app and the tests. |

The integration tests never touch the demo database. They use a separate `sprint_planner_test` database on the same PostgreSQL server, which the test setup creates automatically, then migrates and reseeds on every run. Set `DATABASE_URL_TEST` to point them somewhere else.

---

## Project Structure

```
src/
├── app/
│   ├── api/                             # REST routes: auth, me, admin, dashboard, projects, sprints,
│   │                                    #   tasks, developers, evaluation, portfolio, activity
│   ├── login/                           # Sign-in page
│   ├── register/                        # Self-registration (creates an unlinked developer account)
│   └── (authenticated)/
│       ├── page.tsx                     # Sends each role to its landing page
│       ├── dashboard/                   # Manager dashboard
│       ├── my-work/                     # Developer: own tasks, load per sprint, capacity breakdown
│       ├── portfolio/                   # Client: delivery overview of granted projects
│       │   └── [projectId]/             # Client: one project's progress, burndown, velocity
│       ├── evaluation/                  # Manager: retroactive forecast-vs-actual evaluation
│       ├── admin/users/                 # Manager: Team & Access (roles, developer links, client grants)
│       ├── capacity/                    # Capacity analysis + heatmap + ad-hoc simulator
│       ├── developers/                  # Developer management + estimation-accuracy column
│       ├── projects/                    # Project list
│       │   └── [id]/                    # Project detail + sprint grid + velocity chart
│       ├── settings/                    # Theme, profile, sprint defaults, notifications
│       └── sprints/[id]/                # Sprint detail: health, burndown, forecast, kanban/table,
│                                        #   rebalancing, retrospective
├── components/
│   ├── auth-provider.tsx                # Session, token and resolved role
│   ├── query-provider.tsx
│   ├── brand/
│   │   └── cadence-logo.tsx
│   ├── capacity/
│   │   ├── adhoc-simulator.tsx
│   │   ├── capacity-chart.tsx
│   │   ├── developer-capacity-heatmap.tsx
│   │   ├── developer-workload-table.tsx
│   │   └── overload-badge.tsx
│   ├── client/                          # Client views: no per-developer data
│   │   ├── delivery-confidence.tsx      # Forecast reduced to a band and a label
│   │   └── project-progress-card.tsx
│   ├── dashboard/
│   │   ├── active-sprints.tsx
│   │   ├── at-risk-sprints.tsx
│   │   ├── capacity-summary.tsx
│   │   └── stats-cards.tsx
│   ├── developers/
│   │   └── accuracy-cell.tsx
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   ├── header.tsx
│   │   └── user-menu.tsx
│   ├── my-work/
│   │   ├── cross-sprint-load.tsx        # "Why your capacity is split": the multiplier chain
│   │   └── my-capacity-card.tsx         # One in-flight sprint's load for the signed-in developer
│   ├── projects/
│   │   ├── project-card.tsx
│   │   ├── project-form.tsx
│   │   └── velocity-chart.tsx
│   ├── sprints/
│   │   ├── burndown-indicator.tsx
│   │   ├── forecast-card.tsx
│   │   ├── rebalancing-suggestions.tsx
│   │   ├── retrospective-notes.tsx
│   │   ├── sprint-form.tsx
│   │   └── sprint-health-badge.tsx
│   ├── tasks/
│   │   ├── actual-hours-prompt.tsx      # "How long did it actually take?" on moving to Done
│   │   ├── task-card.tsx
│   │   ├── task-form.tsx
│   │   ├── task-kanban.tsx              # Drag-and-drop Kanban board
│   │   └── task-table.tsx               # Sortable columns, search, filter
│   └── ui/                              # shadcn / Base UI primitives
├── generated/prisma/                    # Generated Prisma client
├── hooks/                               # React Query hooks per entity
├── lib/
│   ├── api-client.ts                    # Browser fetch wrapper (attaches the JWT)
│   ├── auth.ts                          # JWT sign/verify (8-hour tokens)
│   ├── authorize.ts                     # Per-request role, developer and project scope; access guards
│   ├── prisma.ts                        # Prisma client (pg driver adapter)
│   ├── redact.ts                        # Whitelist-only response shapes for developers and clients
│   ├── roles.ts                         # Role vocabulary, legacy aliases, fail-closed default, landing paths
│   ├── route-access.ts                  # Which roles may open which page (UI only; the API is the boundary)
│   ├── task-statuses.ts                 # The eight workflow statuses; only "done" is terminal
│   └── utils.ts
├── services/
│   ├── overload-detection.ts            # Capacity chain, health score, burndown, simulation
│   ├── capacity.service.ts              # Sprint capacity + ad-hoc simulator entry points
│   ├── multi-project-capacity.service.ts # Allocation and context-switch factors
│   ├── estimation-accuracy.service.ts   # Per-developer accuracy factor with shrinkage
│   ├── sprint-forecast.service.ts       # Five-signal sprint failure forecast
│   ├── forecast-evaluation.service.ts   # Retroactive forecast-vs-actual evaluation
│   ├── rebalancing.service.ts           # Task-move suggestions for overloaded developers
│   ├── sprint.service.ts                # Sprint CRUD + overlapping-sprint lookup
│   ├── developer.service.ts
│   ├── project.service.ts
│   └── task.service.ts
├── types/                               # TypeScript type definitions
└── utils/
prisma/
├── schema.prisma
├── migrations/
└── seed.ts                              # Demo team, 7 sprints, dates relative to the day it runs
tests/
├── unit/                                # 10 files: pure planning logic, no database
├── integration/                         # 4 files: run against the sprint_planner_test database
└── setup/                               # Points tests at the test database; creates, migrates and reseeds it
scripts/
├── authz-check.sh                       # npm run check:authz
├── generate-test-report.mjs             # npm run test:report → docs/test-report.md
└── capture-screenshots.ts               # npm run screenshots (Playwright, report figures)
docs/                                    # Design notes, test report, report data, screenshots
```

---

## Core Algorithms

### Capacity & Overload Detection

```
net_weekly_hours    = max(0, developer.weeklyCapacityHours − developer.meetingHoursPerWeek)
capacity_hours      = net_weekly_hours × sprint_weeks          # sprint_weeks = round(days / 7), min 1

N                   = other sprints whose dates overlap this one and in which the developer has a task
allocation_factor   = max(0.25, 1 / (N + 1))                    # equal split across concurrent sprints
context_switch      = max(0.5, 1 − 0.20 × max(0, N − 1))        # no penalty for 2 sprints, −20% per extra one

effective_capacity  = capacity_hours × (1 − sprint.capacityBuffer) × allocation_factor × context_switch
assigned_hours      = SUM(estimatedHours of the developer's tasks WHERE status != 'done')
utilization_percent = round(assigned_hours / effective_capacity × 100)
overload_risk       = assigned_hours > effective_capacity
```

Worked example (Angelo in Sprint 1): (40 − 12) × 2 = 56h × 0.8 buffer × 0.5 allocation = **22.4h effective**. 36h assigned gives **161%**, overloaded, even though 36h is only 45% of a nominal 80-hour fortnight.

### Sprint Health Score

```
score  = 100
score -= 30 × (developers with assigned_hours > effective_capacity)     # overloaded
score -= 10 × (other developers with utilization_percent >= 80)         # at-risk
score -=  5 if average utilization_percent > 85
score  = max(0, score)

status = "overloaded" if score < 40
       | "at-risk"    if score < 70
       | "healthy"
```

### Burndown

```
expected_progress = days_elapsed / total_sprint_days × 100     # days rounded to the nearest whole day
actual_progress   = done_task_hours / total_task_hours × 100
delta             = actual_progress − expected_progress

status = "ahead"    if delta > +10
       | "at-risk"  if delta < −20
       | "behind"   if delta < −5
       | "on-track" otherwise
```

### Rebalancing Suggestion Algorithm

```
for each overloaded developer:
    take their non-done tasks, lowest priority first
    for each candidate task:
        find a developer WHERE:
            not overloaded
            (assignedHours + task.estimatedHours) <= effectiveCapacity
        if found:
            suggest: move task from A → B
            show projected utilisation for both
            stop: at most one suggestion per overloaded developer
```

---

## Database Schema

```
User              — id, name, email, password,
                    role ("manager" | "developer" | "client", default "developer")
Developer         — id, name, weeklyCapacityHours, meetingHoursPerWeek,
                    githubUsername (nullable, unique),
                    userId (nullable, unique → User; SetNull on delete)
ProjectClient     — userId, projectId (unique per pair) — which projects a client may see
Project           — id, name, description
Sprint            — id, name, startDate, endDate, projectId,
                    capacityBuffer (default 0.2),
                    retrospectiveNotes (nullable)
Task              — id, title, estimatedHours, actualHours (nullable),
                    completedAt (nullable),
                    type, status, priority,
                    assignedDeveloperId, sprintId
CapacityRecord    — developerId, sprintId, assignedHours, capacityHours,
                    overloadRisk (unique per developer+sprint pair)
DeveloperActivity — developerId, source, activityDate,
                    commitCount, pullRequestCount, reviewCount,
                    externalRef (unique per source+externalRef)
```

---

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/dashboard` | Stats + at-risk sprints |
| GET/POST | `/api/projects` | List / create projects |
| GET/PUT/DELETE | `/api/projects/[id]` | Get / update / delete project |
| GET | `/api/projects/[id]/velocity` | Sprint velocity data for project |
| GET/POST | `/api/sprints` | List / create sprints |
| GET/PUT/DELETE | `/api/sprints/[id]` | Get / update / delete sprint |
| GET | `/api/sprints/[id]/capacity` | Capacity + health + burndown |
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PUT/DELETE | `/api/tasks/[id]` | Get / update / delete task |
| GET/POST | `/api/developers` | List / create developers |
| GET/PUT/DELETE | `/api/developers/[id]` | Get / update / delete developer |
| GET | `/api/developers/accuracy` | Estimation accuracy factor for every developer |
| GET | `/api/developers/[id]/accuracy` | Single developer's accuracy factor with trend |
| GET | `/api/sprints/[id]/forecast` | Sprint failure probability + contributor breakdown |
| GET | `/api/evaluation/forecast` | Retroactive forecast vs actual outcome for every completed sprint |
| POST | `/api/activity/ingest` | Ingest DeveloperActivity rows (seed / future GitHub webhook) |
| GET | `/api/me` | Caller's identity, resolved role, linked developer and project grants |
| GET | `/api/admin/users` | Account roster with roles and links *(manager only)* |
| PUT | `/api/admin/users/[id]` | Set role, link developer profile, grant client projects *(manager only)* |
| GET | `/api/portfolio/[projectId]` | Client delivery view — progress, burndown, confidence band |

All routes except `/api/auth/*` require a `Bearer <token>` header.

**Authorisation.** Every protected handler calls `requireAuth(req)` from [src/lib/authorize.ts](src/lib/authorize.ts), which returns the caller's normalised role, linked `developerId` and permitted `projectIds` — resolved per request rather than baked into the JWT, so a manager re-linking an account takes effect immediately instead of at token expiry. Responses destined for non-managers are rebuilt through whitelists in [src/lib/redact.ts](src/lib/redact.ts); nothing is produced by deleting fields, so a new column on `Task` or `CapacityAnalysis` cannot leak by default.

Three endpoints return a **different shape per role** rather than a filtered one: `/api/dashboard` (discriminated on `kind`), `/api/sprints/[id]/capacity` (managers get health, developers get only their own row, clients get burndown alone) and `/api/sprints/[id]/forecast` (clients get a band and a label, no percentage).

---

## Troubleshooting

### `ETIMEDOUT` when running `npm run dev`

The project is likely on iCloud Drive or Dropbox. Move it to a local unsynced folder:

```bash
mkdir -p ~/Projects
cp -R ~/Documents/GitHub/final-project ~/Projects/
cd ~/Projects/final-project
rm -rf node_modules
npm install
npm run dev
```

### Database connection refused

Ensure Docker Desktop is running and the container is up:

```bash
docker compose ps        # check status
npm run db:up            # start if not running
```

---

## License

Academic project — CS6P05NM Final Year Submission · London Metropolitan University.
