import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

import { DataTablePagination } from "@/components/globals/data-table-pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerateInsight, useInsights } from "@/hooks/use-ai-insights";
import { usePagination } from "@/hooks/use-pagination";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api";
import type { AiInsight } from "@/types";

import type { Route } from "./+types/ai-insights";

export function meta({}: Route.MetaArgs) {
  return [{ title: "AI Insights & Analytics | Employee Management System" }];
}

const PAGE_SIZE = 10;

const PERIOD_OPTIONS = [
  "Last 30 days",
  "Last 90 days",
  "This Quarter (Q3 2026)",
  "Year-to-Date (2026)",
  "Last 6 months",
];

const PRESET_CARDS = [
  {
    period: "Last 30 days",
    title: "Monthly Department Pulse",
    description: "Analyze shift compliance, task velocity, leave usage, and team sentiment over the past 30 days.",
    badge: "⚡ Quick Pulse",
  },
  {
    period: "This Quarter (Q3 2026)",
    title: "Quarterly Performance & OKR Review",
    description: "Deep dive into OKR progress, sprint delivery, peer recognition, and burnout risk indicators.",
    badge: "📊 Quarterly",
  },
  {
    period: "Year-to-Date (2026)",
    title: "Annual Operational Health Audit",
    description: "Comprehensive executive analysis across attendance reliability, retention signals, and leadership action items.",
    badge: "📈 Annual Audit",
  },
];

/**
 * Head AI insights: generate department-scoped insights and view past results.
 */
