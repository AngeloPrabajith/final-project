// --- Entity types matching Prisma models ---

import type { Role } from "@/lib/roles";

export type { Role };

export interface User {
  id: string;
  name: string;
  email: string;
  /** Raw value from the DB — always pass through `normaliseRole` before branching. */
  role: string;
  createdAt?: string;
}

export interface Developer {
  id: string;
  name: string;
  weeklyCapacityHours: number;
  meetingHoursPerWeek?: number;
  githubUsername?: string | null;
  /** Linked login account, if this developer has one. */
  userId?: string | null;
  createdAt: string;
}

export interface ProjectClient {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  sprints?: Sprint[];
  createdAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  projectId: string;
  capacityBuffer: number;
  retrospectiveNotes?: string | null;
  project?: Project;
  tasks?: Task[];
  createdAt: string;
}

export type TaskType = "planned" | "adhoc";
export type TaskStatus =
  | "backlog"
  | "todo"
  | "inprogress"
  | "paused"
  | "qa"
  | "uat"
  | "readyforprod"
  | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  estimatedHours: number;
  actualHours?: number | null;
  completedAt?: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedDeveloperId: string | null;
  assignedDeveloper?: Developer | null;
  sprintId: string;
  sprint?: Sprint;
  createdAt: string;
}

export interface CapacityRecord {
  id: string;
  developerId: string;
  developer?: Developer;
  sprintId: string;
  sprint?: Sprint;
  assignedHours: number;
  capacityHours: number;
  overloadRisk: boolean;
}

// --- Derived / computed types ---

export interface CapacityAnalysis {
  developerId: string;
  developerName: string;
  assignedHours: number;
  completedHours: number;
  capacityHours: number;
  effectiveCapacityHours: number;
  utilizationPercent: number;
  overloadRisk: boolean;
  meetingHoursPerWeek?: number;
  multiProjectFactor?: number;
  allocationFactor?: number;
  contextSwitchFactor?: number;
  concurrentSprintCount?: number;
  overlappingSprintNames?: string[];
}

export type SprintHealthStatus = "healthy" | "at-risk" | "overloaded";

export interface SprintHealth {
  score: number;
  status: SprintHealthStatus;
  overloadedDeveloperCount: number;
  atRiskDeveloperCount: number;
  averageUtilization: number;
  recommendation: string;
}

export type BurndownStatus = "ahead" | "on-track" | "behind" | "at-risk";

export interface BurndownData {
  expectedProgress: number;
  actualProgress: number;
  status: BurndownStatus;
  totalHours: number;
  completedHours: number;
  daysTotal: number;
  daysPassed: number;
}

/**
 * Role-shaped. Managers get all three. Developers get `capacity` filtered to
 * themselves and no `health` (its `recommendation` string names peers).
 * Clients get `burndown` only.
 */
export interface SprintCapacityResponse {
  capacity?: CapacityAnalysis[];
  health?: SprintHealth;
  burndown: BurndownData;
}

export interface AtRiskSprint {
  id: string;
  name: string;
  projectName: string;
  health: SprintHealth;
  startDate: string;
  endDate: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeSprints: number;
  totalDevelopers: number;
  overloadedDevelopers: number;
  capacitySummary: CapacityAnalysis[];
  atRiskSprints: AtRiskSprint[];
}

export interface SimulationResult {
  before: CapacityAnalysis;
  after: CapacityAnalysis;
  wouldCauseOverload: boolean;
}

// --- Predictive layer ---

export type ActivitySource = "seed" | "github" | "mock";

export interface DeveloperActivity {
  id: string;
  developerId: string;
  source: ActivitySource;
  activityDate: string;
  commitCount: number;
  pullRequestCount: number;
  reviewCount: number;
  externalRef?: string | null;
  createdAt: string;
}

export type AccuracyConfidence = "low" | "medium" | "high";
export type AccuracyTrend = "improving" | "stable" | "degrading";

export interface EstimationAccuracy {
  developerId: string;
  developerName: string;
  factor: number;
  rawFactor: number;
  sampleSize: number;
  totalEstimated: number;
  totalActual: number;
  confidence: AccuracyConfidence;
  trend?: AccuracyTrend;
}

export type ForecastRiskBand = "low" | "moderate" | "high" | "critical";

export type ForecastContributorKey =
  | "utilisation"
  | "estimationAccuracy"
  | "velocityTrend"
  | "adhocHistory"
  | "daysRemaining";

