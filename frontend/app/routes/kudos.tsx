import { useState } from "react";
import {
  HeartHandshake,
  Plus,
  Trophy,
  Sparkles,
  Flame,
  Award,
  Crown,
  Heart,
  Rocket,
  Lightbulb,
  Zap,
  Smile,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  useCreateKudos,
  useDeleteKudos,
  useKudosFeed,
  useKudosLeaderboard,
  useToggleReaction,
} from "@/hooks/use-kudos";
import { useUsers } from "@/hooks/use-users";
import type { KudosBadge } from "@/types";

const BADGE_CONFIG: Record<
  KudosBadge,
  { label: string; icon: string; bg: string; text: string; desc: string }
> = {
  problem_solver: {
    label: "Problem Solver",
    icon: "🧩",
    bg: "bg-blue-500/10 border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    desc: "Tackled a tough challenge with ingenuity",
  },
  team_player: {
    label: "Team Player",
    icon: "🤝",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    desc: "Supported teammates and lifted the group",
  },
  speed_demon: {
    label: "Speed Demon",
    icon: "⚡",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    desc: "Blazing execution and fast delivery",
  },
  innovator: {
    label: "Innovator",
    icon: "💡",
    bg: "bg-purple-500/10 border-purple-500/30",
    text: "text-purple-600 dark:text-purple-400",
    desc: "Brought creative, game-changing ideas",
  },
  culture_champion: {
    label: "Culture Champion",
    icon: "🌟",
    bg: "bg-pink-500/10 border-pink-500/30",
    text: "text-pink-600 dark:text-pink-400",
    desc: "Spread positivity, energy, and inclusion",
  },
  mentor: {
    label: "Mentor & Guide",
    icon: "🎓",
    bg: "bg-indigo-500/10 border-indigo-500/30",
    text: "text-indigo-600 dark:text-indigo-400",
    desc: "Empowered and taught colleagues",
  },
  customer_hero: {
    label: "Customer Hero",
    icon: "🏆",
    bg: "bg-rose-500/10 border-rose-500/30",
    text: "text-rose-600 dark:text-rose-400",
    desc: "Went above and beyond for users",
  },
};

