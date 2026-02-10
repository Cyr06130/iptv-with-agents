#!/bin/bash
# Launch agents in tmux, each in its own git worktree for full filesystem isolation.
# Run setup-worktrees.sh first.
# Usage: ./scripts/launch-agents-worktrees.sh

set -euo pipefail

SESSION="web3-agents"
PARENT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Architect (team lead)
tmux new-session -d -s "$SESSION" -n "architect" -c "$PARENT_DIR/project-architect"
tmux send-keys -t "$SESSION:architect" "claude --agent architect" Enter

# Blockchain Developer
tmux new-window -t "$SESSION" -n "blockchain" -c "$PARENT_DIR/project-blockchain-dev"
tmux send-keys -t "$SESSION:blockchain" "claude --agent blockchain-dev" Enter

# Frontend Builder
tmux new-window -t "$SESSION" -n "frontend" -c "$PARENT_DIR/project-frontend-builder"
tmux send-keys -t "$SESSION:frontend" "claude --agent frontend-builder" Enter

# UX Tester
tmux new-window -t "$SESSION" -n "uxtester" -c "$PARENT_DIR/project-ux-tester"
tmux send-keys -t "$SESSION:uxtester" "claude --agent ux-tester" Enter

# Security Engineer
tmux new-window -t "$SESSION" -n "security" -c "$PARENT_DIR/project-security-engineer"
tmux send-keys -t "$SESSION:security" "claude --agent security-engineer" Enter

echo "All agents launched in isolated worktrees."
echo "Attach with: tmux attach -t $SESSION"
tmux attach -t "$SESSION"
