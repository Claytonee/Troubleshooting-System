#!/bin/bash
# QFT Technical Support System — development deployment.
# Triggered by: push to 'develop'.
# All logic lives in deploy.sh so a fix lands in one place, not three.
set -euo pipefail
DEPLOY_ENV="development" BRANCH="develop" exec "$(dirname "${BASH_SOURCE[0]}")/deploy.sh"
