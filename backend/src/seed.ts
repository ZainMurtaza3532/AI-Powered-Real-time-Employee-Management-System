import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "./db/index.js";
import { User, type IUser } from "./models/User.js";
import { Department } from "./models/Department.js";
import { Task } from "./models/Task.js";
import { Attendance } from "./models/Attendance.js";
import { Leave } from "./models/Leave.js";
import { LeavePolicy, DEFAULT_LEAVE_POLICIES } from "./models/LeavePolicy.js";
import { Payroll } from "./models/Payroll.js";
import { Expense } from "./models/Expense.js";
import { Okr } from "./models/Okr.js";
import { Kudos } from "./models/Kudos.js";
import { PerformanceReview } from "./models/PerformanceReview.js";
import { Announcement } from "./models/Announcement.js";
import { Feedback } from "./models/Feedback.js";
import { ActivityLog } from "./models/ActivityLog.js";
import { OfficeLocation } from "./models/OfficeLocation.js";

async function seedDatabase(): Promise<void> {
  await connectDB();

  try {
    console.log("🌱 Starting Comprehensive Enterprise Seeding...");

    // -------------------------------------------------------------------------
    // 1. Leave Policies
    // -------------------------------------------------------------------------
    console.log("📄 Seeding Leave Policies...");
    for (const [leaveType, policy] of Object.entries(DEFAULT_LEAVE_POLICIES)) {
      const existing = await LeavePolicy.findOne({ leaveType: leaveType as any });
      if (!existing) {
        await LeavePolicy.create({
          leaveType: leaveType as any,
          maxDaysPerRequest: policy.maxDaysPerRequest,
          maxDaysPerYear: policy.maxDaysPerYear,
        });
      } else {
        existing.maxDaysPerRequest = policy.maxDaysPerRequest;
        existing.maxDaysPerYear = policy.maxDaysPerYear;
        await existing.save();
      }
    }

    // -------------------------------------------------------------------------
    // 2. Departments
    // -------------------------------------------------------------------------
    console.log("🏢 Seeding Departments...");
    const departmentsData = [
      {
        name: "Engineering",
        description: "Full-stack software engineering, infrastructure, cloud architecture, and technical quality.",
      },
      {
        name: "Product & Design",
        description: "Product management, user research, UI/UX design systems, and roadmap execution.",
      },
      {
        name: "Marketing & Growth",
        description: "Brand strategy, demand generation, product marketing, customer acquisition, and content.",
      },
      {
        name: "Human Resources & People",
        description: "Talent acquisition, employee wellness, cultural initiatives, payroll compliance, and benefits.",
      },
      {
        name: "Finance & Operations",
        description: "Financial planning, accounting, operational efficiency, vendor management, and legal compliance.",
      },
    ];

    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    for (const dept of departmentsData) {
      let doc = await Department.findOne({ name: dept.name });
      if (!doc) {
        doc = await Department.create(dept);
      } else {
        doc.description = dept.description;
        await doc.save();
      }
      deptMap.set(dept.name, doc._id as mongoose.Types.ObjectId);
    }

    // -------------------------------------------------------------------------
    // 3. Users (Admins, Department Heads, Employees)
    // -------------------------------------------------------------------------
    console.log("👥 Seeding Users...");
    const defaultPassword = process.env.ADMIN_PASSWORD ?? "zainmurtazaadmin";
    const currentYear = new Date().getFullYear();

    const usersData = [
      // Admins
      {
        name: process.env.ADMIN_NAME ?? "Zain Murtaza admin",
        email: (process.env.ADMIN_EMAIL ?? "zainmurtazaadmin@gmail.com").trim().toLowerCase(),
        password: defaultPassword,
        role: "admin" as const,
        department: deptMap.get("Engineering"),
        leaveBalance: { year: currentYear, annual: 20, sick: 10, personal: 5 },
      },
      {
        name: "Ali Raza",
        email: "ali@gmail.com",
        password: defaultPassword,
        role: "admin" as const,
        department: deptMap.get("Engineering"),
        leaveBalance: { year: currentYear, annual: 20, sick: 10, personal: 5 },
      },
      // Department Heads
      {
        name: "Sarah Chen",
        email: "sarah.chen@company.com",
        password: defaultPassword,
        role: "head" as const,
        department: deptMap.get("Engineering"),
        leaveBalance: { year: currentYear, annual: 18, sick: 8, personal: 4 },
      },
      {
        name: "Marcus Brody",
        email: "marcus.brody@company.com",
        password: defaultPassword,
        role: "head" as const,
        department: deptMap.get("Product & Design"),
        leaveBalance: { year: currentYear, annual: 17, sick: 9, personal: 5 },
      },
      {
        name: "Aisha Patel",
        email: "aisha.patel@company.com",
        password: defaultPassword,
        role: "head" as const,
        department: deptMap.get("Human Resources & People"),
        leaveBalance: { year: currentYear, annual: 19, sick: 10, personal: 5 },
      },
      // Team Members
      {
        name: "Hamza Tariq",
        email: "hamza@gmail.com",
        password: defaultPassword,
        role: "employee" as const,
        department: deptMap.get("Engineering"),
        leaveBalance: { year: currentYear, annual: 14, sick: 7, personal: 3 },
      },
      {
        name: "Taha Sheikh",
        email: "taha@gmail.com",
        password: defaultPassword,
        role: "employee" as const,
        department: deptMap.get("Product & Design"),
        leaveBalance: { year: currentYear, annual: 12, sick: 6, personal: 2 },
      },
      {
        name: "Maya Lin",
        email: "maya.lin@company.com",
        password: defaultPassword,
        role: "employee" as const,
        department: deptMap.get("Engineering"),
        leaveBalance: { year: currentYear, annual: 16, sick: 8, personal: 4 },
      },
      {
        name: "Jordan Taylor",
        email: "jordan.taylor@company.com",
        password: defaultPassword,
        role: "employee" as const,
        department: deptMap.get("Marketing & Growth"),
        leaveBalance: { year: currentYear, annual: 15, sick: 7, personal: 3 },
      },
      {
        name: "Lucas Silva",
        email: "lucas.silva@company.com",
        password: defaultPassword,
        role: "employee" as const,
        department: deptMap.get("Human Resources & People"),
        leaveBalance: { year: currentYear, annual: 13, sick: 6, personal: 3 },
      },
      {
        name: "Chloe Bennett",
        email: "chloe.bennett@company.com",
        password: defaultPassword,
        role: "employee" as const,
        department: deptMap.get("Finance & Operations"),
        leaveBalance: { year: currentYear, annual: 16, sick: 9, personal: 4 },
      },
    ];

    const userMap = new Map<string, IUser>();
    for (const u of usersData) {
      let user = await User.findOne({ email: u.email }).select("+password");
      if (!user) {
        user = await User.create(u);
        console.log(`   + Created user: ${u.email} (${u.role})`);
      } else {
        user.name = u.name;
        user.role = u.role;
        user.department = u.department;
        user.password = u.password;
        if (!user.leaveBalance) user.leaveBalance = u.leaveBalance;
        await user.save();
      }
      userMap.set(u.email, user);
    }

    const adminUser = userMap.get("zainmurtazaadmin@gmail.com") ?? userMap.get("ali@gmail.com")!;
    const sarahHead = userMap.get("sarah.chen@company.com")!;
    const marcusHead = userMap.get("marcus.brody@company.com")!;
    const aishaHead = userMap.get("aisha.patel@company.com")!;
    const hamzaEmp = userMap.get("hamza@gmail.com")!;
    const tahaEmp = userMap.get("taha@gmail.com")!;
    const mayaEmp = userMap.get("maya.lin@company.com")!;
    const jordanEmp = userMap.get("jordan.taylor@company.com")!;
    const lucasEmp = userMap.get("lucas.silva@company.com")!;
    const chloeEmp = userMap.get("chloe.bennett@company.com")!;

    const allEmployees: IUser[] = [
      hamzaEmp,
      tahaEmp,
      mayaEmp,
      jordanEmp,
      lucasEmp,
      chloeEmp,
      sarahHead,
      marcusHead,
      aishaHead,
    ].filter((e): e is IUser => Boolean(e));

    // -------------------------------------------------------------------------
    // 4. Attendance Records (Past 20 Working Days)
    // -------------------------------------------------------------------------
    console.log("⏱️ Seeding Attendance Records...");
    const now = new Date();
    for (let dayOffset = 20; dayOffset >= 0; dayOffset--) {
      const recordDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOffset));
      const dayOfWeek = recordDate.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

      for (const [i, emp] of allEmployees.entries()) {
        const existing = await Attendance.findOne({ user: emp._id, date: recordDate });
        if (existing) continue;

        // Generate realistic distribution: 85% present, 10% late, 5% remote
        const randomFactor = (dayOffset * 7 + i * 13) % 100;
        let status: "present" | "late" | "half_day" | "on_leave" = "present";
        let checkInHour = 8;
        let checkInMin = 45 + (i % 15);
        let checkOutHour = 17;
        let checkOutMin = 15 + (i % 30);
        let isRemote = randomFactor % 4 === 0;

        if (randomFactor > 88) {
          status = "late";
          checkInHour = 9;
          checkInMin = 35 + (i % 15);
        } else if (randomFactor < 4) {
          status = "half_day";
          checkOutHour = 13;
          checkOutMin = 30;
        }

        const checkIn = new Date(recordDate);
        checkIn.setUTCHours(checkInHour, checkInMin, 0, 0);

        const checkOut = dayOffset === 0 ? null : new Date(recordDate);
        if (checkOut) {
          checkOut.setUTCHours(checkOutHour, checkOutMin, 0, 0);
        }

        await Attendance.create({
          user: emp._id,
          date: recordDate,
          status,
          checkIn,
          checkOut,
          markedBy: adminUser._id,
          notes: isRemote ? "[Remote / WFH] Daily sprint delivery" : "[Office] Standard shift",
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. Tasks
    // -------------------------------------------------------------------------
    console.log("📋 Seeding Tasks...");
    const sampleTasks = [
      {
        title: "Implement Real-Time Server-Sent Events for Notification Hub",
        description: "Connect frontend SSE client hook to the Express notification broadcast stream with reconnection backoff.",
        assignedTo: hamzaEmp._id,
        assignedBy: sarahHead._id,
        department: deptMap.get("Engineering"),
        status: "completed" as const,
        priority: "urgent" as const,
        dueDate: new Date(Date.now() - 2 * 86400000),
        subtasks: [
          { id: "st-1", title: "Implement backend SSE router and push handler", isCompleted: true, estimatedHours: 4 },
          { id: "st-2", title: "Build frontend useSSE hook with reconnect logic", isCompleted: true, estimatedHours: 3 },
          { id: "st-3", title: "Unit test connection recovery and message payloads", isCompleted: true, estimatedHours: 2 },
        ],
        submissionNotes: "Completed and tested across multiple tabs. Verified latency is under 50ms.",
        submittedAt: new Date(Date.now() - 3 * 86400000),
        reviewNotes: "Excellent architecture and clean recovery handlers. Approved!",
        reviewedAt: new Date(Date.now() - 2 * 86400000),
        reviewedBy: sarahHead._id,
        completedAt: new Date(Date.now() - 2 * 86400000),
      },
      {
        title: "Design Modern Glassmorphic UI Components & Color Tokens",
        description: "Create accessible OKLCH color palettes, interactive cards, and responsive navigation drawer components.",
        assignedTo: tahaEmp._id,
        assignedBy: marcusHead._id,
        department: deptMap.get("Product & Design"),
        status: "completed" as const,
        priority: "high" as const,
        dueDate: new Date(Date.now() - 1 * 86400000),
        subtasks: [
          { id: "st-4", title: "Extract color variables into app.css design tokens", isCompleted: true, estimatedHours: 3 },
          { id: "st-5", title: "Build responsive Sidebar and AppHeader layouts", isCompleted: true, estimatedHours: 5 },
          { id: "st-6", title: "Add dark mode contrast accessibility checks", isCompleted: true, estimatedHours: 2 },
        ],
        submissionNotes: "All Shadcn primitives refined with smooth micro-animations and verified in dark mode.",
        submittedAt: new Date(Date.now() - 2 * 86400000),
        reviewNotes: "Design looks ultra-modern and cohesive across all views.",
        reviewedAt: new Date(Date.now() - 1 * 86400000),
        reviewedBy: marcusHead._id,
        completedAt: new Date(Date.now() - 1 * 86400000),
      },
      {
        title: "Migrate MongoDB Aggregation Queries for Payroll & Analytics",
        description: "Optimize monthly earnings calculations, index optimizations, and tax deduction formulas.",
        assignedTo: mayaLinOrHamza(mayaEmp, hamzaEmp)._id,
        assignedBy: sarahHead._id,
        department: deptMap.get("Engineering"),
        status: "in_progress" as const,
        priority: "urgent" as const,
        dueDate: new Date(Date.now() + 3 * 86400000),
        subtasks: [
          { id: "st-7", title: "Profile slow MongoDB queries using explain plans", isCompleted: true, estimatedHours: 3 },
          { id: "st-8", title: "Add compound indexes on employee + date fields", isCompleted: true, estimatedHours: 2 },
          { id: "st-9", title: "Refactor PDF export generator with stream buffers", isCompleted: false, estimatedHours: 4 },
        ],
      },
      {
        title: "Launch Q3 Enterprise Demand Generation Campaign",
        description: "Coordinate webinar series, partner newsletter sponsorships, and product release marketing collateral.",
        assignedTo: jordanEmp._id,
        assignedBy: adminUser._id,
        department: deptMap.get("Marketing & Growth"),
        status: "in_progress" as const,
        priority: "high" as const,
        dueDate: new Date(Date.now() + 5 * 86400000),
        subtasks: [
          { id: "st-10", title: "Draft high-converting product one-pagers", isCompleted: true, estimatedHours: 4 },
          { id: "st-11", title: "Set up targeted landing pages with UTM analytics", isCompleted: true, estimatedHours: 3 },
          { id: "st-12", title: "Launch email newsletter sequence via Resend", isCompleted: false, estimatedHours: 3 },
        ],
      },
      {
        title: "Execute Annual Compensation & Market Salary Benchmarking",
        description: "Review regional salary bands against tech industry standards and propose merit adjustments for Q4.",
        assignedTo: chloeEmp._id,
        assignedBy: aishaHead._id,
        department: deptMap.get("Finance & Operations"),
        status: "in_review" as const,
        priority: "medium" as const,
        dueDate: new Date(Date.now() + 1 * 86400000),
        subtasks: [
          { id: "st-13", title: "Gather compensation survey data for key roles", isCompleted: true, estimatedHours: 6 },
          { id: "st-14", title: "Model budget impact for cost-of-living adjustments", isCompleted: true, estimatedHours: 4 },
          { id: "st-15", title: "Prepare executive presentation deck", isCompleted: true, estimatedHours: 3 },
        ],
        submissionNotes: "Ready for leadership review. Salary band recommendations attached.",
        submittedAt: new Date(),
      },
      {
        title: "Standardize Employee Onboarding & Compliance Checklists",
        description: "Create an interactive handbook, digital equipment sign-off, and security training modules.",
        assignedTo: lucasEmp._id,
        assignedBy: aishaHead._id,
        department: deptMap.get("Human Resources & People"),
        status: "in_progress" as const,
        priority: "medium" as const,
        dueDate: new Date(Date.now() + 7 * 86400000),
        subtasks: [
          { id: "st-16", title: "Update benefits welcome kit documentation", isCompleted: true, estimatedHours: 3 },
          { id: "st-17", title: "Configure new joiner IT requisition workflows", isCompleted: false, estimatedHours: 4 },
        ],
      },
      {
        title: "AI Flight Risk & Retention Predictive Intelligence Model",
        description: "Integrate multi-factor retention indicators (overtime hours, task velocities, leave patterns, review scores).",
        assignedTo: hamzaEmp._id,
        assignedBy: adminUser._id,
        department: deptMap.get("Engineering"),
        status: "in_progress" as const,
        priority: "urgent" as const,
        dueDate: new Date(Date.now() + 4 * 86400000),
        subtasks: [
          { id: "st-18", title: "Implement retention scoring heuristic algorithm", isCompleted: true, estimatedHours: 4 },
          { id: "st-19", title: "Connect AI Copilot executive insights tab", isCompleted: true, estimatedHours: 3 },
          { id: "st-20", title: "Build interactive radar chart visualization", isCompleted: false, estimatedHours: 4 },
        ],
      },
      {
        title: "Build Automated Digital Payslip Generator & PDF Download",
        description: "Generate compliant digital payslips with earnings, deductions, tax summaries, and QR validation.",
        assignedTo: mayaEmp._id,
        assignedBy: sarahHead._id,
        department: deptMap.get("Engineering"),
        status: "completed" as const,
        priority: "high" as const,
        dueDate: new Date(Date.now() - 4 * 86400000),
        subtasks: [
          { id: "st-21", title: "Implement jsPDF payslip layout generator", isCompleted: true, estimatedHours: 5 },
          { id: "st-22", title: "Add earnings breakdown table and company branding", isCompleted: true, estimatedHours: 3 },
        ],
        submissionNotes: "Payslip generator tested and generates crisp high-resolution PDFs.",
        submittedAt: new Date(Date.now() - 5 * 86400000),
        reviewNotes: "Payslip layout conforms to corporate standards.",
        reviewedAt: new Date(Date.now() - 4 * 86400000),
        reviewedBy: sarahHead._id,
        completedAt: new Date(Date.now() - 4 * 86400000),
      },
    ];

    for (const t of sampleTasks) {
      const existing = await Task.findOne({ title: t.title });
      if (!existing) {
        await Task.create(t);
      }
    }

    // -------------------------------------------------------------------------
    // 6. Leaves
    // -------------------------------------------------------------------------
    console.log("🌴 Seeding Leaves...");
    const sampleLeaves = [
      {
        user: hamzaEmp._id,
        leaveType: "annual" as const,
        startDate: new Date(Date.now() + 14 * 86400000),
        endDate: new Date(Date.now() + 18 * 86400000),
        days: 5,
        reason: "Annual family vacation and rest.",
        status: "approved" as const,
        decidedBy: sarahHead._id,
        decisionNote: "Approved! Enjoy your well-deserved break.",
        decidedAt: new Date(Date.now() - 1 * 86400000),
      },
      {
        user: tahaEmp._id,
        leaveType: "sick" as const,
        startDate: new Date(Date.now() - 5 * 86400000),
        endDate: new Date(Date.now() - 4 * 86400000),
        days: 2,
        reason: "Recovering from seasonal flu and fever.",
        status: "approved" as const,
        decidedBy: marcusHead._id,
        decisionNote: "Get well soon Taha!",
        decidedAt: new Date(Date.now() - 5 * 86400000),
      },
      {
        user: jordanEmp._id,
        leaveType: "personal" as const,
        startDate: new Date(Date.now() + 6 * 86400000),
        endDate: new Date(Date.now() + 7 * 86400000),
        days: 2,
        reason: "Attending brother's graduation ceremony out of state.",
        status: "pending" as const,
      },
      {
        user: mayaEmp._id,
        leaveType: "annual" as const,
        startDate: new Date(Date.now() + 25 * 86400000),
        endDate: new Date(Date.now() + 28 * 86400000),
        days: 4,
        reason: "Attending international tech conference.",
        status: "pending" as const,
      },
      {
        user: lucasEmp._id,
        leaveType: "personal" as const,
        startDate: new Date(Date.now() - 12 * 86400000),
        endDate: new Date(Date.now() - 11 * 86400000),
        days: 2,
        reason: "Home relocation and moving day.",
        status: "approved" as const,
        decidedBy: aishaHead._id,
        decisionNote: "Approved.",
        decidedAt: new Date(Date.now() - 13 * 86400000),
      },
    ];

    for (const l of sampleLeaves) {
      const existing = await Leave.findOne({ user: l.user, reason: l.reason });
      if (!existing) {
        await Leave.create(l);
      }
    }

    // -------------------------------------------------------------------------
    // 7. Payroll Records
    // -------------------------------------------------------------------------
    console.log("💳 Seeding Payroll Records...");
    const currentMonth = now.getUTCMonth() + 1;
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const payrollProfiles = [
      { emp: sarahHead, basic: 9500, housing: 1500, transport: 500, medical: 600, tax: 1800, pension: 450 },
      { emp: marcusHead, basic: 9000, housing: 1400, transport: 500, medical: 600, tax: 1700, pension: 420 },
      { emp: aishaHead, basic: 8500, housing: 1300, transport: 400, medical: 500, tax: 1550, pension: 400 },
      { emp: hamzaEmp, basic: 7200, housing: 1100, transport: 400, medical: 450, tax: 1250, pension: 340 },
      { emp: tahaEmp, basic: 6500, housing: 1000, transport: 350, medical: 400, tax: 1100, pension: 300 },
      { emp: mayaEmp, basic: 7000, housing: 1100, transport: 400, medical: 450, tax: 1200, pension: 330 },
      { emp: jordanEmp, basic: 6200, housing: 950, transport: 350, medical: 400, tax: 1050, pension: 290 },
      { emp: lucasEmp, basic: 5800, housing: 900, transport: 300, medical: 350, tax: 950, pension: 270 },
      { emp: chloeEmp, basic: 6800, housing: 1050, transport: 350, medical: 400, tax: 1150, pension: 320 },
    ];

    for (const p of payrollProfiles) {
      const gross = p.basic + p.housing + p.transport + p.medical;
      const totalDeductions = p.tax + p.pension;
      const net = gross - totalDeductions;

      // Previous month record (paid)
      const existingPrev = await Payroll.findOne({ employee: p.emp._id, month: prevMonth, year: prevYear });
      if (!existingPrev) {
        await Payroll.create({
          employee: p.emp._id,
          month: prevMonth,
          year: prevYear,
          basicSalary: p.basic,
          allowances: { housing: p.housing, transport: p.transport, medical: p.medical, other: 0 },
          deductions: { tax: p.tax, pension: p.pension, unpaidLeave: 0, other: 0 },
          grossSalary: gross,
          netSalary: net,
          paymentStatus: "paid",
          paymentDate: new Date(Date.UTC(prevYear, prevMonth - 1, 28)),
          paymentMethod: "direct_deposit",
          notes: "Monthly salary disbursement processed successfully.",
        });
      }

      // Current month record (paid or pending)
      const existingCurr = await Payroll.findOne({ employee: p.emp._id, month: currentMonth, year: currentYear });
      if (!existingCurr) {
        await Payroll.create({
          employee: p.emp._id,
          month: currentMonth,
          year: currentYear,
          basicSalary: p.basic,
          allowances: { housing: p.housing, transport: p.transport, medical: p.medical, other: 0 },
          deductions: { tax: p.tax, pension: p.pension, unpaidLeave: 0, other: 0 },
          grossSalary: gross,
          netSalary: net,
          paymentStatus: "paid",
          paymentDate: new Date(),
          paymentMethod: "direct_deposit",
          notes: "Regular payroll cycle for current period.",
        });
      }
    }

    // -------------------------------------------------------------------------
    // 8. Expense Claims
    // -------------------------------------------------------------------------
    console.log("🧾 Seeding Expenses...");
    const sampleExpenses = [
      {
        employee: hamzaEmp._id,
        title: "AWS Certified Solutions Architect Exam Voucher",
        category: "training" as const,
        amount: 300.0,
        currency: "USD",
        date: new Date(Date.now() - 4 * 86400000),
        description: "Professional cloud certification reimbursement as part of annual learning budget.",
        receiptName: "aws_exam_receipt_2026.pdf",
        status: "reimbursed" as const,
        reviewedBy: sarahHead._id,
        reviewedAt: new Date(Date.now() - 3 * 86400000),
        reimbursedAt: new Date(Date.now() - 1 * 86400000),
      },
      {
        employee: tahaEmp._id,
        title: "Figma Professional Team Annual License",
        category: "software" as const,
        amount: 180.0,
        currency: "USD",
        date: new Date(Date.now() - 6 * 86400000),
        description: "Design tool subscription for design system component maintenance.",
        receiptName: "figma_invoice_inv492.pdf",
        status: "approved" as const,
        reviewedBy: marcusHead._id,
        reviewedAt: new Date(Date.now() - 5 * 86400000),
      },
      {
        employee: jordanEmp._id,
        title: "Client Quarterly Business Review Dinner",
        category: "meals" as const,
        amount: 245.5,
        currency: "USD",
        date: new Date(Date.now() - 8 * 86400000),
        description: "Strategic dinner meeting with key enterprise account leads.",
        receiptName: "bistro_client_dinner.pdf",
        status: "reimbursed" as const,
        reviewedBy: adminUser._id,
        reviewedAt: new Date(Date.now() - 7 * 86400000),
        reimbursedAt: new Date(Date.now() - 2 * 86400000),
      },
      {
        employee: mayaEmp._id,
        title: "4K High-Resolution Dual Monitor for Remote Workstation",
        category: "hardware" as const,
        amount: 450.0,
        currency: "USD",
        date: new Date(Date.now() - 2 * 86400000),
        description: "Approved hardware refresh under ergonomic equipment policy.",
        receiptName: "dell_ultrasharp_receipt.pdf",
        status: "pending" as const,
      },
      {
        employee: chloeEmp._id,
        title: "Financial Analytics & Modeling Software Subscription",
        category: "software" as const,
        amount: 220.0,
        currency: "USD",
        date: new Date(Date.now() - 1 * 86400000),
        description: "Advanced forecasting and financial analysis toolbox.",
        receiptName: "stat_modeler_receipt.pdf",
        status: "pending" as const,
      },
    ];

    for (const exp of sampleExpenses) {
      const existing = await Expense.findOne({ employee: exp.employee, title: exp.title });
      if (!existing) {
        await Expense.create(exp);
      }
    }

    // -------------------------------------------------------------------------
    // 9. Strategic OKRs
    // -------------------------------------------------------------------------
    console.log("🎯 Seeding OKRs...");
    const sampleOkrs = [
      {
        title: "Achieve 99.99% Platform Reliability & Sub-100ms Response Times",
        description: "Deliver high availability, automated disaster recovery, and resilient AI endpoint fallbacks.",
        period: "Q3 2026",
        level: "company" as const,
        owner: adminUser._id,
        department: deptMap.get("Engineering"),
        overallProgress: 82,
        status: "active" as const,
        keyResults: [
          { title: "Maintain 99.99% uptime across production clusters", targetValue: 99.99, currentValue: 99.98, unit: "%", progress: 95, status: "on_track" as const },
          { title: "Reduce P95 API latency to under 80ms", targetValue: 80, currentValue: 72, unit: "ms", progress: 100, status: "completed" as const },
          { title: "Achieve 100% automated fallback coverage for AI tools", targetValue: 100, currentValue: 90, unit: "%", progress: 90, status: "on_track" as const },
        ],
      },
      {
        title: "Modernize Employee Experience & Design System Componentry",
        description: "Refactor core application interfaces with modern glassmorphic styling, dark mode, and accessibility.",
        period: "Q3 2026",
        level: "department" as const,
        owner: marcusHead._id,
        department: deptMap.get("Product & Design"),
        overallProgress: 78,
        status: "active" as const,
        keyResults: [
          { title: "Standardize 30+ reusable Shadcn UI components", targetValue: 30, currentValue: 28, unit: "components", progress: 93, status: "on_track" as const },
          { title: "Achieve WCAG AA 2.1 compliance score above 98%", targetValue: 98, currentValue: 95, unit: "%", progress: 85, status: "on_track" as const },
          { title: "Conduct 15 usability feedback sessions with department heads", targetValue: 15, currentValue: 10, unit: "sessions", progress: 66, status: "on_track" as const },
        ],
      },
      {
        title: "Accelerate Enterprise Customer Pipeline & Brand Presence",
        description: "Expand content marketing, product showcase demonstrations, and strategic lead generation.",
        period: "Q3 2026",
        level: "department" as const,
        owner: jordanEmp._id,
        department: deptMap.get("Marketing & Growth"),
        overallProgress: 65,
        status: "active" as const,
        keyResults: [
          { title: "Generate 200 Qualified Inbound Enterprise Leads", targetValue: 200, currentValue: 135, unit: "leads", progress: 68, status: "on_track" as const },
          { title: "Publish 8 in-depth workforce engineering case studies", targetValue: 8, currentValue: 5, unit: "articles", progress: 62, status: "on_track" as const },
        ],
      },
      {
        title: "Foster Inclusive Company Culture & Continuous Recognition",
        description: "Promote peer recognition, monthly kudos awards, and quarterly team wellness programs.",
        period: "Q3 2026",
        level: "department" as const,
        owner: aishaHead._id,
        department: deptMap.get("Human Resources & People"),
        overallProgress: 88,
        status: "active" as const,
        keyResults: [
          { title: "Achieve 85% monthly employee participation on Kudos Wall", targetValue: 85, currentValue: 82, unit: "%", progress: 96, status: "on_track" as const },
          { title: "Complete 100% of quarterly performance evaluations on schedule", targetValue: 100, currentValue: 80, unit: "%", progress: 80, status: "on_track" as const },
        ],
      },
    ];

    for (const okr of sampleOkrs) {
      const existing = await Okr.findOne({ title: okr.title });
      if (!existing) {
        await Okr.create(okr);
      }
    }

    // -------------------------------------------------------------------------
    // 10. Kudos & Peer Recognitions
    // -------------------------------------------------------------------------
    console.log("❤️ Seeding Kudos...");
    const sampleKudos = [
      {
        sender: sarahHead._id,
        recipient: hamzaEmp._id,
        badge: "speed_demon" as const,
        message: "Outstanding turnaround on the real-time SSE notification hub! Handled edge cases with incredible speed.",
        reactions: [
          { user: marcusHead._id, emoji: "🚀" },
          { user: mayaEmp._id, emoji: "👏" },
          { user: adminUser._id, emoji: "🔥" },
        ],
      },
      {
        sender: hamzaEmp._id,
        recipient: tahaEmp._id,
        badge: "innovator" as const,
        message: "The new glassmorphic charts and dark mode tokens look unbelievable! Super clean UX.",
        reactions: [
          { user: sarahHead._id, emoji: "💡" },
          { user: jordanEmp._id, emoji: "❤️" },
        ],
      },
      {
        sender: aishaHead._id,
        recipient: chloeEmp._id,
        badge: "problem_solver" as const,
        message: "Thank you Chloe for resolving the complex tax deduction model so cleanly ahead of monthly payroll run.",
        reactions: [
          { user: adminUser._id, emoji: "👏" },
          { user: lucasEmp._id, emoji: "🔥" },
        ],
      },
      {
        sender: marcusHead._id,
        recipient: mayaEmp._id,
        badge: "team_player" as const,
        message: "Maya's proactive help with the PDF payslip generator made a huge difference to our timeline.",
        reactions: [
          { user: hamzaEmp._id, emoji: "🚀" },
          { user: sarahHead._id, emoji: "❤️" },
        ],
      },
      {
        sender: jordanEmp._id,
        recipient: lucasEmp._id,
        badge: "culture_champion" as const,
        message: "Organized the smoothest team all-hands and wellness trivia session. Everyone loved it!",
        reactions: [
          { user: aishaHead._id, emoji: "👏" },
          { user: tahaEmp._id, emoji: "🎉" },
        ],
      },
    ];

    for (const k of sampleKudos) {
      const existing = await Kudos.findOne({ sender: k.sender, recipient: k.recipient, message: k.message });
      if (!existing) {
        await Kudos.create(k);
      }
    }

    // -------------------------------------------------------------------------
    // 11. Performance Reviews
    // -------------------------------------------------------------------------
    console.log("🏆 Seeding Performance Reviews...");
    const sampleReviews = [
      {
        employee: hamzaEmp._id,
        reviewer: sarahHead._id,
        period: "Q2 2026",
        status: "acknowledged" as const,
        ratings: [
          { category: "Technical Skills", score: 5, comment: "Demonstrates exceptional full-stack mastery, fast debugging, and robust real-time architecture." },
          { category: "Communication", score: 4, comment: "Maintains clear task updates and collaborates effectively with product designers." },
          { category: "Teamwork", score: 5, comment: "Always willing to unblock teammates and share deep technical knowledge." },
          { category: "Leadership & Initiative", score: 4, comment: "Spearheaded the SSE architecture with zero guidance." },
        ],
        overallScore: 4.5,
        strengths: "Hamza is a cornerstone technical contributor in Engineering. High task completion velocity, zero production regressions, and strong peer mentorship.",
        improvements: "Continue developing architectural documentation and lead technical lunch-and-learns for the team.",
        summary: "Superb execution throughout Q2. Positioned well for Senior Technical Lead responsibilities.",
        goals: [
          { title: "Lead AI Copilot architecture expansion", description: "Design multi-agent tool execution pipeline.", status: "in_progress" as const, dueDate: new Date(Date.now() + 60 * 86400000) },
          { title: "Author developer handbook on real-time SSE patterns", description: "Document resilient SSE conventions.", status: "completed" as const, completedAt: new Date() },
        ],
        employeeComments: "Thank you Sarah! Excited to take on larger architectural initiatives in Q3.",
        acknowledgedAt: new Date(Date.now() - 10 * 86400000),
        aiGenerated: true,
      },
      {
        employee: tahaEmp._id,
        reviewer: marcusHead._id,
        period: "Q2 2026",
        status: "acknowledged" as const,
        ratings: [
          { category: "Design System & UI", score: 5, comment: "Crafted a gorgeous, accessible, and responsive component library." },
          { category: "Product Sense", score: 4, comment: "Understands user journey nuances and reduces workflow friction." },
          { category: "Collaboration", score: 5, comment: "Seamless collaboration with engineering to implement pixel-perfect layouts." },
          { category: "Execution Speed", score: 4, comment: "Consistently delivers mockups ahead of sprint planning." },
        ],
        overallScore: 4.5,
        strengths: "Taha brings world-class visual aesthetics and obsessive attention to typography, micro-interactions, and contrast.",
        improvements: "Conduct more structured user testing sessions with external clients.",
        summary: "Outstanding design leadership that elevated the entire application's first impression.",
        goals: [
          { title: "Publish unified EMS Design Token Figma Library", description: "Sync tokens directly with CSS variables.", status: "completed" as const, completedAt: new Date() },
        ],
        employeeComments: "Appreciate the feedback! Looking forward to refining user analytics flows next.",
        acknowledgedAt: new Date(Date.now() - 8 * 86400000),
        aiGenerated: true,
      },
      {
        employee: jordanEmp._id,
        reviewer: adminUser._id,
        period: "Q2 2026",
        status: "pending_acknowledgment" as const,
        ratings: [
          { category: "Campaign Strategy", score: 4, comment: "Developed high-performing multichannel acquisition funnels." },
          { category: "Content Quality", score: 4, comment: "High quality copywriting for technical audience." },
          { category: "Analytics & ROI", score: 4, comment: "Detailed UTM attribution and conversion tracking." },
          { category: "Collaboration", score: 4, comment: "Strong alignment with sales and product teams." },
        ],
        overallScore: 4.0,
        strengths: "Jordan exceeded growth targets for Q2 and demonstrated strong analytical rigor in ad spend allocation.",
        improvements: "Explore automated drip nurturing campaigns to improve trial-to-paid conversion rates.",
        summary: "Strong performance with tangible contribution to pipeline expansion.",
        goals: [
          { title: "Implement automated lead score enrichment", description: "Integrate CRM with predictive conversion triggers.", status: "not_started" as const, dueDate: new Date(Date.now() + 45 * 86400000) },
        ],
        aiGenerated: true,
      },
    ];

    for (const r of sampleReviews) {
      const existing = await PerformanceReview.findOne({ employee: r.employee, period: r.period });
      if (!existing) {
        await PerformanceReview.create(r);
      }
    }

    // -------------------------------------------------------------------------
    // 12. Announcements
    // -------------------------------------------------------------------------
    console.log("📢 Seeding Announcements...");
    const sampleAnnouncements = [
      {
        title: "🚀 Welcome to the Upgraded AI-Powered Real-Time EMS Platform!",
        body: "We are thrilled to roll out our all-new employee platform featuring live punch clocks, digital payslips, peer Kudos recognition, strategic OKRs, and conversational AI Copilot. Explore all modules from your sidebar navigation!",
        department: deptMap.get("Engineering")!,
        author: adminUser._id,
      },
      {
        title: "📅 Q3 Company All-Hands & Product Roadmap Presentation",
        body: "Join us this Friday at 3:00 PM EST for our quarterly company town hall. Executive leadership will share H2 strategic goals, key hires, and customer milestones.",
        department: deptMap.get("Human Resources & People")!,
        author: aishaHead._id,
      },
      {
        title: "💡 Annual Wellness & Home Ergonomic Equipment Stipend",
        body: "Reminder: All full-time employees are eligible for the $500 annual wellness and ergonomic workspace reimbursement. Submit receipts via the Expense Claims portal under the Hardware / Training category.",
        department: deptMap.get("Human Resources & People")!,
        author: aishaHead._id,
      },
      {
        title: "🛠️ Engineering Architecture Hackathon & AI Showcase",
        body: "Mark your calendars! Next month we are hosting our 48-hour internal hackathon focused on building intelligent automation plugins for our workforce operations.",
        department: deptMap.get("Engineering")!,
        author: sarahHead._id,
      },
    ];

    for (const a of sampleAnnouncements) {
      const existing = await Announcement.findOne({ title: a.title });
      if (!existing) {
        await Announcement.create(a);
      }
    }

    // -------------------------------------------------------------------------
    // 13. Feedback
    // -------------------------------------------------------------------------
    console.log("💬 Seeding Feedback...");
    const sampleFeedbacks = [
      {
        author: hamzaEmp._id,
        isAnonymous: false,
        category: "suggestion" as const,
        message: "Can we add dark-mode support and custom shortcut hotkeys for clocking in/out from the top navbar?",
        status: "resolved" as const,
        response: {
          body: "Great suggestion! Dark mode and responsive header punch clock shortcuts are now fully enabled.",
          respondedBy: adminUser._id,
          respondedAt: new Date(Date.now() - 2 * 86400000),
        },
      },
      {
        author: mayaEmp._id,
        isAnonymous: true,
        category: "praise" as const,
        message: "The new digital payslip PDF generator is super fast and clean. Love having instant downloads!",
        status: "resolved" as const,
        response: {
          body: "Thank you for the wonderful feedback! Glad the digital payslips are saving time.",
          respondedBy: adminUser._id,
          respondedAt: new Date(Date.now() - 1 * 86400000),
        },
      },
      {
        author: jordanEmp._id,
        isAnonymous: false,
        category: "suggestion" as const,
        message: "Would be great to allow tagging colleagues in task descriptions with automated notifications.",
        status: "open" as const,
      },
    ];

    for (const f of sampleFeedbacks) {
      const existing = await Feedback.findOne({ author: f.author, message: f.message });
      if (!existing) {
        await Feedback.create(f);
      }
    }

    // -------------------------------------------------------------------------
    // 14. Office Locations & IP Whitelist
    // -------------------------------------------------------------------------
    console.log("🏢 Seeding Office Locations & IP Whitelists...");
    const sampleOfficeLocations = [
      {
        branchName: "Lahore Head Office",
        ipAddresses: ["127.0.0.1", "::1", "192.168.1.1", "110.38.12.45", "182.180.160.10"],
        isActive: true,
        address: "Gulberg III, Main Boulevard, Lahore, Pakistan",
      },
      {
        branchName: "Karachi Branch",
        ipAddresses: ["127.0.0.1", "115.186.140.22", "202.163.112.80"],
        isActive: true,
        address: "Clifton Block 4, Karachi, Pakistan",
      },
      {
        branchName: "Islamabad Tech Hub",
        ipAddresses: ["127.0.0.1", "39.40.10.15", "175.107.200.5"],
        isActive: true,
        address: "Blue Area, Jinnah Avenue, Islamabad, Pakistan",
      },
    ];

    for (const loc of sampleOfficeLocations) {
      const existing = await OfficeLocation.findOne({ branchName: loc.branchName });
      if (!existing) {
        await OfficeLocation.create(loc);
      } else {
        existing.ipAddresses = loc.ipAddresses;
        existing.isActive = loc.isActive;
        existing.address = loc.address;
        await existing.save();
      }
    }

    // -------------------------------------------------------------------------
    // 15. Activity Logs
    // -------------------------------------------------------------------------
    console.log("📜 Seeding Activity Logs...");
    const sampleLogs = [
      { action: "login" as const, actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, details: { method: "cookie_auth" } },
      { action: "task_created" as const, actor: sarahHead._id, actorName: sarahHead.name, actorEmail: sarahHead.email, actorRole: sarahHead.role, targetType: "task", targetName: "Implement Real-Time SSE" },
      { action: "leave_approved" as const, actor: sarahHead._id, actorName: sarahHead.name, actorEmail: sarahHead.email, actorRole: sarahHead.role, targetType: "leave", targetName: "Vacation for Hamza Tariq" },
      { action: "review_created" as const, actor: marcusHead._id, actorName: marcusHead.name, actorEmail: marcusHead.email, actorRole: marcusHead.role, targetType: "performance_review", targetName: "Q2 Review for Taha" },
      { action: "announcement_created" as const, actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, targetType: "announcement", targetName: "Welcome to EMS Platform" },
    ];

    for (const log of sampleLogs) {
      await ActivityLog.create(log);
    }

    console.log("✅ Comprehensive Enterprise Seeding Completed Successfully! 🎉");
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    throw err;
  } finally {
    await disconnectDB();
  }
}

function mayaLinOrHamza(m: IUser, h: IUser): IUser {
  return m ?? h;
}

if (import.meta.main) {
  seedDatabase().catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
}
