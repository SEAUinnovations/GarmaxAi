# 🚀 Quick Start Guide

Get ModelMeAI up and running in just a few steps!

## Step 1: Prerequisites Check ✓

Make sure you have these installed:

```bash
# Check Node.js version (should be v20.19.0+)
node --version

# Check npm version
npm --version
```

## Step 2: Environment Configuration 🔧

Create a `.env` file in the project root:

```bash
# AWS Aurora MySQL
DATABASE_URL=mysql://admin:password@modelmeai-cluster.xxxxxx.us-east-1.rds.amazonaws.com:3306/modelmeai

# Local MySQL (alternative)
# DATABASE_URL=mysql://root@localhost:3306/modelmeai

# Node environment
NODE_ENV=development
```

> **Note**: If you don't have an Aurora cluster yet:
> - **AWS Aurora** (Recommended): Follow the setup in [POSTGRES_SETUP.md](./POSTGRES_SETUP.md)
> - **Local MySQL**: Install MySQL and create a database named `modelmeai`

## Step 3: Install Dependencies 📦

All dependencies are already installed from `npm install`, but if you need to reinstall:

```bash
npm install
```

## Step 4: Run the Application 🎬

Choose your preferred development setup:

### Option A: Full Stack Development (Recommended)

Open your terminal and run:

```bash
npm run dev
```

This starts:
- ✅ Express.js backend on http://localhost:3000
- ✅ React frontend with HMR (Hot Module Replacement)
- ✅ Vite dev server integration

The app will be available at **http://localhost:3000**

### Option B: Separate Frontend Development

If you prefer running frontend and backend separately:

**Terminal 1 - Backend**:
```bash
npm run dev
```

**Terminal 2 - Frontend Only**:
```bash
npm run dev:client
```

The frontend dev server runs on **http://localhost:5000**

## Step 5: Access the Application 🌐

1. Open your browser
2. Navigate to **http://localhost:3000** (or http://localhost:5000 if using Option B)
3. You should see the ModelMeAI home page with navigation

## 📊 Database Setup (First Time)

If this is your first time with a new database, you may need to push the schema:

```bash
npm run db:push
```

This creates the database tables automatically.

## ✨ Project Features You Can Explore

- **Home Page** (`/`) - Landing page with project information
- **Dashboard** (`/dashboard`) - User dashboard and analytics
- **Navigation** - Responsive navbar with theme support
- **UI Components** - Rich set of pre-built Radix UI components
- **Real-time Features** - WebSocket support for live updates

## 🛠️ Development Commands

```bash
# Development server with auto-reload
npm run dev

# Frontend-only dev server
npm run dev:client

# Type checking
npm run check

# Build for production
npm run build

# Run production build
npm start

# Push database schema changes
npm run db:push
```

## 📁 Key Files to Get Started

- `client/src/App.tsx` - Main React app component
- `server/app.ts` - Express app setup
- `server/routes.ts` - Add your API routes here
- `shared/schema.ts` - Database schema definition
- `client/src/pages/Home.tsx` - Home page component
- `client/src/pages/Dashboard.tsx` - Dashboard component

## 🐛 Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
# Find process using port 3000 on macOS
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Database Connection Error
Check your `.env` file:
- [ ] `DATABASE_URL` is set correctly
- [ ] Database server is running
- [ ] Username and password are correct
- [ ] Database exists

### TypeScript Errors
Run type checking:
```bash
npm run check
```

### Clear Cache and Reinstall
If experiencing weird issues:
```bash
rm -rf node_modules
npm install
```

## 📚 Next Steps

1. **Add Routes**: Edit `server/routes.ts` to add API endpoints
2. **Create Components**: Build new React components in `client/src/components/`
3. **Extend Database**: Modify schema in `shared/schema.ts` and run `npm run db:push`
4. **Style Components**: Use Tailwind CSS utility classes for styling
5. **Add Features**: Implement authentication, forms, and business logic

## 🎨 UI Component Library

The project includes a comprehensive Radix UI component library. Check these examples:

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

// Use them in your components
<Button onClick={() => {}}>Click me</Button>
<Card>
  <Input placeholder="Enter text" />
</Card>
```

## ✅ You're All Set!

Your application is ready to develop! Start with `npm run dev` and happy coding! 🎉

---

For detailed information, see [README.md](./README.md)
