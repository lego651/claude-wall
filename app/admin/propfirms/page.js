"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPropFirmsPage() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFirm, setEditingFirm] = useState(null);
  const [formName, setFormName] = useState('');
  const [formAddresses, setFormAddresses] = useState(['']);

  // Load firms on mount
  useEffect(() => {
    loadFirms();
  }, []);

  async function loadFirms() {
    try {
      setLoading(true);
      const response = await fetch('/api/propfirms');
      if (!response.ok) throw new Error('Failed to load firms');
      const data = await response.json();
      setFirms(data.firms || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formName.trim()) {
      alert('Please enter a firm name');
      return;
    }

    const addresses = formAddresses.filter(a => a.trim());

    try {
      if (editingFirm) {
        // Update existing firm
        const response = await fetch('/api/propfirms', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingFirm.id,
            name: formName,
            addresses
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update firm');
        }
      } else {
        // Create new firm
        const response = await fetch('/api/propfirms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            addresses
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create firm');
        }
      }

      // Reset form and reload
      setFormName('');
      setFormAddresses(['']);
      setShowAddForm(false);
      setEditingFirm(null);
      loadFirms();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this firm?')) return;

    try {
      const response = await fetch(`/api/propfirms?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete firm');
      }

      loadFirms();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleEdit(firm) {
    setEditingFirm(firm);
    setFormName(firm.name);
    setFormAddresses(firm.addresses.length > 0 ? firm.addresses : ['']);
    setShowAddForm(true);
  }

  function handleCancel() {
    setFormName('');
    setFormAddresses(['']);
    setShowAddForm(false);
    setEditingFirm(null);
  }

  function addAddressField() {
    setFormAddresses([...formAddresses, '']);
  }

  function removeAddressField(index) {
    setFormAddresses(formAddresses.filter((_, i) => i !== index));
  }

  function updateAddress(index, value) {
    const updated = [...formAddresses];
    updated[index] = value;
    setFormAddresses(updated);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-error">Error: {error}</div>;

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Prop Firms Admin</h1>
        {!showAddForm && (
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            + Add Firm
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="card bg-base-200 shadow-lg mb-8">
          <div className="card-body">
            <h2 className="card-title">
              {editingFirm ? 'Edit Firm' : 'Add New Firm'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Firm Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., FundingPips"
                  required
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Wallet Addresses</span>
                </label>
                {formAddresses.map((address, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="input input-bordered flex-1"
                      value={address}
                      onChange={(e) => updateAddress(index, e.target.value)}
                      placeholder="0x..."
                    />
                    {formAddresses.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-error btn-square"
                        onClick={() => removeAddressField(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline mt-2"
                  onClick={addAddressField}
                >
                  + Add Address
                </button>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary">
                  {editingFirm ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Firms Table */}
      {firms.length === 0 ? (
        <div className="text-center py-12 text-base-content/60">
          No prop firms yet. Click "Add Firm" to create one.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Firm Name</th>
                <th>Addresses</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((firm) => (
                <tr key={firm.id}>
                  <td>
                    <Link
                      href={`/propfirm/${firm.id}`}
                      className="link link-primary font-semibold"
                    >
                      {firm.name}
                    </Link>
                  </td>
                  <td>
                    <div className="space-y-1">
                      {firm.addresses.length === 0 ? (
                        <span className="text-base-content/60 text-sm">No addresses</span>
                      ) : (
                        firm.addresses.map((addr, idx) => (
                          <div key={idx} className="font-mono text-sm">
                            {addr.slice(0, 8)}...{addr.slice(-6)}
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    {new Date(firm.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleEdit(firm)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-error btn-ghost"
                        onClick={() => handleDelete(firm.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