const EMOJI_LIST = ["👏", "❤️", "🚀", "💡", "🔥"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function KudosPage() {
  const { data: currentUser } = useCurrentUser();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [badge, setBadge] = useState<KudosBadge>("team_player");
  const [message, setMessage] = useState("");

  const feedQuery = useKudosFeed();
  const leaderboardQuery = useKudosLeaderboard();
  const usersQuery = useUsers();

  const createMutation = useCreateKudos();
  const toggleReactionMutation = useToggleReaction();
  const deleteMutation = useDeleteKudos();

  const kudosPosts = feedQuery.data?.data || [];
  const leaderboard = leaderboardQuery.data?.leaderboard || [];
  const otherUsers = (usersQuery.data?.users || []).filter(
    (u) => u._id !== currentUser?._id
  );

  const handleSendKudos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !message.trim()) return;

    createMutation.mutate(
      { recipientId, badge, message },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setRecipientId("");
          setMessage("");
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
              <HeartHandshake className="size-6" />
            </span>
            Kudos & Recognition Wall
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Celebrate wins, award peer badges, and recognize colleagues who make work awesome.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-xs bg-primary">
          <Sparkles className="size-4" /> Give Kudos
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Flame className="size-4 text-amber-500" /> Recent Praise Feed
            </h2>
            <span className="text-xs text-muted-foreground">
              {kudosPosts.length} Celebrations
            </span>
          </div>

          {feedQuery.isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading kudos wall...
            </div>
          ) : kudosPosts.length === 0 ? (
            <Card className="border-border/80 py-16 text-center">
              <CardContent className="space-y-3">
                <HeartHandshake className="size-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold">No kudos shared yet!</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Be the first to brighten someone's day by sending a badge of recognition.
                </p>
                <Button size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2">
                  <Sparkles className="size-4 mr-1" /> Send First Kudos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {kudosPosts.map((post) => {
                const badgeConf = BADGE_CONFIG[post.badge] || BADGE_CONFIG.team_player;

                // Aggregate reaction counts
                const reactionCounts = EMOJI_LIST.map((emoji) => {
                  const count = post.reactions.filter((r) => r.emoji === emoji).length;
                  const hasReacted = post.reactions.some(
                    (r) => (r.user as any)?._id === currentUser?._id && r.emoji === emoji
                  );
                  return { emoji, count, hasReacted };
                });

                return (
                  <Card key={post._id} className="border-border/80 shadow-xs hover:border-border transition-all overflow-hidden">
                    <CardContent className="p-5 space-y-3.5">
                      {/* Sender -> Recipient Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 border border-border">
                            <AvatarFallback className="text-xs font-semibold">
                              {initials(post.sender.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-xs">
                            <p className="font-semibold text-foreground">
                              {post.sender.name}{" "}
                              <span className="font-normal text-muted-foreground">gave kudos to</span>{" "}
                              <span className="font-semibold text-primary">{post.recipient.name}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(post.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Badge Tag */}
                        <Badge className={`${badgeConf.bg} ${badgeConf.text} gap-1.5 px-2.5 py-1 text-xs font-semibold shadow-2xs`}>
                          <span>{badgeConf.icon}</span> {badgeConf.label}
                        </Badge>
                      </div>

                      {/* Praise Message */}
                      <p className="text-xs text-foreground/90 leading-relaxed pl-12 border-l-2 border-primary/20 italic">
                        "{post.message}"
                      </p>

                      {/* Emoji Reactions Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          {reactionCounts.map(({ emoji, count, hasReacted }) => (
                            <button
                              key={emoji}
                              onClick={() =>
                                toggleReactionMutation.mutate({
                                  id: post._id,
                                  emoji,
                                })
                              }
                              className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 transition-transform active:scale-95 border ${
                                hasReacted
                                  ? "bg-primary/15 border-primary/40 text-foreground font-bold"
                                  : "bg-muted/40 border-border/60 hover:bg-muted text-muted-foreground"
                              }`}
                            >
                              <span>{emoji}</span>
                              {count > 0 && <span className="text-[11px]">{count}</span>}
                            </button>
                          ))}
                        </div>

                        {(currentUser?.role === "admin" || currentUser?._id === post.sender._id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(post._id)}
                            className="size-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Gamification Leaderboard & Badges (Right col) */}
        <div className="space-y-4">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="py-4 px-5 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="size-4 text-amber-500" /> Champions of the Month
              </CardTitle>
              <CardDescription className="text-xs">
                Top peer-recognized teammates this cycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Leaderboard resets every month. Give kudos to see rankings!
                </p>
              ) : (
                leaderboard.map((item, idx) => (
                  <div
                    key={item.userId}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="size-9 border">
                          <AvatarFallback className="text-xs font-semibold">
                            {initials(item.name)}
                          </AvatarFallback>
                        </Avatar>
                        {idx === 0 && (
                          <Crown className="size-4 text-amber-500 absolute -top-2 -right-1 fill-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-foreground">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{item.role}</p>
                      </div>
                    </div>

                    <Badge variant="secondary" className="text-xs font-bold gap-1">
                      <Sparkles className="size-3 text-amber-500" /> {item.kudosReceived} Kudos
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Badges Guide */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-border/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                🏅 Recognition Badges Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {Object.entries(BADGE_CONFIG).map(([key, b]) => (
                <div key={key} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/20">
                  <span className="text-base mt-0.5">{b.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold ${b.text}`}>{b.label}</p>
                    <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Give Kudos Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-primary" /> Give Peer Kudos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select a colleague, choose an achievement badge, and write an encouraging note.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendKudos} className="space-y-4 py-2 text-xs">
            <div>
              <label className="text-muted-foreground font-medium">Select Teammate</label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
                className="w-full mt-1 bg-background border border-border rounded-lg p-2.5 outline-none text-xs"
              >
                <option value="">Choose colleague...</option>
                {otherUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-muted-foreground font-medium">Select Badge</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {Object.entries(BADGE_CONFIG).map(([key, b]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setBadge(key as KudosBadge)}
                    className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                      badge === key
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <span className="text-base">{b.icon}</span>
                    <span className="text-xs font-medium text-foreground">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-muted-foreground font-medium">Your Message / Shoutout</label>
              <Textarea
                placeholder="What did they do that was amazing? Give specific praise..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={3}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="flex justify-between pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={createMutation.isPending} className="gap-1.5">
                <Sparkles className="size-4" />
                {createMutation.isPending ? "Posting..." : "Post Kudos to Wall"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
