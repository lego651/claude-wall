"use client";

import { useState, useEffect } from 'react';
import AdminLayout from "@/components/common/AdminLayout";

export default function AdminPropFirmsPage() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [newFirmName, setNewFirmName] = useState('');
  const [newFirmAddresses, setNewFirmAddresses] = useState(['']);
  const [editName, setEditName] = useState('');
  const [editAddresses, setEditAddresses] = useState([]);

  useEffect(() => {
    fetchFirms();
  }, []);

  const fetchFirms = async () => {
    try {
      const res = await fetch('/api/propfirms');
      const data = await res.json();
      setFirms(data.firms || []);
    } catch (error) {
      console.error('Error fetching firms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFirm = async (e) => {
    e.preventDefault();
    if (!newFirmName.trim()) return;

    try {
      const addresses = newFirmAddresses.filter(a => a.trim());
      const res = await fetch('/api/propfirms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFirmName, addresses }),
      });

      if (res.ok) {
        setNewFirmName('');
        setNewFirmAddresses(['']);
        fetchFirms();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add firm');
      }
    } catch (error) {
      alert('Error adding firm');
    }
  };

  const handleEdit = (firm) => {
    setEditingId(firm.id);
    setEditName(firm.name);
    setEditAddresses([...firm.addresses, '']);
  };

  const handleSaveEdit = async (id) => {
    try {
      const addresses = editAddresses.filter(a => a.trim());
      const res = await fetch('/api/propfirms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, addresses }),
      });

      if (res.ok) {
        setEditingId(null);
        fetchFirms();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update firm');
      }
    } catch (error) {
      alert('Error updating firm');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this firm?')) return;

    try {
      const res = await fetch(`/api/propfirms?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchFirms();
      } else {
        alert('Failed to delete firm');
      }
    } catch (error) {
      alert('Error deleting firm');
    }
  };

  const addAddressField = (isEdit = false) => {
    if (isEdit) {
      setEditAddresses([...editAddresses, '']);
    } else {
      setNewFirmAddresses([...newFirmAddresses, '']);
    }
  };

  const updateAddress = (index, value, isEdit = false) => {
    if (isEdit) {
      const updated = [...editAddresses];
      updated[index] = value;
      setEditAddresses(updated);
    } else {
      const updated = [...newFirmAddresses];
      updated[index] = value;
      setNewFirmAddresses(updated);
    }
  };

  const removeAddress = (index, isEdit = false) => {
    if (isEdit) {
      setEditAddresses(editAddresses.filter((_, i) => i !== index));
    } else {
      setNewFirmAddresses(newFirmAddresses.filter((_, i) => i !== index));
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Prop Firms</h1>
          <p className="text-sm text-gray-400">Manage prop firm names and wallet addresses</p>
        </div>

        {/* Add New Firm Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Firm</h2>
          <form onSubmit={handleAddFirm} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Firm Name</label>
              <input
                type="text"
                value={newFirmName}
                onChange={(e) => setNewFirmName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
                placeholder="e.g., FundingPips"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Wallet Addresses</label>
              {newFirmAddresses.map((address, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => updateAddress(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
                    placeholder="0x..."
                  />
                  {newFirmAddresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAddress(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addAddressField(false)}
                className="mt-2 text-sm text-[#635BFF] hover:underline"
              >
                + Add another address
              </button>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-[#635BFF] text-white rounded-lg font-semibold hover:bg-[#5548E6] transition-colors"
            >
              Add Firm
            </button>
          </form>
        </div>

        {/* Firms Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Firm Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Addresses</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {firms.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center text-gray-400">
                      No firms added yet. Add your first firm above.
                    </td>
                  </tr>
                ) : (
                  firms.map((firm) => (
                    <tr key={firm.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {editingId === firm.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">{firm.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === firm.id ? (
                          <div className="space-y-2">
                            {editAddresses.map((address, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  value={address}
                                  onChange={(e) => updateAddress(index, e.target.value, true)}
                                  className="flex-1 px-3 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
                                  placeholder="0x..."
                                />
                                {editAddresses.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeAddress(index, true)}
                                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addAddressField(true)}
                              className="text-xs text-[#635BFF] hover:underline"
                            >
                              + Add address
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {firm.addresses && firm.addresses.length > 0 ? (
                              firm.addresses.map((address, index) => (
                                <div key={index} className="text-sm text-gray-600 font-mono">
                                  {address}
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400 italic">No addresses</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === firm.id ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleSaveEdit(firm.id)}
                              className="px-4 py-1 text-sm bg-[#635BFF] text-white rounded-lg hover:bg-[#5548E6] transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEdit(firm)}
                              className="px-4 py-1 text-sm text-[#635BFF] hover:bg-[#635BFF] hover:bg-opacity-10 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(firm.id)}
                              className="px-4 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
