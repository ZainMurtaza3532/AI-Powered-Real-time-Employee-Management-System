# EMS Backend

Production REST API and background worker engine for the Employee Management System built with **Express 5**, **TypeScript**, **MongoDB (Mongoose 9)**, **Inngest**, and **Gemini AI**.

## Tech Stack

- **Runtime & Server**: Bun / Node.js + Express 5
- **Database & ODM**: MongoDB Atlas + Mongoose 9
- **Authentication**: JWT tokens + HTTP-only cookies + bcryptjs password hashing
- **Security & Performance**: Helmet, CORS, custom sliding-window rate limiting
- **Background Jobs**: Inngest AI automation workflows
- **AI Intelligence**: Google Gemini API (Copilot assistant, flight-risk evaluation, performance review synthesis, workforce insights)
- **Email Service**: Resend transactional email API
- **Deployment**: Vercel Serverless (`/api/index.ts`) & Node/Docker environments

## Project Structure

```
backend/
├── api/
│   └── index.ts               # Vercel serverless entry point
├── src/
│   ├── controllers/           # REST endpoint business logic (19 controllers)
│   ├── db/                    # MongoDB connection & lifecycle management
│   ├── inngest/               # Inngest client & AI background functions
│   ├── lib/                   # Utilities (JWT, SSE, Email, Notifications, LeavePolicies, Pagination)
│   ├── middlewares/           # Authentication, RBAC, and Rate Limiting
│   ├── models/                # Mongoose data models & schemas (17 models)
│   ├── routes/                # Express API router definitions (18 routes)
│   ├── types/                 # Express request type declarations
│   ├── seed.ts                # Database administrator seeding script
│   └── server.ts              # Server startup & middleware chain
├── .env.example               # Backend environment variable template
├── nodemon.json               # Development auto-restart configuration
├── tsconfig.json              # TypeScript ESNext/NodeNext compilation settings
├── tsconfig.build.json        # Production build TypeScript settings
└── vercel.json                # Vercel deployment routes & serverless function config
```

## Available Scripts

```bash
# Start development server with hot-reload on port 5000
bun run dev

# Run TypeScript type check
bun run typecheck

# Build for production
bun run build

# Start production server
bun run start

# Seed default administrator account
bun run seed
```

## Environment Variables

Copy `.env.example` to `.env` and configure your credentials. Refer to `.env.example` for comprehensive descriptions and defaults.
