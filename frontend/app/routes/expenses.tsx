import { useState } from "react";
import {
  Receipt,
  Plus,
  Plane,
  Utensils,
  Laptop,
  GraduationCap,
  Package,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  Calendar,
  DollarSign,
  FileText,
  Trash2,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  useCreateExpense,
  useDeleteExpense,
  useMyExpenses,
} from "@/hooks/use-expenses";
import type { ExpenseCategory, AIAnalyzeReceiptResponse } from "@/types";

const CATEGORY_MAP: Record<ExpenseCategory, { label: string; icon: any; color: string }> = {
  travel: { label: "Travel & Flights", icon: Plane, color: "text-blue-500 bg-blue-500/10" },
  meals: { label: "Meals & Client Dining", icon: Utensils, color: "text-amber-500 bg-amber-500/10" },
  software: { label: "Software & SaaS", icon: Laptop, color: "text-indigo-500 bg-indigo-500/10" },
  training: { label: "Training & Courses", icon: GraduationCap, color: "text-emerald-500 bg-emerald-500/10" },
  hardware: { label: "Equipment & Hardware", icon: HardDrive, color: "text-purple-500 bg-purple-500/10" },
  office_supplies: { label: "Office Supplies", icon: Package, color: "text-rose-500 bg-rose-500/10" },
  other: { label: "Miscellaneous", icon: Receipt, color: "text-slate-500 bg-slate-500/10" },
};

const SAMPLE_RECEIPTS = [
  {
    label: "Uber Taxi",
    text: "Uber Technologies Inc.\nDate: 2026-03-04\nTrip from JFK Airport to Midtown Office\nSubtotal: $42.50\nTip: $8.00\nTotal: $50.50 USD",
  },
  {
    label: "AWS Hosting",
    text: "Amazon Web Services Inc.\nInvoice Date: 2026-03-01\nDescription: Monthly Production Cloud compute EC2 & S3\nAmount Due: $148.20 USD",
  },
  {
    label: "Client Lunch",
    text: "The Capital Grille Manhattan\nDate: 2026-03-05\n2x Executive Luncheon Prix Fixe\n1x Sparkling Water\nTotal: $86.40 USD",
  },
  {
    label: "React Conf",
    text: "React Summit Global Conf 2026\nAttendee: Engineering Ticket\nDate: 2026-03-02\nTotal Paid: $350.00 USD",
  },
];

