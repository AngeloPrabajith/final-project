import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Deterministic PRNG so the demo is believable yet reproducible across reseeds.
// Mulberry32 — good enough for seeding, tiny, no deps.
// -----------------------------------------------------------------------------
function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260424);
function rand(min: number, max: number): number {
  return min + rng() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}
function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

// -----------------------------------------------------------------------------
// Persona config — drives estimation-accuracy demo.
// factor > 1 means the developer takes more hours than estimated (under-estimator).
// factor < 1 means the developer consistently delivers below estimate (over-estimator).
// noise is the per-task multiplicative jitter.
// -----------------------------------------------------------------------------
interface Persona {
  name: string;
  weeklyCapacityHours: number;
  /** Average meeting load — subtracted from weekly hours before capacity calc. */
  meetingHoursPerWeek: number;
  githubUsername: string;
  /** Login for this persona. The User is created and linked via Developer.userId. */
  loginEmail: string;
  // Target factor multipliers per historic sprint index (oldest → newest).
  // Lets us model a trend (e.g. Saajid improves over time).
  factorByHistoricIndex: number[];
  noise: number;
  // How many completed tasks they get per historic sprint, roughly.
  tasksPerSprint: number;
}

const PERSONAS: Persona[] = [
  {
    name: "Angelo Perera",
    weeklyCapacityHours: 40,
    meetingHoursPerWeek: 12, // team lead — heavy meeting load
    githubUsername: "angelo-perera",
    loginEmail: "angelo@sprintplanner.com",
    factorByHistoricIndex: [1.25, 1.3, 1.22, 1.28], // chronic under-estimator
    noise: 0.1,
    tasksPerSprint: 3,
  },
  {
    name: "Nomal Ariyarathna",
    weeklyCapacityHours: 35,
    meetingHoursPerWeek: 6,
    githubUsername: "nomal-ariyarathna",
    loginEmail: "nomal@sprintplanner.com",
    factorByHistoricIndex: [1.02, 0.98, 1.03, 1.0], // accurate
    noise: 0.07,
    tasksPerSprint: 3,
  },
  {
    name: "Kusalni Perera",
    weeklyCapacityHours: 30,
    meetingHoursPerWeek: 4,
    githubUsername: "kusalni-perera",
    loginEmail: "kusalni@sprintplanner.com",
    factorByHistoricIndex: [0.82, 0.78, 0.83, 0.8], // over-estimator (sandbagger)
    noise: 0.08,
    tasksPerSprint: 3,
  },
  {
    name: "Abdulaziz Roshan",
    weeklyCapacityHours: 25,
    meetingHoursPerWeek: 8, // new hire — onboarding meetings
    githubUsername: "abdulaziz-roshan",
    loginEmail: "abdulaziz@sprintplanner.com",
    factorByHistoricIndex: [0, 0, 0, 1.1], // new hire — only contributed to latest historic sprint
    noise: 0.12,
    tasksPerSprint: 1,
  },
  {
    name: "Saajid Jiffrey",
    weeklyCapacityHours: 35,
    meetingHoursPerWeek: 5,
    githubUsername: "saajid-jiffrey",
    loginEmail: "saajid@sprintplanner.com",
    factorByHistoricIndex: [1.3, 1.2, 1.1, 1.05], // improving trend
    noise: 0.08,
    tasksPerSprint: 3,
  },
];

// Task title pools so the demo reads naturally.
const PLANNED_TITLES = [
  "PDP FAQ module",
  "Customer support live chat",
  "Collection page one-card module",
  "Mobile collection page hover states",
  "Checkout upsells (Checkout Extensibility)",
  "Launchpad scheduled product drops",
  "Post-purchase survey integration",
  "Pre-order transactional emails",
  "Klaviyo auto-suppression rules",
  "SEO metadata updates",
  "Alt-text audit — banner imagery",
  "Keyboard navigation — quantity stepper",
  "Hero video pause/stop control",
  "Consolidate duplicate product schema",
  "Extend cache lifetimes for repeat visitors",
  "Defer non-essential third-party scripts",
  "Lazy-load third-party apps",
  "Image formats & delivery audit",
  "Homepage hero image optimisation",
  "Mini cart UX improvements",
];