export default function HeadAiInsights() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { page, setPage, offset, total, setTotal } = usePagination({
    limit: PAGE_SIZE,
    resetKey: `${search}-${statusFilter}`,
  });
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInsights({ limit: PAGE_SIZE, offset });
  const generate = useGenerateInsight();
  const insights = data?.insights ?? [];

  const [generateOpen, setGenerateOpen] = useState(false);
  const [viewing, setViewing] = useState<AiInsight | null>(null);

  useEffect(() => {
    setTotal(data?.total ?? 0);
  }, [data?.total, setTotal]);

  const filteredInsights = insights.filter((i) => {
    const matchesSearch =
      (i.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.summary || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.period || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const completedCount = insights.filter((i) => i.status === "completed").length;
  const generatingCount = insights.filter((i) => i.status === "generating" || i.status === "pending").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            Department AI Insights & Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data-driven strategic intelligence synthesized from attendance records, task completion velocity, appraisal ratings, and team sentiment.
          </p>
        </div>
        <Button onClick={() => setGenerateOpen(true)} className="gap-2 shadow-sm">
          <Sparkles className="size-4" />
          Generate New Insight
        </Button>
      </div>

      {/* KPI Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-border/70 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Total Reports</span>
            <Brain className="size-3.5 text-primary" />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-foreground font-mono">
            {total}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Department scope</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Completed</span>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
            {completedCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ready for review</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Generating</span>
            <LoaderCircle className={`size-3.5 text-amber-500 ${generatingCount > 0 ? "animate-spin" : ""}`} />
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-amber-600 dark:text-amber-400 font-mono">
            {generatingCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">In real-time progress</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>AI Model Engine</span>
            <Zap className="size-3.5 text-primary" />
          </p>
          <p className="text-sm font-bold tracking-tight mt-2 text-primary">
            Gemini 2.5 Flash
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Multi-source synthesis</p>
        </Card>
      </div>

      {/* 1-Click Quick Generation Preset Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Zap className="size-3.5 text-primary" /> Quick 1-Click Insight Presets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESET_CARDS.map((preset) => (
            <Card
              key={preset.period}
              className="p-4 border-border/70 hover:border-primary/50 transition-all cursor-pointer bg-card/60 hover:bg-card shadow-xs flex flex-col justify-between space-y-3 group"
              onClick={() => {
                if (!generate.isPending) {
                  generate.mutate({ period: preset.period });
                }
              }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    {preset.badge}
                  </Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="font-bold text-sm text-foreground">{preset.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{preset.description}</p>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">Period: {preset.period}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/20">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="size-3" /> Status:
          </span>
          {["all", "completed", "generating", "failed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search reports by title or period..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Insight List */}
      <div className="space-y-4">
        {isPending ? (
          <InsightListSkeleton />
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t load insights</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {getErrorMessage(error)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isRefetching}
              >
                {isRefetching ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : filteredInsights.length > 0 ? (
          <>
            <div className="grid gap-3">
              {filteredInsights.map((insight) => (
                <InsightCard
                  key={insight._id}
                  insight={insight}
                  onView={() => setViewing(insight)}
                />
              ))}
            </div>
            {total > PAGE_SIZE && (
              <DataTablePagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Brain />
              </EmptyMedia>
              <EmptyTitle>No AI Insights Found</EmptyTitle>
              <EmptyDescription>
                {search || statusFilter !== "all"
                  ? "No insights match your active search filters."
                  : "Generate your first strategic AI insight report for your department using the presets above or the custom generator."}
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setGenerateOpen(true)} className="gap-2">
              <Sparkles className="size-4" />
              Generate insight
            </Button>
          </Empty>
        )}
      </div>

      <GenerateInsightDialog
        open={generateOpen}
        onOpenChange={(open) => {
          if (!open) setGenerateOpen(false);
        }}
      />
      <InsightDetailDialog
        insight={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  AiInsight["status"],
  { label: string; icon: typeof Clock; variant: "default" | "secondary" | "destructive" | "outline"; badgeClass: string }
> = {
  pending: {
    label: "Queued",
    icon: Clock,
    variant: "outline",
    badgeClass: "bg-muted text-muted-foreground",
  },
  generating: {
    label: "Generating Analysis…",
    icon: LoaderCircle,
    variant: "secondary",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    variant: "default",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    variant: "destructive",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

function InsightCard({
  insight,
  onView,
}: {
  insight: AiInsight;
  onView: () => void;
}) {
  const meta = STATUS_META[insight.status];
  const Icon = meta.icon;

  return (
    <Card className="transition-all hover:bg-muted/30 border-border/80 shadow-xs">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-semibold text-foreground truncate">
              {insight.title ?? "Generating Strategic Insight Analysis…"}
            </h3>
            <Badge variant={meta.variant} className={`gap-1 text-[11px] ${meta.badgeClass}`}>
              <Icon
                className={`size-3 ${insight.status === "generating" ? "animate-spin" : ""}`}
              />
              {meta.label}
            </Badge>
          </div>
          {insight.summary ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {insight.summary}
            </p>
          ) : insight.status === "generating" ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
              Synthesizing attendance records, tasks velocity, and feedback metrics in real-time…
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>Period: <strong>{insight.period}</strong></span>
            <span>&bull;</span>
            <span>
              Generated: {new Date(insight.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </p>
          {insight.error && (
            <p className="text-xs text-destructive">{insight.error}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            disabled={insight.status !== "completed"}
            className="gap-1.5 h-8 text-xs font-semibold"
          >
            <Eye className="size-3.5" />
            View Full Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function InsightListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} aria-busy="true" aria-label="Loading insight">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generate Insight Dialog
// ---------------------------------------------------------------------------

function GenerateInsightDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const generate = useGenerateInsight();
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0]);
  const [customPeriod, setCustomPeriod] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setPeriod(PERIOD_OPTIONS[0]);
      setCustomPeriod("");
      setUseCustom(false);
      setSubmitted(false);
    }
  }, [open]);

  const effectivePeriod = useCustom ? customPeriod.trim() : period;
  const periodInvalid = submitted && !effectivePeriod;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!effectivePeriod) return;

    generate.mutate(
      { period: effectivePeriod },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Generate Strategic AI Insight
          </DialogTitle>
          <DialogDescription className="text-xs">
            The AI engine synthesizes department attendance consistency, sprint task delivery, leave patterns, and appraisal scores to produce an executive report.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Select Target Period</Label>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant={!useCustom && period === opt ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setPeriod(opt);
                    setUseCustom(false);
                  }}
                  className="text-xs h-7"
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-period" className="text-xs font-semibold">Or Enter Custom Period / Milestone</Label>
            <Input
              id="custom-period"
              value={customPeriod}
              onChange={(e) => {
                setCustomPeriod(e.target.value);
                setUseCustom(true);
              }}
              placeholder="e.g. Q3 2026, Summer Release Sprint, July 2026"
              className="text-xs h-8 font-mono"
              aria-invalid={periodInvalid}
            />
            {periodInvalid && (
              <p className="text-xs text-destructive">
                Please select or enter a time period.
              </p>
            )}
          </div>

          {generate.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>{getErrorMessage(generate.error)}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generate.isPending}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={generate.isPending} className="h-8 text-xs gap-1.5 font-semibold">
              {generate.isPending ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {generate.isPending ? "Starting Analysis…" : "Generate Report Now"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Insight Detail Dialog with Markdown, Tables & Download
// ---------------------------------------------------------------------------

function InsightDetailDialog({
  insight,
  onOpenChange,
}: {
  insight: AiInsight | null;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const open = insight !== null;

  const handleCopy = () => {
    if (!insight?.content) return;
    const fullText = `# ${insight.title}\n\n**Period:** ${insight.period}\n**Summary:** ${insight.summary || ""}\n\n${insight.content}`;
    void navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Report copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!insight?.content) return;
    const fullText = `# ${insight.title}\n\n**Period:** ${insight.period}\n**Generated:** ${new Date(insight.createdAt).toLocaleDateString()}\n**Summary:** ${insight.summary || ""}\n\n${insight.content}`;
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-insight-${insight.period.replace(/\s+/g, "-").toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Markdown report downloaded!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {insight && (
          <>
            <DialogHeader className="border-b border-border/60 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_META[insight.status].variant} className="text-xs">
                    {STATUS_META[insight.status].label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {insight.period}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1">
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 text-xs gap-1">
                    <Download className="size-3" /> Download .md
                  </Button>
                </div>
              </div>

              <DialogTitle className="text-lg font-bold mt-2">{insight.title}</DialogTitle>
              <DialogDescription className="text-xs">
                Generated on{" "}
                {new Date(insight.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </DialogDescription>
            </DialogHeader>

            {/* Summary Banner */}
            {insight.summary && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Executive Takeaway
                </p>
                <p className="text-sm font-medium text-foreground">
                  {insight.summary}
                </p>
              </div>
            )}

            {/* Markdown Report Content */}
            {insight.content && (
              <div className="space-y-3 text-xs leading-relaxed text-foreground/90">
                {insight.content.split("\n\n").map((block, idx) => {
                  if (block.startsWith("## ")) {
                    return (
                      <h2
                        key={idx}
                        className="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/40 flex items-center gap-2"
                      >
                        {block.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (block.startsWith("### ")) {
                    return (
                      <h3 key={idx} className="text-sm font-semibold text-foreground mt-3 mb-1">
                        {block.replace("### ", "")}
                      </h3>
                    );
                  }

                  // Table rendering
                  if (block.startsWith("|")) {
                    const rows = block.split("\n").filter((r) => !r.includes("---") && r.trim().length > 0);
                    return (
                      <div key={idx} className="my-2.5 overflow-x-auto rounded-lg border border-border bg-card">
                        <table className="w-full text-xs text-left">
                          <tbody>
                            {rows.map((row, rIdx) => {
                              const cells = row.split("|").filter((c) => c.trim().length > 0);
                              return (
                                <tr key={rIdx} className={rIdx === 0 ? "bg-muted/70 font-semibold border-b border-border" : "border-b border-border/40 hover:bg-muted/20"}>
                                  {cells.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-2 whitespace-nowrap">
                                      {cell.trim().replace(/\*\*/g, "")}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  // Code block rendering
                  if (block.startsWith("```")) {
                    const code = block.replace(/```[a-z]*\n?|```/g, "");
                    return (
                      <pre key={idx} className="p-3 rounded-lg bg-muted/80 text-foreground font-mono text-[11px] overflow-x-auto my-2 border border-border/60">
                        {code}
                      </pre>
                    );
                  }

                  // Bullet lists
                  if (block.startsWith("- ") || block.startsWith("* ")) {
                    return (
                      <ul key={idx} className="list-disc pl-5 space-y-1.5 text-xs text-foreground/90">
                        {block.split("\n").map((item, iIdx) => (
                          <li key={iIdx}>{renderInlineFormatting(item.replace(/^[-*] /, ""))}</li>
                        ))}
                      </ul>
                    );
                  }

                  // Numbered lists
                  if (/^\d+\.\s/.test(block)) {
                    return (
                      <ol key={idx} className="list-decimal pl-5 space-y-1.5 text-xs text-foreground/90">
                        {block.split("\n").map((item, iIdx) => (
                          <li key={iIdx}>{renderInlineFormatting(item.replace(/^\d+\.\s/, ""))}</li>
                        ))}
                      </ol>
                    );
                  }

                  // Divider
                  if (block.trim() === "---") {
                    return <hr key={idx} className="border-border/60 my-2" />;
                  }

                  return (
                    <p key={idx} className="text-xs leading-relaxed whitespace-pre-line">
                      {renderInlineFormatting(block)}
                    </p>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Renders **bold** and `code` inline formatting. */
function renderInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
