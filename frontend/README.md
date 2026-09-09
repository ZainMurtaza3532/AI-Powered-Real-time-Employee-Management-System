# EMS Frontend

Modern, high-performance web client for the Employee Management System built with **React 19**, **React Router 8** (Framework Mode), **TanStack Query**, **Tailwind CSS 4**, and **Shadcn UI**.

## Tech Stack

- **Framework**: React 19 + React Router 8
- **Data Fetching & Caching**: TanStack Query v5 + Axios
- **UI & Design System**: Shadcn UI (accessible Radix/Base-UI primitives), Tailwind CSS 4, Lucide Icons
- **Data Visualization**: Recharts
- **Export Utilities**: jsPDF, jsPDF-AutoTable, XLSX
- **Real-Time**: Server-Sent Events (SSE) hook integration

## Project Structure

```
app/
├── components/
│   ├── auth/          # Login page, Login form & RequireAuth wrapper
│   ├── globals/       # Reusable data table pagination & search bar
│   ├── layout/        # App shell, responsive sidebar & brand
│   ├── notifications/ # SSE notification bell & drawer
│   └── ui/            # Shadcn UI accessible components
├── hooks/             # Custom TanStack query hooks & real-time listeners
├── lib/               # Axios API client, query client, PDF & Excel export utils
├── routes/            # React Router file-based route components
│   ├── admin/         # Admin management dashboards
│   └── ...            # Feature views (dashboard, copilot, payroll, okrs, kudos, etc.)
├── app.css            # Global theme variables and design tokens
├── root.tsx           # Document root, QueryClientProvider, Tooltip & Toast providers
├── routes.ts          # Central route manifest and nested layouts
└── types.ts           # Frontend TypeScript interfaces
```

## Available Scripts

```bash
# Start development server on port 5173
bun run dev

# Run TypeScript type check
bun run typecheck

# Build for production
bun run build

# Start production server
bun run start
```

## Environment Variables

Copy `.env.example` to `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```
