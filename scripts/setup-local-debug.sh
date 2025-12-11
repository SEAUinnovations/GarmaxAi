#!/bin/bash

# ==============================================
# Quick Local Debug Setup
# ==============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GarmaxAI Local Debug Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Creating .env.local from template...${NC}"
    cp .env.local.template .env.local
    echo -e "${GREEN}✓ Created .env.local${NC}"
    echo -e "${YELLOW}⚠ Please edit .env.local and add your API keys and Cognito values${NC}"
    echo ""
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker installed${NC}"

# Start Docker services
echo -e "${YELLOW}Starting Docker services...${NC}"
docker-compose up -d

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check service health
if docker ps | grep -q "garmaxai-mysql.*Up"; then
    echo -e "${GREEN}✓ MySQL is running${NC}"
else
    echo -e "${RED}✗ MySQL failed to start${NC}"
fi

if docker ps | grep -q "garmaxai-redis.*Up"; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis failed to start${NC}"
fi

if docker ps | grep -q "garmaxai-localstack.*Up"; then
    echo -e "${GREEN}✓ LocalStack is running${NC}"
else
    echo -e "${RED}✗ LocalStack failed to start${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Local debug environment is ready!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. Edit ${YELLOW}.env.local${NC} with your values"
echo -e "2. Run: ${YELLOW}npm run db:push${NC} to setup database"
echo -e "3. Run: ${YELLOW}npm run db:seed:plans${NC} to seed data"
echo -e "4. In VS Code: Press ${YELLOW}F5${NC} and select '${YELLOW}Full Stack: Backend + Frontend${NC}'"
echo ""
echo -e "Or run manually:"
echo -e "  Terminal 1: ${YELLOW}npm run dev${NC}"
echo -e "  Terminal 2: ${YELLOW}npm run dev:client${NC}"
echo ""
echo -e "Read ${YELLOW}LOCAL_DEBUG_SETUP.md${NC} for detailed instructions"
echo ""
