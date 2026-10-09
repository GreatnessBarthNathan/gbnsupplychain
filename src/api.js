const API_ROOT = '/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('gbn_token');
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const responseText = await response.text();
  let data = {};
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      throw new Error(`Request failed (${status}); the server returned an invalid response.`);
    }
  }
  if (!response.ok) {
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    throw new Error(data.message || `Request failed (${status}).`);
  }
  return data;
}

export function money(amount, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function whatsappLink(number) {
  let digits = String(number || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `234${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : '';
}

export const stages = [
  { id: 'new', label: 'New order' },
  { id: 'activated', label: 'Activated' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'at_state', label: 'With rider' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'transferred', label: 'Transferred to your account' },
  { id: 'failed', label: 'Delivery failed' },
  { id: 'returning', label: 'Returning to supplier' },
  { id: 'returned', label: 'Returned to supplier' }
];

export function stageLabel(stage) {
  return stages.find((item) => item.id === stage)?.label || stage;
}
