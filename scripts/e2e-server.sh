#!/usr/bin/env bash
# Prevent idle sleep during the production build and browser run. Four apparent
# 15–17 minute test hangs matched four system sleep intervals to the second;
# once the machine stayed awake, the next run passed 30/30 in 1.1 minutes
# (F-84). Linux has no `caffeinate`, so CI proceeds directly.
set -euo pipefail

if command -v caffeinate >/dev/null 2>&1 && [[ "${COSTED_CAFFEINATED:-}" != "1" ]]; then
  export COSTED_CAFFEINATED=1
  exec caffeinate -i "$0" "$@"
fi

# Also refuse concurrent invocations. They would build into the same .next
# directory and target the same port, so sharing one would invalidate the run.
LOCK_DIR="${TMPDIR:-/tmp}/costed-e2e-server.lock"
PID_FILE="$LOCK_DIR/pid"

release_lock() {
  rm -f "$PID_FILE"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Another Costed end-to-end server is already running (PID $existing_pid)." >&2
    echo "Wait for it to finish before starting another pnpm e2e run." >&2
    exit 1
  fi

  # A previous process was killed before its EXIT trap ran.
  release_lock
  mkdir "$LOCK_DIR"
fi

echo "$$" > "$PID_FILE"
trap release_lock EXIT INT TERM

if [[ "${COSTED_E2E_WEBPACK:-}" == "1" ]]; then
  # Turbopack's CSS worker needs a local port that some sandboxes deny.
  ./node_modules/.bin/next build --webpack
else
  ./node_modules/.bin/next build
fi
./node_modules/.bin/next start -p 3100
