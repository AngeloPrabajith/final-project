#!/usr/bin/env bash
#
# Role-based access control verification.
#
# Exercises every API endpoint as a manager, a developer and a client, asserts
# the expected HTTP status, and — the part that matters most — scans every
# client-facing response body for per-developer data that should never reach an
# external stakeholder.
#
# The content scan works because the seeded developer names are fixed and
# unique, so a single grep across a response is a genuinely strong end-to-end
# assertion. It catches leaks a status-code test cannot: a 200 with the right
# shape but the wrong fields inside it.
#
# Usage:
#   npm run dev            # in another terminal
#   npm run db:seed        # required — this asserts against seeded personas
#   ./scripts/authz-check.sh
#
# Exits non-zero if any check fails, so it can gate CI.

set -uo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
dim()   { printf "\033[2m%s\033[0m" "$1"; }

login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))'
}

# expect_status <label> <token> <method> <path> <expected> [body]
expect_status() {
  local label="$1" token="$2" method="$3" path="$4" expected="$5" body="${6:-}"
  local actual
  if [ -n "$body" ]; then
    actual=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
      -d "$body" "$BASE$path")
  else
    actual=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $token" "$BASE$path")
  fi
  if [ "$actual" = "$expected" ]; then
    printf "  %s %-58s %s\n" "$(green PASS)" "$label" "$(dim "$actual")"
    PASS=$((PASS + 1))
  else
    printf "  %s %-58s expected %s, got %s\n" "$(red FAIL)" "$label" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

