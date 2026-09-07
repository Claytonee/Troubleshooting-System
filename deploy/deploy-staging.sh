#!/bin/bash
# QFT Technical Support System — staging deployment.
# Triggered by: push to 'staging'.
# All logic lives in deploy.sh so a fix lands in one place, not three.
set -euo pipefail
DEPLOY_ENV="staging" BRANCH="staging" exec "$(dirname "${BASH_SOURCE[0]}")/deploy.sh"
