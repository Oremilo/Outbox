"use client";

import { useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";
import ComposeModal from "@/components/ComposeModal";
import ScheduledEmails from "@/components/ScheduledEmails";
import SentEmails from "@/components/SentEmails";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("scheduled");
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ message, type });
    },
    []
  );

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your email campaigns and monitor delivery
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => setComposeOpen(true)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Compose Campaign
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: "scheduled", label: "Scheduled Emails" },
          { id: "sent", label: "Sent Emails" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      >
        {/* Content container with glassmorphism */}
        <div className="glass-card rounded-2xl p-6">
          {activeTab === "scheduled" && (
            <ScheduledEmails refreshKey={refreshKey} />
          )}
          {activeTab === "sent" && (
            <SentEmails refreshKey={refreshKey} />
          )}
        </div>
      </Tabs>

      {/* Auto-refresh hint */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={triggerRefresh}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh data
        </button>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => {
          showToast("Campaign scheduled successfully!", "success");
          triggerRefresh();
        }}
        onError={(msg) => showToast(msg, "error")}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
