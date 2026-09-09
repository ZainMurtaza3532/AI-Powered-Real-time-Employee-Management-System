# Employee Management System (EMS)

A full-stack employee management platform built with the MERN stack and React Router framework mode. Features role-based access control, AI-powered insights, and real-time notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 8 (framework mode), TanStack Query, Tailwind CSS 4, Shadcn UI |
| **Backend** | Express 5, MongoDB (Mongoose 9), JWT auth, Inngest (background jobs) |
| **Email** | Resend |
| **Runtime** | Bun |
| **Deploy** | Vercel |

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) v1.x
- MongoDB instance (local or Atlas)
- Vercel account (for deployment)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd ems
bun install --cwd backend
bun install --cwd frontend

# Backend setup
cd backend
cp .env.example .env   # fill in your values (see Environment Variables)
bun run seed            # optional: populate demo data
cd ..

# Frontend setup
cd frontend
cp .env.example .env   # fill in your values
cd ..
```

### Development

```bash
# Backend (port 5000)
cd backend && bun run dev

# Frontend (port 5173)
cd frontend && bun run dev
```

### Production Build

```bash
cd backend && bun run build   # TypeScript compile
cd frontend && bun run build  # React Router build
```

### Typecheck

```bash
cd backend && bun run typecheck
cd frontend && bun run typecheck
```

## Environment Variables

### Backend

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CORS_ORIGIN` | Allowed frontend origins (comma-separated) | `http://localhost:5173,http://localhost:5174` |
| `MONGO_URI` / `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/ems` |
| `JWT_SECRET` | Secret key for signing authentication JWT tokens | `bffb9430e1e...` |
| `JWT_EXPIRES_IN` | Session token expiry duration | `7d` |
| `COOKIE_SECRET` | Secret for cookie signing and session protection | `d18df73ab4...` |
| `GEMINI_API_KEY` | Google Gemini API key for EMS Copilot, AI Reviews & Insights | `AQ.Ab8RN6LFh5...` |
| `RESEND_API_KEY` | Resend API key for transactional emails | `re_xxx` |
| `ADMIN_NAME` | Default initial admin account name | `Admin` |
| `ADMIN_EMAIL` | Default initial admin account email | `admin@ems.local` |
| `ADMIN_PASSWORD` | Default initial admin account password | `change-me-123` |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000/api` |

## Project Structure

```
.
├── backend/                        # Express 5 REST API & Inngest Functions
│   ├── api/
│   │   └── index.ts                # Vercel serverless entry point
│   ├── src/
│   │   ├── controllers/            # Business logic & route handlers (19 controllers)
│   │   │   ├── activityLogs.ts
│   │   │   ├── aiInsights.ts
│   │   │   ├── announcements.ts
│   │   │   ├── attendance.ts
│   │   │   ├── auth.ts
│   │   │   ├── copilot.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── departments.ts
│   │   │   ├── expenses.ts
│   │   │   ├── feedback.ts
│   │   │   ├── kudos.ts
│   │   │   ├── leavePolicies.ts
│   │   │   ├── leaves.ts
│   │   │   ├── notifications.ts
│   │   │   ├── okrs.ts
│   │   │   ├── orgChart.ts
│   │   │   ├── payroll.ts
│   │   │   ├── performanceReviews.ts
│   │   │   ├── reports.ts
│   │   │   ├── tasks.ts
│   │   │   └── users.ts
│   │   ├── db/                     # MongoDB connection setup
│   │   ├── inngest/                # Inngest client & AI workflow functions
│   │   ├── lib/                    # Helpers (JWT, SSE, Email, Notifications, LeavePolicies, Pagination)
│   │   ├── middlewares/            # Auth, RBAC & Rate Limiting middlewares
│   │   ├── models/                 # Mongoose Data Schemas (17 models)
│   │   │   ├── ActivityLog.ts
│   │   │   ├── AiInsight.ts
│   │   │   ├── Announcement.ts
│   │   │   ├── Attendance.ts
│   │   │   ├── Department.ts
│   │   │   ├── Expense.ts
│   │   │   ├── Feedback.ts
│   │   │   ├── Kudos.ts
│   │   │   ├── Leave.ts
│   │   │   ├── LeavePolicy.ts
│   │   │   ├── LeaveType.ts
│   │   │   ├── Notification.ts
│   │   │   ├── Okr.ts
│   │   │   ├── Payroll.ts
│   │   │   ├── PerformanceReview.ts
│   │   │   ├── Task.ts
│   │   │   └── User.ts
│   │   ├── routes/                 # Express API routers (18 routers)
│   │   ├── types/                  # Express type declarations
│   │   ├── seed.ts                 # Database seeding script
│   │   └── server.ts               # Express server bootstrap & middleware pipeline
│   ├── .env.example                # Documented backend environment configuration
│   ├── nodemon.json                # Development hot-reloading config
│   ├── tsconfig.json               # Backend TypeScript configuration (ESNext/NodeNext)
│   ├── tsconfig.build.json         # Vercel build TypeScript configuration
│   └── vercel.json                 # Vercel deployment configuration
│
└── frontend/                       # React 19 + React Router 8 Modern App
    ├── app/
    │   ├── components/
    │   │   ├── auth/               # Login page, Login form & RequireAuth
    │   │   ├── globals/            # Reusable pagination & data search components
    │   │   ├── layout/             # App shell, responsive sidebar & navigation
    │   │   ├── notifications/      # Real-time SSE notification bell & drawer
    │   │   └── ui/                 # Accessible Shadcn UI component library
    │   ├── hooks/                  # TanStack Query & real-time custom hooks (25 hooks)
    │   ├── lib/                    # API client, PDF/Excel export & utility helpers
    │   ├── routes/                 # Application routes & layouts
    │   │   ├── admin/              # Admin-only management routes
    │   │   ├── ai-insights.tsx     # AI workforce intelligence
    │   │   ├── announcements.tsx   # Company & department announcements
    │   │   ├── attendance.tsx      # Attendance clock in/out & history
    │   │   ├── copilot.tsx         # AI Copilot & Flight-Risk Assistant
    │   │   ├── dashboard.tsx       # Real-time analytics dashboard
    │   │   ├── expenses.tsx        # Expense claims & reimbursements
    │   │   ├── feedback.tsx        # Employee feedback & resolution
    │   │   ├── home.tsx            # Landing & authentication entrance
    │   │   ├── kudos.tsx           # Social recognition & badges wall
    │   │   ├── leaves.tsx          # Leave requests & balance manager
    │   │   ├── okrs.tsx            # Strategic goals & key results
    │   │   ├── org-chart.tsx       # Interactive organizational hierarchy tree
    │   │   ├── payroll.tsx         # Salary slips & payroll downloads
    │   │   ├── performance-reviews.tsx # Performance reviews
    │   │   ├── profile.tsx         # Employee profile & security settings
    │   │   ├── protected.tsx       # Auth-protected layout wrapper
    │   │   └── tasks.tsx           # Task management & Kanban board
    │   ├── app.css                 # Global styles, typography & CSS variables
    │   ├── root.tsx                # App root layout, Providers & ErrorBoundary
    │   ├── routes.ts               # React Router v8 type-safe route definitions
    │   └── types.ts                # Application-wide TypeScript definitions
    ├── .env.example                # Documented frontend environment configuration
    ├── components.json             # Shadcn UI registry configuration
    ├── Dockerfile                  # Production container build definition
    ├── react-router.config.ts      # React Router build configuration
    ├── tsconfig.json               # Frontend TypeScript configuration
    └── vite.config.ts              # Vite 8 bundler configuration
