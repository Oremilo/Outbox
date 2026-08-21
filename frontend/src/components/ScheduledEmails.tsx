"use client";

import { useEffect, useState, useCallback } from "react";
import Badge from "./ui/Badge";
import { getScheduledEmails } from "@/lib/api-client";
import { EmailDTO } from "@/lib/types";

interface ScheduledEmailsProps {
  refreshKey: number;
}

export default function ScheduledEmails({ refreshKey }: ScheduledEmailsProps) {
  const [emails, setEmails] = useState<EmailDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getScheduledEmails(page, 15);
      setEmails(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to fetch scheduled emails:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails, refreshKey]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/30"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (emails.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-400 mb-1">No scheduled emails</h3>
        <p className="text-sm text-slate-600">
          Compose a new campaign to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Recipient
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Scheduled For
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {emails.map((email) => (
              <tr
                key={email.id}
                className="hover:bg-slate-800/30 transition-colors duration-150"
              >
                <td className="px-4 py-3.5">
                  <p className="text-sm text-white font-medium">{email.recipientEmail}</p>
                  <p className="text-xs text-slate-500 mt-0.5">from {email.senderName}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-sm text-slate-300 truncate max-w-[200px]">{email.subject}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-sm text-slate-400">
                    {new Date(email.scheduledTime).toLocaleString()}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <Badge status={email.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-slate-500">
            Showing {emails.length} of {total} emails
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
