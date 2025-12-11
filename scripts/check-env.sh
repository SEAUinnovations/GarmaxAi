#!/bin/bash

# ==============================================
# Environment Check Script
# ==============================================
# Checks if local debug environment is properly configured

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GarmaxAI Environment Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check .env.local
echo -e "${BLUE}Checking .env.local...${NC}"
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓ .env.local exists${NC}"
    
    # Check critical variables
    if grep -q "COGNITO_USER_POOL_ID=us-east-1" .env.local; then
        echo -e "${GREEN}  ✓ COGNITO_USER_POOL_ID configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ COGNITO_USER_POOL_ID needs configuration${NC}"
    fi
    
    if grep -q "COGNITO_CLIENT_ID=.*[a-z0-9]" .env.local; then
        echo -e "${GREEN}  ✓ COGNITO_CLIENT_ID configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ COGNITO_CLIENT_ID needs configuration${NC}"
    fi
    
    if grep -q "COGNITO_DOMAIN=garmaxai" .env.local; then
        echo -e "${GREEN}  ✓ COGNITO_DOMAIN configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ COGNITO_DOMAIN needs configuration${NC}"
    fi
    
    if grep -q "FRONTEND_URL=http://localhost:5000" .env.local; then
        echo -e "${GREEN}  ✓ FRONTEND_URL set to localhost:5000${NC}"
    else
        echo -e "${YELLOW}  ⚠ FRONTEND_URL should be http://localhost:5000${NC}"
    fi
else
    echo -e "${RED}✗ .env.local not found${NC}"
    echo -e "${YELLOW}  Run: cp .env.local.template .env.local${NC}"
fi

echo ""

# Check Docker
echo -e "${BLUE}Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker installed${NC}"
    
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓ Docker daemon is running${NC}"
        
        # Check containers
        if docker ps | grep -q "garmaxai-mysql"; then
            echo -e "${GREEN}  ✓ MySQL container running${NC}"
        else
            echo -e "${YELLOW}  ⚠ MySQL container not running${NC}"
        fi
        
        if docker ps | grep -q "garmaxai-redis"; then
            echo -e "${GREEN}  ✓ Redis container running${NC}"
        else
            echo -e "${YELLOW}  ⚠ Redis container not running${NC}"
        fi
        
        if docker ps | grep -q "garmaxai-localstack"; then
            echo -e "${GREEN}  ✓ LocalStack container running${NC}"
        else
            echo -e "${YELLOW}  ⚠ LocalStack container not running${NC}"
        fi
    else
        echo -e "${RED}✗ Docker daemon not running${NC}"
        echo -e "${YELLOW}  Start Docker Desktop${NC}"
    fi
else
    echo -e "${RED}✗ Docker not installed${NC}"
fi

echo ""

# Check Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js installed: ${NODE_VERSION}${NC}"
    
    if [ -d "node_modules" ]; then
        echo -e "${GREEN}  ✓ Dependencies installed${NC}"
    else
        echo -e "${YELLOW}  ⚠ Dependencies not installed${NC}"
        echo -e "${YELLOW}    Run: npm install${NC}"
    fi
else
    echo -e "${RED}✗ Node.js not installed${NC}"
fi

echo ""

# Check ports
echo -e "${BLUE}Checking ports...${NC}"
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 3000 is in use (backend)${NC}"
else
    echo -e "${GREEN}✓ Port 3000 available${NC}"
fi

if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 5000 is in use (frontend)${NC}"
else
    echo -e "${GREEN}✓ Port 5000 available${NC}"
fi

echo ""

# Check VS Code config
echo -e "${BLUE}Checking VS Code configuration...${NC}"
if [ -f ".vscode/launch.json" ]; then
    echo -e "${GREEN}✓ Debug configurations exist${NC}"
else
    echo -e "${RED}✗ Debug configurations missing${NC}"
fi

if [ -f ".vscode/tasks.json" ]; then
    echo -e "${GREEN}✓ VS Code tasks exist${NC}"
else
    echo -e "${RED}✗ VS Code tasks missing${NC}"
fi

echo ""

# Check Vite config
echo -e "${BLUE}Checking Vite configuration...${NC}"
if grep -q "proxy" client/vite.config.ts; then
    echo -e "${GREEN}✓ Vite proxy configured${NC}"
else
    echo -e "${YELLOW}⚠ Vite proxy not configured${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "If you see ${GREEN}green checkmarks${NC}, you're good!"
echo -e "If you see ${YELLOW}yellow warnings${NC}, fix those issues."
echo -e "If you see ${RED}red errors${NC}, those must be resolved."
echo ""
echo -e "Next steps:"
echo -e "1. Fix any ${YELLOW}yellow${NC} or ${RED}red${NC} items above"
echo -e "2. Run: ${YELLOW}./scripts/setup-local-debug.sh${NC}"
echo -e "3. Run: ${YELLOW}npm run db:push${NC}"
echo -e "4. Press ${YELLOW}F5${NC} in VS Code to start debugging"
echo ""
