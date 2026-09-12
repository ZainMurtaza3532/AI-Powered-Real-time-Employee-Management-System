import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Building,
  Check,
  Copy,
  Globe,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react";

import { DataTablePagination } from "@/components/globals/data-table-pagination";
import { DataTableSearch } from "@/components/globals/data-table-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateOfficeLocation,
  useDeleteOfficeLocation,
  useMyIp,
  useOfficeLocations,
  useUpdateOfficeLocation,
} from "@/hooks/use-office-locations";
import { usePagination } from "@/hooks/use-pagination";
import { getErrorMessage } from "@/lib/api";
import type { OfficeLocation, OfficeLocationInput } from "@/types";

const PAGE_SIZE = 10;

export default function AdminOfficeLocations() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const { page, setPage, offset, total, setTotal } = usePagination({
    limit: PAGE_SIZE,
    resetKey: search,
  });

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOfficeLocations({ search: search || undefined, limit: PAGE_SIZE, offset });

  const { data: myIpData, isLoading: isLoadingMyIp, refetch: refetchMyIp } = useMyIp();

  const officeLocations = data?.officeLocations ?? [];
  const [formLocation, setFormLocation] = useState<OfficeLocation | "new" | null>(null);
  const [deleting, setDeleting] = useState<OfficeLocation | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  useEffect(() => {
    setTotal(data?.total ?? 0);
  }, [data?.total, setTotal]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Compute metrics
  const totalIps = officeLocations.reduce((acc, loc) => acc + loc.ipAddresses.length, 0);
  const activeBranches = officeLocations.filter((loc) => loc.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building className="size-6 text-primary" /> Branch Office IP Whitelisting
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage physical office locations (Lahore, Karachi, Islamabad) and dynamic IP address whitelists to prevent attendance time-theft.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetch();
              void refetchMyIp();
            }}
            disabled={isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setFormLocation("new")}
            className="gap-2 bg-primary text-primary-foreground shadow-sm"
          >
            <Plus className="size-4" /> Add Branch Location
          </Button>
        </div>
      </div>

      {/* Top Banner: Detected Current IP & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Detected IP Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card md:col-span-2">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Wifi className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Current Detected IP
                  </span>
                  {myIpData?.isWhitelisted ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                      <ShieldCheck className="size-3" /> Whitelisted ({myIpData.branchName})
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                      <ShieldAlert className="size-3" /> Unwhitelisted Remote IP
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 font-mono text-xl font-bold text-foreground">
                  {isLoadingMyIp ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    <>
                      <span>{myIpData?.ip || "127.0.0.1"}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(myIpData?.ip || "127.0.0.1")}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        title="Copy IP"
                      >
                        {copiedIp === myIpData?.ip ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Extracted via cloud proxy headers (x-forwarded-for) and normalized for Vercel edge deployment.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (myIpData?.ip) {
                  setFormLocation("new");
                }
              }}
              className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="size-3.5" /> Whitelist Current IP
            </Button>
          </CardContent>
        </Card>

        {/* Quick Stat Pill */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Whitelist Metrics
              </span>
              <Globe className="size-4 text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-center">
              <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                <p className="text-2xl font-bold text-foreground">{officeLocations.length}</p>
                <p className="text-[11px] text-muted-foreground">Total Branches</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/40 border border-border/50">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeBranches}</p>
                <p className="text-[11px] text-muted-foreground">Active Enforced</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Configured Office Branches</CardTitle>
              <CardDescription>
                Punches matching these branch IPs are classified as <strong>In Office</strong>. Unrecognized IPs fallback to <strong>Remote/WFH</strong> and trigger manager review.
              </CardDescription>
            </div>
            <DataTableSearch
              value={search}
              onValueChange={setSearch}
              placeholder="Search branch name..."
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isPending ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error loading office locations</AlertTitle>
                <AlertDescription>{getErrorMessage(error)}</AlertDescription>
              </Alert>
            </div>
          ) : officeLocations.length === 0 ? (
            <div className="py-12">
              <Empty>
                <EmptyMedia>
                  <Building className="size-10 text-muted-foreground" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No office locations found</EmptyTitle>
                  <EmptyDescription>
                    {search
                      ? `No branch locations match "${search}".`
                      : "No office branches configured yet. Add your first branch location to enable IP whitelisting."}
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  onClick={() => setFormLocation("new")}
                  className="mt-4 gap-2"
                >
                  <Plus className="size-4" /> Add Branch Location
                </Button>
              </Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[220px]">Branch Office</TableHead>
                    <TableHead>Whitelisted IP Addresses / Subnets</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officeLocations.map((loc) => (
                    <TableRow key={loc._id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="size-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground">{loc.branchName}</p>
                            {loc.address && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{loc.address}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {loc.ipAddresses.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">No IPs assigned</span>
                          ) : (
                            loc.ipAddresses.map((ip) => (
                              <Badge
                                key={ip}
                                variant="secondary"
                                className="font-mono text-xs px-2 py-0.5 bg-muted border border-border/60 hover:bg-muted/80 gap-1.5 group cursor-pointer"
                                onClick={() => copyToClipboard(ip)}
                                title="Click to copy IP"
                              >
                                <span>{ip}</span>
                                {copiedIp === ip ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3 text-muted-foreground group-hover:text-foreground opacity-60 group-hover:opacity-100" />
                                )}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {loc.isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
                            🟢 Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-border">
                            ⚪ Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormLocation(loc)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit branch"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(loc)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete branch"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="border-t border-border/60 p-4">
            <DataTablePagination
              page={page}
              limit={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      {formLocation && (
        <OfficeLocationFormDialog
          location={formLocation === "new" ? null : formLocation}
          initialIp={formLocation === "new" ? myIpData?.ip : undefined}
          open={Boolean(formLocation)}
          onOpenChange={(open) => !open && setFormLocation(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleting && (
        <DeleteLocationDialog
          location={deleting}
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Location Modal with IP Chip Management
// ---------------------------------------------------------------------------

function OfficeLocationFormDialog({
  location,
  initialIp,
  open,
  onOpenChange,
}: {
  location: OfficeLocation | null;
  initialIp?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = Boolean(location);
  const createMutation = useCreateOfficeLocation();
  const updateMutation = useUpdateOfficeLocation();

  const [branchName, setBranchName] = useState(location?.branchName ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [ips, setIps] = useState<string[]>(
    location?.ipAddresses ?? (initialIp ? [initialIp] : ["127.0.0.1"])
  );
  const [newIpInput, setNewIpInput] = useState("");
  const [ipError, setIpError] = useState("");

  const handleAddIp = () => {
    const trimmed = newIpInput.trim();
    if (!trimmed) return;

    // Check duplicate
    if (ips.includes(trimmed)) {
      setIpError("This IP address is already in the list");
      return;
    }

    setIps([...ips, trimmed]);
    setNewIpInput("");
    setIpError("");
  };

  const handleRemoveIp = (indexToRemove: number) => {
    setIps(ips.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;

    if (isEditing && location) {
      await updateMutation.mutateAsync({
        id: location._id,
        branchName: branchName.trim(),
        address: address.trim() || undefined,
        isActive,
        ipAddresses: ips,
      });
    } else {
      await createMutation.mutateAsync({
        branchName: branchName.trim(),
        address: address.trim() || undefined,
        isActive,
        ipAddresses: ips,
      });
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="size-5 text-primary" />
              {isEditing ? `Edit "${location?.branchName}"` : "Add Office Branch Location"}
            </DialogTitle>
            <DialogDescription>
              Configure the branch office details and authorized IP addresses for attendance validation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Branch Name */}
            <div className="space-y-1.5">
              <Label htmlFor="branchName">
                Branch Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branchName"
                placeholder="e.g. Lahore Head Office, Karachi Branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                required
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address">Physical Address / City</Label>
              <Input
                id="address"
                placeholder="e.g. Gulberg III, Main Boulevard, Lahore"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* Active Enforcement Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                  Enforce IP Whitelist
                </Label>
                <p className="text-xs text-muted-foreground">
                  When active, attendance punches matching these IPs are recognized as In-Office.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* IP Whitelist Management */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Authorized Public IP Addresses</Label>
                <span className="text-xs text-muted-foreground">{ips.length} configured</span>
              </div>

              {/* Add IP Input Bar */}
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 110.38.12.45 or 192.168.1.0/24"
                  value={newIpInput}
                  onChange={(e) => {
                    setNewIpInput(e.target.value);
                    if (ipError) setIpError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddIp();
                    }
                  }}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddIp}
                  className="shrink-0 gap-1"
                >
                  <Plus className="size-3.5" /> Add IP
                </Button>
              </div>

              {ipError && (
                <p className="text-xs text-destructive">{ipError}</p>
              )}

              {/* IP Tags Chip Container */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/30 min-h-[90px] flex flex-wrap gap-2 items-start content-start">
                {ips.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic w-full text-center py-4">
                    No IP addresses added yet. Add public IPs or CIDR blocks above.
                  </p>
                ) : (
                  ips.map((ip, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border font-mono text-xs shadow-2xs"
                    >
                      <span>{ip}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIp(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                        title="Remove IP"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: Supports single IPv4/IPv6 addresses (e.g. <code>182.180.160.10</code>), local loopback (<code>127.0.0.1</code>), or CIDR subnets (e.g. <code>192.168.1.0/24</code>).
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !branchName.trim()} className="gap-2">
              {isPending && <LoaderCircle className="size-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteLocationDialog({
  location,
  open,
  onOpenChange,
}: {
  location: OfficeLocation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteMutation = useDeleteOfficeLocation();

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(location._id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="size-5" /> Delete Branch Location
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{location.branchName}</strong>?
            This will permanently remove its {location.ipAddresses.length} whitelisted IP addresses from the system.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="gap-2"
          >
            {deleteMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Delete Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
