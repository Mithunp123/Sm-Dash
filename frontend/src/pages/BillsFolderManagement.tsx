import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import DeveloperCredit from '@/components/DeveloperCredit';
import { BackButton } from '@/components/BackButton';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { FolderPlus, Trash2, Edit2, Eye, Loader2, Plus, Folder } from 'lucide-react';

const BillsFolderManagement = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  
  // State
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showExpensesDialog, setShowExpensesDialog] = useState(false);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [folderForm, setFolderForm] = useState({
    folder_name: '',
    description: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_title: '',
    category: 'food',
    breakfast_amount: 0,
    lunch_amount: 0,
    dinner_amount: 0,
    refreshment_amount: 0,
    fuel_amount: 0,
    accommodation_amount: 0,
    other_expense: 0
  });

  // Check auth
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    if (!eventId) {
      toast.error('No event selected');
      navigate(-1);
      return;
    }

    loadFolders();
  }, [eventId]);

  // Load folders
  const loadFolders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bills/folders/${eventId}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setFolders(data.folders || []);
      } else {
        toast.error(data.message || 'Failed to load folders');
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      toast.error('Error loading folders');
    } finally {
      setLoading(false);
    }
  };

  // Load expenses for folder
  const loadExpenses = async (folderId: number) => {
    try {
      const response = await fetch(`/api/expenses/folder/${folderId}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setExpenses(data.expenses || []);
      } else {
        toast.error(data.message || 'Failed to load expenses');
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Error loading expenses');
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!folderForm.folder_name.trim()) {
      toast.error('Please enter folder name');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bills/folders/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          event_id: parseInt(eventId!),
          ...folderForm
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Folder created successfully');
        setShowNewFolderDialog(false);
        setFolderForm({ folder_name: '', description: '' });
        loadFolders();
      } else {
        toast.error(data.message || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error creating folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add expense to folder
  const handleAddExpense = async () => {
    if (!expenseForm.expense_title.trim()) {
      toast.error('Please enter expense title');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/expenses/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          event_id: parseInt(eventId!),
          folder_id: selectedFolder.id,
          ...expenseForm,
          breakfast_amount: parseFloat(expenseForm.breakfast_amount as any) || 0,
          lunch_amount: parseFloat(expenseForm.lunch_amount as any) || 0,
          dinner_amount: parseFloat(expenseForm.dinner_amount as any) || 0,
          refreshment_amount: parseFloat(expenseForm.refreshment_amount as any) || 0,
          fuel_amount: parseFloat(expenseForm.fuel_amount as any) || 0,
          accommodation_amount: parseFloat(expenseForm.accommodation_amount as any) || 0,
          other_expense: parseFloat(expenseForm.other_expense as any) || 0
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Expense added successfully');
        setShowAddExpenseDialog(false);
        setExpenseForm({
          expense_title: '',
          category: 'food',
          breakfast_amount: 0,
          lunch_amount: 0,
          dinner_amount: 0,
          refreshment_amount: 0,
          fuel_amount: 0,
          accommodation_amount: 0,
          other_expense: 0
        });
        loadExpenses(selectedFolder.id);
      } else {
        toast.error(data.message || 'Failed to add expense');
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Error adding expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folderId: number) => {
    if (!window.confirm('Are you sure you want to delete this folder and all its expenses?')) {
      return;
    }

    try {
      const response = await fetch(`/api/bills/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Folder deleted successfully');
        if (selectedFolder?.id === folderId) {
          setSelectedFolder(null);
        }
        loadFolders();
      } else {
        toast.error(data.message || 'Failed to delete folder');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Error deleting folder');
    }
  };

  // Delete expense
  const handleDeleteExpense = async (expenseId: number) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Expense deleted successfully');
        loadExpenses(selectedFolder.id);
      } else {
        toast.error(data.message || 'Failed to delete expense');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Error deleting expense');
    }
  };

  // View folder expenses
  const handleViewFolder = async (folder: any) => {
    setSelectedFolder(folder);
    await loadExpenses(folder.id);
    setShowExpensesDialog(true);
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
          <h1 className="text-4xl font-bold mt-4 mb-2">Bills & Expenses</h1>
          <p className="text-muted-foreground">Manage expense folders and bills for this event</p>
        </div>

        {/* Create Folder Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end gap-2"
        >
          <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <FolderPlus className="w-5 h-5" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="folder-name">Folder Name *</Label>
                  <Input
                    id="folder-name"
                    placeholder="e.g., Venue Expenses, Catering Costs"
                    value={folderForm.folder_name}
                    onChange={(e) => setFolderForm({ ...folderForm, folder_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="folder-desc">Description</Label>
                  <Input
                    id="folder-desc"
                    placeholder="Optional description"
                    value={folderForm.description}
                    onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFolder} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Folder'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Folders List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {folders.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No folders created yet</p>
                <Button onClick={() => setShowNewFolderDialog(true)}>
                  Create First Folder
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="w-5 h-5" />
                  Expense Folders ({folders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folder Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folders.map((folder) => (
                        <TableRow key={folder.id}>
                          <TableCell className="font-medium">{folder.folder_name}</TableCell>
                          <TableCell className="text-muted-foreground">{folder.description || '-'}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewFolder(folder)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="gap-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Expenses Dialog */}
        <Dialog open={showExpensesDialog} onOpenChange={setShowExpensesDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedFolder?.folder_name} - Expenses
              </DialogTitle>
            </DialogHeader>

            {selectedFolder && (
              <div className="space-y-6">
                {/* Add expense button */}
                <div className="flex justify-end gap-2">
                  <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Expense</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        <div>
                          <Label>Expense Title *</Label>
                          <Input
                            placeholder="e.g., Lunch for volunteers"
                            value={expenseForm.expense_title}
                            onChange={(e) => setExpenseForm({ ...expenseForm, expense_title: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label>Category</Label>
                          <select
                            className="w-full border rounded px-3 py-2"
                            value={expenseForm.category}
                            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                          >
                            <option value="food">Food</option>
                            <option value="transport">Transport</option>
                            <option value="accommodation">Accommodation</option>
                            <option value="supplies">Supplies</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">Breakfast (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.breakfast_amount || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, breakfast_amount: e.target.value as any })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Lunch (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.lunch_amount || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, lunch_amount: e.target.value as any })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Dinner (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.dinner_amount || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, dinner_amount: e.target.value as any })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Refreshment (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.refreshment_amount || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, refreshment_amount: e.target.value as any })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Fuel (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.fuel_amount || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, fuel_amount: e.target.value as any })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Accommodation (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.accommodation_amount || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, accommodation_amount: e.target.value as any })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Other (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseForm.other_expense || ''}
                              onChange={(e) => setExpenseForm({ ...expenseForm, other_expense: e.target.value as any })}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddExpense} disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add Expense'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Expenses List */}
                {expenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No expenses in this folder yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map((expense) => (
                      <Card key={expense.id} className="bg-muted/50">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Title</Label>
                              <p className="font-medium">{expense.expense_title}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Category</Label>
                              <p className="font-medium capitalize">{expense.category}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-background rounded">
                            <div className="text-center">
                              <Label className="text-xs text-muted-foreground">Food Total</Label>
                              <p className="font-bold text-green-600">₹ {(expense.food_total || 0).toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                              <Label className="text-xs text-muted-foreground">Travel Total</Label>
                              <p className="font-bold text-blue-600">₹ {(expense.travel_total || 0).toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                              <Label className="text-xs text-muted-foreground">Grand Total</Label>
                              <p className="font-bold text-purple-600">₹ {(expense.grand_total || 0).toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default BillsFolderManagement;
