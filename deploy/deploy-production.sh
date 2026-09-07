#!/bin/bash
# QFT Technical Support System — production deployment.
# Triggered by: push to 'main'.
# All logic lives in deploy.sh so a fix lands in one place, not three.
set -euo pipefail
DEPLOY_ENV="production" BRANCH="main" exec "$(dirname "${BASH_SOURCE[0]}")/deploy.sh"
