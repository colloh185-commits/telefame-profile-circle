import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { GalleryVerticalEnd, MessageSquare, Moon, Plus, Sun, Users } from "lucide-react";
import { LogoMark } from "@/components/telefam/Logo";
import { HomeMenu } from "@/components/telefam/home/HomeMenu";
import { Avatar } from "@/components/telefam/home/parts";
import { comingSoon } from "@/lib/coming-soon";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type NavKey = "chats" | "contacts" | "feeds";

type NavItem = {
  key: NavKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  to?: "/home" | "/contacts";
};

const NAV: NavItem[] = [
  { key: "chats", label: "Chats", icon: MessageSquare, to: "/home" },
  { key: "contacts", label: "Contacts", icon: Users, to: "/contacts" },
  { key: "feeds", label: "Feeds", icon: GalleryVerticalEnd },
];

type Me = { avatarUrl: string | null | undefined; avatarPath?: string | null | undefined; name: string | undefined };

/* ------------------------------ Mobile bottom bar ------------------------------ */

export function MobileBottomNav({ active, me }: { active: NavKey; me: Me }) {
  return (
    <nav aria-label="Main" className="shrink-0 border-t bg-background pb-safe shadow-nav md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pt-1">
        <BottomTab item={NAV[0]!} active={active === "chats"} />
        <BottomTab item={NAV[1]!} active={active === "contacts"} />
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => comingSoon("Post")}
            aria-label="Post"
            className="-mt-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </button>
          <span className="mt-0.5 pb-1 text-[0.6875rem] font-semibold text-muted-foreground">Post</span>
        </div>
        <BottomTab item={NAV[2]!} active={active === "feeds"} />
        <button
          type="button"
          onClick={() => comingSoon("Profile")}
          className="flex flex-col items-center gap-0.5 pb-1 pt-1"
        >
          <Avatar url={me.avatarUrl} path={me.avatarPath} name={me.name} className="size-[22px] text-[0.5rem] ring-2 ring-border" />
          <span className="text-[0.6875rem] font-semibold text-muted-foreground">Profile</span>
        </button>
      </div>
    </nav>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const cls = cn(
    "flex flex-col items-center gap-0.5 pb-1 pt-1 transition-colors",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  );
  const body = (
    <>
      <Icon className={cn("size-[22px]", active && "fill-current")} />
      <span className="text-[0.6875rem] font-semibold">{item.label}</span>
    </>
  );
  if (item.to) {
    return (
      <Link to={item.to} aria-current={active ? "page" : undefined} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => comingSoon(item.label)} className={cls}>
      {body}
    </button>
  );
}

/* --------------------------------- Desktop rail -------------------------------- */

export function DesktopRail({ active, me, className }: { active: NavKey; me: Me; className?: string }) {
  const { resolved, toggle } = useTheme();
  return (
    <aside className={cn("flex flex-col items-center gap-1.5 bg-brand-gradient py-4 text-primary-foreground", className)}>
      <LogoMark className="mb-3 size-10" />
      {NAV.map((item) => (
        <RailButton key={item.key} item={item} active={item.key === active} />
      ))}
      <button
        type="button"
        onClick={() => comingSoon("Post")}
        aria-label="Post"
        className="mt-2 flex size-10 items-center justify-center rounded-xl bg-primary-foreground text-primary shadow-brand transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex size-9 items-center justify-center rounded-xl text-primary-foreground/85 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
        >
          {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <HomeMenu align="start" side="right">
          <button
            type="button"
            aria-label="Account menu"
            className="rounded-full ring-2 ring-primary-foreground/70 transition hover:ring-primary-foreground"
          >
            <Avatar url={me.avatarUrl} path={me.avatarPath} name={me.name} className="size-9 text-xs" />
          </button>
        </HomeMenu>
      </div>
    </aside>
  );
}

function RailButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const cls = cn(
    "flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[0.625rem] font-semibold transition-colors",
    active
      ? "bg-primary-foreground/20 text-primary-foreground"
      : "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground",
  );
  const body = (
    <>
      <Icon className={cn("size-5", active && "fill-current")} />
      {item.label}
    </>
  );
  if (item.to) {
    return (
      <Link to={item.to} aria-current={active ? "page" : undefined} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => comingSoon(item.label)} className={cls}>
      {body}
    </button>
  );
}
