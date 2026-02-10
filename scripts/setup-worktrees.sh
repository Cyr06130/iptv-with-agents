#!/bin/bash
# Create git worktrees for filesystem isolation between agents.
# Each agent gets its own working directory with shared git history.
# Usage: ./scripts/setup-worktrees.sh
# Run from the main project root (must be a git repo).

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT_DIR="$(dirname "$PROJECT_ROOT")"

cd "$PROJECT_ROOT"

# Ensure we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not a git repository. Initialize with 'git init' first."
  exit 1
fi

MAIN_BRANCH=$(git branch --show-current)
if [ -z "$MAIN_BRANCH" ]; then
  echo "Error: No commits yet. Make an initial commit first."
  exit 1
fi

AGENTS=("blockchain-dev" "frontend-builder" "ux-tester" "security-engineer" "architect")

for agent in "${AGENTS[@]}"; do
  WORKTREE_PATH="$PARENT_DIR/project-$agent"
  BRANCH="agent/$agent"

  if [ -d "$WORKTREE_PATH" ]; then
    echo "  Worktree already exists: $WORKTREE_PATH (skipping)"
  else
    git worktree add "$WORKTREE_PATH" -b "$BRANCH" "$MAIN_BRANCH"
    echo "  Created worktree: $WORKTREE_PATH on branch $BRANCH"
  fi
done

echo ""
echo "All worktrees created. Launch agents with: ./scripts/launch-agents-worktrees.sh"
