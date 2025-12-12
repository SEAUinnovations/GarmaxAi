#!/bin/bash
# Quick script to manually top up test user credits
# Usage: ./scripts/top-up-test-user.sh [amount]

AMOUNT=${1:-100000}

echo "Topping up bettstahlik@gmail.com with $AMOUNT credits..."
TARGET_CREDITS=$AMOUNT npx tsx scripts/ensure-test-user-credits.ts