# expect_count <label> <token> <path> <expected>
expect_count() {
  local label="$1" token="$2" path="$3" expected="$4"
  local actual
  actual=$(curl -s -H "Authorization: Bearer $token" "$BASE$path" \
    | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else -1)
except Exception: print(-1)')
  if [ "$actual" = "$expected" ]; then
    printf "  %s %-58s %s\n" "$(green PASS)" "$label" "$(dim "$actual rows")"
    PASS=$((PASS + 1))
  else
    printf "  %s %-58s expected %s rows, got %s\n" "$(red FAIL)" "$label" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

# Anything here appearing in a client response is a leak. Developer names come
# from the seed personas; the field names are the capacity-model internals.
LEAK_PATTERN='Angelo|Nomal|Kusalni|Abdulaziz|Saajid|utilizationPercent|overloadRisk|meetingHoursPerWeek|assignedDeveloper|actualHours|retrospectiveNotes|estimates|weeklyCapacityHours|adjustedAnalyses|probabilityPercent'

# expect_no_leak <label> <token> <path>
expect_no_leak() {
  local label="$1" token="$2" path="$3"
  local hits
  hits=$(curl -s -H "Authorization: Bearer $token" "$BASE$path" \
    | grep -Eoi "$LEAK_PATTERN" | sort -u | tr '\n' ' ')
  if [ -z "$hits" ]; then
    printf "  %s %-58s %s\n" "$(green PASS)" "$label" "$(dim clean)"
    PASS=$((PASS + 1))
  else
    printf "  %s %-58s leaked: %s\n" "$(red FAIL)" "$label" "$hits"
    FAIL=$((FAIL + 1))
  fi
}

echo
echo "Cadence — role-based access control checks"
echo "Base: $BASE"

MGR=$(login admin@sprintplanner.com)
DEV=$(login angelo@sprintplanner.com)
UNLINKED=$(login newdev@sprintplanner.com)
CLIENT=$(login client-ecom@sprintplanner.com)
CLIENT_NEW=$(login client-new@sprintplanner.com)

if [ -z "$MGR" ] || [ -z "$DEV" ] || [ -z "$CLIENT" ]; then
  echo "$(red 'Could not log in.') Is the dev server running and the database seeded?"
  exit 1
fi

# Ids used by the ownership and scoping checks.
CLIENT_PROJECT=$(curl -s -H "Authorization: Bearer $CLIENT" "$BASE/api/projects" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')
OTHER_PROJECT=$(curl -s -H "Authorization: Bearer $MGR" "$BASE/api/projects" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(next(p['id'] for p in d if p['id'] not in '$CLIENT_PROJECT'))")
DEV_TASK=$(curl -s -H "Authorization: Bearer $DEV" "$BASE/api/tasks" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')
PEER_TASK=$(curl -s -H "Authorization: Bearer $MGR" "$BASE/api/tasks" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next(t["id"] for t in d if (t.get("assignedDeveloper") or {}).get("name","").startswith("Nomal")))')
FOREIGN_SPRINT=$(curl -s -H "Authorization: Bearer $MGR" "$BASE/api/sprints" \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)
print(next(s["id"] for s in d if not any((t.get("assignedDeveloper") or {}).get("name","").startswith("Angelo") for t in s["tasks"])))')
CLIENT_SPRINT=$(curl -s -H "Authorization: Bearer $CLIENT" "$BASE/api/sprints" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')

echo
echo "1. Unauthenticated requests are refused"
expect_status "no token → /api/projects"          "" GET /api/projects            401
expect_status "no token → /api/dashboard"         "" GET /api/dashboard           401
expect_status "no token → /api/developers"        "" GET /api/developers          401
expect_status "garbage token → /api/me"     "not-a-jwt" GET /api/me               401

echo
echo "2. Manager retains full access (regression check)"
expect_status "manager → developers roster"       "$MGR" GET /api/developers           200
expect_status "manager → team accuracy"           "$MGR" GET /api/developers/accuracy  200
expect_status "manager → forecast evaluation"     "$MGR" GET /api/evaluation/forecast  200
expect_status "manager → admin users"             "$MGR" GET /api/admin/users          200
expect_count  "manager sees all projects"         "$MGR" /api/projects 3

echo
echo "3. Developer is confined to their own work"
expect_status "developer → developers roster"     "$DEV" GET /api/developers           403
expect_status "developer → team accuracy"         "$DEV" GET /api/developers/accuracy  403
expect_status "developer → forecast evaluation"   "$DEV" GET /api/evaluation/forecast  403
expect_status "developer → activity ingest"       "$DEV" POST /api/activity/ingest     403 '{"entries":[]}'
expect_status "developer → admin users"           "$DEV" GET /api/admin/users          403
expect_status "developer → sprint with no own work" "$DEV" GET "/api/sprints/$FOREIGN_SPRINT" 403
expect_status "developer → sprint forecast"       "$DEV" GET "/api/sprints/$FOREIGN_SPRINT/forecast" 403
expect_status "developer → create task"           "$DEV" POST /api/tasks 403 '{"title":"x","estimatedHours":1,"type":"planned","sprintId":"x"}'
expect_status "developer → delete own task"       "$DEV" DELETE "/api/tasks/$DEV_TASK" 403
expect_status "developer → update peer's task"    "$DEV" PUT "/api/tasks/$PEER_TASK" 403 '{"status":"done"}'
expect_status "developer → reassign own task"     "$DEV" PUT "/api/tasks/$DEV_TASK"  403 '{"assignedDeveloperId":"someone-else"}'
expect_status "developer → set own task status"   "$DEV" PUT "/api/tasks/$DEV_TASK"  200 '{"status":"inprogress"}'
expect_count  "developer sees 0 tasks in a sprint they're not on" "$DEV" "/api/tasks?sprintId=$FOREIGN_SPRINT" 0

echo
echo "4. Unlinked developer account is denied by default"
expect_status "unlinked → tasks"                  "$UNLINKED" GET /api/tasks    403
expect_status "unlinked → sprints"                "$UNLINKED" GET /api/sprints  403
expect_status "unlinked → own identity"           "$UNLINKED" GET /api/me       200

echo
echo "5. Client is confined to granted projects"
expect_status "client → developers roster"        "$CLIENT" GET /api/developers          403
expect_status "client → team accuracy"            "$CLIENT" GET /api/developers/accuracy 403
expect_status "client → forecast evaluation"      "$CLIENT" GET /api/evaluation/forecast 403
expect_status "client → unassigned project"       "$CLIENT" GET "/api/projects/$OTHER_PROJECT" 403
expect_status "client → unassigned velocity"      "$CLIENT" GET "/api/projects/$OTHER_PROJECT/velocity" 403
expect_status "client → granted project"          "$CLIENT" GET "/api/projects/$CLIENT_PROJECT" 200
expect_status "client → create task"              "$CLIENT" POST /api/tasks 403 '{"title":"x","estimatedHours":1,"type":"planned","sprintId":"x"}'
expect_status "client → delete granted project"   "$CLIENT" DELETE "/api/projects/$CLIENT_PROJECT" 403
expect_status "client → capacity simulation"      "$CLIENT" GET "/api/sprints/$CLIENT_SPRINT/capacity?simulateDeveloperId=x&simulateHours=5" 403
expect_count  "client sees only granted projects" "$CLIENT" /api/projects 1

echo
echo "6. Client with no grants sees nothing (deny by default)"
expect_count "no-grant client → projects" "$CLIENT_NEW" /api/projects 0
expect_count "no-grant client → sprints"  "$CLIENT_NEW" /api/sprints  0
expect_count "no-grant client → tasks"    "$CLIENT_NEW" /api/tasks    0

echo
echo "7. No per-developer data in any client-facing response"
expect_no_leak "client /api/dashboard"            "$CLIENT" /api/dashboard
expect_no_leak "client /api/projects"             "$CLIENT" /api/projects
expect_no_leak "client /api/projects/[id]"        "$CLIENT" "/api/projects/$CLIENT_PROJECT"
expect_no_leak "client /api/projects/[id]/velocity" "$CLIENT" "/api/projects/$CLIENT_PROJECT/velocity"
expect_no_leak "client /api/sprints"              "$CLIENT" /api/sprints
expect_no_leak "client /api/sprints/[id]"         "$CLIENT" "/api/sprints/$CLIENT_SPRINT"
expect_no_leak "client /api/sprints/[id]/capacity" "$CLIENT" "/api/sprints/$CLIENT_SPRINT/capacity"
expect_no_leak "client /api/sprints/[id]/forecast" "$CLIENT" "/api/sprints/$CLIENT_SPRINT/forecast"
expect_no_leak "client /api/tasks"                "$CLIENT" /api/tasks
expect_no_leak "client /api/portfolio/[id]"       "$CLIENT" "/api/portfolio/$CLIENT_PROJECT"

echo
echo "─────────────────────────────────────────────"
printf "  %s passed, %s failed\n" "$(green "$PASS")" "$([ "$FAIL" -eq 0 ] && green 0 || red "$FAIL")"
echo

# Leave the seed data as we found it — one check above flips a task status.
if [ "$FAIL" -eq 0 ]; then
  echo "$(dim 'Note: run `npm run db:seed` to reset the task status this script changed.')"
  exit 0
fi
exit 1
