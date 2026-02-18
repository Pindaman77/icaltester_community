import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCalendar, useCalendars, useDeleteCalendar, useUpdateCalendar } from "@/hooks/useCalendars";
import { useBookings, useCreateBooking, useUpdateBooking, useDeleteBooking } from '@/hooks/useBookings';
import { useSubscriptions, useCreateSubscription, useDeleteSubscription, useSyncSubscription, useUpdateSubscription } from '@/hooks/useSubscriptions';
import { useSyncLogs } from '@/hooks/useSyncLogs';
import { useImportedEvents } from '@/hooks/useImportedEvents';
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { publicIcsPath, publicIcsUrl } from "@/lib/functionsClient";
import {
  CalendarDays,
  CalendarRange,
  CheckCircle,
  ChevronRight,
  Copy,
  History,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";
import { format, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { DateSelector } from "@/components/booking/DateSelector";
import type { Calendar } from "@/integrations/supabase/client";

type CalendarWithColor = Calendar & { color?: string };

function CalendarHeader({
  calendar,
  feedPath,
  copyFeedUrl,
  calendars,
  onSelectCalendar,
}: {
  calendar: CalendarWithColor;
  feedPath: string;
  copyFeedUrl: () => void;
  calendars: CalendarWithColor[];
  onSelectCalendar: (id: string) => void;
}) {
  const hasColor = Boolean(calendar.color);
  const iconClassName = `flex h-12 w-12 items-center justify-center rounded-2xl ${
    hasColor ? "text-white" : "bg-primary/10 text-primary"
  }`;

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="transition-colors hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{calendar.name}</span>
      </nav>

      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className={iconClassName} style={hasColor ? { backgroundColor: calendar.color } : undefined}>
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{calendar.name}</h1>
            <p className="text-sm text-muted-foreground">Feed is live</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick switch
            </span>
            <Select value={calendar.id} onValueChange={onSelectCalendar}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full bg-primary/70"
                        style={item.color ? { backgroundColor: item.color } : undefined}
                      />
                      {item.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{feedPath}</code>
            <Button variant="outline" size="sm" onClick={copyFeedUrl} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Feed
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="secondary" size="sm" asChild className="gap-2">
              <Link to="/timeline">
                <CalendarRange className="h-4 w-4" />
                Open Timeline View
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Public feed URL. Anyone with the link can access it.
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper to get all blocked dates from bookings and imported events
function getBlockedDates(
  bookings: any[],
  importedEvents: any[],
  excludeBookingId?: string
): Date[] {
  const blockedDates: Date[] = [];
  
  // Add dates from manual bookings (excluding cancelled)
  for (const booking of bookings) {
    if (excludeBookingId && booking.id === excludeBookingId) continue;
    if (booking.status === 'cancelled') continue;
    
    const start = parseISO(booking.start_date);
    const end = parseISO(booking.end_date);
    // Block all dates from check-in to check-out (exclusive of checkout)
    const days = eachDayOfInterval({ start, end: new Date(end.getTime() - 86400000) });
    blockedDates.push(...days);
  }
  
  // Add dates from imported events
  for (const event of importedEvents) {
    if (event.status?.toLowerCase() === 'cancelled') continue;
    
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date);
    const days = eachDayOfInterval({ start, end: new Date(end.getTime() - 86400000) });
    blockedDates.push(...days);
  }
  
  return blockedDates;
}

export default function CalendarDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: calendar, isLoading: calendarLoading } = useCalendar(id!);
  const { data: calendars } = useCalendars();
  const { data: bookings, isLoading: bookingsLoading } = useBookings(id!);
  const { data: subscriptions } = useSubscriptions(id!);
  const { data: syncLogs } = useSyncLogs(id!);
  const { data: importedEvents, isLoading: importedLoading } = useImportedEvents(id!);
  const updateCalendar = useUpdateCalendar();
  const { toast } = useToast();
  const [includeImported, setIncludeImported] = useState(false);

  const validTabs = ["bookings", "subscriptions", "logs", "settings"] as const;
  type TabValue = (typeof validTabs)[number];
  const rawTab = searchParams.get("tab");
  const currentTab = (validTabs as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as TabValue)
    : "bookings";

  const subscriptionNames = useMemo(() => {
    return new Map((subscriptions ?? []).map((sub) => [sub.id, sub.name]));
  }, [subscriptions]);

  useEffect(() => {
    setIncludeImported(Boolean(calendar?.include_imported_in_export));
  }, [calendar?.include_imported_in_export]);

  if (authLoading || calendarLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!calendar) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Calendar not found</h2>
          <Link to="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // Use canonical feed URL from backend (single source of truth)
  const feedUrl = calendar.public_feed_url || publicIcsUrl(calendar.feed_token);
  const feedPath = calendar.public_feed_path || publicIcsPath(calendar.feed_token);

  const copyFeedUrl = () => {
    if (!feedUrl) {
      toast({ title: 'Error', description: 'Feed URL not available', variant: 'destructive' });
      return;
    }
    navigator.clipboard.writeText(feedUrl);
    toast({ title: 'Copied!', description: 'iCal feed URL copied to clipboard' });
  };

  const handleExportToggle = async (checked: boolean) => {
    try {
      await updateCalendar.mutateAsync({ id: id!, include_imported_in_export: checked });
      setIncludeImported(checked);
      toast({ title: "Updated", description: "Export settings saved." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  const handleSelectCalendar = (calendarId: string) => {
    if (calendarId === calendar.id) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", currentTab);
    navigate(`/calendar/${calendarId}?${next.toString()}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <CalendarHeader 
          calendar={calendar} 
          feedPath={feedPath} 
          copyFeedUrl={copyFeedUrl}
          calendars={(calendars ?? []) as CalendarWithColor[]}
          onSelectCalendar={handleSelectCalendar}
        />

        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="bookings" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <Link2 className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              Sync Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <BookingsTab
              calendarId={id!}
              calendar={calendar}
              bookings={bookings || []}
              importedEvents={importedEvents || []}
              isLoading={bookingsLoading}
              isImportedLoading={importedLoading}
              subscriptionNames={subscriptionNames}
            />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionsTab calendarId={id!} subscriptions={subscriptions || []} />
          </TabsContent>

          <TabsContent value="logs">
            <SyncLogsTab logs={syncLogs || []} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab
              calendar={calendar}
              includeImported={includeImported}
              onToggleExport={handleExportToggle}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function BookingsTab({
  calendarId,
  calendar,
  bookings,
  importedEvents,
  isLoading,
  isImportedLoading,
  subscriptionNames,
}: {
  calendarId: string;
  calendar: any;
  bookings: any[];
  importedEvents: any[];
  isLoading: boolean;
  isImportedLoading: boolean;
  subscriptionNames: Map<string, string>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [summary, setSummary] = useState('');
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  
  // Get default status from database, fallback to 'tentative'
  const dbDefaultStatus = calendar?.default_booking_status;
  const [defaultStatus, setDefaultStatus] = useState<'pending' | 'tentative' | 'confirmed'>('tentative');
  
  // Sync local state with database value
  useEffect(() => {
    if (dbDefaultStatus === 'pending' || dbDefaultStatus === 'tentative' || dbDefaultStatus === 'confirmed') {
      setDefaultStatus(dbDefaultStatus);
    }
  }, [dbDefaultStatus]);

  const updateCalendar = useUpdateCalendar();

  // Save default status to database when it changes
  const handleDefaultStatusChange = async (value: 'pending' | 'tentative' | 'confirmed') => {
    const previous = defaultStatus;
    setDefaultStatus(value);
    try {
      await updateCalendar.mutateAsync({ id: calendarId, default_booking_status: value });
      toast({ title: 'Updated', description: 'Default status saved.' });
    } catch (error) {
      setDefaultStatus(previous);
      const message = error instanceof Error ? error.message : 'Failed to save default status';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const [editSummary, setEditSummary] = useState('');
  const [editCheckIn, setEditCheckIn] = useState<Date | null>(null);
  const [editCheckOut, setEditCheckOut] = useState<Date | null>(null);
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const { toast } = useToast();

  // Calculate blocked dates for the create dialog (all existing bookings)
  const blockedDatesForCreate = useMemo(
    () => getBlockedDates(bookings, importedEvents),
    [bookings, importedEvents]
  );

  // Calculate blocked dates for the edit dialog (exclude the booking being edited)
  const blockedDatesForEdit = useMemo(
    () => getBlockedDates(bookings, importedEvents, editingBooking?.id),
    [bookings, importedEvents, editingBooking?.id]
  );

  const handleCreate = async () => {
    if (!summary || !checkIn || !checkOut) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    try {
      const startDate = format(checkIn, 'yyyy-MM-dd');
      const endDate = format(checkOut, 'yyyy-MM-dd');
      await createBooking.mutateAsync({ calendar_id: calendarId, summary, start_date: startDate, end_date: endDate, status: defaultStatus });
      setSummary(''); setCheckIn(null); setCheckOut(null);
      setDialogOpen(false);
      toast({ title: 'Success', description: 'Booking created!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (booking: any) => {
    setEditingBooking(booking);
    setEditSummary(booking.summary);
    setEditCheckIn(new Date(booking.start_date));
    setEditCheckOut(new Date(booking.end_date));
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingBooking || !editSummary || !editCheckIn || !editCheckOut) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    try {
      await updateBooking.mutateAsync({
        id: editingBooking.id,
        summary: editSummary,
        start_date: format(editCheckIn, 'yyyy-MM-dd'),
        end_date: format(editCheckOut, 'yyyy-MM-dd'),
      });
      setEditDialogOpen(false);
      setEditingBooking(null);
      toast({ title: 'Updated', description: 'Booking updated!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateBooking.mutateAsync({ id, status });
      toast({ title: 'Updated', description: `Booking ${status}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this booking?')) return;
    try {
      await deleteBooking.mutateAsync({ id, calendarId });
      toast({ title: 'Deleted', description: 'Booking removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manual Bookings</CardTitle>
            <CardDescription>Manual bookings that will appear in your iCal feed</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Default status:</Label>
              <Select
                value={defaultStatus}
                onValueChange={(v) => handleDefaultStatusChange(v as 'pending' | 'tentative' | 'confirmed')}
                disabled={updateCalendar.isPending}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Booking
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Booking</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Guest Name / Summary</Label>
                  <Input placeholder="John Doe" value={summary} onChange={(e) => setSummary(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Check-in / Check-out</Label>
                  <DateSelector
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onDatesChange={(checkIn, checkOut) => {
                      setCheckIn(checkIn);
                      setCheckOut(checkOut);
                    }}
                    blockedDates={blockedDatesForCreate}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleCreate} disabled={createBooking.isPending}>
                  {createBooking.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Booking</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Guest Name / Summary</Label>
                  <Input value={editSummary} onChange={(e) => setEditSummary(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Check-in / Check-out</Label>
                  <DateSelector
                    checkIn={editCheckIn}
                    checkOut={editCheckOut}
                    onDatesChange={(checkIn, checkOut) => {
                      setEditCheckIn(checkIn);
                      setEditCheckOut(checkOut);
                    }}
                    blockedDates={blockedDatesForEdit}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleEditSave} disabled={updateBooking.isPending}>
                  {updateBooking.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No bookings yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.summary}</TableCell>
                    <TableCell>{format(new Date(booking.start_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(booking.end_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Select value={booking.status} onValueChange={(v) => handleStatusChange(booking.id, v)}>
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="tentative">Tentative</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(booking)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(booking.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imported Events</CardTitle>
          <CardDescription>Read-only events fetched from your subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          {isImportedLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : importedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No imported events yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Summary</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importedEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.summary}</TableCell>
                    <TableCell>{format(new Date(event.start_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(event.end_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={String(event.status).toLowerCase() === 'cancelled' ? 'destructive' : 'secondary'}>
                        {String(event.status).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subscriptionNames.get(event.subscription_id) ?? event.subscription_id.slice(0, 8)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const SYNC_INTERVAL_OPTIONS = [
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 10800, label: '3 hours' },
  { value: 21600, label: '6 hours' },
  { value: 43200, label: '12 hours' },
  { value: 86400, label: '24 hours' },
  { value: 0, label: 'None (manual only)' },
];

function SubscriptionsTab({ calendarId, subscriptions }: { calendarId: string; subscriptions: any[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [defaultInterval, setDefaultInterval] = useState(3600);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editIcalUrl, setEditIcalUrl] = useState('');
  const [editInterval, setEditInterval] = useState(3600);
  
  const createSubscription = useCreateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const updateSubscription = useUpdateSubscription();
  const syncSubscription = useSyncSubscription();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name || !icalUrl) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    try {
      await createSubscription.mutateAsync({ 
        calendar_id: calendarId, 
        name, 
        ical_url: icalUrl,
        poll_interval_sec: defaultInterval
      });
      setName(''); setIcalUrl('');
      setDialogOpen(false);
      toast({ title: 'Success', description: 'Subscription added!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this subscription?')) return;
    try {
      await deleteSubscription.mutateAsync({ id, calendarId });
      toast({ title: 'Removed', description: 'Subscription deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const result = await syncSubscription.mutateAsync({ subscriptionId: id, calendarId });
      toast({ 
        title: 'Synced', 
        description: `Added: ${result.added}, Updated: ${result.updated}, Removed: ${result.removed}` 
      });
    } catch (error: any) {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    } finally {
      setSyncingId(null);
    }
  };

  const openEditDialog = (sub: any) => {
    setEditingSub(sub);
    setEditName(sub.name);
    setEditIcalUrl(sub.ical_url);
    setEditInterval(sub.poll_interval_sec ?? 3600);
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editName || !editIcalUrl) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    try {
      await updateSubscription.mutateAsync({
        id: editingSub.id,
        calendarId,
        name: editName,
        ical_url: editIcalUrl,
        poll_interval_sec: editInterval,
      });
      setEditDialogOpen(false);
      setEditingSub(null);
      toast({ title: 'Success', description: 'Subscription updated!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getIntervalLabel = (sec: number) => {
    const opt = SYNC_INTERVAL_OPTIONS.find(o => o.value === sec);
    return opt ? opt.label : `${sec}s`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>External iCal feeds to import events from</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Default interval:</Label>
            <Select value={String(defaultInterval)} onValueChange={(v) => setDefaultInterval(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVAL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Subscribe to iCal Feed</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="StayManager Export" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>iCal URL</Label>
                  <Input placeholder="https://..." value={icalUrl} onChange={(e) => setIcalUrl(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleCreate} disabled={createSubscription.isPending}>
                  {createSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Subscribe
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {subscriptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No subscriptions yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead className="w-[130px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{sub.ical_url}</TableCell>
                  <TableCell className="text-muted-foreground">{getIntervalLabel(sub.poll_interval_sec ?? 300)}</TableCell>
                  <TableCell>
                    {sub.last_synced_at ? format(new Date(sub.last_synced_at), 'MMM d, HH:mm') : 'Never'}
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => openEditDialog(sub)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => handleSync(sub.id)}
                      disabled={syncingId === sub.id}
                    >
                      {syncingId === sub.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(sub.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Subscription Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>iCal URL</Label>
              <Input value={editIcalUrl} onChange={(e) => setEditIcalUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sync Interval</Label>
              <Select value={String(editInterval)} onValueChange={(v) => setEditInterval(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_INTERVAL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdate} disabled={updateSubscription.isPending}>
              {updateSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SyncLogsTab({ logs }: { logs: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Logs</CardTitle>
        <CardDescription>Recent sync activity for this calendar</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No sync logs yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Removed</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    {log.ran_at || log.created_at ? format(new Date(log.ran_at || log.created_at), 'MMM d, HH:mm:ss') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.direction}</Badge>
                  </TableCell>
                  <TableCell>
                    {log.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell>{log.http_status ?? '-'}</TableCell>
                  <TableCell>{log.vevent_count ?? '-'}</TableCell>
                  <TableCell>{log.events_added ?? '-'}</TableCell>
                  <TableCell>{log.events_updated ?? '-'}</TableCell>
                  <TableCell>{log.events_removed ?? '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {log.message || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsTab({
  calendar,
  includeImported,
  onToggleExport,
}: {
  calendar: CalendarWithColor;
  includeImported: boolean;
  onToggleExport: (checked: boolean) => void;
}) {
  const updateCalendar = useUpdateCalendar();
  const deleteCalendar = useDeleteCalendar();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState(calendar.name);

  useEffect(() => {
    setName(calendar.name);
  }, [calendar.name]);

  const canSaveName = name.trim().length > 0 && name.trim() !== calendar.name;
  const supportsColor = typeof calendar.color === "string" && calendar.color.length > 0;

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Please enter a calendar name", variant: "destructive" });
      return;
    }
    try {
      await updateCalendar.mutateAsync({ id: calendar.id, name: name.trim() });
      toast({ title: "Updated", description: "Calendar name updated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCalendar = async () => {
    if (!confirm(`Delete calendar "${calendar.name}"? This will also delete all bookings and subscriptions.`)) {
      return;
    }
    try {
      await deleteCalendar.mutateAsync(calendar.id);
      toast({ title: "Deleted", description: "Calendar removed" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Calendar Settings</CardTitle>
          <CardDescription>Update core settings for this feed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="settings-calendar-name">Display name</Label>
            <Input
              id="settings-calendar-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSaveName()}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveName} disabled={!canSaveName || updateCalendar.isPending}>
                {updateCalendar.isPending ? "Saving..." : "Save name"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setName(calendar.name)}
                disabled={name === calendar.name}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex flex-col gap-2">
              <Label>Calendar color</Label>
              {supportsColor ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                  {calendar.color}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Color customization is not available for this calendar.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>Include imported events in feed</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, events imported from subscriptions will appear in the public ICS feed.
                </p>
              </div>
              <Switch
                checked={includeImported}
                onCheckedChange={onToggleExport}
                disabled={updateCalendar.isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Delete this calendar and all related data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDeleteCalendar} disabled={deleteCalendar.isPending}>
            {deleteCalendar.isPending ? "Deleting..." : "Delete calendar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
