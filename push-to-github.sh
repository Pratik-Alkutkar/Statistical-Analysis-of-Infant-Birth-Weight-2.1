#!/usr/bin/env bash
# One-shot script to clear the GitHub repo and push everything from this folder.
#
# Run this from inside the project folder:
#   chmod +x push-to-github.sh && ./push-to-github.sh
#
# What it does:
#   1. Removes any existing local .git
#   2. Initializes a fresh repo on branch `main`
#   3. Commits every file (except those in .gitignore)
#   4. Force-pushes to https://github.com/Pratik-Alkutkar/Statistical-Analysis-of-Infant-Birth-Weight-2.1.git
#      -> this wipes whatever is currently on GitHub and replaces it with this folder.
#
# You'll be prompted for your GitHub credentials (use a Personal Access Token,
# not your password: https://github.com/settings/tokens).

set -euo pipefail

REMOTE="https://github.com/Pratik-Alkutkar/Statistical-Analysis-of-Infant-Birth-Weight-2.1.git"
BRANCH="main"

echo "==> Resetting local git history"
rm -rf .git
git init -b "$BRANCH" >/dev/null
git config user.name  "Pratik-Alkutkar"
git config user.email "alkutkarpratik@gmail.com"

echo "==> Staging files"
git add -A

echo "==> Committing"
git commit -m "Initial commit: Birth Weight Risk app (Next.js + Python serverless)" >/dev/null

echo "==> Configuring remote"
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"

echo "==> Force-pushing to $REMOTE (this will overwrite the remote $BRANCH branch)"
git push --force origin "$BRANCH"

echo
echo "Done. Your repo is now at:"
echo "  https://github.com/Pratik-Alkutkar/Statistical-Analysis-of-Infant-Birth-Weight-2.1"