export default function EmployeeExpensesPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);

  // AI OCR state
  const [showAiScanner, setShowAiScanner] = useState(false);
  const [rawReceiptText, setRawReceiptText] = useState("");
  const [aiAuditResult, setAiAuditResult] = useState<AIAnalyzeReceiptResponse["analysis"] | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("travel");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [receiptName, setReceiptName] = useState("");

  const { data, isLoading } = useMyExpenses(selectedStatus || undefined);
  const expenses = data?.expenses || [];

  const createMutation = useCreateExpense();
  const deleteMutation = useDeleteExpense();
  const aiAnalyzeMutation = useAIAnalyzeReceipt();

  const totalSubmitted = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalReimbursed = expenses
    .filter((e) => e.status === "reimbursed")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalPending = expenses
    .filter((e) => e.status === "pending" || e.status === "approved")
    .reduce((sum, e) => sum + e.amount, 0);

  const handleAiScan = () => {
    if (!rawReceiptText.trim()) return;
    aiAnalyzeMutation.mutate(
      { receiptText: rawReceiptText },
      {
        onSuccess: (result) => {
          setAiAuditResult(result);
          if (result.merchant) {
            setTitle(`${result.merchant} - ${result.category.replace("_", " ")}`);
          }
          if (result.category) {
            setCategory(result.category);
          }
          if (result.amount) {
            setAmount(result.amount.toString());
          }
          if (result.date) {
            setDate(result.date.slice(0, 10));
          }
          if (result.description) {
            setDescription(result.description);
          }
          if (result.merchant) {
            setReceiptName(`REC-${result.merchant.replace(/\s+/g, "").toUpperCase()}-${Date.now().toString().slice(-4)}.pdf`);
          }
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    createMutation.mutate(
      {
        title,
        category,
        amount: Number(amount),
        date,
        description,
        receiptName,
      },
      {
        onSuccess: () => {
          setIsSubmitOpen(false);
          setTitle("");
          setAmount("");
          setDescription("");
          setReceiptName("");
          setRawReceiptText("");
          setAiAuditResult(null);
          setShowAiScanner(false);
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
            Expense Reimbursements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit business expenses with AI receipt auto-fill, track approval progress, and receive direct reimbursements.
          </p>
        </div>

        <Button onClick={() => setIsSubmitOpen(true)} className="gap-2 shadow-xs">
          <Plus className="size-4" /> New Expense Claim
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Reimbursement</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                ${totalPending.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="size-3 text-amber-500" /> In Review / Approved
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
              <p className="text-xs font-medium text-muted-foreground">Total Reimbursed</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                ${totalReimbursed.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-500" /> Settled to Account
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Banknote className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Claims Filed</p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                ${totalSubmitted.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <FileText className="size-3" /> {expenses.length} Total Submissions
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Receipt className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { label: "All Claims", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Approved", value: "approved" },
          { label: "Reimbursed", value: "reimbursed" },
          { label: "Rejected", value: "rejected" },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={selectedStatus === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStatus(tab.value)}
            className="text-xs h-8 rounded-lg border-border/70"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Expenses Table */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading expense claims...
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No expense claims found. Click <strong>"New Expense Claim"</strong> to submit your receipts.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Expense Title</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Receipt / Note</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const cat = CATEGORY_MAP[expense.category] || CATEGORY_MAP.other;
                  const Icon = cat.icon;

                  return (
                    <TableRow key={expense._id} className="hover:bg-muted/20">
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-md ${cat.color}`}>
                            <Icon className="size-3.5" />
                          </span>
                          <span className="font-medium text-foreground">{cat.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {expense.title}
                        {expense.description && (
                          <p className="text-[11px] font-normal text-muted-foreground truncate max-w-xs">
                            {expense.description}
                          </p>
                        )}
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
                      <TableCell className="text-right">
                        {expense.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(expense._id)}
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Claim Modal */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Receipt className="size-5 text-primary" /> Submit Expense Claim
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide invoice or receipt details. You can paste receipt text to auto-populate with AI.
            </DialogDescription>
          </DialogHeader>

          {/* AI Scanner Toggle Header */}
          <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-4 animate-pulse" />
                </span>
                <span className="text-xs font-semibold text-foreground">AI Receipt Scanner & Policy Auditor</span>
              </div>
              <Button
                type="button"
                variant={showAiScanner ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1 border-primary/30"
                onClick={() => setShowAiScanner(!showAiScanner)}
              >
                <Zap className="size-3 text-primary" />
                {showAiScanner ? "Hide Scanner" : "✨ Fast OCR Scan"}
              </Button>
            </div>

            {showAiScanner && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">Quick demo paste:</span>
                  {SAMPLE_RECEIPTS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => setRawReceiptText(sample.text)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border/70 transition-colors"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Paste invoice text, receipt OCR snippet, or merchant breakdown here..."
                  value={rawReceiptText}
                  onChange={(e) => setRawReceiptText(e.target.value)}
                  rows={3}
                  className="text-xs bg-background/90"
                />

                <Button
                  type="button"
                  size="sm"
                  disabled={!rawReceiptText.trim() || aiAnalyzeMutation.isPending}
                  onClick={handleAiScan}
                  className="w-full h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-indigo-600 text-white"
                >
                  <Sparkles className="size-3.5" />
                  {aiAnalyzeMutation.isPending ? "Analyzing Receipt & Verifying Policy..." : "Extract & Auto-Fill Form"}
                </Button>

                {aiAuditResult && (
                  <div className="rounded-lg border border-border bg-background p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <ShieldCheck className="size-3.5 text-primary" /> AI Policy Verdict:
                      </span>
                      <Badge
                        className={
                          aiAuditResult.complianceRisk === "low"
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]"
                            : aiAuditResult.complianceRisk === "medium"
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]"
                            : "bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px]"
                        }
                      >
                        {aiAuditResult.complianceRisk === "low"
                          ? "✓ Low Risk (Compliant)"
                          : aiAuditResult.complianceRisk === "medium"
                          ? "⚠ Medium Review Needed"
                          : "🚨 High Risk Policy Flag"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{aiAuditResult.complianceNotes}</p>
                    {aiAuditResult.itemizedItems && aiAuditResult.itemizedItems.length > 0 && (
                      <div className="pt-1 border-t border-border/60 text-[11px] space-y-0.5">
                        <span className="font-medium text-muted-foreground">Line items extracted:</span>
                        {aiAuditResult.itemizedItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-muted-foreground">
                            <span>• {item.name}</span>
                            <span className="font-medium">${item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 py-1 text-xs">
            <div>
              <label className="text-muted-foreground font-medium">Expense Title</label>
              <Input
                placeholder="e.g. Flight to Tech Conference, Team Dinner"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full mt-1 bg-background border border-border rounded-lg p-2 outline-none"
                >
                  {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground font-medium">Amount ($ USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium">Date Incurred</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-muted-foreground font-medium">Receipt File / Ref #</label>
                <Input
                  placeholder="e.g. INV-2026-981.pdf"
                  value={receiptName}
                  onChange={(e) => setReceiptName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-muted-foreground font-medium">Description & Purpose</label>
              <Textarea
                placeholder="Add business justification or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="flex justify-between pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsSubmitOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={createMutation.isPending} className="gap-1.5">
                {createMutation.isPending ? "Submitting..." : "Submit Claim"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


