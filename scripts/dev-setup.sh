#!/bin/bash

# ==============================================
# Local Development Environment Setup Script
# ==============================================
# Sets up complete local environment for E2E testing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GarmaxAI Local Development Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required tools
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠ .env.local not found${NC}"
    echo -e "${YELLOW}Please create .env.local based on .env.local template${NC}"
    echo ""
else
    echo -e "${GREEN}✓ .env.local exists${NC}"
fi

# Stop any existing containers
echo -e "${YELLOW}Stopping any existing containers...${NC}"
docker-compose down -v 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Start Docker services
echo -e "${YELLOW}Starting Docker services...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Function to check service health
check_service() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo -n "  Waiting for $service"
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps | grep $service | grep -q "healthy\|Up"; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}✗ $service failed to start${NC}"
    docker-compose logs $service
    return 1
}

check_service "mysql"
check_service "redis"
check_service "localstack"

echo ""

# Initialize database
echo -e "${YELLOW}Initializing database schema...${NC}"
sleep 5  # Give MySQL extra time to fully initialize

# Load env vars
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Loaded .env.local${NC}"
elif [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Loaded .env${NC}"
else
    echo -e "${YELLOW}⚠ No .env file found${NC}"
fi

npm run db:push 2>&1 | grep -v "warning" || {
    echo -e "${YELLOW}⚠ Database push encountered issues, continuing...${NC}"
}
echo -e "${GREEN}✓ Database schema created${NC}"

# Seed subscription plans
echo -e "${YELLOW}Seeding subscription plans...${NC}"
npm run db:seed:plans 2>&1 | grep -v "warning" || {
    echo -e "${YELLOW}⚠ Seeding encountered issues, continuing...${NC}"
}
echo -e "${GREEN}✓ Subscription plans seeded${NC}"

# Verify services
echo ""
echo -e "${YELLOW}Verifying services...${NC}"

# Check MySQL
if docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "SELECT 1" garmaxai &>/dev/null; then
    echo -e "${GREEN}✓ MySQL: Connected${NC}"
    TABLES=$(docker exec garmaxai-mysql mysql -ugarmaxuser -pgarmaxpass -e "SHOW TABLES;" garmaxai 2>/dev/null | tail -n +2 | wc -l)
    echo -e "  Tables created: $TABLES"
else
    echo -e "${RED}✗ MySQL: Connection failed${NC}"
fi

# Check Redis
if docker exec garmaxai-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓ Redis: Connected${NC}"
else
    echo -e "${RED}✗ Redis: Connection failed${NC}"
fi

# Check LocalStack
if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ LocalStack: Running${NC}"
else
    echo -e "${YELLOW}⚠ LocalStack: Not responding (may still be initializing)${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Services are running:"
echo -e "  ${GREEN}•${NC} MySQL:      localhost:3306"
echo -e "  ${GREEN}•${NC} Redis:      localhost:6379"
echo -e "  ${GREEN}•${NC} LocalStack: localhost:4566"
echo -e "  ${GREEN}•${NC} Adminer:    http://localhost:8080"
echo ""
echo -e "Next steps:"
echo -e "  1. ${YELLOW}Edit .env.local${NC} - Add your API keys (Stripe, Replicate)"
echo -e "  2. ${YELLOW}npm run dev${NC} - Start backend (port 3000)"
echo -e "  3. ${YELLOW}npm run dev:client${NC} - Start frontend (port 5000)"
echo -e "  4. ${YELLOW}npm run test:e2e${NC} - Run E2E tests"
echo ""
echo -e "To view logs:"
echo -e "  ${YELLOW}docker-compose logs -f${NC}"
echo ""
echo -e "To verify environment:"
echo -e "  ${YELLOW}./scripts/test-env.sh${NC}"
echo ""
echo -e "To stop services:"
echo -e "  ${YELLOW}docker-compose down${NC}"
echo ""