```

## Features

### Authentication & Authorization

- JWT-based authentication with httpOnly cookies
- Role-based access control: **admin**, **head**, **employee**
- Permission-gated routes via middleware (`requireAuth`, `requireRole`)

### Employee Management

- Full employee profiles (personal info, contact, employment details)
- Department assignment and management
- User CRUD with role-based permissions

### AI Copilot & Flight-Risk Intelligence

- Conversational AI assistant with live database context (Gemini 2.5 Flash)
- Quick prompt drafting for reviews, announcements, and leave applications
- Predictive turnover & retention flight-risk intelligence for managers

### Payroll & Digital Salary Slips

- Automated monthly payroll runs with 1-click execution
- Detailed earnings (housing, transport, medical) & deductions (tax, pension) breakdown
- Professional PDF Payslip generation & instant downloads

### Expense Claims & Reimbursements

- Category-based employee expense submission with receipt tracking
- Manager review, approval, rejection with notes, and reimbursement workflows

### OKRs & Strategic Goals

- Company, Department, and Individual Objectives
- Key results with targets, current values, and interactive real-time progress sliders
- Goal velocity analytics

### Kudos & Social Recognition Wall

- Peer-to-peer badge giving ("Problem Solver", "Team Player", "Speed Demon", "Innovator", etc.)
- Real-time emoji reactions (👏, ❤️, 🚀, 💡, 🔥)
- Monthly Gamification Leaderboard & badge rankings

### Interactive Organizational Chart

- Visual hierarchy tree: Executive Leadership → Departments → Heads → Team Members
- Real-time active task and workload indicators on employee cards

### Attendance

- Clock in / clock out tracking
- Daily attendance records with status (present, late, absent, half-day, on leave)
- Attendance overview per month

### Leave Management

- Apply for leave with type, date range, and reason
- Leave balance tracking per type (sick, vacation, personal, etc.)
- Admin/head approval workflow
- Configurable leave policies per department

### Tasks

- Create, assign, and track tasks
- Status updates (todo, in-progress, review, done)
- Priority levels (low, medium, high, urgent)

### Performance Reviews

- Admin-initiated performance reviews for employees
- Rating system with written feedback
- Gemini AI automated review generation

### Feedback

- Employee feedback submission & admin resolution

### Announcements

- Admin/Head announcements visible to employees

### AI Insights

- AI-powered analytics for workforce management
- Admin dashboard with generated insights

### Activity Logging

- Full audit trail of user actions across the system

### Dashboard

- **Admin/Head**: department stats, leave overview, task metrics, attendance overview
- **Employee**: personal attendance rate, leave balance, active tasks, completed tasks

### Notifications

- Real-time notification system for users via SSE

## API Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/login` | Login | Public |
| `POST` | `/api/auth/logout` | Logout | Public |
| `GET` | `/api/auth/me` | Current user | Auth |
| `POST` | `/api/copilot/chat` | AI HR Copilot assistant | Auth |
| `GET` | `/api/copilot/flight-risk` | Flight risk & retention intelligence | Admin/Head |
| CRUD | `/api/payroll` | Salary slips & batch payroll runs | Auth / Admin |
| CRUD | `/api/expenses` | Expense claims & reimbursement approvals | Auth / Admin |
| CRUD | `/api/okrs` | Objectives & Key Results | Auth |
| CRUD | `/api/kudos` | Peer recognition feed & reactions | Auth |
| `GET` | `/api/kudos/leaderboard` | Top recognized monthly champions | Auth |
| `GET` | `/api/org-chart` | Organizational hierarchy structure | Auth |
| CRUD | `/api/users` | User management | Admin |
| CRUD | `/api/departments` | Department management | Admin |
| CRUD | `/api/leaves` | Leave applications | Auth |
| CRUD | `/api/attendance` | Attendance records | Auth |
| CRUD | `/api/tasks` | Task management | Auth |
| CRUD | `/api/announcements` | Announcements | Admin/Head |
| CRUD | `/api/performance-reviews` | Performance reviews | Admin/Head |
| CRUD | `/api/feedback` | Feedback | Auth |
| CRUD | `/api/ai-insights` | AI insights | Admin |
| `GET` | `/api/dashboard/analytics` | Admin/head dashboard | Admin/Head |
| `GET` | `/api/dashboard/my` | Employee dashboard | Auth |
| CRUD | `/api/notifications` | Notifications | Auth |
| `GET` | `/api/reports` | Reports | Admin/Head |
| `GET` | `/api/activity-logs` | Activity log | Admin |

