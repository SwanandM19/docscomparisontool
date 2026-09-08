"use client";

import React, { useState, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProcessingRegistryProvider } from "@/lib/hooks/processing-registry";
import AppSidebar from "@/components/dashboard/app-sidebar";
import TopNavbar from "@/components/dashboard/top-navbar";
import DashboardOverview from "@/components/dashboard/dashboard-overview";
import DocumentComparator from "@/components/dashboard/document-comparator";
import IntelligentComparison from "@/components/dashboard/intelligent-comparison";
import DocumentTranslation from "@/components/dashboard/document-translation";
import InvoiceBuilder from "@/components/dashboard/invoice-builder";
import AssistantWidget from "@/components/dashboard/assistant-widget";
import ComparisonResults from "@/components/dashboard/comparison-results";
import AIWorkspace from "@/components/dashboard/ai-workspace";
import HistoryAudits from "@/components/dashboard/history-audits";
import VendorAnalytics from "@/components/dashboard/vendor-analytics";
import ToleranceSettings from "@/components/dashboard/tolerance-settings";
import UserProfile from "@/components/dashboard/user-profile";
// [ADMIN-APPROVAL] Remove this import + its "approvals" entries below to retire the feature.
import UserApprovals from "@/components/dashboard/user-approvals";

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
  intelligent: {
    id: "intelligent",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Intelligent Comparison" },
    ],
  },
  translate: {
    id: "translate",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Document Translation" },
    ],
  },
  invoice: {
    id: "invoice",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "Invoice Builder" },
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
  // [ADMIN-APPROVAL] Remove this entry to retire the feature.
  approvals: {
    id: "approvals",
    breadcrumbs: [
      { label: "DocIntel", href: "/dashboard" },
      { label: "User Approvals" },
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
      case "intelligent":
        return <IntelligentComparison />;
      case "translate":
        return <DocumentTranslation />;
      case "invoice":
        return <InvoiceBuilder />;
      case "history":
        return <HistoryAudits onViewComparison={handleViewComparison} />;
      case "analytics":
        return <VendorAnalytics />;
      case "settings":
        return <ToleranceSettings />;
      case "profile":
        return <UserProfile />;
      // [ADMIN-APPROVAL] Remove this case to retire the feature.
      case "approvals":
        return <UserApprovals />;
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

        {/* Global assistant — floating launcher + window, available on every view. */}
        <AssistantWidget />
      </ProcessingRegistryProvider>
    </TooltipProvider>
  );
}
