#!/bin/bash
# Launch all 5 Claude Code agents in parallel tmux panes.
# Usage: ./scripts/launch-agents.sh
# Prerequisites: tmux, claude CLI installed

set -euo pipefail

SESSION="web3-agents"
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Architect (team lead)
tmux new-session -d -s "$SESSION" -n "architect" -c "$PROJECT_ROOT"
tmux send-keys -t "$SESSION:architect" "cd '$PROJECT_ROOT' && claude --agent architect" Enter

# Blockchain Developer
tmux new-window -t "$SESSION" -n "blockchain" -c "$PROJECT_ROOT"
tmux send-keys -t "$SESSION:blockchain" "cd '$PROJECT_ROOT' && claude --agent blockchain-dev" Enter

# Frontend Builder
tmux new-window -t "$SESSION" -n "frontend" -c "$PROJECT_ROOT"
tmux send-keys -t "$SESSION:frontend" "cd '$PROJECT_ROOT' && claude --agent frontend-builder" Enter

# UX Tester
tmux new-window -t "$SESSION" -n "uxtester" -c "$PROJECT_ROOT"
tmux send-keys -t "$SESSION:uxtester" "cd '$PROJECT_ROOT' && claude --agent ux-tester" Enter

# Security Engineer
tmux new-window -t "$SESSION" -n "security" -c "$PROJECT_ROOT"
tmux send-keys -t "$SESSION:security" "cd '$PROJECT_ROOT' && claude --agent security-engineer" Enter

echo "All agents launched in tmux session '$SESSION'."
echo "Attach with: tmux attach -t $SESSION"
echo "Switch windows: Ctrl-b + window number (0-4)"
tmux attach -t "$SESSION"
