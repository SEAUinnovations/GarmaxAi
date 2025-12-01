# GarmaxAi Storage System

This application uses a flexible storage abstraction layer that automatically switches between development and production storage systems.

## Storage Types

### Development (Memory Storage)
- **Environment**: `NODE_ENV=development` or `NODE_ENV=test`
- **Implementation**: In-memory storage using JavaScript Maps
- **Persistence**: Data is lost when the server restarts
- **Use Case**: Local development, testing, quick prototyping

### Production (RDS Aurora MySQL)
- **Environment**: `NODE_ENV=production` or `NODE_ENV=staging`
- **Implementation**: AWS RDS Aurora MySQL with Drizzle ORM
- **Persistence**: Fully persistent database storage
- **Use Case**: Production deployment, staging environment

## Configuration

### Environment Variables

For **Development** (automatic, no configuration needed):
```env
NODE_ENV=development
```

For **Production** (requires RDS configuration):
```env
NODE_ENV=production
RDS_HOST=your-aurora-cluster-endpoint.cluster-xyz.us-east-1.rds.amazonaws.com
RDS_PORT=3306
RDS_DATABASE=garmaxai
RDS_USERNAME=admin
RDS_PASSWORD=your-secure-password
```

## Storage Factory

The `StorageFactory` class automatically selects the appropriate storage implementation:

```typescript
import { getStorage } from './src/storage';

// Automatically returns MemStorage or RDSStorage based on environment
const storage = await getStorage();

// Use storage methods
const user = await storage.getUser(userId);
```

## Health Checks

Monitor which storage system is active:

### Basic Health Check
```
GET /api/health
```

### Storage-Specific Health Check
```
GET /api/health/storage
```

Example response:
```json
{
  "storage": "memory",
  "healthy": true,
  "environment": "development",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Database Migrations

For production deployments using RDS Aurora MySQL:

1. **Setup RDS Environment Variables**:
   ```env
   RDS_HOST=your-cluster-endpoint
   RDS_DATABASE=garmaxai
   RDS_USERNAME=admin
   RDS_PASSWORD=secure-password
   ```

2. **Run Database Migrations**:
   ```bash
   npm run db:migrate:rds
   ```

3. **Generate and Push Schema Changes**:
   ```bash
   npm run db:push
   ```

## Development Workflow

### Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Storage automatically uses in-memory implementation

### Production Deployment
1. Set up AWS RDS Aurora MySQL cluster
2. Configure environment variables for RDS connection
3. Run database migrations: `npm run db:migrate:rds`
4. Deploy application with `NODE_ENV=production`
5. Storage automatically uses RDS implementation

## Storage Interface

All storage implementations follow the `IStorage` interface:

```typescript
interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User>;
  
  // Generation management
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  cancelGeneration(id: string): Promise<boolean>;
  
  // Temporary user management (email verification)
  createTempUser(data: TempUserData): Promise<TempUser>;
  getTempUserByEmail(email: string): Promise<TempUser | undefined>;
  updateTempUser(email: string, data: UpdateTempUserData): Promise<void>;
  deleteTempUser(email: string): Promise<void>;
}
```

## Benefits

1. **Seamless Development**: No database setup required for local development
2. **Production Ready**: Robust RDS Aurora MySQL for production workloads
3. **Environment Awareness**: Automatic selection based on NODE_ENV
4. **Easy Testing**: In-memory storage perfect for unit and integration tests
5. **Scalable**: RDS Aurora MySQL handles production scale and reliability