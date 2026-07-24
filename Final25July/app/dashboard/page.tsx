"use client";

import React, { useState, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProcessingRegistryProvider } from "@/lib/hooks/processing-registry";
import AppSidebar from "@/components/dashboard/app-sidebar";
import TopNavbar from "@/components/dashboard/top-navbar";
import DashboardOverview from "@/components/dashboard/dashboard-overview";
import DocumentComparator from "@/components/dashboard/document-comparator";
import ComparisonResults from "@/components/dashboard/comparison-results";
import AIWorkspace from "@/components/dashboard/ai-workspace";
import HistoryAudits from "@/components/dashboard/history-audits";
import VendorAnalytics from "@/components/dashboard/vendor-analytics";
import ToleranceSettings from "@/components/dashboard/tolerance-settings";
import UserProfile from "@/components/dashboard/user-profile";

interface PageConfig {
  id: string;
  breadcrumbs: { label: string; href?: string }[];
}

const pages: Record<string, PageConfig> = {
  dashboard: {
    id: "dashboard",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Dashboard Overview" },
    ],
  },
  comparator: {
    id: "comparator",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Document Comparator" },
    ],
  },
  history: {
    id: "history",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "History & Audits" },
    ],
  },
  analytics: {
    id: "analytics",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Vendor Analytics" },
    ],
  },
  settings: {
    id: "settings",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Settings" },
      { label: "Tolerance Rules" },
    ],
  },
  profile: {
    id: "profile",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "User Profile" },
    ],
  },
};

type ComparatorFlow = "upload" | "results" | "workspace";

export default function DashboardPage() {
  const [activePage, setActivePage] = useState("dashboard");
  const [pageKey, setPageKey] = useState(0);

  // Comparator sub-flow state, lifted up here so a comparison's ID survives
  // navigating between the Ingestion -> Results -> AI Workspace screens.
  const [comparatorFlow, setComparatorFlow] = useState<ComparatorFlow>("upload");
  const [activeComparisonId, setActiveComparisonId] = useState<string | null>(null);

  const handleNavigate = useCallback(
    (id: string) => {
      if (id !== activePage && pages[id]) {
        setActivePage(id);
        setPageKey((k) => k + 1);
        // Every fresh navigation into the comparator starts a new upload flow.
        if (id === "comparator") {
          setComparatorFlow("upload");
          setActiveComparisonId(null);
        }
      }
    },
    [activePage]
  );

  // Jumps straight to a specific comparison's results — used by the
  // "Recent Comparisons" list and Audit Log rows so a past comparison is a
  // single click away instead of requiring a re-run.
  const handleViewComparison = useCallback((comparisonId: string) => {
    setActivePage("comparator");
    setPageKey((k) => k + 1);
    setComparatorFlow("results");
    setActiveComparisonId(comparisonId);
  }, []);

  const currentPage = pages[activePage] || pages.dashboard;

  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardOverview onNavigate={handleNavigate} onViewComparison={handleViewComparison} />;
      case "comparator":
        if (comparatorFlow === "workspace" && activeComparisonId) {
          return (
            <AIWorkspace
              comparisonId={activeComparisonId}
              onBack={() => setComparatorFlow("results")}
            />
          );
        }
        if (comparatorFlow === "results" && activeComparisonId) {
          return (
            <ComparisonResults
              comparisonId={activeComparisonId}
              onBack={() => {
                setComparatorFlow("upload");
                setActiveComparisonId(null);
              }}
              onOpenWorkspace={() => setComparatorFlow("workspace")}
            />
          );
        }
        return (
          <DocumentComparator
            onComparisonCreated={(comparisonId) => {
              setActiveComparisonId(comparisonId);
              setComparatorFlow("results");
            }}
          />
        );
      case "history":
        return <HistoryAudits onViewComparison={handleViewComparison} />;
      case "analytics":
        return <VendorAnalytics />;
      case "settings":
        return <ToleranceSettings />;
      case "profile":
        return <UserProfile />;
      default:
        return <DashboardOverview onNavigate={handleNavigate} onViewComparison={handleViewComparison} />;
    }
  };

  return (
    <TooltipProvider delay={0}>
      <ProcessingRegistryProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
          <AppSidebar activeItem={activePage} onNavigate={handleNavigate} />

          <div className="flex-1 flex flex-col overflow-hidden">
            <TopNavbar breadcrumbs={currentPage.breadcrumbs} onNavigate={handleNavigate} />

            <main className="flex-1 overflow-y-auto grid-background">
              <div
                key={pageKey}
                className="animate-fade-in-up p-6 lg:p-8 max-w-[1400px] mx-auto w-full"
              >
                {renderContent()}
              </div>
            </main>
          </div>
        </div>
      </ProcessingRegistryProvider>
    </TooltipProvider>
  );
}
