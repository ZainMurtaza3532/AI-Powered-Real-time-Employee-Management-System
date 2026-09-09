import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DollarSign,
  Plus,
  Play,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Trash2,
  TrendingUp,
  Building,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useAllPayrolls,
  useDeletePayroll,
  useGeneratePayroll,
  usePayrollStats,
  useUpdatePayrollStatus,
} from "@/hooks/use-payroll";
import type { PaymentStatus, Payroll } from "@/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AdminPayrollPage() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [defaultSalary, setDefaultSalary] = useState<number>(5500);

  const statsQuery = usePayrollStats();
  const payrollsQuery = useAllPayrolls({
    month: selectedMonth,
    year: selectedYear,
    status: selectedStatus || undefined,
    search: search || undefined,
  });

  const generateMutation = useGeneratePayroll();
  const updateStatusMutation = useUpdatePayrollStatus();
  const deleteMutation = useDeletePayroll();

  const payrolls = payrollsQuery.data?.data || [];

  const handleRunPayroll = () => {
    generateMutation.mutate(
      {
        month: selectedMonth,
        year: selectedYear,
        defaultBasicSalary: defaultSalary,
      },
      {
        onSuccess: () => setIsGenerateOpen(false),
      }
    );
  };

  const handleDownloadPDF = (slip: Payroll) => {
    const doc = new jsPDF();
    const monthName = MONTH_NAMES[slip.month - 1] || `Month ${slip.month}`;

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EMS ENTERPRISE", 14, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Official Employee Salary Slip & Compensation Statement", 14, 24);

    doc.text(`Period: ${monthName} ${slip.year}`, 196, 20, { align: "right" });

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE DETAILS", 14, 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Employee Name: ${slip.employee?.name}`, 14, 48);
    doc.text(`Employee Email: ${slip.employee?.email}`, 14, 54);
    doc.text(`Department: ${slip.employee?.department?.name || "General"}`, 14, 60);

    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT METADATA", 120, 42);
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${slip.paymentStatus.toUpperCase()}`, 120, 48);
    doc.text(`Payment Method: ${slip.paymentMethod.replace("_", " ").toUpperCase()}`, 120, 54);
    doc.text(`Disbursed On: ${slip.paymentDate ? new Date(slip.paymentDate).toLocaleDateString() : "Pending"}`, 120, 60);

    autoTable(doc, {
      startY: 68,
      head: [["Earnings Item", "Amount (USD)"]],
      body: [
        ["Basic Salary", `$${slip.basicSalary.toLocaleString()}`],
        ["Housing Allowance", `$${(slip.allowances?.housing || 0).toLocaleString()}`],
        ["Transport Allowance", `$${(slip.allowances?.transport || 0).toLocaleString()}`],
        ["Medical Allowance", `$${(slip.allowances?.medical || 0).toLocaleString()}`],
        ["Other Allowances", `$${(slip.allowances?.other || 0).toLocaleString()}`],
        ["Gross Earnings", `$${slip.grossSalary.toLocaleString()}`],
      ],
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8.5 },
    });

    const earningsFinalY = (doc as any).lastAutoTable.finalY || 130;

    autoTable(doc, {
      startY: earningsFinalY + 8,
      head: [["Deductions & Withholdings", "Amount (USD)"]],
      body: [
        ["Income Tax (Withholding)", `$${(slip.deductions?.tax || 0).toLocaleString()}`],
        ["Pension / Social Security", `$${(slip.deductions?.pension || 0).toLocaleString()}`],
        ["Unpaid Leave Deduction", `$${(slip.deductions?.unpaidLeave || 0).toLocaleString()}`],
        ["Other Deductions", `$${(slip.deductions?.other || 0).toLocaleString()}`],
        [
          "Total Deductions",
          `$${(
            (slip.deductions?.tax || 0) +
            (slip.deductions?.pension || 0) +
            (slip.deductions?.unpaidLeave || 0) +
            (slip.deductions?.other || 0)
          ).toLocaleString()}`,
        ],
      ],
      theme: "striped",
      headStyles: { fillColor: [225, 29, 72] },
      styles: { fontSize: 8.5 },
    });

    const deductionsFinalY = (doc as any).lastAutoTable.finalY || 200;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, deductionsFinalY + 8, 182, 22, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("NET TAKE-HOME PAY", 20, deductionsFinalY + 22);

    doc.setFontSize(15);
    doc.setTextColor(16, 185, 129);
    doc.text(`$${slip.netSalary.toLocaleString()}`, 190, deductionsFinalY + 22, { align: "right" });

    doc.save(`Payslip-${slip.employee?.name}-${monthName}-${slip.year}.pdf`);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="size-6" />
            </span>
            Payroll Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run batch salary disbursements, calculate tax deductions, and manage enterprise compensation.
          </p>
        </div>

        <Button onClick={() => setIsGenerateOpen(true)} className="gap-2 shadow-xs">
          <Play className="size-4 fill-current" /> Run Monthly Payroll
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Disbursed This Month</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                ${statsQuery.data?.totalDisbursed?.toLocaleString() || 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-500" /> {statsQuery.data?.paidCount || 0} Completed
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Payouts</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                ${statsQuery.data?.totalPending?.toLocaleString() || 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="size-3 text-amber-500" /> {statsQuery.data?.pendingCount || 0} Awaiting
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <CreditCard className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Headcount on Payroll</p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                {statsQuery.data?.totalPayrollCount || 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Building className="size-3" /> Active Contracts
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Current Pay Period</p>
              <p className="text-xl font-bold mt-1 text-foreground">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="size-3" /> Monthly Cycle
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <Calendar className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 w-full">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employee name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs bg-background h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-xs bg-background border border-border/70 rounded-lg px-3 py-2 outline-none h-9"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs bg-background border border-border/70 rounded-lg px-3 py-2 outline-none h-9"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-background border border-border/70 rounded-lg px-3 py-2 outline-none h-9"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Payroll Table */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-0">
          {payrollsQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading payroll records...
            </div>
          ) : payrolls.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No payroll records found for this period. Click <strong>"Run Monthly Payroll"</strong> to generate slips.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Employee</TableHead>
                  <TableHead className="text-xs">Department</TableHead>
                  <TableHead className="text-xs">Basic Salary</TableHead>
                  <TableHead className="text-xs">Gross Pay</TableHead>
                  <TableHead className="text-xs">Deductions</TableHead>
                  <TableHead className="text-xs">Net Payout</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((slip) => {
                  const totalDeductions =
                    (slip.deductions?.tax || 0) +
                    (slip.deductions?.pension || 0) +
                    (slip.deductions?.unpaidLeave || 0) +
                    (slip.deductions?.other || 0);

                  return (
                    <TableRow key={slip._id} className="hover:bg-muted/20">
                      <TableCell className="text-xs">
                        <p className="font-semibold text-foreground">{slip.employee?.name}</p>
                        <p className="text-[11px] text-muted-foreground">{slip.employee?.email}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slip.employee?.department?.name || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-xs">
                        ${slip.basicSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        ${slip.grossSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-rose-500">
                        -${totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground">
                        ${slip.netSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <select
                          value={slip.paymentStatus}
                          onChange={(e) =>
                            updateStatusMutation.mutate({
                              id: slip._id,
                              status: e.target.value as PaymentStatus,
                            })
                          }
                          className="text-[11px] bg-card border border-border/70 rounded-md px-2 py-1 outline-none font-medium"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="paid">Paid</option>
                          <option value="failed">Failed</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(slip)}
                          className="h-8 text-xs gap-1"
                        >
                          <Download className="size-3.5 text-primary" /> PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(slip._id)}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch Payroll Run Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-primary" /> Run Monthly Payroll
            </DialogTitle>
            <DialogDescription className="text-xs">
              Automatically calculate base salaries, housing/transport allowances, and tax withholdings across all active team members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full mt-1 bg-background border border-border rounded-lg p-2 outline-none"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground font-medium">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full mt-1 bg-background border border-border rounded-lg p-2 outline-none"
                >
                  {[currentYear, currentYear - 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-muted-foreground font-medium">Default Standard Base Salary ($)</label>
              <Input
                type="number"
                value={defaultSalary}
                onChange={(e) => setDefaultSalary(Number(e.target.value))}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Standard baseline salary for employees without a custom rate.
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setIsGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRunPayroll}
              disabled={generateMutation.isPending}
              className="gap-1.5"
            >
              <Play className="size-3.5 fill-current" />
              {generateMutation.isPending ? "Generating Payroll..." : "Execute Payroll Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
