import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DeveloperCredit from '@/components/DeveloperCredit';
import { useNavigate, useParams } from 'react-router-dom';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  DollarSign, QrCode, Plus, Trash2, Eye, Calendar, User, TrendingUp,
  PieChart, FolderPlus, FileText, AlertCircle, Loader2, Download, Settings, Gear, Upload, Edit
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import ExpensesModule from '@/components/expenses/ExpensesModule';

const EventFundsManagement = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();

  // State
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(auth.hasRole('student') ? 'fundraising' : 'overview');
  const [currentUserID, setCurrentUserID] = useState(null);

  // Fundraising state
  const [fundraisingEnabled, setFundraisingEnabled] = useState(false);
  const [fundEntryEnabled, setFundEntryEnabled] = useState(true);
  const [qrCodePath, setQrCodePath] = useState('');
  const [collections, setCollections] = useState([]);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [showEditCollection, setShowEditCollection] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState(null);
  const [collectionFormData, setCollectionFormData] = useState({
    payer_name: '',
    amount: '',
    department: '',
    contributor_type: 'student',
    payment_mode: 'cash',
    transaction_id: '',
    notes: ''
  });

  // Expenses state
  const [folders, setFolders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [folderFormData, setFolderFormData] = useState({
    folder_name: '',
    description: ''
  });
  const [expenseFormData, setExpenseFormData] = useState({
    expense_title: '',
    category: 'other',
    transport_from: '',
    transport_to: '',
    transport_mode: '',
    fuel_amount: '',
    breakfast_amount: '',
    lunch_amount: '',
    dinner_amount: '',
    refreshment_amount: '',
    accommodation_amount: '',
    other_expense: ''
  });

  // Summary state
  const [summary, setSummary] = useState({
    total_fund_raised: 0,
    total_expenses: 0,
    balance: 0
  });

  // Settings state for admin
  const [qrFile, setQrFile] = useState(null);
  const [showQrUpload, setShowQrUpload] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const role = auth.getRole();
    if (role === 'volunteer') {
      toast.error('Volunteers do not have access to finance modules');
      navigate('/');
      return;
    }

    // Set current user ID for filtering
    const userId = auth.user?.id || JSON.parse(localStorage.getItem('user') || '{}').id;
    setCurrentUserID(userId);

    loadEventData();
  }, [eventId]);

  // Load all data
  const loadEventData = async () => {
    try {
      setLoading(true);

      // Get event
      const eventRes = await api.getEvent(eventId);
      if (eventRes.success) {
        setEvent(eventRes.event);
      }

      // Get fundraising status
      let fundraisingEnabledLocal = false;
      const statusRes = await api.call('GET', '/fundraising/status');
      if (statusRes.success) {
        fundraisingEnabledLocal = statusRes.fundraising_enabled;
        setFundraisingEnabled(statusRes.fundraising_enabled);
        setFundEntryEnabled(statusRes.fund_entry_enabled ?? true);
        setQrCodePath(statusRes.qr_code_path);
      }

      // Only load if admin or if fundraising is enabled
      if (auth.hasRole('admin') || fundraisingEnabledLocal) {
        const collectRes = await api.call('GET', `/fundraising/list/${eventId}`);
        if (collectRes.success) {
          setCollections(collectRes.collections || []);
        }
      }

      // Load expenses
      const expenseRes = await api.call('GET', `/expenses/list/${eventId}`);
      if (expenseRes.success) {
        setExpenses(expenseRes.expenses || []);
      }

      // Load folders
      const folderRes = await api.call('GET', `/expenses/folders/${eventId}`);
      if (folderRes.success) {
        setFolders(folderRes.folders || []);
      }

      // Load summary
      const summaryRes = await api.call('GET', `/finance/summary/${eventId}`);
      if (summaryRes.success) {
        setSummary(summaryRes.summary);
      }
    } catch (err) {
      toast.error('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh QR code when Add Collection dialog opens
  useEffect(() => {
    if (showAddCollection) {
      const refreshQR = async () => {
        try {
          const statusRes = await api.call('GET', '/fundraising/status');
          if (statusRes.success && statusRes.qr_code_path) {
            setQrCodePath(statusRes.qr_code_path);
          }
        } catch (err) {
          console.error('Failed to refresh QR code:', err);
        }
      };
      refreshQR();
    }
  }, [showAddCollection]);

  // Add collection
  const handleAddCollection = async (e) => {
    e.preventDefault();
    try {
      if (!fundEntryEnabled) {
        toast.error('Fund entry is currently disabled');
        return;
      }
      if (!collectionFormData.payer_name || !collectionFormData.amount) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Students (Scan & Pay) don't need transaction_id in the UI.
      if (
        collectionFormData.payment_mode === 'online' &&
        !auth.hasRole('student') &&
        !collectionFormData.transaction_id.trim()
      ) {
        toast.error('Transaction ID is required for UPI payments');
        return;
      }

      const result = await api.call('POST', '/fundraising/add', {
        event_id: eventId,
        ...collectionFormData,
        amount: parseFloat(collectionFormData.amount)
      });

      if (result.success) {
        toast.success('Collection entry added');
        setShowAddCollection(false);
        setCollectionFormData({
          payer_name: '',
          amount: '',
          department: '',
          contributor_type: 'student',
          payment_mode: 'cash',
          transaction_id: '',
          notes: ''
        });
        loadEventData();
      } else {
        toast.error(result.message || 'Failed to add collection');
      }
    } catch (err) {
      toast.error('Error adding collection');
      console.error(err);
    }
  };

  // Delete collection (Admin only)
  const handleDeleteCollection = async (collectionId: number) => {
    try {
      const result = await api.call('DELETE', `/fundraising/${collectionId}`);
      if (result.success) {
        toast.success('Collection entry deleted');
        loadEventData();
      } else {
        toast.error(result.message || 'Failed to delete collection');
      }
    } catch (err) {
      toast.error('Error deleting collection');
      console.error(err);
    }
  };

  // Add folder
  const handleAddFolder = async (e) => {
    e.preventDefault();
    try {
      if (!folderFormData.folder_name) {
        toast.error('Please enter folder name');
        return;
      }

      const result = await api.call('POST', '/expenses/folder/add', {
        event_id: eventId,
        ...folderFormData
      });

      if (result.success) {
        toast.success('Folder created');
        setShowAddFolder(false);
        setFolderFormData({ folder_name: '', description: '' });
        loadEventData();
      } else {
        toast.error(result.message || 'Failed to create folder');
      }
    } catch (err) {
      toast.error('Error creating folder');
      console.error(err);
    }
  };

  // Add expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      if (!selectedFolder || !expenseFormData.expense_title) {
        toast.error('Please select folder and enter title');
        return;
      }

      const result = await api.call('POST', '/expenses/add', {
        event_id: eventId,
        folder_id: selectedFolder.id,
        ...expenseFormData
      });

      if (result.success) {
        toast.success('Expense added');
        setShowAddExpense(false);
        setExpenseFormData({
          expense_title: '',
          category: 'other',
          transport_from: '',
          transport_to: '',
          transport_mode: '',
          fuel_amount: '',
          breakfast_amount: '',
          lunch_amount: '',
          dinner_amount: '',
          refreshment_amount: '',
          accommodation_amount: '',
          other_expense: ''
        });
        loadEventData();
      } else {
        toast.error(result.message || 'Failed to add expense');
      }
    } catch (err) {
      toast.error('Error adding expense');
      console.error(err);
    }
  };

  // Toggle fundraising (Admin only)
  const handleToggleFundraising = async (enabled) => {
    try {
      setUpdatingSettings(true);
      const result = await api.call('POST', '/finance/settings/fundraising/toggle', {
        enabled
      });

      if (result.success) {
        setFundraisingEnabled(enabled);
        toast.success(`Fund raising ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(result.message || 'Failed to update setting');
      }
    } catch (err) {
      toast.error('Error updating setting');
      console.error(err);
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Handle QR upload (Admin only)
  const handleQRUpload = async () => {
    try {
      if (!qrFile) {
        toast.error('Please select a file');
        return;
      }

      setUploadingQR(true);
      const formData = new FormData();
      formData.append('qr_code', qrFile);

      const result = await api.callFormData('POST', '/finance/settings/qrcode/upload', formData);

      if (result.success) {
        setQrCodePath(result.qr_code_path);
        setQrFile(null);
        setShowQrUpload(false);
        toast.success('QR code uploaded successfully');
      } else {
        toast.error(result.message || 'Failed to upload QR code');
      }
    } catch (err) {
      toast.error('Error uploading QR code');
      console.error(err);
    } finally {
      setUploadingQR(false);
    }
  };

  // Delete QR code (Admin only)
  const handleDeleteQR = async () => {
    try {
      setUpdatingSettings(true);
      const result = await api.call('POST', '/finance/settings/qrcode/delete');

      if (result.success) {
        setQrCodePath('');
        toast.success('QR code deleted');
      } else {
        toast.error(result.message || 'Failed to delete QR code');
      }
    } catch (err) {
      toast.error('Error deleting QR code');
      console.error(err);
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Edit collection
  const handleEditCollection = (collection) => {
    setCollectionFormData({
      payer_name: collection.payer_name,
      amount: collection.amount.toString(),
      department: collection.department || '',
      contributor_type: collection.contributor_type || 'student',
      payment_mode: collection.payment_mode,
      transaction_id: collection.transaction_id || '',
      notes: collection.notes || ''
    });
    setEditingCollectionId(collection.id);
    setShowEditCollection(true);
  };

  // Update collection
  const handleUpdateCollection = async (e) => {
    e.preventDefault();
    try {
      if (!collectionFormData.payer_name || !collectionFormData.amount) {
        toast.error('Please fill in all required fields');
        return;
      }

      const result = await api.call('PUT', `/fundraising/${editingCollectionId}`, {
        ...collectionFormData,
        amount: parseFloat(collectionFormData.amount)
      });

      if (result.success) {
        toast.success('Collection entry updated');
        setShowEditCollection(false);
        setEditingCollectionId(null);
        setCollectionFormData({
          payer_name: '',
          amount: '',
          department: '',
          contributor_type: 'student',
          payment_mode: 'cash',
          transaction_id: '',
          notes: ''
        });
        loadEventData();
      } else {
        toast.error(result.message || 'Failed to update collection');
      }
    } catch (err) {
      toast.error('Error updating collection');
      console.error(err);
    }
  };

  // Export to Excel with better formatting
  const exportToExcel = (data) => {
    try {
      // Create CSV with proper headers and formatting
      const headers = ['Payer Name', 'Amount (₹)', 'Department', 'Payment Mode', 'Received By', 'Date'];
      const rows = data.map(row => [
        row.payer_name,
        Number(row.amount).toFixed(2),
        row.department || 'N/A',
        row.payment_mode,
        row.received_by_name || 'N/A',
        new Date(row.created_at).toLocaleDateString()
      ]);

      // Build CSV content
      let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';
      rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
      element.setAttribute('download', `fundraising_collections_${event?.id}_${new Date().getTime()}.csv`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success('Excel file downloaded successfully');
    } catch (err) {
      toast.error('Failed to export Excel');
      console.error(err);
    }
  };

  // Export to PDF
  const exportToPDF = (data) => {
    try {
      const htmlContent = `
        <html>
          <head>
            <title>Fund Raising Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: white; }
              h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #4CAF50; color: white; font-weight: bold; }
              tr:nth-child(even) { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Fund Raising Collections Report</h1>
            <p><strong>Event:</strong> ${event?.title || 'N/A'}</p>
            <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Payer Name</th>
                  <th>Amount</th>
                  <th>Department</th>
                  <th>Payment Mode</th>
                  <th>Received By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(row => `
                  <tr>
                    <td>${row.payer_name}</td>
                    <td>₹${Number(row.amount).toFixed(2)}</td>
                    <td>${row.department || 'N/A'}</td>
                    <td>${row.payment_mode}</td>
                    <td>${row.received_by_name || 'N/A'}</td>
                    <td>${new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    } catch (err) {
      toast.error('Failed to export PDF');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <DeveloperCredit />
      <main className="w-full px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Event Funds Management</h1>
          <p className="text-muted-foreground">{event?.title || 'Event'}</p>
        </div>

        {/* Summary Cards - Hide for students */}
        {!auth.hasRole('student') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total Fund Raised</CardTitle>
              <DollarSign className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">₹{Number(summary.total_fund_raised).toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <FileText className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">₹{Number(summary.total_expenses).toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className={Number(summary.balance) >= 0 ? 'border-blue-200 dark:border-blue-900' : 'border-orange-200 dark:border-orange-900'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <TrendingUp className={`w-4 h-4 ${Number(summary.balance) >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${Number(summary.balance) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                ₹{Number(summary.balance).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {Number(summary.balance) >= 0 ? 'Surplus' : 'Deficit'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${
            auth.hasRole('student') ? 'grid-cols-1' : 
            auth.hasRole('admin') ? 'grid-cols-4' : 
            'grid-cols-3'
          }`}>
            {!auth.hasRole('student') && <TabsTrigger value="overview">Overview</TabsTrigger>}
            <TabsTrigger value="fundraising">Fund Raising</TabsTrigger>
            {!auth.hasRole('student') && <TabsTrigger value="expenses">Expenses</TabsTrigger>}
            {auth.hasRole('admin') && <TabsTrigger value="settings">Settings</TabsTrigger>}
          </TabsList>

          {/* Allow all roles to see Fundraising tab content (not just admin/office bearer) */}

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-950 rounded">
                    <span>Total Collected</span>
                    <span className="font-bold text-green-600">₹{Number(summary.total_fund_raised).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-950 rounded">
                    <span>Total Spent</span>
                    <span className="font-bold text-red-600">₹{Number(summary.total_expenses).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950 rounded font-bold">
                    <span>Balance</span>
                    <span className={Number(summary.balance) >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                      ₹{Number(summary.balance).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fundraising Tab */}
          <TabsContent value="fundraising" className="space-y-6">
            {!fundraisingEnabled && !auth.hasRole('admin') && !auth.hasRole('office_bearer') && !auth.hasRole('student') ? (
              <Card className="border-orange-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <p className="text-orange-700 dark:text-orange-300">
                      Fund raising is currently disabled by admin
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* QR Code Display */}
                {qrCodePath && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5" />
                        Entry
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <img src={qrCodePath} alt="QR Code" className="w-64 h-64 object-contain" />
                    </CardContent>
                  </Card>
                )}

                {/* Add Collection / Scan & Pay Button */}
                {auth.hasRole('student') ? (
                  <Button
                    onClick={() => {
                      if (!fundEntryEnabled) {
                        toast.error('Fund entry is currently disabled');
                        return;
                      }
                      setCollectionFormData((prev) => ({
                        ...prev,
                        payment_mode: 'online',
                        transaction_id: '',
                        notes: '',
                        contributor_type: 'student'
                      }));
                      setShowAddCollection(true);
                    }}
                    className="w-full"
                    disabled={!fundEntryEnabled}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Entry
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      onClick={() => setShowAddCollection(true)}
                      className="w-full"
                      disabled={!fundEntryEnabled}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Collection Entry
                    </Button>
                    {!fundEntryEnabled && (
                      <p className="text-sm text-muted-foreground">
                        Fund entry is currently disabled
                      </p>
                    )}
                  </div>
                )}

                {auth.hasRole('student') && !fundEntryEnabled && (
                  <p className="text-sm text-muted-foreground">
                    Fund entry is currently disabled
                  </p>
                )}

                {/* Collections List */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Fund Collections</CardTitle>
                      {auth.hasRole('student') && (
                        <p className="text-lg font-bold text-green-600 mt-2">
                          Total Collected: ₹{Number(
                            collections.reduce((sum, col) => sum + Number(col.amount), 0)
                          ).toFixed(2)}
                        </p>
                      )}
                    </div>
                    {(auth.hasRole('admin') || auth.hasRole('student')) && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                              const dataToExport = collections;
                            exportToExcel(dataToExport);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Excel
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                              const dataToExport = collections;
                            exportToPDF(dataToExport);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Payer Name</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Received By</TableHead>
                            <TableHead>Date</TableHead>
                            {auth.hasRole('admin') && <TableHead>Action</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collections.map((col) => (
                            <TableRow key={col.id}>
                              <TableCell>{col.payer_name}</TableCell>
                              <TableCell className="font-semibold">₹{Number(col.amount).toFixed(2)}</TableCell>
                              <TableCell className="text-sm">{col.department || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant={col.payment_mode === 'cash' ? 'default' : 'secondary'}>
                                  {col.payment_mode}
                                </Badge>
                              </TableCell>
                              <TableCell>{col.received_by_name || 'N/A'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(col.created_at).toLocaleDateString()}
                              </TableCell>
                              {auth.hasRole('admin') && (
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditCollection(col)}
                                      className="text-blue-600 hover:bg-blue-50"
                                      title="Edit entry"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteCollection(col.id)}
                                      className="text-destructive hover:bg-destructive/10"
                                      title="Delete entry"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-6">
            <ExpensesModule
              eventId={eventId as string}
              folders={folders}
              expenses={expenses}
              onRefresh={loadEventData}
            />
          </TabsContent>

          {/* Settings Tab (Admin Only) */}
          {auth.hasRole('admin') && (
            <TabsContent value="settings" className="space-y-6">
              {/* Fundraising Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Fund Raising Status</CardTitle>
                    <CardDescription>
                      Enable or disable fund raising for all events
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <h3 className="font-semibold">Enable Fund Raising</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          When enabled, office bearers can add fund collections
                        </p>
                      </div>
                      <Switch
                        checked={fundraisingEnabled}
                        onCheckedChange={(checked) => handleToggleFundraising(checked)}
                        disabled={updatingSettings}
                      />
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Status:</strong> Fund raising is currently{' '}
                        <strong>{fundraisingEnabled ? '✓ Enabled' : '✗ Disabled'}</strong>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* QR Code Management */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="w-5 h-5" />
                      QR Code Management
                    </CardTitle>
                    <CardDescription>
                      Upload a QR code for online payments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Current QR Display */}
                    {qrCodePath ? (
                      <div className="space-y-4">
                        <div className="p-6 bg-muted rounded-lg flex flex-col items-center">
                          <img
                            src={qrCodePath}
                            alt="QR Code"
                            className="w-64 h-64 object-contain rounded-lg shadow-lg"
                          />
                          <p className="text-sm text-muted-foreground mt-4">Current QR Code</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowQrUpload(true)}
                            disabled={uploadingQR || updatingSettings}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Replace QR Code
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={handleDeleteQR}
                            disabled={uploadingQR || updatingSettings}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
                        <QrCode className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">No QR code uploaded yet</p>
                        <Button onClick={() => setShowQrUpload(true)} disabled={uploadingQR || updatingSettings}>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload QR Code
                        </Button>
                      </div>
                    )}

                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Note:</strong> The QR code will be displayed to office bearers when they add online payment entries. Supported formats: PNG, JPEG, GIF
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Info Section */}
              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
                <CardHeader>
                  <CardTitle className="text-blue-900 dark:text-blue-100">How Settings Work</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-blue-800 dark:text-blue-200">
                  <p>
                    <strong>1. Enable Fund Raising:</strong> Toggle the switch above to activate the fund raising module for office bearers
                  </p>
                  <p>
                    <strong>2. Upload QR Code:</strong> Upload a QR code image that links to your payment gateway or UPI
                  </p>
                  <p>
                    <strong>3. Global Setting:</strong> These settings apply to all events when the fundraising tab is visible
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* QR Upload Dialog */}
      <Dialog open={showQrUpload} onOpenChange={setShowQrUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('qr-input')?.click()}
            >
              <input
                id="qr-input"
                type="file"
                accept="image/*"
                onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {qrFile ? qrFile.name : 'Click to select or drag & drop image'}
              </p>
            </div>

            {qrFile && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold">{qrFile.name}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleQRUpload} className="flex-1" disabled={uploadingQR || !qrFile}>
                {uploadingQR ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowQrUpload(false)} disabled={uploadingQR}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Collection Dialog */}
      <Dialog open={showAddCollection} onOpenChange={setShowAddCollection}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{auth.hasRole('student') ? 'Entry' : 'Add Fund Collection Entry'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCollection} className="space-y-4">
            <div>
              <Label>Payer Name *</Label>
              <Input
                value={collectionFormData.payer_name}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, payer_name: e.target.value })
                }
                placeholder="Enter payer name"
              />
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={collectionFormData.amount}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, amount: e.target.value })
                }
                placeholder="Enter amount"
              />
            </div>

            {auth.hasRole('student') ? (
              <div>
                <Label>Mode *</Label>
                <Input value="UPI" disabled />
              </div>
            ) : (
              <div>
                <Label>Payment Mode *</Label>
                <Select
                  value={collectionFormData.payment_mode}
                  onValueChange={(value) =>
                    setCollectionFormData({ ...collectionFormData, payment_mode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show QR Code when Online is selected */}
            {collectionFormData.payment_mode === 'online' && (
              <div className="space-y-2">
                {qrCodePath ? (
                  <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">
                      💳 Scan QR Code for Online Payment
                    </p>
                    <div className="flex justify-center">
                      <img 
                        src={qrCodePath} 
                        alt="Payment QR Code" 
                        className="max-w-xs rounded border-2 border-blue-300"
                        onError={() => console.log('QR Code failed to load from:', qrCodePath)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-amber-300 rounded-lg p-4 bg-amber-50 dark:bg-amber-950">
                    <div className="flex flex-col items-center justify-center gap-3 py-4">
                      <div className="w-24 h-24 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                        <QrCode className="w-12 h-12 text-gray-500" />
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
                        ⚠️ QR Code not available yet. Please contact admin to upload payment QR code.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Department</Label>
              <Select
                value={collectionFormData.department || 'none'}
                onValueChange={(value) =>
                  setCollectionFormData({ ...collectionFormData, department: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="CSE">Computer Science & Engineering</SelectItem>
                  <SelectItem value="ECE">Electronics & Communication</SelectItem>
                  <SelectItem value="MECH">Mechanical Engineering</SelectItem>
                  <SelectItem value="CIVIL">Civil Engineering</SelectItem>
                  <SelectItem value="EEE">Electrical & Electronics</SelectItem>
                  <SelectItem value="IT">Information Technology</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!auth.hasRole('student') && (
              <div>
                <Label>Transaction ID *</Label>
                <Input
                  value={collectionFormData.transaction_id}
                  onChange={(e) =>
                    setCollectionFormData({ ...collectionFormData, transaction_id: e.target.value })
                  }
                  placeholder="Enter UPI transaction reference / ID"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {auth.hasRole('student') ? 'Submit Entry' : 'Add Entry'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddCollection(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={showEditCollection} onOpenChange={setShowEditCollection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fund Collection Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCollection} className="space-y-4">
            <div>
              <Label>Payer Name *</Label>
              <Input
                value={collectionFormData.payer_name}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, payer_name: e.target.value })
                }
                placeholder="Enter payer name"
              />
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={collectionFormData.amount}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, amount: e.target.value })
                }
                placeholder="Enter amount"
              />
            </div>

            <div>
              <Label>Payment Mode *</Label>
              <Select
                value={collectionFormData.payment_mode}
                onValueChange={(value) =>
                  setCollectionFormData({ ...collectionFormData, payment_mode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Department</Label>
              <Select
                value={collectionFormData.department || 'none'}
                onValueChange={(value) =>
                  setCollectionFormData({ ...collectionFormData, department: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="CSE">Computer Science & Engineering</SelectItem>
                  <SelectItem value="ECE">Electronics & Communication</SelectItem>
                  <SelectItem value="MECH">Mechanical Engineering</SelectItem>
                  <SelectItem value="CIVIL">Civil Engineering</SelectItem>
                  <SelectItem value="EEE">Electrical & Electronics</SelectItem>
                  <SelectItem value="IT">Information Technology</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Update Entry
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowEditCollection(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Folder Dialog */}
      <Dialog open={showAddFolder} onOpenChange={setShowAddFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bill Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddFolder} className="space-y-4">
            <div>
              <Label>Folder Name *</Label>
              <Input
                value={folderFormData.folder_name}
                onChange={(e) =>
                  setFolderFormData({ ...folderFormData, folder_name: e.target.value })
                }
                placeholder="e.g., Venue Expenses"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={folderFormData.description}
                onChange={(e) =>
                  setFolderFormData({ ...folderFormData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Create Folder
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddFolder(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Add a new expense to {selectedFolder?.folder_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <Label>Expense Title *</Label>
              <Input
                value={expenseFormData.expense_title}
                onChange={(e) =>
                  setExpenseFormData({ ...expenseFormData, expense_title: e.target.value })
                }
                placeholder="e.g., Food for Event"
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={expenseFormData.category}
                onValueChange={(value) =>
                  setExpenseFormData({ ...expenseFormData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuel">Fuel</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="accommodation">Accommodation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Food Expenses */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Food Expenses</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Breakfast</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.breakfast_amount}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        breakfast_amount: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Lunch</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.lunch_amount}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        lunch_amount: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Dinner</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.dinner_amount}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        dinner_amount: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Refreshment</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.refreshment_amount}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        refreshment_amount: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Travel & Other */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Travel & Other</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fuel Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.fuel_amount}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        fuel_amount: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Accommodation</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.accommodation_amount}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        accommodation_amount: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Other Expense</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseFormData.other_expense}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        other_expense: e.target.value
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Add Expense
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddExpense(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventFundsManagement;
