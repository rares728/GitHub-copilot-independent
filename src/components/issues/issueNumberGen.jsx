import { apiClient } from '@/api/client';

/**
 * Generates the next AEE-NNNN issue number.
 * Format: AEE-0001 … AEE-9999
 */
export async function genNextIssueNumber() {
  try {
    const issues = await apiClient.entities.ProductionIssue.list('-created_date', 500);
    let max = 0;
    for (const iss of issues) {
      const num = iss.issue_number || '';
      const match = num.match(/^AEE-(\d{4})$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    }
    const next = Math.min(max + 1, 9999);
    return `AEE-${String(next).padStart(4, '0')}`;
  } catch {
    return `AEE-0001`;
  }
}