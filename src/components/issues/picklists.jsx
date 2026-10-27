import { apiClient } from '@/api/client';

const cache = {};

async function fetchEntityOptions(entityCategory) {
  const cacheKey = `entity_${entityCategory}`;
  if (cache[cacheKey]) return cache[cacheKey];
  const options = await apiClient.entities.PicklistOption.filter({ category: entityCategory, is_active: true }, 'sort_order', 500);
  if (!options.length) {
    throw new Error(`No values are configured for "${entityCategory}". Import the picklist data in Settings.`);
  }
  const result = options
    .filter(option => option.value != null && option.value !== '')
    .map(option => ({ value: option.value, label: option.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  cache[cacheKey] = result;
  return result;
}

export async function fetchIssueTypes() {
  return fetchEntityOptions('IssueType_Picklist');
}

export async function fetchProcessSteps() {
  return fetchEntityOptions('ProcessStep_Picklist');
}

export async function fetchAssignDpt() {
  return fetchEntityOptions('department');
}

export async function fetchDefectTypes() {
  return fetchEntityOptions('DefectType_Picklist');
}

export async function fetchPartNumberAlias() {
  const cacheKey = 'partNumberAlias_entity';
  if (cache[cacheKey]) return cache[cacheKey];

  // Try entity first
  const options = await apiClient.entities.PicklistOption.filter({ category: 'Part Number vs Alias_Picklist', is_active: true }, 'sort_order', 500);

  if (options.length > 0) {
    const result = options.map(o => ({ partNumber: o.value, alias: o.label }));
    cache[cacheKey] = result;
    return result;
  }

  throw new Error('No part number aliases are configured. Import the picklist data in Settings.');
}

export async function fetchUtilajSerial() {
  const cacheKey = 'utilajSerial_entity';
  if (cache[cacheKey]) return cache[cacheKey];
  const options = await apiClient.entities.PicklistOption.filter({ category: 'Utilaj - Serial#_Picklist', is_active: true }, 'sort_order', 500);
  if (!options.length) {
    throw new Error('No equipment serial numbers are configured. Import the picklist data in Settings.');
  }
  const result = options.map(o => ({ partNumber: o.value, alias: o.label }));
  cache[cacheKey] = result;
  return result;
}