export interface ForecastContributor {
  key: ForecastContributorKey;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface AdjustedCapacityAnalysis extends CapacityAnalysis {
  accuracyFactor: number;
  adjustedEffectiveCapacityHours: number;
  adjustedUtilizationPercent: number;
  adjustedOverloadRisk: boolean;
}

export interface SprintForecast {
  probabilityPercent: number;
  riskBand: ForecastRiskBand;
  headline: string;
  contributors: ForecastContributor[];
  adjustedAnalyses: AdjustedCapacityAnalysis[];
}

export type ForecastOutcome = "met" | "partial" | "missed";

export interface ForecastEvaluation {
  sprintId: string;
  sprintName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  predictedProbability: number;
  predictedBand: ForecastRiskBand;
  topContributor: { key: ForecastContributorKey; label: string; points: number };
  actualCompletionRate: number;
  totalEstimatedHours: number;
  completedEstimatedHours: number;
  outcome: ForecastOutcome;
}

export interface ForecastEvaluationSummary {
  evaluations: ForecastEvaluation[];
  hitCount: number; // predicted high/critical AND actually missed/partial
  falseAlarmCount: number; // predicted high/critical AND actually met
  missedAlarmCount: number; // predicted low/moderate AND actually missed
  totalSprints: number;
}

// --- Role-scoped API shapes ---

/** `GET /api/me` — the caller's identity plus what the server resolved for them. */
export interface MeResponse {
  user: User;
  role: Role;
  /** Linked `Developer.id`, or null when the account has no developer profile. */
  developerId: string | null;
  /** Assigned project ids for clients; null means unrestricted. */
  projectIds: string[] | null;
}

/** Manager dashboard — the original full-fat payload. */
export interface ManagerDashboard extends DashboardStats {
  kind: "manager";
}

/** Developer dashboard — strictly own-workload figures, no peer data. */
export interface DeveloperDashboard {
  kind: "developer";
  /** Null when the account isn't linked to a developer profile yet. */
  developerId: string | null;
  developerName: string | null;
  openTaskCount: number;
  openHours: number;
  /** Own capacity across the sprints currently in flight. */
  currentSprints: {
    sprintId: string;
    sprintName: string;
    projectName: string;
    assignedHours: number;
    /** Sprint hours after meetings are deducted, before buffer and dilution. */
    capacityHours: number;
    /** The sprint's planning buffer (0–0.4), needed to explain the arithmetic. */
    capacityBuffer: number;
    effectiveCapacityHours: number;
    utilizationPercent: number;
    overloadRisk: boolean;
    meetingHoursPerWeek: number;
    /** Own concurrent commitments — the cross-sprint dilution, from the developer's side. */
    concurrentSprintCount: number;
    overlappingSprintNames: string[];
    allocationFactor: number;
    contextSwitchFactor: number;
    multiProjectFactor: number;
  }[];
  concurrentSprintCount: number;
  accuracyFactor: number | null;
  accuracyConfidence: AccuracyConfidence | null;
}

/** Client dashboard — delivery progress per assigned project, no people data. */
export interface ClientDashboard {
  kind: "client";
  projects: ClientProjectSummary[];
}

export interface ClientProjectSummary {
  projectId: string;
  projectName: string;
  description: string | null;
  activeSprintCount: number;
  totalSprintCount: number;
  completionPercent: number;
  confidence: DeliveryConfidence;
}

export type DashboardResponse =
  | ManagerDashboard
  | DeveloperDashboard
  | ClientDashboard;

/**
 * Client-facing view of the sprint forecast. Deliberately carries no
 * percentage and no contributor breakdown — those embed developer names in
 * their `detail` strings.
 */
export interface DeliveryConfidence {
  band: ForecastRiskBand;
  label: string;
}

/** Whitelisted task shape for client responses — no assignee, no actual hours. */
export interface ClientTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  estimatedHours: number;
  sprintId: string;
}

/** Whitelisted sprint shape for client responses — no retrospective notes. */
export interface ClientSprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  projectId: string;
  projectName: string | null;
  tasks: ClientTask[];
}

/** Whitelisted project shape for client responses — sprints are redacted too. */
export interface ClientProject {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  sprints: ClientSprint[];
}

/** A client's project detail view. */
export interface ClientProjectDetail {
  id: string;
  name: string;
  description: string | null;
  completionPercent: number;
  sprints: ClientSprintProgress[];
}

export interface ClientSprintProgress {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  burndown: BurndownData;
  confidence: DeliveryConfidence;
}

/** Row shape for the manager-only `/admin/users` screen. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  rawRole: string;
  developerId: string | null;
  developerName: string | null;
  projectIds: string[];
  createdAt: string;
}

export interface UpdateAdminUserInput {
  role?: Role;
  developerId?: string | null;
  projectIds?: string[];
}

// --- API helpers ---

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// --- Form / input types ---

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface CreateSprintInput {
  name: string;
  startDate: string;
  endDate: string;
  projectId: string;
  capacityBuffer?: number;
}

export interface UpdateSprintInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  capacityBuffer?: number;
  retrospectiveNotes?: string | null;
}

export interface CreateDeveloperInput {
  name: string;
  weeklyCapacityHours: number;
  meetingHoursPerWeek?: number;
  githubUsername?: string;
}

export interface UpdateDeveloperInput {
  name?: string;
  weeklyCapacityHours?: number;
  meetingHoursPerWeek?: number;
  githubUsername?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  estimatedHours: number;
  type: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignedDeveloperId?: string;
  sprintId: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  estimatedHours?: number;
  actualHours?: number | null;
  completedAt?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignedDeveloperId?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
