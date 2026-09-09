import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DollarSign,
  Download,
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Eye,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useCurrentUser } from "@/hooks/use-auth";
import { useMyPayslips } from "@/hooks/use-payroll";
import type { Payroll } from "@/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function EmployeePayrollPage() {
  const { data: currentUser } = useCurrentUser();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedPayslip, setSelectedPayslip] = useState<Payroll | null>(null);

  const { data, isLoading } = useMyPayslips(selectedYear);
  const payslips = data?.payslips || [];

  const latestSlip = payslips[0];
  const totalEarnedThisYear = payslips
    .filter((p) => p.paymentStatus === "paid")
    .reduce((sum, p) => sum + p.netSalary, 0);

  const generatePDF = (slip: Payroll) => {
    const doc = new jsPDF();
    const monthName = MONTH_NAMES[slip.month - 1] || `Month ${slip.month}`;

    // Header Branding
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EMS ENTERPRISE", 14, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Official Employee Salary Slip & Compensation Statement", 14, 24);

    doc.setTextColor(255, 255, 255);
    doc.text(`Period: ${monthName} ${slip.year}`, 196, 20, { align: "right" });

    // Employee & Payment Metadata
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE DETAILS", 14, 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Employee Name: ${slip.employee?.name || currentUser?.name}`, 14, 48);
    doc.text(`Employee Email: ${slip.employee?.email || currentUser?.email}`, 14, 54);
    doc.text(`Department: ${slip.employee?.department?.name || "General"}`, 14, 60);

    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT METADATA", 120, 42);
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${slip.paymentStatus.toUpperCase()}`, 120, 48);
    doc.text(`Payment Method: ${slip.paymentMethod.replace("_", " ").toUpperCase()}`, 120, 54);
    doc.text(`Disbursed On: ${slip.paymentDate ? new Date(slip.paymentDate).toLocaleDateString() : "Pending"}`, 120, 60);

    // Earnings Table
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
      headStyles: { fillColor: [79, 70, 229] }, // indigo
      styles: { fontSize: 8.5 },
    });

    const earningsFinalY = (doc as any).lastAutoTable.finalY || 130;

    // Deductions Table
    autoTable(doc, {
      startY: earningsFinalY + 8,
      head: [["Deductions & Withholdings", "Amount (USD)"]],
      body: [
        ["Income Tax (Withholding)", `$${(slip.deductions?.tax || 0).toLocaleString()}`],
        ["Pension / Retirement Contribution", `$${(slip.deductions?.pension || 0).toLocaleString()}`],
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
      headStyles: { fillColor: [225, 29, 72] }, // rose
      styles: { fontSize: 8.5 },
    });

    const deductionsFinalY = (doc as any).lastAutoTable.finalY || 200;

    // Net Pay Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, deductionsFinalY + 8, 182, 22, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("NET TAKE-HOME PAY", 20, deductionsFinalY + 22);

    doc.setFontSize(15);
    doc.setTextColor(16, 185, 129); // emerald
    doc.text(`$${slip.netSalary.toLocaleString()}`, 190, deductionsFinalY + 22, { align: "right" });

    // Footer note
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "This is a system-generated payslip authorized by EMS Payroll Hub. For questions, contact payroll@ems.internal.",
      105,
      285,
      { align: "center" }
    );

    doc.save(`Payslip-${monthName}-${slip.year}.pdf`);
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
            My Compensation & Payslips
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access and download your digital monthly salary slips, earnings breakdowns, and tax statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs bg-card border border-border/70 rounded-lg px-3 py-2 outline-none"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Latest Net Payout</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {latestSlip ? `$${latestSlip.netSalary.toLocaleString()}` : "$0"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="size-3" />
                {latestSlip ? `${MONTH_NAMES[latestSlip.month - 1]} ${latestSlip.year}` : "No record"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Disbursed ({selectedYear})</p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                ${totalEarnedThisYear.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="size-3 text-primary" /> YTD Net Earnings
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <CreditCard className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Direct Deposit Status</p>
              <p className="text-2xl font-bold mt-1 text-foreground flex items-center gap-1.5 text-base">
                <ShieldCheck className="size-5 text-emerald-500" /> Verified Account
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Building className="size-3" /> Bank Transfer
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <ShieldCheck className="size-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-border/50">
          <CardTitle className="text-base font-semibold">Salary Statements ({selectedYear})</CardTitle>
          <CardDescription className="text-xs">
            Review detailed salary components and download high-resolution PDF statements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading salary statements...
            </div>
          ) : payslips.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No salary slips issued for {selectedYear} yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-xs">Basic Salary</TableHead>
                  <TableHead className="text-xs">Allowances</TableHead>
                  <TableHead className="text-xs">Deductions</TableHead>
                  <TableHead className="text-xs">Net Salary</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((slip) => {
                  const totalAllowances =
                    (slip.allowances?.housing || 0) +
                    (slip.allowances?.transport || 0) +
                    (slip.allowances?.medical || 0) +
                    (slip.allowances?.other || 0);

                  const totalDeductions =
                    (slip.deductions?.tax || 0) +
                    (slip.deductions?.pension || 0) +
                    (slip.deductions?.unpaidLeave || 0) +
                    (slip.deductions?.other || 0);

                  return (
                    <TableRow key={slip._id} className="hover:bg-muted/20">
                      <TableCell className="font-semibold text-xs">
                        {MONTH_NAMES[slip.month - 1]} {slip.year}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        ${slip.basicSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-emerald-600 dark:text-emerald-400">
                        +${totalAllowances.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-rose-500">
                        -${totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground">
                        ${slip.netSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {slip.paymentStatus === "paid" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                            <CheckCircle2 className="size-3" /> Paid
                          </Badge>
                        ) : slip.paymentStatus === "processing" ? (
                          <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 gap-1">
                            <Clock className="size-3" /> Processing
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                            <AlertCircle className="size-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayslip(slip)}
                          className="h-8 text-xs gap-1"
                        >
                          <Eye className="size-3.5" /> Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePDF(slip)}
                          className="h-8 text-xs gap-1 border-border/70"
                        >
                          <Download className="size-3.5 text-primary" /> PDF
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

      {/* Detailed Payslip Preview Modal */}
      {selectedPayslip && (
        <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-5 text-primary" />
                Payslip Breakdown — {MONTH_NAMES[selectedPayslip.month - 1]} {selectedPayslip.year}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Comprehensive itemized earnings, tax withholdings, and pension contributions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <span className="text-muted-foreground">Employee:</span>
                  <p className="font-semibold text-foreground text-sm">{currentUser?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-semibold capitalize text-emerald-600">{selectedPayslip.paymentStatus}</p>
                </div>
              </div>

              {/* Earnings breakdown */}
              <div className="space-y-2">
                <p className="font-semibold text-foreground border-b border-border pb-1">Earnings</p>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Base Salary</span>
                  <span className="font-medium text-foreground">${selectedPayslip.basicSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Housing Allowance</span>
                  <span>+${(selectedPayslip.allowances?.housing || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Transport Allowance</span>
                  <span>+${(selectedPayslip.allowances?.transport || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Medical Allowance</span>
                  <span>+${(selectedPayslip.allowances?.medical || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Deductions breakdown */}
              <div className="space-y-2 pt-2">
                <p className="font-semibold text-foreground border-b border-border pb-1">Deductions</p>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Tax Withholding</span>
                  <span className="text-rose-500">-${(selectedPayslip.deductions?.tax || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Pension / Social Fund</span>
                  <span className="text-rose-500">-${(selectedPayslip.deductions?.pension || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Total Net */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold">
                <span className="text-emerald-700 dark:text-emerald-300">Net Take-Home Pay</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-base">
                  ${selectedPayslip.netSalary.toLocaleString()}
                </span>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedPayslip(null)}>
                Close
              </Button>
              <Button size="sm" onClick={() => generatePDF(selectedPayslip)} className="gap-1.5">
                <Download className="size-4" /> Download Official PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
