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
import { BackButton } from '@/components/BackButton';
import { useNavigate, useParams } from 'react-router-dom';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  DollarSign, QrCode, Plus, Trash2, Eye, Calendar, User, TrendingUp,
  PieChart, FolderPlus, FileText, AlertCircle, Loader2, Download
} from 'lucide-react';

const EventFundsManagement = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();

  // State
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Fundraising state
  const [fundraisingEnabled, setFundraisingEnabled] = useState(false);
  const [qrCodePath, setQrCodePath] = useState('');
  const [collections, setCollections] = useState([]);
  const [showAddCollection, setShowAddCollection] = useState(false);
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

  // Add collection
  const handleAddCollection = async (e) => {
    e.preventDefault();
    try {
      if (!collectionFormData.payer_name || !collectionFormData.amount) {
        toast.error('Please fill in all required fields');
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
      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <BackButton />
          <h1 className="text-4xl font-bold mt-4 mb-2">Event Funds Management</h1>
          <p className="text-muted-foreground">{event?.title || 'Event'}</p>
        </div>

        {/* Summary Cards */}
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fundraising">Fund Raising</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

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
            {!fundraisingEnabled && !auth.hasRole('admin') ? (
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
                        Scan & Pay
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <img src={qrCodePath} alt="QR Code" className="w-64 h-64 object-contain" />
                    </CardContent>
                  </Card>
                )}

                {/* Add Collection Button */}
                <Button onClick={() => setShowAddCollection(true)} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Collection Entry
                </Button>

                {/* Collections List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Fund Collections</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Payer Name</TableHead>
                            <TableHead>Amount</TableHead>
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteCollection(col.id)}
                                    className="text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
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
            <Button onClick={() => setShowAddFolder(true)} className="w-full">
              <FolderPlus className="w-4 h-4 mr-2" />
              Create Folder
            </Button>

            {/* Folders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {folders.map((folder) => (
                <Card key={folder.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader onClick={() => setSelectedFolder(folder)}>
                    <CardTitle className="flex items-center justify-between">
                      <span>{folder.folder_name}</span>
                      <Badge>{folder.expense_count} items</Badge>
                    </CardTitle>
                    <CardDescription>{folder.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">₹{Number(folder.folder_total).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created by {folder.created_by_name}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Expenses View (All + optionally filtered by selected folder) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{selectedFolder ? selectedFolder.folder_name : 'All Expenses'}</CardTitle>
                  <CardDescription>
                    {selectedFolder ? 'Expenses in this folder' : 'All expenses across folders'}
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAddExpense(true)}
                  size="sm"
                  disabled={!selectedFolder}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folder</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Created By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedFolder
                        ? expenses.filter((e) => e.folder_id === selectedFolder.id)
                        : expenses
                      ).map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{expense.folder_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {expense.created_at ? new Date(expense.created_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>{expense.expense_title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">₹{Number(expense.grand_total).toFixed(2)}</TableCell>
                          <TableCell>{expense.created_by_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Collection Dialog */}
      <Dialog open={showAddCollection} onOpenChange={setShowAddCollection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fund Collection Entry</DialogTitle>
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
              <Input
                value={collectionFormData.department}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, department: e.target.value })
                }
                placeholder="Optional"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Add Entry
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddCollection(false)}>
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
