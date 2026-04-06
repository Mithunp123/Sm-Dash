/**
 * Finance API Helper
 * Provides typed API calls for fundraising, expenses, and finance settings
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getToken = (): string | null => {
  return sessionStorage.getItem('auth_token');
};

const getHeaders = (includeContentType = true): HeadersInit => {
  const headers: HeadersInit = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// Type definitions
interface FundCollection {
  id?: number;
  event_id: number;
  donor_name: string;
  amount: number;
  payment_mode: string;
  reference_number?: string;
  remarks?: string;
}

interface Expense {
  id?: number;
  event_id: number;
  folder_id: number;
  description: string;
  amount: number;
  category?: string;
  bill_number?: string;
  vendor_name?: string;
}

interface BillFolder {
  id?: number;
  event_id: number;
  folder_name: string;
  description?: string;
}

// Fundraising APIs
export const fundraisingAPI = {
  getFundraisingStatus: async () => {
    const response = await fetch(`${API_BASE}/fundraising/status`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  addFundCollection: async (eventId: number, data: Partial<FundCollection>) => {
    const response = await fetch(`${API_BASE}/fundraising/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ event_id: eventId, ...data })
    });
    return response.json();
  },

  getFundCollections: async (eventId: number, filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/fundraising/list/${eventId}?${params}`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  getFundraisingSummary: async (eventId: number) => {
    const response = await fetch(`${API_BASE}/fundraising/summary/${eventId}`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  updateFundCollection: async (id: number, data: Partial<FundCollection>) => {
    const response = await fetch(`${API_BASE}/fundraising/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  },

  deleteFundCollection: async (collectionId: number) => {
    const response = await fetch(`${API_BASE}/fundraising/${collectionId}`, {
      method: 'DELETE',
      headers: getHeaders(false)
    });
    return response.json();
  }
};

// Expense APIs
export const expenseAPI = {
  createBillFolder: async (eventId: number, data: Partial<BillFolder>) => {
    const response = await fetch(`${API_BASE}/expenses/folder/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ event_id: eventId, ...data })
    });
    return response.json();
  },

  getBillFolders: async (eventId: number) => {
    const response = await fetch(`${API_BASE}/expenses/folders/${eventId}`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  getFolderWithExpenses: async (folderId: number) => {
    const response = await fetch(`${API_BASE}/expenses/folder/${folderId}`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  addExpense: async (eventId: number, folderId: number, data: Partial<Expense>) => {
    const response = await fetch(`${API_BASE}/expenses/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ event_id: eventId, folder_id: folderId, ...data })
    });
    return response.json();
  },

  getExpenses: async (eventId: number) => {
    const response = await fetch(`${API_BASE}/expenses/list/${eventId}`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  updateExpense: async (id: number, data: Partial<Expense>) => {
    const response = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  },

  deleteExpense: async (expenseId: number) => {
    const response = await fetch(`${API_BASE}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: getHeaders(false)
    });
    return response.json();
  },

  getExpensesByCategory: async (eventId: number) => {
    const response = await fetch(`${API_BASE}/expenses/event/${eventId}/by-category`, {
      headers: getHeaders(false)
    });
    return response.json();
  }
};

// Finance Settings APIs
export const financeSettingsAPI = {
  getSettings: async () => {
    const response = await fetch(`${API_BASE}/finance/settings`, {
      headers: getHeaders(false)
    });
    return response.json();
  },

  toggleFundraising: async (enabled: boolean) => {
    const response = await fetch(`${API_BASE}/finance/settings/fundraising/toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ enabled })
    });
    return response.json();
  },

  uploadQRCode: async (file: File) => {
    const formData = new FormData();
    formData.append('qr_code', file);

    const response = await fetch(`${API_BASE}/finance/settings/qrcode/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    return response.json();
  },

  deleteQRCode: async () => {
    const response = await fetch(`${API_BASE}/finance/settings/qrcode/delete`, {
      method: 'POST',
      headers: getHeaders(false)
    });
    return response.json();
  },

  getFinancialSummary: async (eventId: number) => {
    const response = await fetch(`${API_BASE}/finance/summary/${eventId}`, {
      headers: getHeaders(false)
    });
    return response.json();
  }
};
