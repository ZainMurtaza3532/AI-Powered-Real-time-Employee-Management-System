import { useState } from "react";
import {
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  Banknote,
  Clock,
  Filter,
  Trash2,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
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
  useAIAnalyzeReceipt,
  useAllExpenses,
  useDeleteExpense,
  useUpdateExpenseStatus,
} from "@/hooks/use-expenses";
import type { Expense, ExpenseStatus, AIAnalyzeReceiptResponse } from "@/types";

export default function AdminExpensesPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [rejectingExpense, setRejectingExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // AI Audit Dialog State
  const [auditingExpense, setAuditingExpense] = useState<Expense | null>(null);
  const [auditResult, setAuditResult] = useState<AIAnalyzeReceiptResponse["analysis"] | null>(null);

  const expensesQuery = useAllExpenses({
    status: selectedStatus || undefined,
    search: search || undefined,
  });

  const updateStatusMutation = useUpdateExpenseStatus();
  const deleteMutation = useDeleteExpense();
  const aiAnalyzeMutation = useAIAnalyzeReceipt();

  const expenses = expensesQuery.data?.data || [];

  const totalPending = expenses
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalApproved = expenses
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalReimbursed = expenses
    .filter((e) => e.status === "reimbursed")
    .reduce((sum, e) => sum + e.amount, 0);

  const handleStartAudit = (expense: Expense) => {
    setAuditingExpense(expense);
    setAuditResult(null);

    const syntheticReceipt = `Merchant / Title: ${expense.title}
Category: ${expense.category}
Amount: $${expense.amount.toFixed(2)} ${expense.currency}
Employee: ${expense.employee?.name || "Staff"}
Description: ${expense.description || "Corporate expense reimbursement"}
Receipt File: ${expense.receiptName || "None attached"}`;

    aiAnalyzeMutation.mutate(
      { receiptText: syntheticReceipt },
      {
        onSuccess: (res) => {
          setAuditResult(res);
        },
      }
    );
  };

  const handleReject = () => {
    if (!rejectingExpense) return;
    updateStatusMutation.mutate(
      {
        id: rejectingExpense._id,
        status: "rejected",
        rejectionReason: rejectionReason.trim() || "Does not meet corporate expense policy guidelines",
      },
      {
        onSuccess: () => {
          setRejectingExpense(null);
          setRejectionReason("");
        },
      }
    );
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Receipt className="size-6" />
            </span>
            Expense Review & Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review submitted employee expense receipts with AI policy audits, authorize payouts, and reconcile corporate reimbursements.
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                ${totalPending.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="size-3 text-amber-500" /> Awaiting Manager Approval
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Approved for Payout</p>
              <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                ${totalApproved.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="size-3 text-blue-500" /> Ready to Reimburse
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Settled & Reimbursed</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                ${totalReimbursed.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Banknote className="size-3 text-emerald-500" /> Disbursed to Employees
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Banknote className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 w-full">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employee or expense title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs bg-background h-9"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="text-xs bg-background border border-border/70 rounded-lg px-3 py-2 outline-none h-9 w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="reimbursed">Reimbursed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-0">
          {expensesQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading expense claims...
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No expense claims found matching your filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Employee</TableHead>
                  <TableHead className="text-xs">Expense Details</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Receipt Ref</TableHead>
                  <TableHead className="text-xs text-right">Review Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense._id} className="hover:bg-muted/20">
                    <TableCell className="text-xs">
                      <p className="font-semibold text-foreground">{expense.employee?.name}</p>
                      <p className="text-[11px] text-muted-foreground">{expense.employee?.department?.name || "General"}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-semibold text-foreground">{expense.title}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">Category: {expense.category.replace("_", " ")}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-foreground">
                      ${expense.amount.toFixed(2)} {expense.currency}
                    </TableCell>
                    <TableCell className="text-xs">
                      {expense.status === "reimbursed" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                          <Banknote className="size-3" /> Reimbursed
                        </Badge>
                      ) : expense.status === "approved" ? (
                        <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 gap-1">
                          <CheckCircle2 className="size-3" /> Approved
                        </Badge>
                      ) : expense.status === "rejected" ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
                          <XCircle className="size-3" /> Rejected
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                          <Clock className="size-3" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {expense.receiptName ? (
                        <span className="font-mono text-[11px] text-primary">📄 {expense.receiptName}</span>
                      ) : (
                        <span>—</span>
                      )}
                      {expense.rejectionReason && (
                        <p className="text-[11px] text-destructive mt-0.5">Note: {expense.rejectionReason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {expense.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartAudit(expense)}
                            className="h-8 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1"
                          >
                            <Sparkles className="size-3 text-primary" /> AI Audit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: expense._id,
                                status: "approved",
                              })
                            }
                            className="h-8 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="size-3.5 mr-1" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRejectingExpense(expense)}
                            className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <XCircle className="size-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}

                      {expense.status === "approved" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: expense._id,
                              status: "reimbursed",
                            })
                          }
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <Banknote className="size-3.5" /> Mark Reimbursed
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(expense._id)}
                        className="h-8 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* AI Policy Audit Dialog */}
      {auditingExpense && (
        <Dialog open={!!auditingExpense} onOpenChange={() => setAuditingExpense(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> AI Policy Audit & Risk Assessment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Real-time compliance validation against standard corporate spending guidelines.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{auditingExpense.title}</span>
                  <span>${auditingExpense.amount.toFixed(2)} {auditingExpense.currency}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Submitted by {auditingExpense.employee?.name} • Category: {auditingExpense.category}
                </p>
              </div>

              {aiAnalyzeMutation.isPending ? (
                <div className="py-8 text-center space-y-2">
                  <Sparkles className="size-6 text-primary animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">Running AI policy compliance heuristics...</p>
                </div>
              ) : auditResult ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-primary" /> Compliance Score
                      </span>
                      <Badge
                        className={
                          auditResult.complianceRisk === "low"
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs"
                            : auditResult.complianceRisk === "medium"
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs"
                            : "bg-rose-500/15 text-rose-600 border-rose-500/30 text-xs"
                        }
                      >
                        {auditResult.complianceRisk === "low"
                          ? "✓ Low Risk (Compliant)"
                          : auditResult.complianceRisk === "medium"
                          ? "⚠ Moderate Review Required"
                          : "🚨 High Risk Policy Alert"}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {auditResult.complianceNotes}
                    </p>

                    {auditResult.itemizedItems && auditResult.itemizedItems.length > 0 && (
                      <div className="pt-2 border-t border-border/60 space-y-1">
                        <span className="font-medium text-foreground text-[11px]">Audit breakdown:</span>
                        {auditResult.itemizedItems.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] text-muted-foreground">
                            <span>• {it.name}</span>
                            <span>${it.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="flex justify-between gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAuditingExpense(null)}>
                Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const exp = auditingExpense;
                    setAuditingExpense(null);
                    setRejectingExpense(exp);
                    if (auditResult?.complianceNotes) {
                      setRejectionReason(auditResult.complianceNotes);
                    }
                  }}
                  className="h-8 text-xs"
                >
                  Reject Claim
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    updateStatusMutation.mutate(
                      { id: auditingExpense._id, status: "approved" },
                      {
                        onSuccess: () => setAuditingExpense(null),
                      }
                    );
                  }}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <CheckCircle2 className="size-3.5" /> Approve Claim
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rejection Dialog */}
      {rejectingExpense && (
        <Dialog open={!!rejectingExpense} onOpenChange={() => setRejectingExpense(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-destructive">
                <XCircle className="size-5" /> Reject Expense Claim
              </DialogTitle>
              <DialogDescription className="text-xs">
                Provide feedback or policy rationale to the employee for rejecting this claim.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p>
                Rejecting claim <strong>"{rejectingExpense.title}"</strong> (${rejectingExpense.amount.toFixed(2)}) from {rejectingExpense.employee?.name}.
              </p>
              <div>
                <label className="text-muted-foreground font-medium">Rejection Reason</label>
                <Input
                  placeholder="e.g. Receipt unreadable, exceeds per-diem limit, not pre-approved"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setRejectingExpense(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={updateStatusMutation.isPending}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
