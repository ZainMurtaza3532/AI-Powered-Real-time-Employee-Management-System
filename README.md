# AI-Powered Real-Time Employee Management System (EMS)

An enterprise-grade, full-stack Employee Management System built with the modern MERN stack, React Router v8 (Framework Mode), and Google Gemini AI. Features role-based access control (RBAC), multi-horizon attendance timecards, automated payroll with digital PDF payslips, OKRs, peer Kudos recognition wall, predictive flight-risk intelligence, conversational EMS Copilot, and real-time Server-Sent Events (SSE).

---

## ⚡ Quick Demo Accounts (1-Click Instant Login)

The application includes 1-click quick login buttons on the sign-in page to effortlessly explore each role perspective:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `zainmurtazaadmin@gmail.com` | `zainmurtazaadmin` | Full organization control, payroll runs, user & department management, executive reports, AI insights, system audit log. |
| **👔 Dept Head** | `sarah.chen@company.com` | `zainmurtazaadmin` | Department workload oversight, task delegation & review, leave approvals, expense approvals, flight-risk intelligence. |
| **💻 Employee** | `hamza@gmail.com` | `zainmurtazaadmin` | Daily punch clock, task board, leave requests, PDF payslips, expense claims, OKRs, Kudos peer recognition wall. |

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, React Router 8 (Framework Mode), TanStack Query (React Query v5), Tailwind CSS 4, Shadcn UI, Lucide Icons, Recharts, jsPDF, html2canvas |
| **Backend** | Express 5, Node.js / Bun, MongoDB Atlas (Mongoose 9), JWT (httpOnly Cookies), Inngest (Background AI Workflows), Server-Sent Events (SSE) |
| **AI & LLM** | Google Gemini (Gemini 1.5 Flash, Gemini 2.0 Flash, Gemini 1.5 Pro) with live database grounding and local heuristic fallback engines |
| **Email & Delivery** | Resend API (Transactional HTML emails, status alerts, leave decision notices) |
| **Styling & Theme** | Modern OKLCH color palettes, glassmorphism, responsive sidebar navigation, dark mode support |
| **Deployment** | Vercel (Serverless backend entry point + React Router SPA/SSR bundle) |

---

## 🚀 Quickstart & Setup

