"use client";

import { useEffect, useState, useCallback } from "react";

interface TwitterDraft {
  id: string;
  draft_date: string;
  tweet_text: string;
  template: "A" | "B";
  creator_handle: string | null;
  video_title: string | null;
  video_url: string | null;
  news_url: string | null;
  status: "pending" | "approved" | "posted" | "skipped" | "failed";
  tweet_id: string | null;
  failure_reason: string | null;
  auto_approve: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_BADGE: Record<TwitterDraft["status"], string> = {
  pending: "badge-warning",
  approved: "badge-success",
  posted: "badge-info",
  skipped: "badge-ghost",
  failed: "badge-error",
};

function CharCount({ text }: { text: string }) {
  // Approximate Twitter char count (URLs = 23 chars)
  const urlMatches = text.match(/https?:\/\/\S+/g) ?? [];
  let count = text.length;
  for (const url of urlMatches) count = count - url.length + 23;
  const over = count > 280;
  return (
    <span className={`text-xs font-mono ${over ? "text-error" : "text-base-content/40"}`}>
      {count}/280
    </span>
  );
}

function DraftCard({
  draft,
  onUpdate,
}: {
  draft: TwitterDraft;
  onUpdate: (id: string, changes: Partial<TwitterDraft>) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(draft.tweet_text);
  const [loading, setLoading] = useState(false);

  async function patch(body: object) {
    setLoading(true);
    const res = await fetch(`/api/admin/twitter/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.draft) onUpdate(draft.id, json.draft);
    setLoading(false);
  }

  async function saveEdit() {
    await patch({ tweet_text: editText });
    setEditMode(false);
  }

  const isUpcoming = draft.status === "pending" || draft.status === "approved";
  const tweetUrl = draft.tweet_id
    ? `https://twitter.com/i/web/status/${draft.tweet_id}`
    : null;

  return (
    <div className={`card bg-base-100 border ${isUpcoming ? "border-primary/30" : "border-base-200"} shadow-sm`}>
      <div className="card-body gap-3 p-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm">{draft.draft_date}</span>
            <span className={`badge badge-sm ${STATUS_BADGE[draft.status]}`}>
              {draft.status}
            </span>
            <span className="badge badge-sm badge-ghost">Template {draft.template}</span>
          </div>
          {tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              View on 𝕏
            </a>
          )}
        </div>

        {/* Creator mention */}
        {draft.creator_handle && (
          <div className="text-xs text-base-content/50">
            Pinging:{" "}
            <a
              href={`https://twitter.com/${draft.creator_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary"
            >
              @{draft.creator_handle}
            </a>
          </div>
        )}

        {/* Video title */}
        {draft.video_title && (
          <div className="text-xs text-base-content/50 truncate">
            Video:{" "}
            {draft.video_url ? (
              <a href={draft.video_url} target="_blank" rel="noopener noreferrer" className="underline">
                {draft.video_title}
              </a>
            ) : (
              draft.video_title
            )}
          </div>
        )}

        {/* Tweet text */}
        {editMode ? (
          <div className="space-y-2">
            <textarea
              className="textarea textarea-bordered w-full text-sm font-mono"
              rows={6}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <CharCount text={editText} />
              <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={loading}>
                Save
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => { setEditText(draft.tweet_text); setEditMode(false); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <pre className="text-sm whitespace-pre-wrap font-sans bg-base-200 rounded-lg p-3 leading-relaxed">
              {draft.tweet_text}
            </pre>
            <div className="flex justify-end">
              <CharCount text={draft.tweet_text} />
            </div>
          </div>
        )}

        {/* Failure reason */}
        {draft.failure_reason && (
          <div className="alert alert-error text-xs">
            <span>Failed: {draft.failure_reason}</span>
          </div>
        )}

        {/* Actions */}
        {(draft.status === "pending" || draft.status === "failed") && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="btn btn-sm btn-success"
              onClick={() => patch({ status: "approved" })}
              disabled={loading}
            >
              ✓ Approve
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setEditMode(true)}
              disabled={loading}
            >
              ✎ Edit
            </button>
            <button
              className="btn btn-sm btn-ghost text-error"
              onClick={() => patch({ status: "skipped" })}
              disabled={loading}
            >
              Skip
            </button>
          </div>
        )}

        {draft.status === "approved" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-success font-semibold self-center">
              ✓ Will post at 11:15 UTC
            </span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setEditMode(true)}
              disabled={loading}
            >
              ✎ Edit
            </button>
            <button
              className="btn btn-sm btn-ghost text-error"
              onClick={() => patch({ status: "skipped" })}
              disabled={loading}
            >
              Skip
            </button>
          </div>
        )}

        {/* Auto-approve toggle (for any non-posted draft) */}
        {draft.status !== "posted" && draft.status !== "skipped" && (
          <label className="flex items-center gap-2 text-xs text-base-content/50 cursor-pointer pt-1">
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-primary"
              checked={draft.auto_approve}
              onChange={(e) => patch({ auto_approve: e.target.checked })}
              disabled={loading}
            />
            Auto-approve (Week 3 mode — posts without manual review)
          </label>
        )}
      </div>
    </div>
  );
}

export default function TwitterQueuePage() {
  const [drafts, setDrafts] = useState<TwitterDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/twitter/drafts");
    const json = await res.json();
    if (json.drafts) {
      setDrafts(json.drafts);
    } else {
      setError(json.error ?? "Unknown error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(id: string, changes: Partial<TwitterDraft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
  }

  const upcoming = drafts.filter((d) => d.status === "pending" || d.status === "approved");
  const history = drafts.filter((d) => !["pending", "approved"].includes(d.status));

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Twitter Queue</h1>
          <p className="text-sm text-base-content/50 mt-1">
            Daily YouTube picks bot — review drafts before they post at 11:15 UTC
          </p>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Upcoming drafts */}
      <section className="space-y-4">
        <h2 className="font-bold text-base-content/70 uppercase text-xs tracking-widest">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="text-sm text-base-content/40 py-6 text-center">
            No pending drafts. Generator runs nightly at 22:15 UTC.
          </div>
        ) : (
          upcoming.map((d) => (
            <DraftCard key={d.id} draft={d} onUpdate={handleUpdate} />
          ))
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-bold text-base-content/70 uppercase text-xs tracking-widest">
            History (last 14 days)
          </h2>
          {history.map((d) => (
            <DraftCard key={d.id} draft={d} onUpdate={handleUpdate} />
          ))}
        </section>
      )}
    </main>
  );
}
