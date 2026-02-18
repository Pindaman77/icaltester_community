import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useCalendars, useCreateCalendar } from "@/hooks/useCalendars";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, CalendarRange, LayoutDashboard, Plus } from "lucide-react";

export function Sidebar() {
  const { data: calendars, isLoading } = useCalendars();
  const createCalendar = useCreateCalendar();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");

  const activeCalendarId = params.id ?? null;
  const isDashboard = location.pathname === "/dashboard";
  const isTimeline = location.pathname === "/timeline";

  const calendarItems = useMemo(() => calendars ?? [], [calendars]);

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) {
      toast({ title: "Error", description: "Please enter a calendar name", variant: "destructive" });
      return;
    }
    try {
      await createCalendar.mutateAsync(newCalendarName.trim());
      setNewCalendarName("");
      setDialogOpen(false);
      toast({ title: "Success", description: "Calendar created!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <UiSidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">iCal Tester</p>
            <p className="text-xs text-muted-foreground">Developer workspace</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isDashboard}>
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isTimeline}>
                <Link to="/timeline">
                  <CalendarRange className="h-4 w-4" />
                  Timeline
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>My Feeds</SidebarGroupLabel>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <SidebarGroupAction aria-label="Create calendar">
                <Plus className="h-4 w-4" />
              </SidebarGroupAction>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Calendar</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sidebar-calendar-name">Calendar Name</Label>
                  <Input
                    id="sidebar-calendar-name"
                    placeholder="e.g., Partner Mock Feed"
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
                  {createCalendar.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <SidebarMenu>
            {isLoading && (
              <>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
              </>
            )}
            {!isLoading && calendarItems.length === 0 && (
              <div className="px-2 text-xs text-muted-foreground">No calendars yet.</div>
            )}
            {!isLoading &&
              calendarItems.map((calendar) => {
                const color = (calendar as { color?: string }).color;
                return (
                  <SidebarMenuItem key={calendar.id}>
                    <SidebarMenuButton asChild isActive={activeCalendarId === calendar.id}>
                      <Link to={`/calendar/${calendar.id}`}>
                        <span
                          className="h-2 w-2 rounded-full bg-primary/70"
                          style={color ? { backgroundColor: color } : undefined}
                        />
                        {calendar.name}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Add multiple mock calendars to test sync edge cases and overlaps.
        </div>
      </SidebarFooter>
    </UiSidebar>
  );
}
