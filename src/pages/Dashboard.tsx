import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useCalendars, useCreateCalendar, useDeleteCalendar, useUpdateCalendar } from "@/hooks/useCalendars";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fnGet } from "@/lib/functionsClient";
import { Booking, Subscription } from "@/integrations/supabase/client";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const fetchBookings = async (calendarId: string) => {
  const { events } = await fnGet<{ events: Booking[] }>(`/manual-events?calendar_id=${calendarId}`);
  return events ?? [];
};

const fetchSubscriptions = async (calendarId: string) => {
  const { subscriptions } = await fnGet<{ subscriptions: Subscription[] }>(`/subscriptions?calendar_id=${calendarId}`);
  return subscriptions ?? [];
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: calendars, isLoading } = useCalendars();
  const createCalendar = useCreateCalendar();
  const deleteCalendar = useDeleteCalendar();
  const updateCalendar = useUpdateCalendar();
  const { toast } = useToast();
  const [newCalendarName, setNewCalendarName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdDialogOpen, setCreatedDialogOpen] = useState(false);
  const [createdFeedUrl, setCreatedFeedUrl] = useState("");
  const [createdFeedPath, setCreatedFeedPath] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<{ id: string; name: string } | null>(null);
  const [editCalendarName, setEditCalendarName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const calendarIds = useMemo(() => (calendars ?? []).map((calendar) => calendar.id), [calendars]);

  const bookingQueries = useQueries({
    queries: calendarIds.map((calendarId) => ({
      queryKey: ["bookings", calendarId],
      queryFn: () => fetchBookings(calendarId),
      enabled: Boolean(user) && Boolean(calendarId),
    })),
  });

  const subscriptionQueries = useQueries({
    queries: calendarIds.map((calendarId) => ({
      queryKey: ["subscriptions", calendarId],
      queryFn: () => fetchSubscriptions(calendarId),
      enabled: Boolean(user) && Boolean(calendarId),
    })),
  });

  const bookingCounts = new Map(
    calendarIds.map((calendarId, index) => [calendarId, bookingQueries[index]?.data?.length ?? 0]),
  );
  const subscriptionCounts = new Map(
    calendarIds.map((calendarId, index) => [calendarId, subscriptionQueries[index]?.data?.length ?? 0]),
  );

  const totalBookings = bookingQueries.reduce((sum, query) => sum + (query.data?.length ?? 0), 0);
  const totalSubscriptions = subscriptionQueries.reduce((sum, query) => sum + (query.data?.length ?? 0), 0);
  const hasCalendars = calendarIds.length > 0;
  const bookingsLoading = hasCalendars && bookingQueries.some((query) => query.isLoading);
  const subscriptionsLoading = hasCalendars && subscriptionQueries.some((query) => query.isLoading);

  const filteredCalendars = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return calendars ?? [];
    return (calendars ?? []).filter((calendar) => calendar.name.toLowerCase().includes(trimmed));
  }, [calendars, searchTerm]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) {
      toast({ title: "Error", description: "Please enter a calendar name", variant: "destructive" });
      return;
    }
    try {
      const created = await createCalendar.mutateAsync(newCalendarName.trim());
      setCreatedFeedUrl(created?.public_feed_url || "");
      setCreatedFeedPath(created?.public_feed_path || "");
      setCreatedDialogOpen(true);
      setNewCalendarName("");
      setDialogOpen(false);
      toast({ title: "Success", description: "Calendar created!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCalendar = async (id: string, name: string) => {
    if (!confirm(`Delete calendar "${name}"? This will also delete all bookings and subscriptions.`)) return;
    try {
      await deleteCalendar.mutateAsync(id);
      toast({ title: "Deleted", description: "Calendar removed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const copyFeedUrl = (feedUrl: string) => {
    navigator.clipboard.writeText(feedUrl);
    toast({ title: "Copied!", description: "iCal feed URL copied to clipboard" });
  };

  const handleEditCalendar = (calendar: { id: string; name: string }) => {
    setEditingCalendar(calendar);
    setEditCalendarName(calendar.name);
    setEditDialogOpen(true);
  };

  const handleSaveCalendarName = async () => {
    if (!editingCalendar || !editCalendarName.trim()) {
      toast({ title: "Error", description: "Please enter a calendar name", variant: "destructive" });
      return;
    }
    try {
      await updateCalendar.mutateAsync({ id: editingCalendar.id, name: editCalendarName });
      setEditDialogOpen(false);
      setEditingCalendar(null);
      toast({ title: "Updated", description: "Calendar name updated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const stats = [
    {
      label: "Active Calendars",
      value: calendars?.length ?? 0,
      icon: CalendarDays,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Total Bookings",
      value: bookingsLoading ? "..." : totalBookings,
      icon: CheckCircle2,
      tone: "bg-emerald-500/10 text-emerald-600",
    },
    {
      label: "External Subscriptions",
      value: subscriptionsLoading ? "..." : totalSubscriptions,
      icon: Link2,
      tone: "bg-indigo-500/10 text-indigo-600",
    },
  ];

  return (
    <>
      <SEO title="Dashboard" noindex />
      <Layout>
        <div className="space-y-8">
        <Dialog open={createdDialogOpen} onOpenChange={setCreatedDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save your feed URL</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Save this URL now. It cannot be recovered later.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1 rounded break-all">
                  {createdFeedPath || "Feed URL unavailable"}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyFeedUrl(createdFeedUrl)}
                  disabled={!createdFeedUrl}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Public feed URL. Anyone with the link can access it.</p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">Monitor your mock feeds and synchronization health.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search calendars..."
              className="pl-9"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-border/70">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">My Calendar Feeds</h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                {filteredCalendars.length}
              </span>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Calendar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Calendar</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="calendar-name">Calendar Name</Label>
                    <Input
                      id="calendar-name"
                      placeholder="e.g., Beach House, Mountain Cabin"
                      value={newCalendarName}
                      onChange={(event) => setNewCalendarName(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleCreateCalendar()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleCreateCalendar} disabled={createCalendar.isPending}>
                    {createCalendar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : calendars?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">No calendars yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first calendar to start testing iCal sync.
                  </p>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Calendar
                </Button>
              </CardContent>
            </Card>
          ) : filteredCalendars.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">No calendars match your search</h3>
                  <p className="text-sm text-muted-foreground">Try a different name or clear the filter.</p>
                </div>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Clear search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCalendars.map((calendar) => {
                const color = (calendar as { color?: string }).color;
                const bookingCount = bookingCounts.get(calendar.id) ?? 0;
                const subscriptionCount = subscriptionCounts.get(calendar.id) ?? 0;
                const lastActivity = calendar.updated_at || calendar.created_at;
                const lastActivityLabel = lastActivity ? format(new Date(lastActivity), "MMM d, yyyy") : "—";

                return (
                  <Card key={calendar.id} className="group relative overflow-hidden border-border/70">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-primary/70"
                              style={color ? { backgroundColor: color } : undefined}
                            />
                            <CardTitle className="text-lg">{calendar.name}</CardTitle>
                          </div>
                          <CardDescription className="mt-1">
                            Poll: every {calendar.poll_interval_minutes} min
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditCalendar({ id: calendar.id, name: calendar.name })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCalendar(calendar.id, calendar.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          {bookingCount} bookings
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                          <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                          {subscriptionCount} subscriptions
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                          Last activity: {lastActivityLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <code
                          className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate"
                          title={calendar.public_feed_url || calendar.public_feed_path}
                        >
                          {calendar.public_feed_path || "Loading..."}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyFeedUrl(calendar.public_feed_url || "")}
                          disabled={!calendar.public_feed_url}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Link to={`/calendar/${calendar.id}`}>
                        <Button variant="outline" className="w-full gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Manage
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Calendar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-calendar-name">Calendar Name</Label>
                <Input
                  id="edit-calendar-name"
                  value={editCalendarName}
                  onChange={(event) => setEditCalendarName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleSaveCalendarName()}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveCalendarName} disabled={updateCalendar.isPending}>
                {updateCalendar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
    </>
  );
}
