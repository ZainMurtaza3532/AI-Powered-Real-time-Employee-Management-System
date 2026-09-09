import { useState, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Send,
  Bot,
  UserRound,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  Zap,
  CalendarDays,
  ClipboardList,
  Megaphone,
  HelpCircle,
  FileText,
  Clock,
  CreditCard,
  Target,
  Trophy,
  Receipt,
  MessageSquare,
  BarChart3,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Search,
  Copy,
  Check,
  Building2,
  Printer,
  FileDown,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import {
  useCopilotChat,
  useFlightRisk,
  useGenerate1on1Agenda,
  useGenerateExecutiveBriefing,
  useSkillsMatrix,
  type CopilotChatMessage,
} from "@/hooks/use-copilot";
import { useToast } from "@/hooks/use-toast";


interface QuickTopicPrompt {
  icon: typeof CalendarDays;
  label: string;
  category: string;
  text: string;
}

const QUICK_TOPIC_PROMPTS: QuickTopicPrompt[] = [
  {
    icon: Clock,
    label: "Today's Punch & Shift",
    category: "Attendance",
    text: "What is my current attendance status and how many hours have I logged today?",
  },
  {
    icon: CalendarDays,
    label: "My Leave Balance",
    category: "Leaves",
    text: "What is my current leave balance and allowance for this year?",
  },
  {
    icon: ClipboardList,
    label: "My Pending Tasks",
    category: "Tasks",
    text: "Can you summarize all my pending tasks, upcoming deadlines, and priorities?",
  },
  {
    icon: CreditCard,
    label: "Payroll & Payslips",
    category: "Payroll",
    text: "How does payroll calculation work and where can I view and download my payslips?",
  },
  {
    icon: Target,
    label: "Draft Performance Self-Review",
    category: "Performance",
    text: "Help me draft a comprehensive performance self-review highlighting teamwork, initiative, and key delivery milestones.",
  },
  {
    icon: Megaphone,
    label: "Draft Team Announcement",
    category: "Broadcast",
    text: "Write an inspiring company announcement welcoming everyone to the new quarter and outlining departmental goals.",
  },
  {
    icon: HelpCircle,
    label: "Draft Sick Leave Application",
    category: "Leaves",
    text: "Draft a polite and professional sick leave email to submit to my department head for 2 days.",
  },
  {
    icon: BookOpen,
    label: "Full Website Guide",
    category: "Guide",
    text: "Give me a comprehensive overview of all modules and tools available in this Employee Management System.",
  },
];

const PLATFORM_MODULES = [
  {
    id: "attendance",
    title: "Attendance & Punch Clock",
    link: "/attendance",
    icon: Clock,
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    description: "Live digital punch clock, shift stopwatch, 8-hour daily target gauge, office/remote toggle, and multi-horizon records (Daily, Weekly, Monthly, Yearly).",
    samplePrompt: "How does the attendance grace period and overtime calculation work?",
  },
  {
    id: "leaves",
    title: "Leaves & Time Off",
    link: "/leaves",
    icon: CalendarDays,
    color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    description: "Submit vacation, sick, and personal leave applications. Real-time approval workflow with automated email confirmations via Resend.",
    samplePrompt: "What is the policy for submitting annual vacation and sick leave requests?",
  },
  {
    id: "tasks",
    title: "Task Management",
    link: "/tasks",
    icon: ClipboardList,
    color: "text-purple-600 bg-purple-500/10 border-purple-500/20",
    description: "Assign work items with priority tags, deadlines, description notes, and submission reviews for team members.",
    samplePrompt: "Explain the complete task lifecycle from assignment to approval in EMS.",
  },
  {
    id: "payroll",
    title: "Payroll & Salary Slips",
    link: "/payroll",
    icon: CreditCard,
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    description: "Transparent compensation breakdowns including base salary, allowances, tax deductions, and 1-click PDF/CSV payslip downloads.",
    samplePrompt: "How are allowances and deductions calculated on my monthly payslip?",
  },
  {
    id: "performance",
    title: "Performance Reviews & OKRs",
    link: "/performance-reviews",
    icon: Target,
    color: "text-pink-600 bg-pink-500/10 border-pink-500/20",
    description: "Quarterly evaluations (1.0 to 5.0 rating scale), peer feedback, strengths assessment, and measurable OKRs.",
    samplePrompt: "Give me tips for writing an impactful self-evaluation for my performance appraisal.",
  },
  {
    id: "kudos",
    title: "Kudos & Recognition Wall",
    link: "/kudos",
    icon: Trophy,
    color: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",
    description: "Peer-to-peer appreciation badges (Above & Beyond, Team Player, Innovation Hero, Leadership Star, Customer Champion).",
    samplePrompt: "How do I give kudos to a teammate for exceptional project delivery?",
  },
  {
    id: "expenses",
    title: "Expense Claims & Reimbursements",
    link: "/expenses",
    icon: Receipt,
    color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20",
    description: "Corporate reimbursement tracking for travel, office supplies, client meals, and software with receipt verification.",
    samplePrompt: "What expense categories are eligible for corporate reimbursement?",
  },
  {
    id: "announcements",
    title: "Company Announcements & Feedback",
    link: "/announcements",
    icon: Megaphone,
    color: "text-orange-600 bg-orange-500/10 border-orange-500/20",
    description: "Broadcast company-wide or department updates with priority tags, plus an anonymous feedback suggestion box.",
    samplePrompt: "Help me write a concise department townhall invitation announcement.",
  },
  {
    id: "reports",
    title: "Reports & Export Center",
    link: "/reports",
    icon: BarChart3,
    color: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20",
    description: "Executive analytics and 1-click PDF/CSV reports across attendance, leaves, payroll, tasks, and company turnover.",
    samplePrompt: "What reports can I export for department audits and compliance?",
  },
];

export default function CopilotPage() {
  const { data: currentUser } = useCurrentUser();
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      role: "assistant",
      content: `### 🤖 Welcome to **EMS Copilot & AI Intelligence**!\n\nI am your AI workplace assistant, deeply trained on the entire Employee Management System. I have live, real-time context on your profile, today's punch status, active tasks, leave balances, and department operations.\n\nChoose a quick topic below or ask me anything about your workday, company policies, or request drafts!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useCopilotChat();
  const isPrivileged = currentUser?.role === "admin" || currentUser?.role === "head";
  const flightRiskQuery = useFlightRisk(isPrivileged);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatMutation.isPending]);

  const handleSend = (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || chatMutation.isPending) return;

    const newMessages: CopilotChatMessage[] = [
      ...messages,
      { role: "user", content: promptText },
    ];
    setMessages(newMessages);
    setInput("");

    chatMutation.mutate(
      {
        message: promptText,
        conversationHistory: newMessages,
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
        },
      }
    );
  };

  const filteredPrompts = useMemo(() => {
    if (activeCategory === "All") return QUICK_TOPIC_PROMPTS;
    return QUICK_TOPIC_PROMPTS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const formatMarkdown = (content: string) => {
    return (
      <div className="space-y-2 text-sm leading-relaxed prose dark:prose-invert max-w-none">
        {content.split("\n\n").map((paragraph, idx) => {
          // Render Headings
          if (paragraph.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-base font-semibold text-foreground mt-2 mb-1 flex items-center gap-2">
                {paragraph.replace("### ", "")}
              </h3>
            );
          }
          if (paragraph.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-lg font-bold text-foreground mt-3 mb-1">
                {paragraph.replace("## ", "")}
              </h2>
            );
          }

          // Render Tables
          if (paragraph.startsWith("|")) {
            const rows = paragraph.split("\n").filter((r) => !r.includes("---") && r.trim().length > 0);
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

          // Render Blockquotes
          if (paragraph.startsWith("> ")) {
            return (
              <blockquote key={idx} className="border-l-4 border-primary bg-primary/5 p-2.5 rounded-r-md text-xs text-muted-foreground my-2 space-y-1">
                {paragraph.replace(/^> /gm, "")}
              </blockquote>
            );
          }

          // Render Bullet Lists
          if (paragraph.startsWith("- ")) {
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1.5 text-xs text-foreground/90">
                {paragraph.split("\n").map((item, iIdx) => {
                  const itemText = item.replace(/^- /, "");
                  return (
                    <li key={iIdx}>
                      {renderInlineLinks(itemText)}
                    </li>
                  );
                })}
              </ul>
            );
          }

          // Render Numbered Lists
          if (/^\d+\.\s/.test(paragraph)) {
            return (
              <ol key={idx} className="list-decimal pl-5 space-y-1.5 text-xs text-foreground/90">
                {paragraph.split("\n").map((item, iIdx) => {
                  const itemText = item.replace(/^\d+\.\s/, "");
                  return (
                    <li key={iIdx}>
                      {renderInlineLinks(itemText)}
                    </li>
                  );
                })}
              </ol>
            );
          }

          // Regular Paragraph with Inline Links
          return (
            <p key={idx} className="text-xs whitespace-pre-line leading-relaxed">
              {renderInlineLinks(paragraph)}
            </p>
          );
        })}
      </div>
    );
  };

  // Helper to parse markdown links [Text](url) into clickable Router Links
  const renderInlineLinks = (text: string) => {
    const parts = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const label = match[1];
      const url = match[2];

      if (url.startsWith("/")) {
        parts.push(
          <Link
            key={match.index}
            to={url}
            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors mx-0.5"
          >
            {label} <ExternalLink className="size-3 inline shrink-0" />
          </Link>
        );
      } else {
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors mx-0.5"
          >
            {label} <ExternalLink className="size-3 inline shrink-0" />
          </a>
        );
      }
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "chat";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            EMS Copilot & AI Intelligence Suite
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trained on all EMS workflows, live attendance tracking, task intelligence, and organizational retention signals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 gap-1.5 font-medium">
            <Zap className="size-3.5 fill-primary" /> Multi-Model Gemini Engine
          </Badge>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full ${isPrivileged ? "max-w-4xl grid-cols-6" : "max-w-md grid-cols-2"}`}>
          <TabsTrigger value="chat" className="flex items-center gap-1.5 text-xs">
            <Bot className="size-3.5" /> Copilot Chat
          </TabsTrigger>
          {isPrivileged && (
            <TabsTrigger value="skills" className="flex items-center gap-1.5 text-xs">
              <Zap className="size-3.5 text-amber-500" /> Skills Matrix
            </TabsTrigger>
          )}
          {isPrivileged && (
            <TabsTrigger value="1on1" className="flex items-center gap-1.5 text-xs">
              <Target className="size-3.5" /> 1-on-1 Planner
            </TabsTrigger>
          )}
          {isPrivileged && (
            <TabsTrigger value="executive" className="flex items-center gap-1.5 text-xs">
              <BarChart3 className="size-3.5" /> Executive Brief
            </TabsTrigger>
          )}
          {isPrivileged && (
            <TabsTrigger value="flight-risk" className="flex items-center gap-1.5 text-xs">
              <TrendingDown className="size-3.5" /> Retention
            </TabsTrigger>
          )}
          <TabsTrigger value="guide" className="flex items-center gap-1.5 text-xs">
            <BookOpen className="size-3.5" /> Platform Guide
          </TabsTrigger>
        </TabsList>


        {/* Tab 1: AI Chat Assistant */}
        <TabsContent value="chat" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Chat Box */}
            <Card className="lg:col-span-3 border-border/80 shadow-sm flex flex-col h-[670px]">
              <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-foreground">Copilot Active with Live Context</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setMessages([
                      {
                        role: "assistant",
                        content: `### 🔄 Session reset!\n\nHow can I help you today? Choose any prompt or ask any platform question.`,
                      },
                    ])
                  }
                  className="h-7 text-xs gap-1 text-muted-foreground"
                >
                  <RefreshCw className="size-3" /> Clear Chat
                </Button>
              </CardHeader>

              {/* Chat Message Stream */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <Avatar className={`size-8 border ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <AvatarFallback className="text-xs font-semibold">
                        {msg.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4 text-primary" />}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-xs"
                          : "bg-muted/60 text-foreground border border-border/60 rounded-tl-xs"
                      }`}
                    >
                      {formatMarkdown(msg.content)}
                    </div>
                  </div>
                ))}

                {chatMutation.isPending && (
                  <div className="flex items-start gap-3">
                    <Avatar className="size-8 bg-muted border">
                      <AvatarFallback>
                        <Bot className="size-4 text-primary animate-spin" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/70 border border-border/60 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Sparkles className="size-3.5 animate-pulse text-primary" /> Analyzing platform workflows and live context…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input Footer */}
              <div className="p-3 border-t border-border/60 bg-background">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder="Ask EMS Copilot (e.g. 'What is my leave balance?', 'Show attendance summary', 'Draft announcement')..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 text-sm bg-muted/30 focus-visible:ring-1"
                    disabled={chatMutation.isPending}
                  />
                  <Button type="submit" disabled={!input.trim() || chatMutation.isPending} className="gap-1.5 shadow-sm">
                    <Send className="size-4" /> Send
                  </Button>
                </form>
              </div>
            </Card>

            {/* Side Panel: Quick Prompts & Context */}
            <div className="space-y-4">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ⚡ Smart Prompts
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <div className="flex flex-wrap gap-1 pb-2 border-b border-border/40 text-[10px]">
                    {["All", "Attendance", "Leaves", "Tasks", "Payroll"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                          activeCategory === cat
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                    {filteredPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(prompt.text)}
                        className="w-full text-left p-2 rounded-lg border border-border/50 hover:bg-accent/60 transition-colors flex items-start gap-2 group"
                      >
                        <prompt.icon className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors block truncate">
                            {prompt.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">
                            {prompt.text}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 shadow-sm bg-muted/10">
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ℹ️ Live Injected Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 text-xs space-y-2 text-muted-foreground">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span>User:</span> <strong className="text-foreground">{currentUser?.name}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span>Role:</span> <strong className="text-foreground capitalize">{currentUser?.role}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span>Live Stream:</span> <strong className="text-emerald-600 dark:text-emerald-400 font-medium">🟢 Connected</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>AI Engine:</span> <strong className="text-primary font-medium">Gemini 2.5 Flash</strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Interactive Platform Knowledge Guide */}
        <TabsContent value="guide" className="space-y-4 pt-2">
          <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> EMS Knowledge Base & Module Directory
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Explore every core workflow of the platform. Click any card to jump to the page or ask Copilot directly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORM_MODULES.map((mod) => (
              <Card key={mod.id} className="border-border/70 p-5 flex flex-col justify-between space-y-4 hover:border-border transition-all shadow-xs group">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`p-2 rounded-xl border ${mod.color}`}>
                      <mod.icon className="size-5" />
                    </span>
                    <Link
                      to={mod.link}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 opacity-80 group-hover:opacity-100"
                    >
                      Open Page <ArrowRight className="size-3" />
                    </Link>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => handleSend(mod.samplePrompt)}
                    className="w-full text-left p-2 rounded-lg bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-between"
                  >
                    <span className="truncate mr-2">💬 &ldquo;{mod.samplePrompt}&rdquo;</span>
                    <Sparkles className="size-3 text-primary shrink-0" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Flight Risk & Retention Predictor (Admin/Head only) */}
        {isPrivileged && (
          <TabsContent value="flight-risk" className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border/80">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Employees Analyzed</p>
                    <p className="text-2xl font-bold mt-1 font-mono">{flightRiskQuery.data?.totalAnalyzed || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                    <UserRound className="size-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-destructive">High Turnover Risk</p>
                    <p className="text-2xl font-bold text-destructive mt-1 font-mono">
                      {flightRiskQuery.data?.highRiskCount || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                    <ShieldAlert className="size-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Medium Risk</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                      {flightRiskQuery.data?.mediumRiskCount || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                    <AlertTriangle className="size-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Stable & Healthy</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                      {flightRiskQuery.data?.lowRiskCount || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="size-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Risk Profiles */}
            <Card className="border-border/80">
              <CardHeader className="py-4 px-6 border-b border-border/50">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingDown className="size-5 text-primary" /> Predictive Retention Profiles
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated sentiment, attendance dips, overdue workload, and appraisal ratings to proactively prevent employee turnover.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {flightRiskQuery.isLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Analyzing workforce signals...
                  </div>
                ) : !flightRiskQuery.data?.profiles.length ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No employee profiles to analyze yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flightRiskQuery.data.profiles.map((profile) => (
                      <div
                        key={profile.employeeId}
                        className="p-4 rounded-xl border border-border/70 hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{profile.name}</span>
                            <Badge
                              variant="outline"
                              className={
                                profile.riskLevel === "high"
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : profile.riskLevel === "medium"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              }
                            >
                              {profile.riskLevel === "high"
                                ? "🚨 High Flight Risk"
                                : profile.riskLevel === "medium"
                                ? "⚠️ Moderate Warning"
                                : "✓ Stable Engagement"}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({profile.riskScore}% risk factor)
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {profile.riskFactors.map((factor, fIdx) => (
                              <span
                                key={fIdx}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                              >
                                • {factor}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="md:text-right max-w-sm">
                          <p className="text-xs font-medium text-foreground">💡 Actionable Recommendation:</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{profile.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab: AI Skills Radar & Succession Planning Matrix */}
        {isPrivileged && (
          <TabsContent value="skills" className="space-y-4 pt-2">
            <SkillsMatrixTab />
          </TabsContent>
        )}

        {/* Tab 4: AI 1-on-1 Meeting & Career Progression Planner (Admin/Head only) */}
        {isPrivileged && (
          <TabsContent value="1on1" className="space-y-4 pt-2">
            <OneOnOnePlannerTab />
          </TabsContent>
        )}

        {/* Tab 5: AI Workforce Executive Briefing (Admin/Head only) */}
        {isPrivileged && (
          <TabsContent value="executive" className="space-y-4 pt-2">
            <ExecutiveBriefingTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🎯 1-on-1 Meeting Planner Component
// ---------------------------------------------------------------------------

function OneOnOnePlannerTab() {
  const toast = useToast();
  const { data: usersData, isPending: usersPending } = useUsers();
  const users = usersData?.users.filter((u) => u.role === "employee");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const generate1on1 = useGenerate1on1Agenda();
  const [copied, setCopied] = useState(false);

  const selectedUser = users?.find((u) => u._id === selectedUserId);

  const handleGenerate = () => {
    if (!selectedUserId) return;
    generate1on1.mutate({ employeeId: selectedUserId });
  };

  const handleCopy = () => {
    if (generate1on1.data?.agendaMarkdown) {
      navigator.clipboard.writeText(generate1on1.data.agendaMarkdown);
      setCopied(true);
      toast.success("1-on-1 Guide copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="size-5 text-primary" />
            AI 1-on-1 Meeting & Career Progression Copilot
          </CardTitle>
          <CardDescription className="text-xs">
            Synthesizes live attendance rates, completed deliverables, peer kudos, and recent performance evaluations into a tailored managerial 1-on-1 guide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an employee for 1-on-1..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedUserId || generate1on1.isPending}
              className="gap-2 bg-primary hover:bg-primary/90 shadow-xs"
            >
              {generate1on1.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span>{generate1on1.isPending ? "Analyzing & Generating..." : "Generate 1-on-1 Guide"}</span>
            </Button>
          </div>

          {generate1on1.data && (
            <div className="space-y-4 pt-4 border-t border-border/60">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-border/60 bg-card text-center">
                  <span className="text-[11px] text-muted-foreground font-medium">30-Day Attendance</span>
                  <p className="text-lg font-bold text-foreground mt-0.5 font-mono">
                    {generate1on1.data.stats.attendanceRate}%
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border/60 bg-card text-center">
                  <span className="text-[11px] text-muted-foreground font-medium">Completed Tasks</span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    {generate1on1.data.stats.completedTasksCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border/60 bg-card text-center">
                  <span className="text-[11px] text-muted-foreground font-medium">Evaluation Score</span>
                  <p className="text-lg font-bold text-primary mt-0.5 font-mono">
                    ⭐ {generate1on1.data.stats.latestScore}/5.0
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border/60 bg-card text-center">
                  <span className="text-[11px] text-muted-foreground font-medium">Peer Kudos Received</span>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                    🏆 {generate1on1.data.stats.kudosCount}
                  </p>
                </div>
              </div>

              {/* Guide Card */}
              <Card className="border-border/80 bg-background shadow-xs">
                <CardHeader className="py-3 px-4 border-b border-border/50 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Structured 1-on-1 Blueprint for {generate1on1.data.employee.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {generate1on1.data.employee.department}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1.5"
                  >
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copied ? "Copied" : "Copy Guide"}</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-5 overflow-x-auto text-sm leading-relaxed prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed">
                    {generate1on1.data.agendaMarkdown}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 📊 Executive Briefing Memo Component
// ---------------------------------------------------------------------------

function ExecutiveBriefingTab() {
  const toast = useToast();
  const briefing = useGenerateExecutiveBriefing();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (briefing.data?.briefingMarkdown) {
      navigator.clipboard.writeText(briefing.data.briefingMarkdown);
      setCopied(true);
      toast.success("Executive Briefing copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="size-5 text-indigo-600" />
              AI Executive Workforce Briefing Memo
            </CardTitle>
            <CardDescription className="text-xs">
              Synthesizes real-time organizational telemetry across Attendance, Task velocity, OKR trajectory, and Financial liabilities into a C-Suite executive briefing.
            </CardDescription>
          </div>
          <Button
            onClick={() => briefing.mutate()}
            disabled={briefing.isPending}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0"
          >
            {briefing.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            <span>{briefing.isPending ? "Generating Briefing..." : "Generate Executive Briefing"}</span>
          </Button>
        </CardHeader>

        {briefing.data && (
          <CardContent className="space-y-6 border-t border-border/60 pt-5">
            {/* Health Index Meter & Telemetry Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 text-center flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Workforce Health Index</span>
                <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-1 font-mono">
                  {briefing.data.healthIndex}/100
                </p>
                <Badge variant="outline" className="mt-1 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                  Optimal State
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-card text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Attendance Stability</span>
                <p className="text-xl font-bold text-foreground mt-1 font-mono">
                  {briefing.data.metrics.attendancePace}%
                </p>
                <span className="text-[10px] text-muted-foreground">30-day pace</span>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-card text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Task Velocity</span>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {briefing.data.metrics.completedTasks} done
                </p>
                <span className="text-[10px] text-muted-foreground">{briefing.data.metrics.inProgressTasks} in pipeline</span>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-card text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Strategic OKRs</span>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                  {briefing.data.metrics.avgOkrProgress}%
                </p>
                <span className="text-[10px] text-muted-foreground">milestone pace</span>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-card text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Pending Claims</span>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  ${briefing.data.metrics.pendingExpenseAmount.toLocaleString()}
                </p>
                <span className="text-[10px] text-muted-foreground">{briefing.data.metrics.pendingExpenseCount} claims</span>
              </div>
            </div>

            {/* Generated Memo Card */}
            <Card className="border-border/80 bg-background shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-border/50 flex flex-row items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Executive Briefing Document
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1.5"
                  >
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copied ? "Copied" : "Copy Memo"}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-sm leading-relaxed prose dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed">
                  {briefing.data.briefingMarkdown}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ AI Skills Radar & Succession Planning Matrix Component
// ---------------------------------------------------------------------------

function SkillsMatrixTab() {
  const skillsQuery = useSkillsMatrix();
  const data = skillsQuery.data;

  return (
    <div className="space-y-6 pt-2">
      {/* Header Banner */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="size-5 text-amber-500 fill-amber-500/20" />
              AI Skills Radar & Succession Planning Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Synthesizes real-time task tags, peer feedback, performance evaluations, and role competencies to identify bench strength and promotion readiness.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => skillsQuery.refetch()}
            disabled={skillsQuery.isFetching}
            className="gap-1.5 h-8 text-xs shrink-0"
          >
            <RefreshCw className={`size-3.5 ${skillsQuery.isFetching ? "animate-spin" : ""}`} />
            <span>{skillsQuery.isFetching ? "Syncing Radar..." : "Refresh Matrix"}</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 border-t border-border/60 pt-5">
          {skillsQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Sparkles className="size-6 text-primary animate-spin mx-auto mb-2" />
              Mapping competency radar and succession vectors...
            </div>
          ) : data ? (
            <>
              {/* Overall Coverage & Strategic AI Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Workforce Competency Coverage
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-4xl font-black text-amber-700 dark:text-amber-300 font-mono">
                        {data.overallCoverage}%
                      </span>
                      <span className="text-xs text-muted-foreground">across all domains</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${data.overallCoverage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground flex justify-between">
                      <span>Baseline: 70%</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Target: 85%</span>
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-2 p-5 rounded-xl border border-border/70 bg-card space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      AI Executive Talent Insights & Recommendations
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {data.strategicInsights.map((insight, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                        <span className="font-medium text-foreground text-[11px]">• Recommendation {idx + 1}</span>
                        <p className="text-[11px] leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Competency Domains Grid */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Target className="size-4 text-primary" /> Core Competency Radar
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.competencies.map((comp, idx) => {
                    const isAbove = comp.proficiencyScore >= comp.benchmarkTarget;
                    return (
                      <Card key={idx} className="border-border/70 p-4 space-y-3 hover:border-border transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-foreground leading-tight">
                            {comp.skill}
                          </span>
                          <Badge
                            className={
                              isAbove
                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]"
                                : "bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]"
                            }
                          >
                            {isAbove ? "✓ Above Target" : "⚠ Development"}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-muted-foreground">Proficiency:</span>
                            <span className="font-bold text-foreground">{comp.proficiencyScore}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isAbove ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${comp.proficiencyScore}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>Target: {comp.benchmarkTarget}%</span>
                          <span>{comp.employeeCount} active contributors</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Department Skills Clusters */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="size-4 text-primary" /> Department Competency Clusters & Gaps
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {data.departments.map((dept) => (
                    <Card key={dept.departmentId} className="border-border/70 p-4 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-foreground">{dept.departmentName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {dept.headcount} members
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {dept.topSkills.map((sk, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-border/40 text-[11px] space-y-1">
                        <span className="text-muted-foreground font-medium">Growth Area:</span>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          ⚠ {dept.growthGap}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Succession & Leadership Readiness Leaderboard */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Trophy className="size-4 text-amber-500" /> High-Potential Succession Bench & Leadership Pipeline
                </h3>
                <div className="space-y-2.5">
                  {data.successionCandidates.map((candidate, idx) => (
                    <div
                      key={candidate.employeeId}
                      className="p-4 rounded-xl border border-border/70 bg-card hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center font-mono">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-sm text-foreground">{candidate.name}</span>
                          <Badge variant="outline" className="text-[11px]">
                            {candidate.department}
                          </Badge>
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[11px]">
                            ⭐ {candidate.readinessScore}% Promotion Readiness
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Recommended Track: <strong className="text-foreground">{candidate.recommendedTrack}</strong>
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {candidate.keyStrengths.map((str, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60"
                            >
                              ✓ {str}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs text-muted-foreground">Active Task Velocity</span>
                        <p className="text-sm font-bold text-foreground font-mono">
                          {candidate.activeTasksVelocity} deliverables
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


