import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bookmark,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { comingSoon } from "@/lib/coming-soon";
import { useTheme, type ThemePref } from "@/lib/theme";

export function HomeMenu({
  children,
  align = "end",
  side = "bottom",
}: {
  children: ReactNode;
  align?: "start" | "end";
  side?: "bottom" | "right" | "top";
}) {
  const navigate = useNavigate();
  const { pref, setTheme } = useTheme();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-56 rounded-2xl p-1.5">
        <DropdownMenuItem onSelect={() => comingSoon("New group")} className="gap-3 rounded-xl py-2.5">
          <Users className="size-4" /> New group
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => comingSoon("Invite friends")} className="gap-3 rounded-xl py-2.5">
          <UserPlus className="size-4" /> Invite friends
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => comingSoon("Saved messages")} className="gap-3 rounded-xl py-2.5">
          <Bookmark className="size-4" /> Saved messages
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => comingSoon("Settings")} className="gap-3 rounded-xl py-2.5">
          <Settings className="size-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 text-xs font-semibold text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setTheme(v as ThemePref)}>
          <DropdownMenuRadioItem value="light" className="gap-3 rounded-xl py-2">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-3 rounded-xl py-2">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-3 rounded-xl py-2">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="gap-3 rounded-xl py-2.5 text-destructive focus:text-destructive">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
