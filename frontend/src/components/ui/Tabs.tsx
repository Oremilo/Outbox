"use client";

import { ReactNode } from "react";

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export default function Tabs({ tabs, activeTab, onChange, children }: TabsProps) {
  return (
    <div>
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200 cursor-pointer
              ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`
                  text-xs px-1.5 py-0.5 rounded-md
                  ${activeTab === tab.id ? "bg-white/20" : "bg-slate-700"}
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
