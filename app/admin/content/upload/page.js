"use client";

/**
 * Admin Content Upload UI (TICKET-S8-007)
 * /admin/content/upload
 *
 * Allows admins to upload firm content and industry news
 * with AI categorization preview and approval workflow.
 */

import { useState } from 'react';
import Link from 'next/link';

// Firm list - TODO: Fetch from API
const FIRMS = [
  { id: 'fundingpips', name: 'FundingPips' },
  { id: 'fxify', name: 'FXIFY' },
  { id: 'fundednext', name: 'Funded Next' },
  { id: 'the5ers', name: 'The5ers' },
  { id: 'instantfunding', name: 'Instant Funding' },
  { id: 'blueguardian', name: 'Blue Guardian' },
  { id: 'aquafunded', name: 'Aqua Funded' },
  { id: 'alphacapitalgroup', name: 'Alpha Capital Group' },
  { id: 'ftmo', name: 'FTMO' },
  { id: 'topstep', name: 'Topstep' },
  { id: 'apex', name: 'Apex Trading' },
];

export default function AdminContentUpload() {
  const [tab, setTab] = useState('firm'); // 'firm' or 'industry'
  const [formData, setFormData] = useState({
    firm_id: '',
    content_type: 'company_news',
    title: '',
    raw_content: '',
    source_type: 'manual_upload',
    source_url: '',
    content_date: new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAiResult(null);
    setError(null);

    try {
      const endpoint =
        tab === 'firm'
          ? '/api/admin/content/firm'
          : '/api/admin/content/industry';

      const payload = tab === 'firm' ? formData : {
        title: formData.title,
        raw_content: formData.raw_content,
        source_type: formData.source_type,
        source_url: formData.source_url,
        content_date: formData.content_date,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Upload failed');
      }

      setAiResult(data.item);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!aiResult) return;

    try {
      const endpoint =
        tab === 'firm'
          ? `/api/admin/content/firm/${aiResult.id}`
          : `/api/admin/content/industry/${aiResult.id}`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Publish failed');
      }

      alert('✓ Content published successfully!');

      // Reset form
      setFormData({
        firm_id: '',
        content_type: 'company_news',
        title: '',
        raw_content: '',
        source_type: 'manual_upload',
        source_url: '',
        content_date: new Date().toISOString().slice(0, 10),
      });
      setAiResult(null);
    } catch (err) {
      alert(`Publish error: ${err.message}`);
    }
  };

  const handleSaveDraft = () => {
    alert('✓ Saved as draft (already saved, not published)');

    // Reset form
    setFormData({
      firm_id: '',
      content_type: 'company_news',
      title: '',
      raw_content: '',
      source_type: 'manual_upload',
      source_url: '',
      content_date: new Date().toISOString().slice(0, 10),
    });
    setAiResult(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Upload Content</h1>
        <p className="text-base-content/60 mt-2">
          Add firm news, rule changes, promotions, or industry news with AI categorization
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="tabs tabs-boxed mb-6">
        <button
          className={`tab ${tab === 'firm' ? 'tab-active' : ''}`}
          onClick={() => {
            setTab('firm');
            setAiResult(null);
            setError(null);
          }}
        >
          Firm Content
        </button>
        <button
          className={`tab ${tab === 'industry' ? 'tab-active' : ''}`}
          onClick={() => {
            setTab('industry');
            setAiResult(null);
            setError(null);
          }}
        >
          Industry News
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card card-border bg-base-100 p-6 space-y-4 shadow-lg">
        {/* Firm Selector (only for firm content) */}
        {tab === 'firm' && (
          <div>
            <label className="label">
              <span className="label-text font-medium">Firm *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.firm_id}
              onChange={(e) => handleInputChange('firm_id', e.target.value)}
              required
            >
              <option value="">Select firm...</option>
              {FIRMS.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Content Type Selector (only for firm content) */}
        {tab === 'firm' && (
          <div>
            <label className="label">
              <span className="label-text font-medium">Content Type *</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {[
                { value: 'company_news', label: 'Company News' },
                { value: 'rule_change', label: 'Rule Change' },
                { value: 'promotion', label: 'Promotion' },
              ].map((type) => (
                <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="content_type"
                    value={type.value}
                    checked={formData.content_type === type.value}
                    onChange={(e) => handleInputChange('content_type', e.target.value)}
                    className="radio radio-primary"
                  />
                  <span>{type.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="label">
            <span className="label-text font-medium">Title *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="e.g., Instant Payout Feature Launched"
            required
          />
        </div>

        {/* Content */}
        <div>
          <label className="label">
            <span className="label-text font-medium">Content *</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-40"
            value={formData.raw_content}
            onChange={(e) => handleInputChange('raw_content', e.target.value)}
            placeholder="Paste full text from Discord, email, screenshot..."
            required
          />
          <div className="label">
            <span className="label-text-alt text-base-content/50">
              {formData.raw_content.length} characters
            </span>
          </div>
        </div>

        {/* Source Type and Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">
              <span className="label-text font-medium">Source Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.source_type}
              onChange={(e) => handleInputChange('source_type', e.target.value)}
            >
              <option value="manual_upload">Manual Upload</option>
              <option value="discord">Discord</option>
              <option value="firm_email">Email</option>
              <option value="twitter">Twitter</option>
              <option value="reddit">Reddit</option>
              {tab === 'industry' && <option value="news_website">News Website</option>}
              {tab === 'industry' && <option value="regulatory">Regulatory</option>}
            </select>
          </div>

          <div>
            <label className="label">
              <span className="label-text font-medium">Date *</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={formData.content_date}
              onChange={(e) => handleInputChange('content_date', e.target.value)}
              required
            />
          </div>
        </div>

        {/* Source URL */}
        <div>
          <label className="label">
            <span className="label-text font-medium">Source URL (Optional)</span>
          </label>
          <input
            type="url"
            className="input input-bordered w-full"
            value={formData.source_url}
            onChange={(e) => handleInputChange('source_url', e.target.value)}
            placeholder="https://discord.com/..."
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading loading-spinner" />
              Processing with AI...
            </>
          ) : (
            'Process with AI'
          )}
        </button>
      </form>

      {/* AI Results Preview */}
      {aiResult && (
        <div className="card card-border bg-base-200 p-6 mt-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">✨ AI Processing Results</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <strong className="min-w-32">AI Category:</strong>
              <span className="badge badge-primary">{aiResult.ai_category}</span>
            </div>

            <div className="flex items-start gap-3">
              <strong className="min-w-32">Confidence:</strong>
              <div className="flex items-center gap-2">
                <progress
                  className="progress progress-primary w-32"
                  value={aiResult.ai_confidence * 100}
                  max="100"
                />
                <span>{(aiResult.ai_confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            {aiResult.ai_tags?.length > 0 && (
              <div className="flex items-start gap-3">
                <strong className="min-w-32">Tags:</strong>
                <div className="flex flex-wrap gap-2">
                  {aiResult.ai_tags.map((tag, i) => (
                    <span key={i} className="badge badge-outline badge-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {aiResult.mentioned_firm_ids?.length > 0 && (
              <div className="flex items-start gap-3">
                <strong className="min-w-32">Mentioned Firms:</strong>
                <span>{aiResult.mentioned_firm_ids.join(', ')}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <strong>AI Summary:</strong>
              <p className="p-4 bg-base-100 rounded-lg border border-base-300">
                {aiResult.ai_summary}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <button onClick={handleApprove} className="btn btn-success">
              ✓ Approve & Publish
            </button>
            <button onClick={handleSaveDraft} className="btn btn-outline">
              Save as Draft
            </button>
            <Link href="/admin/content/review" className="btn btn-ghost">
              View Queue →
            </Link>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-base-200 rounded-lg">
        <h3 className="font-bold mb-2">💡 Tips</h3>
        <ul className="text-sm space-y-1 list-disc list-inside text-base-content/70">
          <li>Paste full content for best AI accuracy (not just headlines)</li>
          <li>Include source URL when available for verification</li>
          <li>Review AI summary before publishing</li>
          <li>Draft items won't appear in weekly digest until published</li>
        </ul>
      </div>
    </div>
  );
}
