import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, BookOpen, Archive, BarChart3, ClipboardList } from 'lucide-react';
import InspectionTable from '../components/visual/InspectionTable';
import InspectionDetail from '../components/visual/InspectionDetail';
import StandardsTree from '../components/visual/StandardsTree';
import AiPromptEditor from '../components/visual/AiPromptEditor';
import LearnedCorrectionsCard from '../components/visual/LearnedCorrectionsCard';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: ClipboardList },
  { key: 'standards', label: 'Standards', icon: BookOpen },
  { key: 'archive', label: 'Archive', icon: Archive },
  { key: 'learning', label: 'Learning Module', icon: BarChart3 },
];

export default function VisualInspection() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const location = useLocation();

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const list = await apiClient.entities.VisualInspectionEntry.list('-created_date', 200);
      setEntries(list || []);
      // Daca venim cu ?entry=ID, selecteaza-l automat
      const params = new URLSearchParams(location.search);
      const entryId = params.get('entry');
      if (entryId) {
        const found = (list || []).find(e => e.id === entryId);
        if (found) setSelectedEntry(found);
      }
    } catch (e) {
      console.error('Load entries error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (updated) => {
    if (!updated) {
      setEntries(prev => prev.filter(e => e.id !== selectedEntry?.id));
      setSelectedEntry(null);
      return;
    }
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    setSelectedEntry(updated);
  };

  // Learning stats
  const learningStats = () => {
    const validated = entries.filter(e => e.human_validated);
    const total = validated.length;
    const agreed = validated.filter(e => e.human_agrees_with_ai).length;
    const accuracy = total > 0 ? Math.round((agreed / total) * 100) : 0;
    return { total, agreed, accuracy, pending: entries.filter(e => !e.human_validated).length };
  };

  const stats = learningStats();
  // Lista activa pastreaza toate intrarile, inclusiv cele finalizate,
  // pentru a putea fi accesate oricand.
  const activeEntries = entries;
  const archivedEntries = entries.filter(e => e.status === 'finalized');

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Visual Inspection AI</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-700">Active entries ({activeEntries.length})</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : (
                <InspectionTable entries={activeEntries} onSelect={setSelectedEntry} selectedId={selectedEntry?.id} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <InspectionDetail entry={selectedEntry} onUpdate={handleUpdate} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'standards' && <StandardsTree />}

      {tab === 'archive' && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Finalized inspections archive ({archivedEntries.length})</span>
            </div>
            <InspectionTable entries={archivedEntries} onSelect={setSelectedEntry} selectedId={selectedEntry?.id} />
          </CardContent>
        </Card>
      )}

      {tab === 'learning' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-1">Total human validations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.accuracy}%</p>
              <p className="text-xs text-slate-500 mt-1">AI accuracy (human agreement)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-slate-500 mt-1">Pending validation</p>
            </CardContent>
          </Card>
          <LearnedCorrectionsCard />
          <div className="md:col-span-3">
            <AiPromptEditor />
          </div>
        </div>
      )}
    </div>
  );
}