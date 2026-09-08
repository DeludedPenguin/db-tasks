import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { CheckSquare, Archive, FolderOpen, Timer, ScrollText, ArrowUpDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SELF_HOSTED } from "@/lib/data";

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
    <div className="min-h-screen bg-background text-sm">
      <header className="sticky top-0 z-50 border-b border-line/70 bg-background/80 backdrop-blur-xl">
        <div className="container flex min-h-14 items-center justify-between gap-2 py-2">
          <div className="flex min-w-0 items-center gap-1">
            <h1 className="mr-3 shrink-0 font-mono text-[13px] font-semibold text-foreground sm:text-[15px]">
              DB_Tasks
            </h1>
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-line bg-panel/50 p-1 backdrop-blur-md">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[10px] font-medium transition sm:px-3",
                      isActive
                        ? "border-aqua/50 bg-aqua/10 text-foreground"
                        : "border-transparent text-sub hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          {!SELF_HOSTED && (
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>
       <main className="container py-5 sm:py-7">
        <Outlet />
      </main>
    </div>
  );
}
