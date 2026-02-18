import { Fragment, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { fnDelete } from "@/lib/functionsClient";
import { LogOut, Trash2 } from "lucide-react";

type Crumb = {
  label: string;
  to?: string;
};

const buildBreadcrumbs = (pathname: string): Crumb[] => {
  if (pathname.startsWith("/calendar/")) {
    return [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Calendar" },
    ];
  }
  if (pathname.startsWith("/dashboard")) {
    return [{ label: "Dashboard" }];
  }
  return [{ label: "Workspace" }];
};

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const breadcrumbs = buildBreadcrumbs(location.pathname);

  const email = user?.email ?? "Account";
  const initial = email.trim().charAt(0).toUpperCase() || "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account permanently? This removes all calendars, bookings, subscriptions, and logs. This action cannot be undone."
    );
    if (!confirmed || isDeletingAccount) return;

    setIsDeletingAccount(true);
    try {
      await fnDelete<{ ok: boolean }>("/account");
      await signOut();
      toast({ title: "Account deleted", description: "Your account and data were removed." });
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete account";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border glass-surface px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.to ?? "/dashboard"}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted"
                aria-label="Open account menu"
              >
                <div className="hidden text-right md:block">
                  <p className="text-sm font-semibold text-foreground">{email}</p>
                </div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">{initial}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                disabled={isDeletingAccount}
                onClick={handleDeleteAccount}
              >
                <Trash2 className="h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm">
            <Link to="/auth">Sign In</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
