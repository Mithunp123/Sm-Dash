/**
 * Finance API Helper
 * Add these methods to your existing api object
 */

// Fundraising APIs
const fundraisingAPI = {
  /**
   * Get fundraising status
   */
  getFundraisingStatus: async () => {
    const response = await fetch(`${API_BASE}/fundraising/status`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Add a fund collection
   */
  addFundCollection: async (eventId, data) => {
    const response = await fetch(`${API_BASE}/fundraising/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ event_id: eventId, ...data })
    });
    return response.json();
  },

  /**
   * Get fund collections for event
   */
  getFundCollections: async (eventId, filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/fundraising/list/${eventId}?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Get fundraising summary
   */
  getFundraisingSummary: async (eventId) => {
    const response = await fetch(`${API_BASE}/fundraising/summary/${eventId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Delete a fund collection
   */
  deleteFundCollection: async (collectionId) => {
    const response = await fetch(`${API_BASE}/fundraising/${collectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  }
};

// Expense APIs
const expenseAPI = {
  /**
   * Create a bill folder
   */
  createBillFolder: async (eventId, data) => {
    const response = await fetch(`${API_BASE}/expenses/folder/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ event_id: eventId, ...data })
    });
    return response.json();
  },

  /**
   * Get bill folders
   */
  getBillFolders: async (eventId) => {
    const response = await fetch(`${API_BASE}/expenses/folders/${eventId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Get folder with expenses
   */
  getFolderWithExpenses: async (folderId) => {
    const response = await fetch(`${API_BASE}/expenses/folder/${folderId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Add an expense
   */
  addExpense: async (eventId, folderId, data) => {
    const response = await fetch(`${API_BASE}/expenses/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ event_id: eventId, folder_id: folderId, ...data })
    });
    return response.json();
  },

  /**
   * Get expenses for event
   */
  getExpenses: async (eventId) => {
    const response = await fetch(`${API_BASE}/expenses/list/${eventId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Delete an expense
   */
  deleteExpense: async (expenseId) => {
    const response = await fetch(`${API_BASE}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Get expense summary by category
   */
  getExpensesByCategory: async (eventId) => {
    const response = await fetch(`${API_BASE}/expenses/event/${eventId}/by-category`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  }
};

// Finance Settings APIs
const financeSettingsAPI = {
  /**
   * Get finance settings
   */
  getSettings: async () => {
    const response = await fetch(`${API_BASE}/finance/settings`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Toggle fundraising
   */
  toggleFundraising: async (enabled) => {
    const response = await fetch(`${API_BASE}/finance/settings/fundraising/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ enabled })
    });
    return response.json();
  },

  /**
   * Upload QR code
   */
  uploadQRCode: async (file) => {
    const formData = new FormData();
    formData.append('qr_code', file);

    const response = await fetch(`${API_BASE}/finance/settings/qrcode/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`
      },
      body: formData
    });
    return response.json();
  },

  /**
   * Delete QR code
   */
  deleteQRCode: async () => {
    const response = await fetch(`${API_BASE}/finance/settings/qrcode/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  /**
   * Get financial summary for event
   */
  getFinancialSummary: async (eventId) => {
    const response = await fetch(`${API_BASE}/finance/summary/${eventId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  }
};

// Add these methods to your api object in api.js:
// api.fundraising = fundraisingAPI;
// api.expenses = expenseAPI;
// api.financeSettings = financeSettingsAPI;

export { fundraisingAPI, expenseAPI, financeSettingsAPI };
