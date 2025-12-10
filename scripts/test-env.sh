#!/bin/bash

# ==============================================
# Environment Verification Script
# ==============================================
# Tests all local services and dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GarmaxAI Environment Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Load environment variables
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Loaded .env.local${NC}"
else
    echo -e "${RED}✗ .env.local not found${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# Docker Services
echo -e "${YELLOW}Docker Services:${NC}"

if docker-compose ps | grep -q "mysql.*Up"; then
    echo -e "  ${GREEN}✓${NC} MySQL container running"
    
    # Test connection
    if docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "SELECT 1" garmaxai &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} MySQL connection successful"
        
        # Count tables
        TABLES=$(docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "SHOW TABLES;" garmaxai 2>/dev/null | tail -n +2 | wc -l | xargs)
        echo -e "     Database: garmaxai ($TABLES tables)"
        
        # Check specific tables
        if docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "DESCRIBE users;" garmaxai &>/dev/null; then
            echo -e "     ${GREEN}•${NC} users table exists"
        else
            echo -e "     ${RED}✗${NC} users table missing"
            FAILED=$((FAILED + 1))
        fi
        
        if docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "DESCRIBE subscription_plans;" garmaxai &>/dev/null; then
            echo -e "     ${GREEN}•${NC} subscription_plans table exists"
            
            PLAN_COUNT=$(docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "SELECT COUNT(*) FROM subscription_plans;" garmaxai 2>/dev/null | tail -n 1)
            echo -e "     Plans seeded: $PLAN_COUNT"
        else
            echo -e "     ${RED}✗${NC} subscription_plans table missing"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "  ${RED}✗${NC} MySQL connection failed"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "  ${RED}✗${NC} MySQL container not running"
    FAILED=$((FAILED + 1))
fi
echo ""

if docker-compose ps | grep -q "redis.*Up"; then
    echo -e "  ${GREEN}✓${NC} Redis container running"
    
    # Test connection
    if docker exec garmaxai-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "  ${GREEN}✓${NC} Redis connection successful"
        
        # Get memory info
        MEM=$(docker exec garmaxai-redis redis-cli INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
        echo -e "     Memory used: $MEM"
    else
        echo -e "  ${RED}✗${NC} Redis connection failed"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "  ${RED}✗${NC} Redis container not running"
    FAILED=$((FAILED + 1))
fi
echo ""

if docker-compose ps | grep -q "localstack.*Up"; then
    echo -e "  ${GREEN}✓${NC} LocalStack container running"
    
    # Test health endpoint
    if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} LocalStack API responding"
        
        # Check specific services
        HEALTH=$(curl -s http://localhost:4566/_localstack/health)
        if echo "$HEALTH" | grep -q '"s3".*"available"'; then
            echo -e "     ${GREEN}•${NC} S3 available"
        fi
        if echo "$HEALTH" | grep -q '"sqs".*"available"'; then
            echo -e "     ${GREEN}•${NC} SQS available"
        fi
        if echo "$HEALTH" | grep -q '"dynamodb".*"available"'; then
            echo -e "     ${GREEN}•${NC} DynamoDB available"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  LocalStack API not responding (may still be initializing)"
    fi
else
    echo -e "  ${RED}✗${NC} LocalStack container not running"
    FAILED=$((FAILED + 1))
fi
echo ""

# Network connectivity
echo -e "${YELLOW}Network Connectivity:${NC}"

# MySQL
if nc -z localhost 3306 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} MySQL port 3306 accessible"
else
    echo -e "  ${RED}✗${NC} MySQL port 3306 not accessible"
    FAILED=$((FAILED + 1))
fi

# Redis
if nc -z localhost 6379 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Redis port 6379 accessible"
else
    echo -e "  ${RED}✗${NC} Redis port 6379 not accessible"
    FAILED=$((FAILED + 1))
fi

