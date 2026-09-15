"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  GitCompareArrows,
  Brain,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Languages,
  ReceiptText,
  ScrollText,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/hooks/use-session";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  // [ADMIN-APPROVAL] Remove this field + the "User Approvals" nav item below
  // to retire the feature.
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    id: "comparator",
    label: "Document Comparator",
    icon: GitCompareArrows,
    href: "/comparator",
  },
  {
    id: "intelligent",
    label: "Intelligent Comparison",
    icon: Brain,
    href: "/intelligent",
  },
  {
    id: "translate",
    label: "Document Translation",
    icon: Languages,
    href: "/translate",
  },
  {
    id: "invoice",
    label: "Document Filler",
    icon: ReceiptText,
    href: "/invoice",
  },
  {
    id: "summary",
    label: "Document Summary",
    icon: ScrollText,
    href: "/summary",
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
  const { user } = useSession();
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative z-20",
        collapsed ? "w-[72px]" : "w-[320px]"
      )}
    >
      {/* Logo / Brand — the full logo (mark + wordmark), never cropped, just
          sized to whatever room this header has in each collapse state. */}
      <div className={cn("flex flex-col items-center justify-center shrink-0 py-4", collapsed ? "px-2" : "px-5")}>
        <Image
          src="/Logo.png"
          alt="Company logo"
          width={collapsed ? 44 : 108}
          height={collapsed ? 46 : 112}
          className="object-contain"
          priority
        />
        {!collapsed && (
          <div className="animate-fade-in-up text-center mt-1">
            <h1 className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate">
              DocIntel
            </h1>
            <p className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wider uppercase">
              Platform
            </p>
          </div>
        )}
      </div>

      <div className="px-4">
        <Separator className="bg-sidebar-border" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
                "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-200 group relative",
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
                <span className="truncate min-w-0">{item.label}</span>
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
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>

      <div className="px-4 py-4">
        <Separator className="bg-sidebar-border" />
      </div>

      {/* Collapse/expand toggle — edge-mounted so it's always in the same
          spot and never gets covered by anything docked to a page corner. */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border shadow-md flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-200 z-30 cursor-pointer"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
