import { useState } from "react";
import {
  Network,
  Users,
  Building2,
  Crown,
  UserCheck,
  Search,
  CheckCircle2,
  Mail,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useOrgChart } from "@/hooks/use-org-chart";
import type { OrgDepartment, OrgNodeUser } from "@/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function OrgChartPage() {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<OrgNodeUser | null>(null);

  const { data, isLoading } = useOrgChart();

  const toggleDept = (deptId: string) => {
    setCollapsedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const filteredDepts = (data?.departments || []).filter((dept) => {
    if (selectedDept && dept._id !== selectedDept) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const matchesDept = dept.name.toLowerCase().includes(s);
    const matchesHeads = dept.heads.some((h) => h.name.toLowerCase().includes(s) || h.email.toLowerCase().includes(s));
    const matchesMembers = dept.members.some((m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s));
    return matchesDept || matchesHeads || matchesMembers;
  });

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Network className="size-6" />
            </span>
            Organizational Structure & Hierarchy
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual tree of company leadership, department heads, reporting lines, and active team workloads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 gap-1.5">
            <Users className="size-3.5" /> {data?.organization?.totalEmployees || 0} Members Across {data?.organization?.totalDepartments || 0} Departments
          </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 w-full">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employee, title, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs bg-background h-9"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="text-xs bg-background border border-border/70 rounded-lg px-3 py-2 outline-none h-9 w-full sm:w-auto"
        >
          <option value="">All Departments</option>
          {data?.departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name} ({d.totalMembers})
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Constructing organizational hierarchy tree...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tier 1: Executive & Leadership */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Crown className="size-4" /> Executive Leadership & Administration
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data?.leadership.map((admin) => (
                <div
                  key={admin._id}
                  onClick={() => setSelectedUser(admin)}
                  className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent hover:border-amber-500/60 transition-all cursor-pointer shadow-xs flex items-center gap-3.5 group"
                >
                  <Avatar className="size-11 border-2 border-amber-500/40">
                    <AvatarFallback className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs">
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-amber-600 transition-colors">
                        {admin.name}
                      </p>
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0">
                        Admin
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                      <ClipboardList className="size-3" /> {admin.activeTasks} Active Tasks
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Divider Connector */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/80" />
            </div>
            <div className="relative bg-background px-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary" /> Departments & Teams
            </div>
          </div>

          {/* Tier 2: Departments & Members */}
          <div className="space-y-6">
            {filteredDepts.map((dept) => {
              const isCollapsed = collapsedDepts[dept._id];

              return (
                <Card key={dept._id} className="border-border/80 shadow-xs overflow-hidden">
                  <div
                    onClick={() => toggleDept(dept._id)}
                    className="p-4 bg-muted/30 border-b border-border/50 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-foreground">{dept.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {dept.totalMembers} Members
                          </Badge>
                        </div>
                        {dept.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{dept.description}</p>
                        )}
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="size-8 p-0">
                      {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                  </div>

                  {!isCollapsed && (
                    <CardContent className="p-5 space-y-5">
                      {/* Department Heads */}
                      {dept.heads.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Shield className="size-3.5" /> Department Head / Lead
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {dept.heads.map((head) => (
                              <div
                                key={head._id}
                                onClick={() => setSelectedUser(head)}
                                className="p-3 rounded-lg border border-primary/30 bg-primary/5 hover:border-primary transition-all cursor-pointer flex items-center gap-3"
                              >
                                <Avatar className="size-9 border border-primary/30">
                                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                                    {initials(head.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-xs text-foreground truncate">{head.name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{head.email}</p>
                                  <span className="text-[10px] text-primary font-medium">
                                    {head.activeTasks} Active Tasks
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Team Members */}
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Users className="size-3.5" /> Team Members ({dept.members.length})
                        </p>
                        {dept.members.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-2">
                            No team members currently assigned to this department.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {dept.members.map((member) => (
                              <div
                                key={member._id}
                                onClick={() => setSelectedUser(member)}
                                className="p-3 rounded-lg border border-border/60 hover:border-border hover:bg-muted/20 transition-all cursor-pointer flex items-center gap-3 group"
                              >
                                <Avatar className="size-8 border border-border">
                                  <AvatarFallback className="text-xs font-medium">
                                    {initials(member.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-xs text-foreground truncate group-hover:text-primary transition-colors">
                                    {member.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                                  <span className="text-[10px] text-muted-foreground">
                                    {member.activeTasks} Tasks
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Unassigned employees if any */}
          {data?.unassigned && data.unassigned.length > 0 && (
            <Card className="border-border/80 bg-muted/10">
              <CardHeader className="py-3 px-4 border-b border-border/40">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Unassigned Personnel ({data.unassigned.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.unassigned.map((emp) => (
                    <div
                      key={emp._id}
                      onClick={() => setSelectedUser(emp)}
                      className="p-2.5 rounded-lg border border-border/60 bg-card flex items-center gap-2.5 cursor-pointer hover:border-primary"
                    >
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">{initials(emp.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium truncate">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{emp.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* User Quick Info Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-12 border-2 border-primary/40">
                  <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
                    {initials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-base font-semibold">{selectedUser.name}</DialogTitle>
                  <DialogDescription className="text-xs capitalize">{selectedUser.role} Profile</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5" /> Email
                  </span>
                  <span className="font-medium">{selectedUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ClipboardList className="size-3.5" /> Active Tasks
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedUser.activeTasks} Assigned
                  </Badge>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