# LocalStack
if nc -z localhost 4566 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} LocalStack port 4566 accessible"
else
    echo -e "  ${RED}✗${NC} LocalStack port 4566 not accessible"
    FAILED=$((FAILED + 1))
fi

# Adminer
if nc -z localhost 8080 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Adminer port 8080 accessible"
    echo -e "     Access at: ${BLUE}http://localhost:8080${NC}"
else
    echo -e "  ${YELLOW}⚠${NC}  Adminer port 8080 not accessible"
fi
echo ""

# Environment Variables
echo -e "${YELLOW}Environment Variables:${NC}"

if [ ! -z "$DATABASE_URL" ]; then
    echo -e "  ${GREEN}✓${NC} DATABASE_URL set"
else
    echo -e "  ${RED}✗${NC} DATABASE_URL not set"
    FAILED=$((FAILED + 1))
fi

if [ ! -z "$REDIS_URL" ]; then
    echo -e "  ${GREEN}✓${NC} REDIS_URL set"
else
    echo -e "  ${RED}✗${NC} REDIS_URL not set"
    FAILED=$((FAILED + 1))
fi

if [ ! -z "$JWT_SECRET" ]; then
    echo -e "  ${GREEN}✓${NC} JWT_SECRET set"
else
    echo -e "  ${RED}✗${NC} JWT_SECRET not set"
    FAILED=$((FAILED + 1))
fi

if [ ! -z "$COGNITO_USER_POOL_ID" ]; then
    echo -e "  ${GREEN}✓${NC} COGNITO_USER_POOL_ID set"
else
    echo -e "  ${YELLOW}⚠${NC}  COGNITO_USER_POOL_ID not set (using mock for local)"
fi

if [ ! -z "$STRIPE_SECRET_KEY" ]; then
    if [[ "$STRIPE_SECRET_KEY" == "sk_test_"* ]]; then
        echo -e "  ${GREEN}✓${NC} STRIPE_SECRET_KEY set (test mode)"
    else
        echo -e "  ${YELLOW}⚠${NC}  STRIPE_SECRET_KEY set but not test key"
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  STRIPE_SECRET_KEY not set (add for payment testing)"
fi

if [ ! -z "$REPLICATE_API_TOKEN" ]; then
    echo -e "  ${GREEN}✓${NC} REPLICATE_API_TOKEN set"
else
    echo -e "  ${YELLOW}⚠${NC}  REPLICATE_API_TOKEN not set (add for AI features)"
fi
echo ""

# Node dependencies
echo -e "${YELLOW}Node Dependencies:${NC}"

if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} Root node_modules exists"
else
    echo -e "  ${RED}✗${NC} Root node_modules missing - run 'npm install'"
    FAILED=$((FAILED + 1))
fi

if [ -d "client/node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} Client node_modules exists"
else
    echo -e "  ${YELLOW}⚠${NC}  Client node_modules missing - run 'cd client && npm install'"
fi
echo ""

# Build artifacts
echo -e "${YELLOW}Build Artifacts:${NC}"

if [ -d "dist" ]; then
    echo -e "  ${GREEN}✓${NC} Backend dist/ exists"
else
    echo -e "  ${YELLOW}⚠${NC}  Backend dist/ missing - run 'npm run build'"
fi

if [ -d "client/dist" ]; then
    echo -e "  ${GREEN}✓${NC} Frontend dist/ exists"
else
    echo -e "  ${YELLOW}⚠${NC}  Frontend dist/ missing - run 'npm run build:client'"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo -e "Environment is ready for development."
    echo -e "Run ${YELLOW}npm run dev${NC} to start backend"
    echo -e "Run ${YELLOW}npm run dev:client${NC} to start frontend"
    exit 0
else
    echo -e "${RED}✗ $FAILED check(s) failed${NC}"
    echo ""
    echo -e "Fix the issues above before continuing."
    echo -e "Run ${YELLOW}./scripts/dev-setup.sh${NC} to reinitialize environment"
    exit 1
fi
echo ""
