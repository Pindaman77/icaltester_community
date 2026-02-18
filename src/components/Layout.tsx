import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset>
        <Navbar />
        <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
