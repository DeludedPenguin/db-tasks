import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { CheckSquare, Archive, FolderOpen, Timer, ScrollText, ArrowUpDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Tasks", icon: CheckSquare },
  { to: "/completed", label: "Completed", icon: Archive },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/timer", label: "Timer", icon: Timer },
  { to: "/timer/log", label: "Focus Log", icon: ScrollText },
  { to: "/import-export", label: "Import/Export", icon: ArrowUpDown },
];

export default function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-1">
            <h1 className="mr-4 text-lg font-semibold tracking-tight text-foreground">
              DB_Tasks
            </h1>
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
