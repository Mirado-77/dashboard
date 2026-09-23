#!/usr/bin/env bash

set -e

docker compose up -d db mailpit

SESSION="dev"

tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" "bun run dev:api"
tmux split-window -h -t "$SESSION" "bun run dev:web"
tmux select-layout -t "$SESSION" even-horizontal

tmux attach-session -t "$SESSION"