## Roles & Permissions

| Feature | Employee | Head | Admin |
|---------|----------|------|-------|
| View own profile | ✅ | ✅ | ✅ |
| EMS Copilot AI | ✅ | ✅ | ✅ |
| Flight Risk Intelligence | ❌ | ✅ | ✅ |
| View own payslips & PDF | ✅ | ✅ | ✅ |
| Manage Payroll & Salaries | ❌ | ❌ | ✅ |
| Submit Expense Claims | ✅ | ✅ | ✅ |
| Approve & Reimburse Expenses | ❌ | ✅ | ✅ |
| View/Update OKRs & Goals | ✅ | ✅ | ✅ |
| Give Kudos & React | ✅ | ✅ | ✅ |
| View Org Chart | ✅ | ✅ | ✅ |
| Clock in/out | ✅ | ✅ | ✅ |
| View own attendance | ✅ | ✅ | ✅ |
| View all attendance | ❌ | ✅ | ✅ |
| Apply for leave | ✅ | ✅ | ✅ |
| Approve leaves | ❌ | ✅ | ✅ |
| Manage leave policies | ❌ | ❌ | ✅ |
| Create/update tasks | ✅ | ✅ | ✅ |
| View department dashboard | ❌ | ✅ | ✅ |
| Manage departments | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| Create announcements | ❌ | ✅ | ✅ |
| AI insights | ❌ | ❌ | ✅ |
| Activity log | ❌ | ❌ | ✅ |

## Deployment

The project is configured for Vercel deployment:

- **Backend**: `backend/api/index.ts` serves as the serverless function entry point
- **Frontend**: Standard React Router Vercel build

Ensure the following Vercel environment variables are set for production:

- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN` (your frontend domain)
- `RESEND_API_KEY`
- `NODE_ENV=production`

## License

Private — All rights reserved.
