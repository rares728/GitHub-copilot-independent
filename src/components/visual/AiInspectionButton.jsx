import React, { useState } from 'react';
import { apiClient } from '@/api/client';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';

const OWNER_USERNAME = 'rares728';

function parsePerms(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function canAccessVisualInspection(user) {
  if (!user) return false;
  if ((user.full_name || '').toLowerCase() === OWNER_USERNAME) return true;
  const perms = parsePerms(user.page_permissions);
  if (!perms) return false;
  return !!perms['VisualInspection'];
}

/**
 * Mic buton albastru cu iconita AI. Apare doar daca:
 * - defect type contine "vizual"
 * - userul are permisiune VisualInspection
 * La click: creeaza un VisualInspectionEntry cu datele din issue si navigheaza.
 */
export default function AiInspectionButton({ issueNumber, issueId, partNumber, partAlias, batchNumber, imageUrls, currentUser }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!canAccessVisualInspection(currentUser)) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      // Verifica daca exista deja o intrare pentru acest issue
      const existing = await apiClient.entities.VisualInspectionEntry.filter({ issue_number: issueNumber });
      let entry = existing?.[0];

      if (!entry) {
        entry = await apiClient.entities.VisualInspectionEntry.create({
          issue_number: issueNumber,
          issue_id: issueId,
          part_number: partNumber || '',
          part_alias: partAlias || '',
          batch_number: batchNumber || '',
          image_urls: imageUrls || [],
          status: 'pending',
        });
      }
      navigate(`/VisualInspection?entry=${entry.id}`);
    } catch (e) {
      console.error('AI inspection trigger error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="AI Visual Inspection"
      className="flex items-center justify-center w-8 h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
    </button>
  );
}