import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Building2,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Sparkles,
} from "lucide-react";

import { DataTablePagination } from "@/components/globals/data-table-pagination";
import { DataTableSearch } from "@/components/globals/data-table-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useAIDraftAnnouncement,
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "@/hooks/use-announcements";

import { useCurrentUser } from "@/hooks/use-auth";
import { useDepartments } from "@/hooks/use-departments";
import { usePagination } from "@/hooks/use-pagination";
import { getErrorMessage } from "@/lib/api";
import type { Announcement } from "@/types";

import type { Route } from "./+types/announcements";

/** Sentinel for the admin department combobox's "no department" option. */
const NO_DEPARTMENT = "__none__";

const PAGE_SIZE = 12;

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Announcements | Employee Management System" }];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Department announcements, rendered as a card grid (never a table).
 *
 * - Employees: read-only — see their department's announcements.
 * - Heads: read + create + edit (no delete) for their department.
 * - Admins: read + create + edit + delete for any department.
 */
export default function Announcements() {
  const { data: currentUser } = useCurrentUser();
  const role = currentUser?.role;
  const canManage = role === "head" || role === "admin";
  const isAdmin = role === "admin";
  const noDepartment = !isAdmin && !currentUser?.department;

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
  } = useAnnouncements({ search: search || undefined, limit: PAGE_SIZE, offset });
  const announcements = data?.announcements;

  useEffect(() => {
    setTotal(data?.total ?? 0);
  }, [data?.total, setTotal]);

  const [formAnnouncement, setFormAnnouncement] = useState<Announcement | "new" | null>(null);
  const [reading, setReading] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            Announcements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Post and manage announcements for any department."
              : "Updates from your department head."}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setFormAnnouncement("new")}>
            <Plus />
            New announcement
          </Button>
        )}
      </header>

      <div className="mt-8 space-y-4">
        {noDepartment ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Megaphone />
              </EmptyMedia>
              <EmptyTitle>No department assigned</EmptyTitle>
              <EmptyDescription>
                You&apos;re not assigned to a department yet, so there are no announcements to
                show. Ask an admin to assign you to a department.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isPending ? (
          <AnnouncementGridSkeleton />
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t load announcements</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {getErrorMessage(error)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isRefetching}
              >
                {isRefetching ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {(total > 0 || search !== "") && (
              <DataTableSearch
                value={search}
                onValueChange={setSearch}
                placeholder="Search announcements…"
              />
            )}
            {total > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {announcements?.map((announcement) => (
                    <AnnouncementCard
                      key={announcement._id}
                      announcement={announcement}
                      canEdit={canManage}
                      canDelete={isAdmin}
                      onRead={() => setReading(announcement)}
                      onEdit={() => setFormAnnouncement(announcement)}
                      onDelete={() => setDeleting(announcement)}
                    />
                  ))}
                </div>
                <DataTablePagination
                  page={page}
                  limit={PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                />
              </>
            ) : search !== "" ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Megaphone />
                  </EmptyMedia>
                  <EmptyTitle>No matching announcements</EmptyTitle>
                  <EmptyDescription>
                    No announcements match &ldquo;{search}&rdquo;. Try a different title or
                    keyword.
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              </Empty>
            ) : (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Megaphone />
                  </EmptyMedia>
                  <EmptyTitle>No announcements yet</EmptyTitle>
                  <EmptyDescription>
                    {canManage
                      ? "Post your first announcement to reach your department."
                      : "There are no announcements for your department yet."}
                  </EmptyDescription>
                </EmptyHeader>
                {canManage && (
                  <Button onClick={() => setFormAnnouncement("new")}>
                    <Plus />
                    New announcement
                  </Button>
                )}
              </Empty>
            )}
          </>
        )}
      </div>

      <AnnouncementFormDialog
        open={formAnnouncement !== null}
        announcement={formAnnouncement === "new" ? null : formAnnouncement}
        onOpenChange={(open) => {
          if (!open) setFormAnnouncement(null);
        }}
      />
      <ReadAnnouncementDialog
        announcement={reading}
        onOpenChange={(open) => {
          if (!open) setReading(null);
        }}
      />
      <DeleteAnnouncementDialog
        announcement={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function AnnouncementCard({
  announcement,
  canEdit,
  canDelete,
  onRead,
  onEdit,
  onDelete,
}: {
  announcement: Announcement;
  canEdit: boolean;
  canDelete: boolean;
  onRead: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="shrink-0 capitalize">
            <Building2 data-icon="inline-start" />
            {announcement.department.name}
          </Badge>
          <span className="shrink-0 text-xs text-muted-foreground">
            {format(new Date(announcement.createdAt), "MMM d, yyyy")}
          </span>
        </div>
        <h2 className="font-heading text-base font-semibold leading-snug text-foreground">
          {announcement.title}
        </h2>
        <p className="line-clamp-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {announcement.body}
        </p>
        <button
          type="button"
          onClick={onRead}
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Read more
        </button>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-semibold text-muted-foreground">
            {initials(announcement.author.name)}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {announcement.author.name}
          </span>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                aria-label={`Edit ${announcement.title}`}
              >
                <Pencil />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                aria-label={`Delete ${announcement.title}`}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function AnnouncementGridSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading announcements"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnnouncementFormDialog({
  open,
  announcement,
  onOpenChange,
}: {
  open: boolean;
  /** null = creating a new announcement. */
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateAnnouncement();
  const update = useUpdateAnnouncement();
  const aiDraftMutation = useAIDraftAnnouncement();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const { data: departmentsData } = useDepartments();
  const isEdit = announcement !== null;
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [department, setDepartment] = useState<string>(NO_DEPARTMENT);
  const [submitted, setSubmitted] = useState(false);

  // AI Composer Assistant State
  const [showAiComposer, setShowAiComposer] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "enthusiastic" | "policy" | "alert">("professional");
  const [aiKeyPoints, setAiKeyPoints] = useState("");

  const departmentOptions = useMemo(
    () =>
      (departmentsData?.departments ?? []).map((item) => ({
        value: item._id,
        label: item.name,
      })),
    [departmentsData]
  );
  const selectedDepartment =
    department === NO_DEPARTMENT
      ? null
      : (departmentOptions.find((option) => option.value === department) ?? null);

  useEffect(() => {
    if (open) {
      setTitle(announcement?.title ?? "");
      setBody(announcement?.body ?? "");
      setDepartment(announcement?.department._id ?? NO_DEPARTMENT);
      setSubmitted(false);
      setShowAiComposer(false);
      setAiTopic("");
      setAiKeyPoints("");
    }
  }, [open, announcement]);

  const titleInvalid = submitted && title.trim() === "";
  const bodyInvalid = submitted && body.trim() === "";
  const departmentInvalid = submitted && isAdmin && department === NO_DEPARTMENT;

  const handleGenerateAiDraft = () => {
    if (!aiTopic.trim()) return;
    const points = aiKeyPoints
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    aiDraftMutation.mutate(
      {
        topic: aiTopic,
        tone: aiTone,
        keyPoints: points,
        targetAudience: selectedDepartment ? `${selectedDepartment.label} Team` : "All Team Members",
        departmentName: selectedDepartment?.label,
      },
      {
        onSuccess: (draft) => {
          setTitle(draft.title);
          setBody(draft.body);
          setShowAiComposer(false);
        },
      }
    );
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    if (!title.trim() || !body.trim()) return;
    if (isAdmin && department === NO_DEPARTMENT) return;

    const input = {
      title: title.trim(),
      body: body.trim(),
      ...(isAdmin ? { department } : {}),
    };

    if (isEdit && announcement) {
      update.mutate(
        { id: announcement._id, input },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      create.mutate(input, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEdit ? "Edit announcement" : "New announcement"}</DialogTitle>
            {!isEdit && (
              <Button
                type="button"
                variant={showAiComposer ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowAiComposer(!showAiComposer)}
                className="h-7 text-xs gap-1.5 border-primary/30 text-primary"
              >
                <Sparkles className="size-3.5" />
                {showAiComposer ? "Hide Assistant" : "✨ AI Composer"}
              </Button>
            )}
          </div>
          <DialogDescription>
            {isAdmin
              ? "Pick the department that should see this announcement."
              : "This will be visible to members of your department."}
          </DialogDescription>
        </DialogHeader>

        {/* AI Broadcast Composer Panel */}
        {showAiComposer && (
          <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> AI Broadcast Composer & Tone Polisher
              </span>
              <div className="flex items-center gap-1">
                {(["professional", "enthusiastic", "policy", "alert"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setAiTone(tone)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors capitalize ${
                      aiTone === tone
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <Label htmlFor="ai-topic" className="text-[11px] text-muted-foreground">
                  Announcement Topic / Goal
                </Label>
                <Input
                  id="ai-topic"
                  placeholder="e.g. Q3 Roadmap Review, Security Policy Update, Holiday Hours..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="mt-1 h-8 text-xs bg-background/90"
                />
              </div>

              <div>
                <Label htmlFor="ai-points" className="text-[11px] text-muted-foreground">
                  Key Points / Takeaways (One per line)
                </Label>
                <Textarea
                  id="ai-points"
                  placeholder="• Launch date scheduled for Oct 15&#10;• Mandatory training session Thursday&#10;• Review updated knowledge base docs"
                  value={aiKeyPoints}
                  onChange={(e) => setAiKeyPoints(e.target.value)}
                  rows={2}
                  className="mt-1 text-xs bg-background/90"
                />
              </div>

              <Button
                type="button"
                size="sm"
                disabled={!aiTopic.trim() || aiDraftMutation.isPending}
                onClick={handleGenerateAiDraft}
                className="w-full h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-indigo-600 text-white shadow-xs"
              >
                <Sparkles className="size-3.5" />
                {aiDraftMutation.isPending ? "Drafting & Formatting Broadcast..." : "✨ Generate Polished Broadcast"}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What's the update?"
              autoFocus={!showAiComposer}
              aria-invalid={titleInvalid}
              aria-describedby={titleInvalid ? "announcement-title-error" : undefined}
            />
            {titleInvalid && (
              <p id="announcement-title-error" className="text-xs text-destructive">
                A title is required.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="announcement-body">Message</Label>
            <Textarea
              id="announcement-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share the details with your department…"
              rows={6}
              aria-invalid={bodyInvalid}
              aria-describedby={bodyInvalid ? "announcement-body-error" : undefined}
            />
            {bodyInvalid && (
              <p id="announcement-body-error" className="text-xs text-destructive">
                A message is required.
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="announcement-department">Department</Label>
              <Combobox
                items={departmentOptions}
                value={selectedDepartment}
                onOpenChange={() => {}}
                onValueChange={(item) => setDepartment(item?.value ?? NO_DEPARTMENT)}
                autoHighlight
              >
                <ComboboxInput
                  id="announcement-department"
                  placeholder="Search departments…"
                  className="w-full"
                  showClear
                  aria-invalid={departmentInvalid}
                  aria-describedby={
                    departmentInvalid ? "announcement-department-error" : undefined
                  }
                />
                <ComboboxContent sideOffset={4}>
                  <ComboboxEmpty>No departments found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {departmentInvalid && (
                <p id="announcement-department-error" className="text-xs text-destructive">
                  Pick the department this announcement is for.
                </p>
              )}
            </div>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{isEdit ? "Update failed" : "Creation failed"}</AlertTitle>
              <AlertDescription>{getErrorMessage(error)}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : isEdit ? <Pencil /> : <Plus />}
              {isEdit ? "Save changes" : "Post announcement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Read dialog                                                         */
/* ------------------------------------------------------------------ */

function ReadAnnouncementDialog({
  announcement,
  onOpenChange,
}: {
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
}) {

  const open = announcement !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              <Building2 data-icon="inline-start" />
              {announcement?.department.name}
            </Badge>
            {announcement && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(announcement.createdAt), "MMM d, yyyy")}
              </span>
            )}
          </div>
          <DialogTitle>{announcement?.title}</DialogTitle>
          <DialogDescription>
            Posted by {announcement?.author.name}
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {announcement?.body}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Delete dialog (admin only)                                          */
/* ------------------------------------------------------------------ */

function DeleteAnnouncementDialog({
  announcement,
  onOpenChange,
}: {
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const del = useDeleteAnnouncement();
  const open = announcement !== null;

  function handleDelete() {
    if (!announcement) return;
    del.mutate(announcement._id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete announcement?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">&ldquo;{announcement?.title}&rdquo;</span>{" "}
            will be permanently removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {del.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t delete announcement</AlertTitle>
            <AlertDescription>{getErrorMessage(del.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
            {del.isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            {del.isPending ? "Deleting…" : "Delete announcement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
