import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/api/client';
import AnalyticsFilters from '../components/analytics/AnalyticsFilters';
import AnalyticsSummaryCards from '../components/analytics/AnalyticsSummaryCards';
import TrendChart from '../components/analytics/TrendChart';
import ParetoChart from '../components/analytics/ParetoChart';
import CorrelationCharts from '../components/analytics/CorrelationCharts';
import BatchesByUserChart from '../components/analytics/BatchesByUserChart';

const DEFAULT_FILTERS = { dateFrom: '', dateTo: '', processStep: 'all', issueType: 'all', defectType: 'all', severity: 'all', preset: '365', partNumber: '', batchNumber: '' };

function applyDefaultDatePreset(filters) {
  if (filters.preset === '365' && !filters.dateFrom) {
    const d = new Date();
    d.setDate(d.getDate() - 365);
    return { ...filters, dateFrom: d.toISOString().split('T')[0] };
  }
  return filters;
}

export default function Analytics() {
  const [allIssues, setAllIssues] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    Promise.all([
      apiClient.entities.ProductionIssue.list('-created_date', 1000),
      apiClient.entities.ProductionBatch.list('-production_date', 1000),
    ]).then(([issues, batches]) => {
      setAllIssues(issues || []);
      setAllBatches(batches || []);
      setLoading(false);
    });
  }, []);



  const activeFilters = useMemo(() => applyDefaultDatePreset(filters), [filters]);

  const filtered = useMemo(() => {
    return allIssues.filter(issue => {
      if (activeFilters.dateFrom && issue.reported_date && issue.reported_date < activeFilters.dateFrom) return false;
      if (activeFilters.dateTo && issue.reported_date && issue.reported_date > activeFilters.dateTo) return false;
      if (activeFilters.processStep !== 'all' && issue.machine !== activeFilters.processStep) return false;
      if (activeFilters.defectType !== 'all' && issue.title !== activeFilters.defectType) return false;
      if (activeFilters.issueType !== 'all' && issue.issue_type !== activeFilters.issueType) return false;
      if (activeFilters.severity !== 'all' && issue.severity !== activeFilters.severity) return false;
      if (activeFilters.partNumber && !issue.part_number?.toLowerCase().includes(activeFilters.partNumber.toLowerCase())) return false;
      return true;
    });
  }, [allIssues, activeFilters]);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Advanced Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Deep dive into production issue trends, root causes, and correlations</p>
      </div>

      {/* Filters */}
      <AnalyticsFilters filters={filters} setFilters={setFilters} />

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <AnalyticsSummaryCards issues={filtered} allIssues={allIssues} />
      )}

      {/* Trend over time */}
      {loading ? (
        <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
      ) : (
        <TrendChart issues={filtered} />
      )}

      {/* Pareto charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map(i => <div key={i} className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : (
        <ParetoChart issues={filtered} />
      )}

      {/* Correlation charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : (
        <CorrelationCharts issues={filtered} />
      )}

      {/* Batches by user */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BatchesByUserChart batches={allBatches} loading={loading} />
      </div>
    </div>
  );
}