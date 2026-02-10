#!/bin/bash
# Run all 5 agents in headless mode (for CI/CD or unattended execution).
# Usage: ./scripts/run-all-agents-headless.sh
# Requires: ANTHROPIC_API_KEY environment variable set

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/agent-results"
TASKS_DIR="$PROJECT_ROOT/tasks"

mkdir -p "$RESULTS_DIR"

echo "Starting all agents in headless mode..."
echo "Results will be written to $RESULTS_DIR/"

# Blockchain Developer
if [ -f "$TASKS_DIR/blockchain-task.md" ]; then
  claude -p "$(cat "$TASKS_DIR/blockchain-task.md")" \
    --agent blockchain-dev --output-format json \
    --permission-mode acceptEdits \
    > "$RESULTS_DIR/blockchain.json" 2>&1 &
  PID_BLOCKCHAIN=$!
  echo "  blockchain-dev started (PID: $PID_BLOCKCHAIN)"
else
  echo "  SKIP blockchain-dev: no task file at $TASKS_DIR/blockchain-task.md"
fi

# Frontend Builder
if [ -f "$TASKS_DIR/frontend-task.md" ]; then
  claude -p "$(cat "$TASKS_DIR/frontend-task.md")" \
    --agent frontend-builder --output-format json \
    --permission-mode acceptEdits \
    > "$RESULTS_DIR/frontend.json" 2>&1 &
  PID_FRONTEND=$!
  echo "  frontend-builder started (PID: $PID_FRONTEND)"
else
  echo "  SKIP frontend-builder: no task file at $TASKS_DIR/frontend-task.md"
fi

# UX Tester
if [ -f "$TASKS_DIR/testing-task.md" ]; then
  claude -p "$(cat "$TASKS_DIR/testing-task.md")" \
    --agent ux-tester --output-format json \
    --permission-mode acceptEdits \
    > "$RESULTS_DIR/ux-tester.json" 2>&1 &
  PID_UXTESTER=$!
  echo "  ux-tester started (PID: $PID_UXTESTER)"
else
  echo "  SKIP ux-tester: no task file at $TASKS_DIR/testing-task.md"
fi

# Security Engineer (read-only)
if [ -f "$TASKS_DIR/security-task.md" ]; then
  claude -p "$(cat "$TASKS_DIR/security-task.md")" \
    --agent security-engineer --output-format json \
    --permission-mode plan \
    > "$RESULTS_DIR/security.json" 2>&1 &
  PID_SECURITY=$!
  echo "  security-engineer started (PID: $PID_SECURITY)"
else
  echo "  SKIP security-engineer: no task file at $TASKS_DIR/security-task.md"
fi

echo ""
echo "Waiting for implementation agents to complete..."
wait ${PID_BLOCKCHAIN:-} ${PID_FRONTEND:-} ${PID_UXTESTER:-} ${PID_SECURITY:-} 2>/dev/null

echo "Implementation agents done. Starting architect review..."

# Architect reviews all outputs
claude -p "Review all agent outputs in $RESULTS_DIR/ and write an integration report to coordination/DECISIONS.md" \
  --agent architect --output-format json \
  > "$RESULTS_DIR/architect-review.json"

echo ""
echo "All agents complete. Results in $RESULTS_DIR/"