### Prerequisites
- [Bun](https://bun.sh) v1.x or [Node.js](https://nodejs.org) v20+
- MongoDB instance (MongoDB Atlas or local MongoDB)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ZainMurtaza3532/AI-Powered-Real-time-Employee-Management-System.git
cd AI-Powered-Real-time-Employee-Management-System

# Install backend dependencies
cd backend && npm install
cd ..

# Install frontend dependencies
cd frontend && npm install
cd ..
```

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174

# MongoDB Atlas
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ems
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ems

# Authentication Secrets
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your_cookie_secret_key_here

# Initial Admin User
ADMIN_NAME="Zain Murtaza admin"
ADMIN_EMAIL=zainmurtazaadmin@gmail.com
ADMIN_PASSWORD=zainmurtazaadmin

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Resend Email API
RESEND_API_KEY=re_your_api_key_here
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Seed Enterprise Demo Data
Populate realistic departments, users, attendance logs, tasks, payroll, expenses, OKRs, Kudos, and reviews:
```bash
cd backend
npm run seed
cd ..
```

### 4. Run Development Servers
```bash
# Terminal 1: Backend API (port 5000)
cd backend && npm run dev

# Terminal 2: Frontend Client (port 5173)
cd frontend && npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 📦 Production Build & Typecheck

```bash
# Typecheck backend and frontend
npm run typecheck --prefix backend
npm run typecheck --prefix frontend

# Production build
npm run build --prefix backend
npm run build --prefix frontend
```

---

## 🌟 Key Application Features

### 1. 🤖 EMS Copilot & Workforce AI Intelligence
- Conversational AI assistant grounded in live database telemetry (*attendance punch state, active task counts, leave balances, performance review scores, department stats*).
- 1-Click quick draft generators for leave applications, review feedback, team announcements, and executive briefs.
- Predictive retention & turnover Flight-Risk Intelligence model with factor breakdowns (overtime hours, review trends, leave patterns).
- Resilient model cascade across Gemini 1.5 Flash, 2.0 Flash, and 1.5 Pro with structured heuristic fallback engine.

### 2. ⏱️ Attendance & Digital Timecards
- 1-Click digital check-in and check-out with office/remote location tagging and notes.
- Live shift stopwatch and 8-hour daily target progress bar.
- Multi-horizon timecards:
  - **Daily**: Shift stopwatch, hours gauge, location toggle.
  - **Weekly**: 7-day visual matrix and daily hours histogram.
  - **Monthly**: Visual heatmap calendar, attendance rate %, and instant CSV export.
  - **Yearly**: 12-month annual comparison and audit records.

### 3. 💳 Payroll & Digital Salary Slips
- Automated monthly payroll runs with earnings (*basic, housing, transport, medical*) and deductions (*tax, pension*).
- Professional PDF Payslip generation with instant 1-click download.
- Full compensation history and status tracking (*paid, pending*).

### 4. 📋 Task Management & Kanban Board
- Full lifecycle workflow: `Todo` &rarr; `In Progress` &rarr; `In Review` (with submission notes) &rarr; `Completed` (or rejected with rework notes).
- Priority badges (*Urgent, High, Medium, Low*), due dates, and checklist subtasks.

### 5. 🎯 Strategic OKRs & Goal Velocity
- Company-wide, Department-level, and Individual Objectives.
- Measurable key results with targets, current values, and interactive real-time progress sliders.

### 6. 🏆 Kudos & Social Recognition Wall
- Peer-to-peer recognition badges (*"Problem Solver"*, *"Team Player"*, *"Speed Demon"*, *"Innovator"*, *"Culture Champion"*, *"Mentor"*, *"Customer Hero"*).
- Real-time emoji reactions (`👏`, `❤️`, `🚀`, `💡`, `🔥`).
- Monthly Gamification Leaderboard ranking top contributors.

### 7. 🌴 Leave Management & Custom Policies
- Request time off (*Annual Vacation, Sick, Personal, Unpaid*).
- Dynamic balance tracking with annual entitlements and rollover policies.
- Two-tier approval pipeline (Department Heads & Executive Admins) with automated email notifications via Resend.

### 8. 🧾 Expense Claims & Reimbursements
- Category-based submissions (*Travel, Meals, Hardware, Software, Training, Office Supplies*) with receipt tracking.
- Manager review, approval, rejection notes, and finance reimbursement status.

### 9. 🌐 Interactive Organizational Hierarchy Tree
- Visual hierarchy tree: Executive Leadership &rarr; Departments &rarr; Department Leads &rarr; Team Members.
- Real-time active task and workload status indicators on employee cards.

### 10. 📊 Analytics, Reports & Audit Trail
- Executive workforce analytics with Recharts SVG charts.
- Export department activities and employee performance to PDF and Excel.
- Full immutable Activity Log tracking user actions, logins, status changes, and approvals.

---

## 📡 API Overview

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Session login & httpOnly cookie issuance | Public |
| `POST` | `/api/auth/logout` | Session clearance | Public |
| `GET` | `/api/auth/me` | Current authenticated user profile | Authenticated |
| `POST` | `/api/copilot/chat` | AI Copilot conversational assistant | Authenticated |
| `GET` | `/api/copilot/flight-risk` | Retention & flight-risk predictive analysis | Admin / Head |
| `GET` | `/api/dashboard/analytics` | Organization & department analytics | Admin / Head |
| `GET` | `/api/attendance/today` | Current day punch status & shift stopwatch | Authenticated |
| `POST` | `/api/attendance/punch` | 1-Click check-in / check-out | Authenticated |
| CRUD | `/api/tasks` | Task assignments, subtasks, reviews | Authenticated |
| CRUD | `/api/leaves` | Leave requests, balances, approvals | Authenticated |
| CRUD | `/api/payroll` | Salary slips & batch payroll runs | Authenticated / Admin |
| CRUD | `/api/expenses` | Expense claims & reimbursement approvals | Authenticated / Admin |
| CRUD | `/api/okrs` | Strategic Objectives & Key Results | Authenticated |
| CRUD | `/api/kudos` | Peer recognitions & emoji reactions | Authenticated |
| `GET` | `/api/org-chart` | Interactive organization hierarchy tree | Authenticated |
| CRUD | `/api/announcements` | Company & department announcements | Admin / Head |
| CRUD | `/api/performance-reviews` | 360 performance reviews & AI draft generator | Admin / Head |
| CRUD | `/api/departments` | Department management & member assignment | Admin |
| CRUD | `/api/users` | Employee account management & RBAC roles | Admin |
| `GET` | `/api/reports` | Exportable workforce & performance reports | Admin / Head |
| `GET` | `/api/activity-logs` | Immutable system audit log | Admin |

---

## 🔒 Roles & Permissions Matrix

| Feature / Module | 💻 Employee | 👔 Dept Head | 👑 Admin |
| :--- | :---: | :---: | :---: |
| **Personal Profile & Dashboard** | ✅ | ✅ | ✅ |
| **EMS Copilot AI** | ✅ | ✅ | ✅ |
| **Flight-Risk Predictive Intelligence** | ❌ | ✅ | ✅ |
| **Daily Punch Clock & Timecards** | ✅ | ✅ | ✅ |
| **View Department Attendance** | ❌ | ✅ | ✅ |
| **View Own Payslips & Download PDF** | ✅ | ✅ | ✅ |
| **Manage Organization Payroll** | ❌ | ❌ | ✅ |
| **Submit Expense Claims** | ✅ | ✅ | ✅ |
| **Approve & Reimburse Expenses** | ❌ | ✅ | ✅ |
| **Track OKRs & Strategic Goals** | ✅ | ✅ | ✅ |
| **Give Kudos & Emoji Reactions** | ✅ | ✅ | ✅ |
| **View Interactive Org Chart** | ✅ | ✅ | ✅ |
| **Submit Leave Requests** | ✅ | ✅ | ✅ |
| **Approve / Reject Leaves** | ❌ | ✅ | ✅ |
| **Manage Leave Policies** | ❌ | ❌ | ✅ |
| **Manage Tasks & Subtasks** | ✅ | ✅ | ✅ |
| **Manage Departments** | ❌ | ❌ | ✅ |
| **Manage Users & RBAC Roles** | ❌ | ❌ | ✅ |
| **Post Announcements** | ❌ | ✅ | ✅ |
| **AI Workforce Insights** | ❌ | ❌ | ✅ |
| **System Activity Audit Trail** | ❌ | ❌ | ✅ |

---

## 🚀 Deployment to Vercel

The application is pre-configured for deployment on Vercel:
- **Backend Entry Point**: `backend/api/index.ts`
- **Frontend Build**: React Router framework mode SSR / SPA bundle
- **Environment Variables**: Configure `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `GEMINI_API_KEY`, `RESEND_API_KEY`, and `NODE_ENV=production` in the Vercel project settings.

---

## 📄 License

Private — All rights reserved.
