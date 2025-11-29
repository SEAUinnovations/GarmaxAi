  __  ___          _      _   __  __ _____
 |  \/  |         | |    | | |  \/  |  ___|
 | .  . | ___   __| | ___| | | .  . | |_
 | |\/| |/ _ \ / _` |/ _ \ | | |\/| |  _|
 | |  | | (_) | (_| |  __/ | | |  | | |___
 |_|  |_|\___/ \__,_|\___|_|_|_|  |_|_____|

A modern full-stack web application for AI-powered model portfolio management and image generation. Built with React, Express.js, PostgreSQL, and Drizzle ORM.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Database Management](#database-management)
- [Development](#development)
- [Building for Production](#building-for-production)

## ✨ Features

- **Full-Stack Architecture**: Seamless integration between React frontend and Express.js backend
- **User Authentication**: Secure user management with Passport.js
- **Rich UI Components**: Pre-built Radix UI components with Tailwind CSS styling
- **Database Management**: PostgreSQL with Drizzle ORM and migrations
- **Real-time Updates**: WebSocket support for live features
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **AI Image Generation**: Generate and manage commercial fashion imagery
- **Dashboard**: Comprehensive dashboard for user analytics and portfolio management

## 🏗️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS 4** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible component library
- **React Query** - Server state management
- **React Hook Form** - Efficient form handling
- **Zod** - Schema validation
- **Wouter** - Lightweight client-side router

### Backend
- **Express.js** - Web server framework
- **Node.js** - JavaScript runtime
- **TypeScript** - Type-safe backend code
- **Passport.js** - Authentication middleware
- **Express Session** - Session management
- **WebSockets (ws)** - Real-time communication

### Database
- **MySQL** - Relational database (AWS Aurora compatible)
- **Drizzle ORM** - Type-safe SQL query builder
- **Drizzle Kit** - Migration and schema management
- **AWS Aurora MySQL** - Serverless MySQL database

### Build & Development
- **ESBuild** - Fast JavaScript bundler
- **TSX** - TypeScript executor
- **Vite Plugins** - Custom Vite plugins for meta images and dev tools

## 📦 Prerequisites

Before running the application, ensure you have:

- **Node.js** v20.19.0 or higher (v22.12.0+ recommended)
- **npm** v8.19.2 or higher
- **PostgreSQL** database (or Neon serverless PostgreSQL)
- **Git** (optional, for version control)

To check your Node.js version:
```bash
node --version
npm --version
```

## 🚀 Installation

1. **Clone or extract the project**:
```bash
cd /path/to/ModelMeAI
```

2. **Install dependencies**:
```bash
npm install
```

This will install all required packages for both frontend and backend.

## 🔧 Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Node Environment
NODE_ENV=development

# Optional: Session Store Configuration
# For production, consider using PostgreSQL session store with connect-pg-simple
```

### Database URL Format
- **AWS Aurora MySQL**: `mysql://admin:password@modelmeai-cluster.xxxxxx.us-east-1.rds.amazonaws.com:3306/modelmeai`
- **Local MySQL**: `mysql://root:password@localhost:3306/modelmeai`
- **Neon Serverless**: `postgresql://user:password@ep-xxx.us-east-1.neon.tech/database?sslmode=require`

**Important**: The `DATABASE_URL` environment variable is required for the application to run. Drizzle Kit will throw an error if it's not set.

## 🎯 Running the Application

### Development Mode

The application runs in two parts simultaneously:

**Terminal 1 - Start the Backend Server**:
```bash
npm run dev
```
This starts the Express.js backend server with Vite middleware for HMR (Hot Module Replacement).

**Terminal 2 - Start the Frontend Dev Server** (optional, if you want separate client development):
```bash
npm run dev:client
```
This runs the Vite dev server on port 5000 for the React frontend.

The application will be available at:
- **Frontend**: http://localhost:3000 (or configured port)
- **API**: http://localhost:3000/api

### Access the Application

1. Open your browser and navigate to the frontend URL
2. You'll see the home page with navigation
3. Access the dashboard and other features as needed

## 📂 Project Structure

```
ModelMeAI/
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/            # Radix UI component library
│   │   │   └── Navbar.tsx      # Navigation component
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility libraries
│   │   ├── pages/             # Page components
│   │   ├── App.tsx            # Main app component
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Global styles
│   ├── index.html             # HTML template
│   └── public/                # Static assets
│
├── server/                      # Express.js backend
│   ├── app.ts                 # Express app setup
│   ├── routes.ts              # API routes
│   ├── storage.ts             # Database operations
│   ├── index-dev.ts           # Development entry point
│   └── index-prod.ts          # Production entry point
│
├── shared/                      # Shared code
│   └── schema.ts              # Database schema (Drizzle)
│
├── attached_assets/            # Generated images and assets
│   └── generated_images/      # AI-generated model images
│
├── vite.config.ts             # Vite configuration
├── drizzle.config.ts          # Drizzle ORM configuration
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── package.json               # Project dependencies
└── README.md                  # This file
```

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with both frontend and backend |
| `npm run dev:client` | Start only the Vite dev server (port 5000) |
| `npm run build` | Build frontend and backend for production |
| `npm start` | Run production-built application |
| `npm run check` | Run TypeScript type checking |
| `npm run db:push` | Push database schema changes to the database |

## 🗄️ Database Management

### Schema Definition

Database schema is defined in `shared/schema.ts` using Drizzle ORM:

```typescript
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
```

### Running Migrations

After modifying the schema, push changes to your database:

```bash
npm run db:push
```

This will:
1. Generate migration files in the `migrations/` directory
2. Apply schema changes to your PostgreSQL database
3. Update the database with new tables and columns

### Migrations Directory

Migration files are auto-generated and stored in the `migrations/` folder. These files track all schema changes and can be version controlled.

## 🛠️ Development

### Adding New Routes

Add API routes in `server/routes.ts`:

```typescript
app.get("/api/example", (req, res) => {
  res.json({ message: "Hello from API" });
});
```

### Adding Components

Create new React components in `client/src/components/`:

```typescript
// client/src/components/NewComponent.tsx
export function NewComponent() {
  return <div>My Component</div>;
}
```

### Using UI Components

Import pre-built components from the UI library:

```typescript
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
```

### Type Safety

The project uses TypeScript for full type safety:
- Frontend types are checked with `tsc`
- Backend types are enforced at runtime with Zod
- Database types are auto-generated from schema with Drizzle

Run type checking:
```bash
npm run check
```

## 🏗️ Building for Production

### Build the Application

```bash
npm run build
```

This will:
1. Build the React frontend with Vite
2. Bundle the Express.js backend with esbuild
3. Output to the `dist/` directory

### Run Production Build

```bash
npm start
```

**Note**: Ensure `DATABASE_URL` environment variable is set in production.

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATABASE_URL` for production database
- [ ] Set up secure session store (connect-pg-simple recommended)
- [ ] Configure SSL/TLS for database connections
- [ ] Set up proper logging and monitoring
- [ ] Configure environment variables on your hosting platform

## 🔐 Security Considerations

- User passwords are stored with Passport.js authentication
- Session data is managed with express-session
- Consider using a persistent session store in production (PostgreSQL with connect-pg-simple)
- Ensure DATABASE_URL uses SSL connections in production
- Keep dependencies updated: `npm audit fix`

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Drizzle ORM](https://orm.drizzle.team)
- [Radix UI](https://www.radix-ui.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

**Last Updated**: November 25, 2025

For questions or issues, please check the project structure and configuration files or refer to the documentation links above.
