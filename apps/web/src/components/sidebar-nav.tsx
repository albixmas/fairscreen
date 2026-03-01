"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "grid", label: "Dashboard" },
  { href: "/upload", icon: "upload", label: "Upload CVs" },
  { href: "/candidates", icon: "users", label: "Candidates" },
  { href: "/hiring-zone", icon: "target", label: "Hiring Zone" },
];

const ADMIN_ITEMS = [
  { href: "/admin/taxonomies", icon: "database", label: "Taxonomies" },
  { href: "/admin/fairness", icon: "shield", label: "Fairness" },
];

const ICONS: Record<string, string> = {
  grid: "M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  target: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  database: "M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zM2 6.5C2 8.98 6.48 11 12 11s10-2.02 10-4.5",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

export function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/candidates") {
      return pathname === "/candidates" || pathname.startsWith("/candidates/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-[240px] border-r border-border/50 bg-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border/30">
        <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
          FairScreen
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide uppercase">
          CV Intelligence
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-smooth",
                active
                  ? "text-foreground bg-secondary/80 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <svg
                className={cn("w-4 h-4", active ? "opacity-90" : "opacity-50")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={ICONS[item.icon]} />
              </svg>
              {item.label}
            </a>
          );
        })}

        <div className="pt-4 pb-2 px-3">
          <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
            Admin
          </span>
        </div>

        {ADMIN_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-smooth",
                active
                  ? "text-foreground bg-secondary/80 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <svg
                className={cn("w-4 h-4", active ? "opacity-90" : "opacity-50")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={ICONS[item.icon]} />
              </svg>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-border/30">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">R</span>
          </div>
          <div>
            <p className="text-[13px] font-medium">Recruiter</p>
            <p className="text-[11px] text-muted-foreground">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