const ADHOC_TITLES = [
  "Urgent: homepage banner bug",
  "Bug: search bar misalignment",
  "Bug: homepage module overlapping",
  "Urgent: PDP video not playing",
  "Shopping ads showing wrong price (schema)",
  "Hotfix: hero banner not responsive on mobile",
];

async function main() {
  console.log("⟳ Purging existing data...");
  await prisma.projectClient.deleteMany();
  await prisma.developerActivity.deleteMany();
  await prisma.capacityRecord.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.project.deleteMany();
  await prisma.developer.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------------------
  // Manager logins. Both pre-date the role model and are kept on the same
  // emails/password so anything written down before still works.
  // ---------------------------------------------------------------------------
  const hashedPassword = await bcrypt.hash("password123", 10);
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@sprintplanner.com",
      password: hashedPassword,
      role: "manager",
    },
  });
  const lead = await prisma.user.create({
    data: {
      name: "Team Lead",
      email: "lead@sprintplanner.com",
      password: hashedPassword,
      role: "manager",
    },
  });
  console.log(`✓ Managers: ${admin.email}, ${lead.email}`);

  // ---------------------------------------------------------------------------
  // Developers — each with a login, linked through Developer.userId.
  // ---------------------------------------------------------------------------
  const developers = [] as Array<{
    id: string;
    name: string;
    weeklyCapacityHours: number;
    persona: Persona;
  }>;
  for (const p of PERSONAS) {
    const user = await prisma.user.create({
      data: {
        name: p.name,
        email: p.loginEmail,
        password: hashedPassword,
        role: "developer",
      },
    });
    const dev = await prisma.developer.create({
      data: {
        name: p.name,
        weeklyCapacityHours: p.weeklyCapacityHours,
        meetingHoursPerWeek: p.meetingHoursPerWeek,
        githubUsername: p.githubUsername,
        userId: user.id,
      },
    });
    developers.push({ ...dev, persona: p });
  }

  // An account with the developer role but no Developer row — proves the
  // fail-closed path renders an empty state rather than leaking team data.
  const unlinkedDev = await prisma.user.create({
    data: {
      name: "Unlinked Newcomer",
      email: "newdev@sprintplanner.com",
      password: hashedPassword,
      role: "developer",
    },
  });
  console.log(
    `✓ Developers: ${developers.length} linked, 1 unlinked (${unlinkedDev.email})`
  );

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
  const projectA = await prisma.project.create({
    data: {
      name: "NOYZ Storefront",
      description:
        "Shopify Plus storefront — PDP experience, checkout extensibility, site-speed and accessibility programmes.",
    },
  });
  const projectB = await prisma.project.create({
    data: {
      name: "Fleur du Mal E-Commerce",
      description: "Luxury storefront — merchandising, transactional email, and platform integrations.",
    },
  });
  const projectC = await prisma.project.create({
    data: {
      name: "Only Human · Concurrent stretch",
      description:
        "Cross-platform mobile client. Shares Angelo and Nomal with the other two projects, exposing the cross-sprint allocation case.",
    },
  });
  console.log(`✓ Projects: 3`);

  // ---------------------------------------------------------------------------
  // Client logins — scoped to projects through the ProjectClient join.
  // Three deliberately different shapes so the access model is visible:
  //   single-project, multi-project, and no grants at all.
  // ---------------------------------------------------------------------------
  const clientEcom = await prisma.user.create({
    data: {
      name: "Nadia Rahman (E-Commerce)",
      email: "client-ecom@sprintplanner.com",
      password: hashedPassword,
      role: "client",
    },
  });
  const clientMobile = await prisma.user.create({
    data: {
      name: "Tom Ellis (Mobile)",
      email: "client-mobile@sprintplanner.com",
      password: hashedPassword,
      role: "client",
    },
  });
  // No ProjectClient rows — demonstrates that the default is deny, not allow.
  const clientNew = await prisma.user.create({
    data: {
      name: "Prospective Client",
      email: "client-new@sprintplanner.com",
      password: hashedPassword,
      role: "client",
    },
  });

  await prisma.projectClient.createMany({
    data: [
      // Single project — and it's the overloaded one, so this client sees
      // "Delivery at risk" without ever seeing who is overloaded or why.
      { userId: clientEcom.id, projectId: projectA.id },
      // Two projects — exercises the many-to-many the join table exists for.
      { userId: clientMobile.id, projectId: projectB.id },
      { userId: clientMobile.id, projectId: projectC.id },
    ],
  });
  console.log(
    `✓ Clients: ${clientEcom.email} (1 project), ${clientMobile.email} (2 projects), ${clientNew.email} (none)`
  );

  // ---------------------------------------------------------------------------
  // Sprints — 4 historic + 2 current. Dates pivot around "today" so the current
  // sprints are always genuinely in-flight in the demo regardless of run date.
  // ---------------------------------------------------------------------------
  const today = new Date();
  const REFERENCE_DATE = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  // Current sprints: 5 days ago → +9 days (2-week sprint, ~35% elapsed).
  const currentStart = addDays(REFERENCE_DATE, -5);
  const currentEnd = addDays(REFERENCE_DATE, 9);

  // Historic sprints: walking back in 14-day blocks from currentStart - 1 day.
  function historicWindow(offsetSprintsBack: number): { start: Date; end: Date } {
    const end = addDays(currentStart, -1 - 14 * offsetSprintsBack);
    const start = addDays(end, -13);
    return { start, end };
  }

  interface SprintSeed {
    name: string;
    project: typeof projectA;
    startDate: Date;
    endDate: Date;
    capacityBuffer: number;
    isHistoric: boolean;
    historicIndex?: number;
    retrospectiveNotes?: string;
  }

  const h3 = historicWindow(4); // oldest
  const h2 = historicWindow(3);
  const h1 = historicWindow(2);
  const h0 = historicWindow(1); // most recent historic

  const sprintSeeds: SprintSeed[] = [
    {
      name: "Sprint -3 · Site speed foundations",
      project: projectA,
      startDate: h3.start,
      endDate: h3.end,
      capacityBuffer: 0.2,
      isHistoric: true,
      historicIndex: 0,
      retrospectiveNotes:
        "Solid start. Ad-hoc PDP video issue ate into Angelo's time. Underestimated the image-delivery audit by a full day.",
    },
    {
      name: "Sprint -2 · ADA remediation wave 1",
      project: projectB,
      startDate: h2.start,
      endDate: h2.end,
      capacityBuffer: 0.2,
      isHistoric: true,
      historicIndex: 1,
      retrospectiveNotes:
        "Nomal's alt-text remediation landed cleanly. Kusalni finished ahead of schedule (again). Need to calibrate those estimates.",
    },
    {
      name: "Sprint -1 · Checkout & promotions",
      project: projectA,
      startDate: h1.start,
      endDate: h1.end,
      capacityBuffer: 0.2,
      isHistoric: true,
      historicIndex: 2,
      retrospectiveNotes:
        "Checkout extensibility work took 30% longer than planned. Pattern is getting consistent — Angelo's estimates are systematically low.",
    },
    {
      name: "Sprint 0 · Performance hardening",
      project: projectB,
      startDate: h0.start,
      endDate: h0.end,
      capacityBuffer: 0.2,
      isHistoric: true,
      historicIndex: 3,
      retrospectiveNotes:
        "Abdulaziz joined mid-sprint and picked up the script-deferral tickets — small sample but looks on-pace.",
    },
    {
      name: "Sprint 1 · PDP experience",
      project: projectA,
      startDate: currentStart,
      endDate: currentEnd,
      capacityBuffer: 0.2,
      isHistoric: false,
    },
    {
      name: "Sprint 2 · Email & integrations",
      project: projectB,
      startDate: currentStart,
      endDate: currentEnd,
      capacityBuffer: 0.2,
      isHistoric: false,
    },
    {
      name: "Sprint 3 · Only Human launch stretch",
      project: projectC,
      startDate: currentStart,
      endDate: currentEnd,
      capacityBuffer: 0.2,
      isHistoric: false,
    },
  ];

  const sprints = [] as Array<{
    id: string;
    name: string;
    projectId: string;
    startDate: Date;
    endDate: Date;
    isHistoric: boolean;
    historicIndex?: number;
  }>;
  for (const seed of sprintSeeds) {
    const sprint = await prisma.sprint.create({
      data: {
        name: seed.name,
        startDate: seed.startDate,
        endDate: seed.endDate,
        projectId: seed.project.id,
        capacityBuffer: seed.capacityBuffer,
        retrospectiveNotes: seed.retrospectiveNotes,
      },
    });
    sprints.push({
      id: sprint.id,
      name: sprint.name,
      projectId: sprint.projectId,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      isHistoric: seed.isHistoric,
      historicIndex: seed.historicIndex,
    });
  }
  console.log(`✓ Sprints: ${sprints.length} (4 historic, 2 current)`);

  // ---------------------------------------------------------------------------
  // Historic tasks — completed with realistic actualHours per persona.
  // ---------------------------------------------------------------------------
  let totalHistoricTasks = 0;
  for (const sprint of sprints.filter((s) => s.isHistoric)) {
    const histIdx = sprint.historicIndex!;

    for (const dev of developers) {
      const factor = dev.persona.factorByHistoricIndex[histIdx];
      if (factor === 0) continue; // persona not active this sprint (e.g. Abdulaziz's early sprints)

      const taskCount = dev.persona.tasksPerSprint;
      for (let i = 0; i < taskCount; i++) {
        const estimatedHours = roundToHalf(rand(6, 16));
        const jitter = 1 + rand(-dev.persona.noise, dev.persona.noise);
        const actualHours = roundToHalf(estimatedHours * factor * jitter);
        // completedAt: somewhere in the second half of the sprint window.
        const sprintLenMs = sprint.endDate.getTime() - sprint.startDate.getTime();
        const completedAt = new Date(
          sprint.startDate.getTime() + sprintLenMs * rand(0.55, 0.98)
        );
        await prisma.task.create({
          data: {
            title: pick(PLANNED_TITLES),
            description: null,
            estimatedHours,
            actualHours,
            completedAt,
            type: "planned",
            status: "done",
            priority: pick(["low", "medium", "high"]),
            assignedDeveloperId: dev.id,
            sprintId: sprint.id,
          },
        });
        totalHistoricTasks += 1;
      }
    }

    // 1–2 ad-hoc tasks per historic sprint (feeds the forecast's ad-hoc history signal).
    const adhocCount = randInt(1, 2);
    for (let i = 0; i < adhocCount; i++) {
      const assignee = pick(developers.filter((d) => d.persona.factorByHistoricIndex[histIdx] > 0));
      const factor = assignee.persona.factorByHistoricIndex[histIdx];
      const estimatedHours = roundToHalf(rand(3, 8));
      const actualHours = roundToHalf(
        estimatedHours * factor * (1 + rand(-assignee.persona.noise, assignee.persona.noise))
      );
      const sprintLenMs = sprint.endDate.getTime() - sprint.startDate.getTime();
      const completedAt = new Date(
        sprint.startDate.getTime() + sprintLenMs * rand(0.3, 0.95)
      );
      await prisma.task.create({
        data: {
          title: pick(ADHOC_TITLES),
          description: null,
          estimatedHours,
          actualHours,
          completedAt,
          type: "adhoc",
          status: "done",
          priority: "critical",
          assignedDeveloperId: assignee.id,
          sprintId: sprint.id,
        },
      });
      totalHistoricTasks += 1;
    }

    // Spillover tasks — committed but didn't ship before sprint end.
    // Drives the actual-completion-rate signal so the evaluation page has
    // missed/partial outcomes to grade the forecast against.
    // Sprint -1 (histIdx=2): partial outcome.
    // Sprint 0  (histIdx=3): missed outcome (worst recent sprint, sets up the
    //                         current-sprint forecast as a continuation of a
    //                         worsening trend).
    const spilloverCount = histIdx === 2 ? 2 : histIdx === 3 ? 8 : 0;
    if (spilloverCount > 0) {
      const spilloverDevs = developers.filter(
        (d) => d.persona.factorByHistoricIndex[histIdx] > 0
      );
      for (let i = 0; i < spilloverCount; i++) {
        const dev = spilloverDevs[i % spilloverDevs.length];
        const estimatedHours = roundToHalf(rand(6, 14));
        await prisma.task.create({
          data: {
            title: pick(PLANNED_TITLES),
            description: null,
            estimatedHours,
            type: "planned",
            status: i % 2 === 0 ? "inprogress" : "todo",
            priority: pick(["low", "medium"]),
            assignedDeveloperId: dev.id,
            sprintId: sprint.id,
          },
        });
        totalHistoricTasks += 1;
      }
    }
  }
  console.log(`✓ Historic tasks: ${totalHistoricTasks}`);

  // ---------------------------------------------------------------------------
  // Current sprint tasks — Sprint 1 is overloaded, Sprint 2 is healthy.
  // No actualHours / completedAt — they're in-flight.
  // ---------------------------------------------------------------------------
  const sprint1 = sprints.find((s) => s.name.startsWith("Sprint 1"))!;
  const sprint2 = sprints.find((s) => s.name.startsWith("Sprint 2"))!;
  const sprint3 = sprints.find((s) => s.name.startsWith("Sprint 3"))!;

  const angelo = developers.find((d) => d.name === "Angelo Perera")!;
  const nomal = developers.find((d) => d.name === "Nomal Ariyarathna")!;
  const kusalni = developers.find((d) => d.name === "Kusalni Perera")!;
  const abdulaziz = developers.find((d) => d.name === "Abdulaziz Roshan")!;
  const saajid = developers.find((d) => d.name === "Saajid Jiffrey")!;

  // Sprint 1 — overloaded (Angelo 90h active vs 64h effective capacity).
  // Task statuses span the full workflow so every column has content on the board.
  type CurrentTaskStatus =
    | "backlog"
    | "todo"
    | "inprogress"
    | "paused"
    | "qa"
    | "uat"
    | "readyforprod";
  const sprint1Tasks: Array<{
    title: string;
    description?: string;
    estimatedHours: number;
    priority: string;
    status: CurrentTaskStatus;
    type: "planned" | "adhoc";
    assignedDeveloperId: string;
  }> = [
    { title: "PDP FAQ module", description: "CMS-driven accordion FAQ on product detail pages.", estimatedHours: 20, priority: "high", status: "inprogress", type: "planned", assignedDeveloperId: angelo.id },
    { title: "Collection page one-card module", description: "Single-card collection layout option with A/B test slot.", estimatedHours: 30, priority: "high", status: "todo", type: "planned", assignedDeveloperId: angelo.id },
    { title: "Mini cart UX improvements", description: "Slide-out cart: upsell slot, free-shipping meter, quantity stepper.", estimatedHours: 25, priority: "medium", status: "backlog", type: "planned", assignedDeveloperId: angelo.id },
    { title: "Urgent: PDP hero video not playing", description: "Hero and swipe video payload failing on iOS Safari; investigate delivery.", estimatedHours: 15, priority: "critical", status: "paused", type: "adhoc", assignedDeveloperId: angelo.id },
    { title: "Checkout upsells (Checkout Extensibility)", description: "Native upsell blocks via Checkout Extensibility + Functions.", estimatedHours: 25, priority: "high", status: "qa", type: "planned", assignedDeveloperId: nomal.id },
    { title: "Launchpad scheduled product drops", description: "Automated scheduled sales and drop workflows via Launchpad.", estimatedHours: 30, priority: "high", status: "todo", type: "planned", assignedDeveloperId: nomal.id },
    { title: "Mobile collection page hover states", description: "Touch-friendly quick-view interactions on collection cards.", estimatedHours: 20, priority: "medium", status: "uat", type: "planned", assignedDeveloperId: kusalni.id },
    { title: "Storefront search relevance tuning", description: "Typo tolerance and synonym handling in site search.", estimatedHours: 15, priority: "medium", status: "readyforprod", type: "planned", assignedDeveloperId: kusalni.id },
    { title: "Homepage video module", description: "Autoplaying muted hero video with reduced-motion fallback.", estimatedHours: 14, priority: "low", status: "todo", type: "planned", assignedDeveloperId: saajid.id },
    { title: "Student discount integration", description: "Verification-provider integration on a dedicated landing page.", estimatedHours: 12, priority: "low", status: "backlog", type: "planned", assignedDeveloperId: saajid.id },
  ];
  for (const t of sprint1Tasks) {
    await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        estimatedHours: t.estimatedHours,
        type: t.type,
        status: t.status,
        priority: t.priority,
        assignedDeveloperId: t.assignedDeveloperId,
        sprintId: sprint1.id,
      },
    });
  }

  // Sprint 2 — healthy, balanced allocation with a workflow spread.
  const sprint2Tasks: Array<{
    title: string;
    description?: string;
    estimatedHours: number;
    priority: string;
    status: CurrentTaskStatus;
    type: "planned" | "adhoc";
    assignedDeveloperId: string;
  }> = [
    { title: "Pre-order transactional emails", description: "Pre-order confirmation and shipping-delay email set.", estimatedHours: 16, priority: "medium", status: "inprogress", type: "planned", assignedDeveloperId: abdulaziz.id },
    { title: "Post-purchase survey integration", description: "Attribution survey embedded on the order-status page.", estimatedHours: 12, priority: "medium", status: "todo", type: "planned", assignedDeveloperId: abdulaziz.id },
    { title: "Klaviyo auto-suppression rules", description: "Automatically suppress bounced and unengaged profiles.", estimatedHours: 15, priority: "medium", status: "qa", type: "planned", assignedDeveloperId: nomal.id },
    { title: "SEO metadata updates", description: "Title/description templates and structured-data cleanup.", estimatedHours: 12, priority: "low", status: "readyforprod", type: "planned", assignedDeveloperId: nomal.id },
    { title: "Google Merchant Center integration", description: "Feed diagnostics and Search Console wiring.", estimatedHours: 10, priority: "low", status: "backlog", type: "planned", assignedDeveloperId: saajid.id },
    { title: "Analytics tracking events", description: "Page-view and conversion-funnel events into GA4.", estimatedHours: 14, priority: "medium", status: "inprogress", type: "planned", assignedDeveloperId: saajid.id },
  ];
  for (const t of sprint2Tasks) {
    await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        estimatedHours: t.estimatedHours,
        type: t.type,
        status: t.status,
        priority: t.priority,
        assignedDeveloperId: t.assignedDeveloperId,
        sprintId: sprint2.id,
      },
    });
  }

  // Sprint 3 — small concurrent stretch on a third project. Drives the
  // multi-project factor: Angelo and Nomal become "shared with N other sprints"
  // on this sprint and on Sprints 1 and 2.
  const sprint3Tasks: Array<{
    title: string;
    description?: string;
    estimatedHours: number;
    priority: string;
    status: CurrentTaskStatus;
    type: "planned" | "adhoc";
    assignedDeveloperId: string;
  }> = [
    { title: "Campaign landing page build", description: "Gallery and detail experience for the launch campaign.", estimatedHours: 14, priority: "medium", status: "inprogress", type: "planned", assignedDeveloperId: angelo.id },
    { title: "Membership backend foundations", description: "Accounts and gated-content groundwork for the membership tier.", estimatedHours: 10, priority: "medium", status: "todo", type: "planned", assignedDeveloperId: nomal.id },
    { title: "Card generation content pipeline", description: "Templated card generation feeding the campaign gallery.", estimatedHours: 8, priority: "low", status: "backlog", type: "planned", assignedDeveloperId: nomal.id },
  ];
  for (const t of sprint3Tasks) {
    await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        estimatedHours: t.estimatedHours,
        type: t.type,
        status: t.status,
        priority: t.priority,
        assignedDeveloperId: t.assignedDeveloperId,
        sprintId: sprint3.id,
      },
    });
  }
  console.log(
    `✓ Current tasks: ${sprint1Tasks.length + sprint2Tasks.length + sprint3Tasks.length}`
  );

  // ---------------------------------------------------------------------------
  // Capacity records — recompute by summing active task hours per dev per sprint.
  // Mirrors runtime engine behaviour. Done tasks excluded.
  // ---------------------------------------------------------------------------
  let capacityRecordCount = 0;
  for (const sprint of sprints) {
    const tasksInSprint = await prisma.task.findMany({
      where: { sprintId: sprint.id, status: { not: "done" } },
      select: { assignedDeveloperId: true, estimatedHours: true },
    });
    const sprintWeeks = Math.max(
      1,
      Math.round((sprint.endDate.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
    );
    const hoursByDev = new Map<string, number>();
    for (const t of tasksInSprint) {
      if (!t.assignedDeveloperId) continue;
      hoursByDev.set(
        t.assignedDeveloperId,
        (hoursByDev.get(t.assignedDeveloperId) ?? 0) + t.estimatedHours
      );
    }
    for (const [devId, assignedHours] of hoursByDev) {
      const dev = developers.find((d) => d.id === devId);
      if (!dev) continue;
      const capacityHours = dev.weeklyCapacityHours * sprintWeeks;
      await prisma.capacityRecord.create({
        data: {
          developerId: devId,
          sprintId: sprint.id,
          assignedHours,
          capacityHours,
          overloadRisk: assignedHours > capacityHours * 0.8,
        },
      });
      capacityRecordCount += 1;
    }
  }
  console.log(`✓ Capacity records: ${capacityRecordCount}`);

  // ---------------------------------------------------------------------------
  // DeveloperActivity — 12 weeks of daily rows per dev. Powers Phase 2 GitHub UI.
  // ---------------------------------------------------------------------------
  let activityCount = 0;
  const ACTIVITY_START = addDays(REFERENCE_DATE, -84); // 12 weeks
  for (const dev of developers) {
    for (let dayOffset = 0; dayOffset <= 84; dayOffset++) {
      const date = addDays(ACTIVITY_START, dayOffset);
      const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      // Abdulaziz only active last 6 weeks (new hire).
      if (dev.name === "Abdulaziz Roshan" && dayOffset < 42) continue;
      const commitBase = isWeekend ? 0 : randInt(2, 8);
      const prBase = isWeekend ? 0 : randInt(0, 2);
      const reviewBase = isWeekend ? 0 : randInt(0, 3);
      // Slight activity correlation with capacity.
      const scale = dev.weeklyCapacityHours / 40;
      await prisma.developerActivity.create({
        data: {
          developerId: dev.id,
          source: "seed",
          activityDate: date,
          commitCount: Math.round(commitBase * scale),
          pullRequestCount: Math.round(prBase * scale),
          reviewCount: Math.round(reviewBase * scale),
          externalRef: null,
        },
      });
      activityCount += 1;
    }
  }
  console.log(`✓ Developer activity rows: ${activityCount}`);

  console.log("\n✅ Seed complete. All passwords: password123\n");
  console.log("  MANAGER   admin@sprintplanner.com        full access");
  console.log("  MANAGER   lead@sprintplanner.com         full access");
  console.log("");
  console.log("  DEVELOPER angelo@sprintplanner.com        overloaded, ×1.28, 2 concurrent sprints");
  console.log("  DEVELOPER nomal@sprintplanner.com          accurate estimator, cross-sprint");
  console.log("  DEVELOPER kusalni@sprintplanner.com        over-estimator (×0.80)");
  console.log("  DEVELOPER abdulaziz@sprintplanner.com         new hire, low-confidence factor");
  console.log("  DEVELOPER saajid@sprintplanner.com         improving trend");
  console.log("  DEVELOPER newdev@sprintplanner.com       no developer profile — empty state");
  console.log("");
  console.log("  CLIENT    client-ecom@sprintplanner.com  E-Commerce Platform only");
  console.log("  CLIENT    client-mobile@sprintplanner.com Mobile API Backend + Mobile App");
  console.log("  CLIENT    client-new@sprintplanner.com   no projects — default-deny state\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
