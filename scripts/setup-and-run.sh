#!/usr/bin/env bash
# Tries to find Node (nvm, fnm, or Homebrew) and run the app.
set -e
cd "$(dirname "$0")/.."

# Try to get node/npm on PATH
if command -v npm &>/dev/null; then
  : # already have npm
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  source "$HOME/.nvm/nvm.sh"
elif [ -f "$HOME/.local/share/fnm/fnm" ] || command -v fnm &>/dev/null; then
  eval "$(fnm env)" 2>/dev/null || true
fi

# Add common install paths
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm &>/dev/null; then
  echo "Node.js not found. Install it first:"
  echo "  • From https://nodejs.org (LTS), or"
  echo "  • Homebrew: brew install node"
  exit 1
fi

echo "Using node: $(command -v node) ($(node -v))"
npm install
npx prisma migrate dev
npx prisma generate
npx prisma db seed
echo ""
echo "Starting dev server. Open http://localhost:3000 when ready."
npm run dev
