import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { createPageUrl } from '@/utils';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, CheckCircle2, XCircle, Layers, Percent } from 'lucide-react';
import BatchForm from '../components/batches/BatchForm';
import PullToRefresh from '../components/ui/PullToRefresh';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CLIENT_COLORS = {
  HW: 'bg-blue-100 text-blue-700',
  COL: 'bg-purple-100 text-purple-700',
  PW: 'bg-red-100 text-red-700',
  EVK: 'bg-green-100 text-green-700',
  PK: 'bg-orange-100 text-orange-700',
  AEC: 'bg-teal-100 text-teal-700',
};

function YieldBadge({ ok, total }) {
  if (!total) return <span className="text-slate-300 text-xs">—</span>;
  const pct = Math.round((ok / total) * 100);
  const color = pct >= 98 ? 'bg-green-100 text-green-700 border-green-200'
    : pct >= 95 ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return <Badge variant="outline" className={`text-xs font-semibold ${color}`}>{pct}%</Badge>;
}



export default function BatchMonitor() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterPartNumber, setFilterPartNumber] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [clientMap, setClientMap] = useState({});
  const navigate = useNavigate();

  useEffect(() => { loadBatches(); }, []);

  // Load P/N → client mapping from Picklist Manager (Part Number vs Alias)
  useEffect(() => {
    apiClient.entities.PicklistOption.filter({ category: 'Part Number vs Alias_Picklist' })
      .then(opts => {
        const list = Array.isArray(opts) ? opts : (opts?.items || []);
        const map = {};
        list.forEach(o => { if (o.value) map[o.value] = o.client || null; });
        setClientMap(map);
      })
      .catch(() => {});
  }, []);

  const [error, setError] = useState(null);

  const loadBatches = async () => {
    try {
      const data = await apiClient.entities.ProductionBatch.list('-production_date', 50000);
      setBatches(data || []);
      setError(null);
    } catch (e) {
      console.error('Failed to load batches:', e);
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await apiClient.entities.ProductionBatch.delete(id);
    setBatches(prev => prev.filter(b => b.id !== id));
  };

  const handleSaved = (saved) => {
    setBatches(prev => {
      // Remove any temp record and update or prepend
      const filtered = prev.filter(b => !String(b.id).startsWith('temp-'));
      const idx = filtered.findIndex(b => b.id === saved.id);
      if (idx >= 0) { const next = [...filtered]; next[idx] = saved; return next; }
      return [saved, ...filtered];
    });
    setShowForm(false);
    setEditBatch(null);
  };

  const filtered = batches.filter(b => {
    if (search) {
      const q = search.toLowerCase();
      if (!b.batch_number?.toLowerCase().includes(q) && !b.part_number?.toLowerCase().includes(q) && !b.machine?.toLowerCase().includes(q) && !b.operation_number?.toLowerCase().includes(q)) return false;
    }
    if (filterPartNumber && !b.part_number?.toLowerCase().includes(filterPartNumber.toLowerCase())) return false;
    if (filterDate && b.production_date !== filterDate) return false;
    if (filterClient && clientMap[b.part_number] !== filterClient) return false;
    return true;
  });

  // Summary KPIs (all data)
  const totalParts = batches.reduce((s, b) => s + (b.total_parts || 0), 0);
  const totalOk = batches.reduce((s, b) => s + (b.parts_ok || 0), 0);
  const totalReprocessed = batches.reduce((s, b) => s + (b.parts_reprocessed || 0), 0);
  const totalNok = batches.reduce((s, b) => s + (b.parts_nok || 0), 0);
  const overallYield = totalParts > 0 ? Math.round((totalOk / totalParts) * 100) : null;

  // Summary KPIs (active selection / filtered table)
  const selParts = filtered.reduce((s, b) => s + (b.total_parts || 0), 0);
  const selOk = filtered.reduce((s, b) => s + (b.parts_ok || 0), 0);
  const selReprocessed = filtered.reduce((s, b) => s + (b.parts_reprocessed || 0), 0);
  const selNok = filtered.reduce((s, b) => s + (b.parts_nok || 0), 0);
  const selHasFilter = !!(search || filterPartNumber || filterDate || filterClient);
  // Dynamic label for the selection KPI cards, showing the current filter
  const selLabel = filterClient ? `Customer ${filterClient}`
    : filterPartNumber ? `P/N ${filterPartNumber}`
    : filterDate ? `Date ${format(new Date(filterDate), 'MMM d, yyyy')}`
    : 'Selected';

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-6">
      <p className="text-red-600 font-semibold">Failed to load Production Monitor</p>
      <p className="text-slate-500 text-sm">{error}</p>
      <button onClick={loadBatches} className="text-blue-600 underline text-sm">Try again</button>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadBatches}>
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Monitor</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track production batches, yield, and link to RCCA</p>
        </div>
        <Button onClick={() => { setEditBatch(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2 sm:w-auto w-full">
          <Plus className="w-4 h-4" /> New Batch
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Batches', value: new Set(batches.map(b => b.batch_number).filter(Boolean)).size.toLocaleString(), pct: null, icon: Layers, color: 'text-purple-600', bg: 'bg-purple-100' },
          { label: 'Total Parts', value: totalParts.toLocaleString(), pct: null, icon: Layers, color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Parts OK', value: totalOk.toLocaleString(), pct: totalParts > 0 ? Math.round((totalOk / totalParts) * 100) : null, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Parts Reprocessed', value: totalReprocessed.toLocaleString(), pct: totalParts > 0 ? Math.round((totalReprocessed / totalParts) * 100) : null, icon: Layers, color: 'text-yellow-600', bg: 'bg-yellow-100' },
          { label: 'Parts NOK', value: totalNok.toLocaleString(), pct: totalParts > 0 ? Math.round((totalNok / totalParts) * 100) : null, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
        ].map(({ label, value, pct, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                {loading ? <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" /> : <span className={`text-2xl font-bold ${color}`}>{value}</span>}
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-3">{label}</p>
              {!loading && pct !== null && (
                <p className={`text-xs font-semibold mt-1 ${color}`}>{pct}% of total</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selection KPI Cards (active table selection) */}
      {(
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          {[
            { label: `Batches (${selLabel})`, value: new Set(filtered.map(b => b.batch_number).filter(Boolean)).size.toLocaleString(), pct: null, icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: `Parts (${selLabel})`, value: selParts.toLocaleString(), pct: null, icon: Layers, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: `OK (${selLabel})`, value: selOk.toLocaleString(), pct: selParts > 0 ? Math.round((selOk / selParts) * 100) : null, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
            { label: `Reprocessed (${selLabel})`, value: selReprocessed.toLocaleString(), pct: selParts > 0 ? Math.round((selReprocessed / selParts) * 100) : null, icon: Layers, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: `NOK (${selLabel})`, value: selNok.toLocaleString(), pct: selParts > 0 ? Math.round((selNok / selParts) * 100) : null, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, pct, icon: Icon, color, bg }) => (
            <Card key={label} className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  {loading ? <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" /> : <span className={`text-2xl font-bold ${color}`}>{value}</span>}
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-3">{label}</p>
                {!loading && pct !== null && (
                  <p className={`text-xs font-semibold mt-1 ${color}`}>{pct}% of selection</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall yield banner */}
      {overallYield !== null && !loading && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 ${
          overallYield >= 98 ? 'bg-green-50 border-green-200 text-green-800'
          : overallYield >= 95 ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
          : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <Percent className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">Overall First-Pass Yield: {overallYield}%</span>
          <span className="text-xs opacity-70 ml-1">({totalOk.toLocaleString()} OK / {totalParts.toLocaleString()} total)</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batch, part, machine..." className="pl-9 text-sm h-9" />
        </div>
        <Input value={filterPartNumber} onChange={e => setFilterPartNumber(e.target.value)} placeholder="Filter by part number..." className="text-sm h-9 w-40" />
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="text-sm h-9 w-40 text-slate-500" />
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="text-sm h-9 w-36 rounded-md border border-input bg-background px-3 text-slate-700 cursor-pointer">
          <option value="">All customers</option>
          {Object.keys(CLIENT_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Batch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Part</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Process Step</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Q-ty NOK</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Customer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-green-600">OK</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-yellow-600 hidden md:table-cell">Reprocessed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-red-500">NOK</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Yield</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden xl:table-cell">RCCA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Recorded By</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(10).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400 text-sm">
                      {batches.length === 0 ? 'No batches yet. Click "New Batch" to get started.' : 'No batches match your search.'}
                    </td>
                  </tr>
                )
                : filtered.map(batch => (
                   <tr key={batch.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setEditBatch(batch); setShowForm(true); }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-slate-800">{batch.batch_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700">{batch.part_number}</span>
                      {batch.part_description && <span className="text-xs text-slate-400 block">{batch.part_description}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{batch.machine || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{batch.operation_number || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {(() => {
                        const client = clientMap[batch.part_number];
                        return client
                          ? <span className={`text-xs font-semibold px-2 py-0.5 rounded ${CLIENT_COLORS[client] || 'bg-slate-100 text-slate-600'}`}>{client}</span>
                          : <span className="text-slate-300 text-xs">—</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{batch.total_parts ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{batch.parts_ok ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-yellow-600 hidden md:table-cell">{batch.parts_reprocessed ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">{batch.parts_nok ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <YieldBadge ok={batch.parts_ok} total={batch.total_parts} />
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {batch.rcca_issue_id ? (
                        <Link
                          to={createPageUrl('IssueDetail') + '?id=' + batch.rcca_issue_id}
                          className="text-xs text-blue-600 hover:underline font-mono"
                          onClick={e => e.stopPropagation()}
                        >
                          {batch.rcca_issue_number || 'View'}
                        </Link>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">
                      {batch.production_date && !isNaN(new Date(batch.production_date)) ? format(new Date(batch.production_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">
                      {batch.saved_by || '—'}
                    </td>

                  </tr>
                  ))
                  }
                  </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              Batch <span className="font-semibold font-mono">{batches.find(b => b.id === confirmDeleteId)?.batch_number}</span> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showForm && (
        <BatchForm
          open={showForm}
          batch={editBatch}
          onClose={() => { setShowForm(false); setEditBatch(null); }}
          onSaved={handleSaved}
          onDeleted={(id) => { setBatches(prev => prev.filter(b => b.id !== id)); setShowForm(false); setEditBatch(null); }}
          existingBatchNumbers={batches.map(b => ({ id: b.id, batch_number: b.batch_number }))}
        />
      )}
    </div>
  </PullToRefresh>
  );
}