import { useState } from "react";
import {
  Target,
  Plus,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building,
  User,
  Sliders,
  Trash2,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useCreateOkr,
  useDeleteOkr,
  useOkrs,
  useUpdateOkr,
} from "@/hooks/use-okrs";
import type { KeyResult, Okr, OkrLevel } from "@/types";

export default function OkrsPage() {
  const { data: currentUser } = useCurrentUser();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Q1 2026");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New OKR form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<OkrLevel>("individual");
  const [period, setPeriod] = useState("Q1 2026");
  const [keyResults, setKeyResults] = useState<
    Array<{ title: string; targetValue: number; currentValue: number; unit: string }>
  >([
    { title: "Achieve milestone deliverables on time", targetValue: 100, currentValue: 0, unit: "%" },
  ]);

  const okrsQuery = useOkrs({
    period: selectedPeriod || undefined,
    level: selectedLevel || undefined,
  });

  const createMutation = useCreateOkr();
  const updateMutation = useUpdateOkr();
  const deleteMutation = useDeleteOkr();

  const okrs = okrsQuery.data?.okrs || [];

  const avgProgress =
    okrs.length > 0
      ? Math.round(okrs.reduce((sum, o) => sum + o.overallProgress, 0) / okrs.length)
      : 0;

  const completedCount = okrs.filter((o) => o.overallProgress >= 100).length;

  const handleAddKeyResult = () => {
    setKeyResults([
      ...keyResults,
      { title: "", targetValue: 100, currentValue: 0, unit: "%" },
    ]);
  };

  const handleRemoveKeyResult = (idx: number) => {
    setKeyResults(keyResults.filter((_, i) => i !== idx));
  };

  const handleCreateOkr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || keyResults.length === 0) return;

    createMutation.mutate(
      {
        title,
        description,
        period,
        level,
        keyResults,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setTitle("");
          setDescription("");
          setKeyResults([
            { title: "Achieve milestone deliverables on time", targetValue: 100, currentValue: 0, unit: "%" },
          ]);
        },
      }
    );
  };

  const handleUpdateKRValue = (okr: Okr, krIndex: number, newValue: number) => {
    const updatedKeyResults = [...okr.keyResults];
    const target = updatedKeyResults[krIndex].targetValue || 1;
    const progress = Math.min(100, Math.max(0, Math.round((newValue / target) * 100)));

    updatedKeyResults[krIndex] = {
      ...updatedKeyResults[krIndex],
      currentValue: newValue,
      progress,
      status: progress >= 100 ? "completed" : progress < 40 ? "at_risk" : "on_track",
    };

    updateMutation.mutate({
      id: okr._id,
      keyResults: updatedKeyResults,
    });
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Target className="size-6" />
            </span>
            Objectives & Key Results (OKRs)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track company-wide strategic objectives, team key results, and quarterly execution velocity.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-xs">
          <Plus className="size-4" /> Set New Objective
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Average Goal Velocity</p>
              <p className="text-2xl font-bold mt-1 text-primary">{avgProgress}%</p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="size-3 text-emerald-500" /> Overall Completion
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Target className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completed Objectives</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {completedCount} / {okrs.length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-500" /> 100% Target Met
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Period</p>
              <p className="text-xl font-bold mt-1 text-foreground">{selectedPeriod}</p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="size-3" /> Quarterly Cadence
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <Layers className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
        <div className="flex items-center gap-2">
          {["Q1 2026", "Q2 2026", "Q3 2026", "Annual 2026"].map((p) => (
            <Button
              key={p}
              variant={selectedPeriod === p ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(p)}
              className="text-xs h-8 border-border/70"
            >
              {p}
            </Button>
          ))}
        </div>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="text-xs bg-background border border-border/70 rounded-lg px-3 py-1.5 outline-none h-8"
        >
          <option value="">All Scopes (Company & Teams)</option>
          <option value="company">Company Objectives</option>
          <option value="department">Department OKRs</option>
          <option value="individual">Individual Goals</option>
        </select>
      </div>

      {/* OKR Cards List */}
      {okrsQuery.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading OKR objectives...
        </div>
      ) : okrs.length === 0 ? (
        <Card className="border-border/80 py-16 text-center">
          <CardContent className="space-y-3">
            <Target className="size-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold">No objectives found for {selectedPeriod}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Align your team around key outcomes by setting quarterly objectives and measurable key results.
            </p>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2">
              <Plus className="size-4 mr-1" /> Create First Objective
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {okrs.map((okr) => (
            <Card key={okr._id} className="border-border/80 shadow-xs overflow-hidden">
              <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          okr.level === "company"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : okr.level === "department"
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {okr.level} Level
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {okr.period}
                      </Badge>
                      {okr.department && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building className="size-3" /> {okr.department.name}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base font-semibold text-foreground mt-1">
                      {okr.title}
                    </CardTitle>
                    {okr.description && (
                      <CardDescription className="text-xs">{okr.description}</CardDescription>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Progress</span>
                      <p className="text-lg font-bold text-primary">{okr.overallProgress}%</p>
                    </div>
                    <div className="w-24">
                      <Progress value={okr.overallProgress} className="h-2" />
                    </div>
                    {(currentUser?.role === "admin" || currentUser?._id === okr.owner._id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(okr._id)}
                        className="size-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Key Results & Measurable Outcomes
                </p>

                <div className="space-y-3">
                  {okr.keyResults.map((kr, idx) => (
                    <div
                      key={kr._id || idx}
                      className="p-3.5 rounded-xl border border-border/60 bg-muted/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {kr.title}
                          </span>
                          {kr.status === "completed" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              Completed
                            </Badge>
                          ) : kr.status === "at_risk" ? (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                              At Risk
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px]">
                              On Track
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Current: <strong>{kr.currentValue}</strong> / Target: {kr.targetValue} {kr.unit} ({kr.progress}%)
                        </p>
                      </div>

                      {/* Interactive inline progress updater */}
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <input
                          type="range"
                          min={0}
                          max={kr.targetValue}
                          value={kr.currentValue}
                          onChange={(e) => handleUpdateKRValue(okr, idx, Number(e.target.value))}
                          className="w-32 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                        />
                        <span className="text-xs font-mono font-bold w-12 text-right">
                          {kr.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create OKR Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Target className="size-5 text-primary" /> Define Strategic Objective
            </DialogTitle>
            <DialogDescription className="text-xs">
              Set inspiring goals with measurable key results for your team or department.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOkr} className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="text-muted-foreground font-medium">Objective Title</label>
              <Input
                placeholder="e.g. Scale Platform Reliability to 99.99%"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="text-muted-foreground font-medium">Description</label>
              <Textarea
                placeholder="Why is this objective critical this quarter?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium">Scope Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as OkrLevel)}
                  className="w-full mt-1 bg-background border border-border rounded-lg p-2 outline-none"
                >
                  <option value="individual">Individual</option>
                  <option value="department">Department</option>
                  <option value="company">Company-wide</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground font-medium">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full mt-1 bg-background border border-border rounded-lg p-2 outline-none"
                >
                  <option value="Q1 2026">Q1 2026</option>
                  <option value="Q2 2026">Q2 2026</option>
                  <option value="Q3 2026">Q3 2026</option>
                  <option value="Annual 2026">Annual 2026</option>
                </select>
              </div>
            </div>

            {/* Key Results list builder */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">Key Results</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddKeyResult}
                  className="h-7 text-xs text-primary gap-1"
                >
                  <Plus className="size-3" /> Add KR
                </Button>
              </div>

              {keyResults.map((kr, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      placeholder="Key Result title..."
                      value={kr.title}
                      onChange={(e) => {
                        const updated = [...keyResults];
                        updated[idx].title = e.target.value;
                        setKeyResults(updated);
                      }}
                      required
                      className="text-xs bg-background"
                    />
                    {keyResults.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveKeyResult(idx)}
                        className="size-7 p-0 text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Target (e.g. 100)"
                      value={kr.targetValue}
                      onChange={(e) => {
                        const updated = [...keyResults];
                        updated[idx].targetValue = Number(e.target.value);
                        setKeyResults(updated);
                      }}
                      className="text-xs bg-background"
                    />
                    <Input
                      placeholder="Unit (e.g. %, users, $)"
                      value={kr.unit}
                      onChange={(e) => {
                        const updated = [...keyResults];
                        updated[idx].unit = e.target.value;
                        setKeyResults(updated);
                      }}
                      className="text-xs bg-background"
                    />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="flex justify-between pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={createMutation.isPending} className="gap-1.5">
                {createMutation.isPending ? "Creating..." : "Save Objective"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
