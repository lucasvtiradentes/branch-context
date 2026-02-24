#!/bin/bash
{marker}

PREV_HEAD="$1"
NEW_HEAD="$2"
CHECKOUT_TYPE="$3"

if [ "$CHECKOUT_TYPE" == "1" ]; then
    OLD_BRANCH=$(git rev-parse --abbrev-ref @{{-1}} 2>/dev/null || echo "unknown")
    NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    {callback} "$OLD_BRANCH" "$NEW_BRANCH" "$PREV_HEAD" "$NEW_HEAD"
fi
