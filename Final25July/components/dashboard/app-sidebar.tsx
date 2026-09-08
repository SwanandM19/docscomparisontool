"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  GitCompareArrows,
  Brain,
  History,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  UserCheck,
  Languages,
  ReceiptText,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useProcessingRegistry } from "@/lib/hooks/processing-registry";
import { useSession } from "@/lib/hooks/use-session";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "accent" | "success";
  // [ADMIN-APPROVAL] Remove this field + the "User Approvals" nav item below
  // to retire the feature.
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard Overview",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    id: "comparator",
    label: "Document Comparator",
    icon: GitCompareArrows,
    href: "/comparator",
    badge: "Flagship",
    badgeVariant: "accent",
  },
  {
    id: "intelligent",
    label: "Intelligent Comparison",
    icon: Brain,
    href: "/intelligent",
    badge: "New",
    badgeVariant: "success",
  },
  {
    id: "translate",
    label: "Document Translation",
    icon: Languages,
    href: "/translate",
    badge: "New",
    badgeVariant: "success",
  },
  {
    id: "invoice",
    label: "Invoice Builder",
    icon: ReceiptText,
    href: "/invoice",
    badge: "New",
    badgeVariant: "success",
  },
  {
    id: "history",
    label: "History & Audits",
    icon: History,
    href: "/history",
  },
  {
    id: "analytics",
    label: "Vendor Analytics",
    icon: BarChart3,
    href: "/analytics",
  },
  // [ADMIN-APPROVAL] Remove this nav item to retire the feature.
  {
    id: "approvals",
    label: "User Approvals",
    icon: UserCheck,
    href: "/approvals",
    adminOnly: true,
  },
];

interface AppSidebarProps {
  activeItem: string;
  onNavigate: (id: string) => void;
}

export default function AppSidebar({ activeItem, onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const registry = useProcessingRegistry();
  const activeJobs = Object.values(registry?.jobs ?? {});
  const activeCount = activeJobs.length;
  const avgProgress =
    activeCount > 0 ? Math.round(activeJobs.reduce((sum, j) => sum + j.progress, 0) / activeCount) : 0;
  const { user } = useSession();
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative z-20",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary/20 shrink-0">
          <Layers className="w-5 h-5 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in-up overflow-hidden">
            <h1 className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate">
              DocIntel
            </h1>
            <p className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wider uppercase">
              Platform
            </p>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border mx-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-3 text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40">
            Navigation
          </p>
        )}
        {visibleNavItems.map((item) => {
          const isActive = activeItem === item.id;
          const Icon = item.icon;

          const button = (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary-foreground sidebar-active-indicator"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                )}
              />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span
                  className={cn(
                    "ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full",
                    item.badgeVariant === "accent"
                      ? "bg-sidebar-primary/20 text-sidebar-primary"
                      : "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  className={cn(
                    "flex items-center justify-center w-full rounded-lg px-3 py-2.5 transition-all duration-200 group relative",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary-foreground sidebar-active-indicator"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
                      isActive
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  <div className="flex items-center gap-2">
                    {item.label}
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-brand/20 text-brand">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>

      <Separator className="bg-sidebar-border mx-4" />

      {/* Bottom section */}
      <div className="px-3 py-4 space-y-3">
        {!collapsed && (
          <div className="px-3 py-3 rounded-lg bg-sidebar-primary/10 border border-sidebar-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className={cn("w-3.5 h-3.5 text-sidebar-primary", activeCount > 0 && "animate-pulse")} />
              <span className="text-xs font-semibold text-sidebar-foreground">
                AI Processing
              </span>
            </div>
            <p className="text-[11px] text-sidebar-foreground/60 leading-relaxed">
              {activeCount > 0
                ? `${activeCount} document${activeCount > 1 ? "s" : ""} processing…`
                : "No documents processing"}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-sidebar-accent overflow-hidden">
              <div
                className="h-full rounded-full bg-sidebar-primary transition-all duration-700"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
