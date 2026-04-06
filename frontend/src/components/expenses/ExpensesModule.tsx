import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Download, Edit, Trash2, Plus, FolderPlus, Loader2 } from 'lucide-react';

type ExpenseRow = {
  id: number;
  folder_id: number;
  folder_name?: string;
  expense_title: string;
  category: string;
  grand_total?: number;
  created_at?: string;
  created_by?: number;
  created_by_name?: string;
  transport_from?: string | null;
  transport_to?: string | null;

  // Component amounts (used to compute total when `grand_total` is not generated)
  breakfast_amount?: number;
  lunch_amount?: number;
  dinner_amount?: number;
  refreshment_amount?: number;
  fuel_amount?: number;
  accommodation_amount?: number;
  other_expense?: number;
};

type FolderRow = {
  id: number;
  folder_name: string;
  description?: string;
  folder_total?: number;
  expense_count?: number;
  created_by?: number;
};

type ExpensesModuleProps = {
  eventId: string | number;
  folders: FolderRow[];
  expenses: ExpenseRow[];
  onRefresh: () => Promise<void> | void;
};

type CategoryKey = 'food' | 'travel' | 'fuel' | 'stationary' | 'other';

const CATEGORY_META: Array<{ key: CategoryKey; label: string }> = [
  { key: 'food', label: 'Food & Refreshment' },
  { key: 'travel', label: 'Transport' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'stationary', label: 'Stationary' },
  { key: 'other', label: 'Others' }
];

const toDisplayCategoryKey = (category: string | null | undefined): CategoryKey => {
  const c = (category || '').toString().toLowerCase();
  if (c === 'food') return 'food';
  if (c === 'travel') return 'travel';
  if (c === 'fuel') return 'fuel';
  if (c === 'stationary') return 'stationary';
  // Backward compatibility: map legacy 'accommodation' and 'other' into 'Others'
  if (c === 'accommodation' || c === 'other') return 'other';
  return 'other';
};

const formatMoney = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

const formatDate = (d?: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString();
};

const normalizeCategoryForAPI = (key: CategoryKey) => {
  // API expects stored categories: food, travel, fuel, stationary, other
  return key;
};

export default function ExpensesModule({ eventId, folders, expenses, onRefresh }: ExpensesModuleProps) {
  const role = auth.getRole();
  const user = auth.getUser();
  const currentUserId = user?.id;

  const canEdit = role === 'admin' || role === 'office_bearer';

  // Some DB setups might not have `grand_total` as a generated column.
  // Compute totals from component fields so amount never shows as 0 incorrectly.
  const computeExpenseAmount = (e: ExpenseRow) => {
    const breakfast = Number(e.breakfast_amount || 0);
    const lunch = Number(e.lunch_amount || 0);
    const dinner = Number(e.dinner_amount || 0);
    const refreshment = Number(e.refreshment_amount || 0);
    const fuel = Number(e.fuel_amount || 0);
    const accommodation = Number(e.accommodation_amount || 0);
    const other = Number(e.other_expense || 0);

    const computed = breakfast + lunch + dinner + refreshment + fuel + accommodation + other;
    // Prefer backend-provided grand_total if present and non-null.
    const gt = e.grand_total;
    return gt === null || gt === undefined ? computed : Number(gt) || computed;
  };

  // Search + filter for expense items
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<CategoryKey | 'all'>('all');

  const [openFolderValues, setOpenFolderValues] = useState<string[]>([]);

  // Folder dialogs
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<'add' | 'edit'>('add');
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [folderForm, setFolderForm] = useState({ folder_name: '', description: '' });
  const [folderBusy, setFolderBusy] = useState(false);

  const [confirmFolderDeleteOpen, setConfirmFolderDeleteOpen] = useState(false);
  const [confirmFolderDeleteId, setConfirmFolderDeleteId] = useState<number | null>(null);
  const [folderDeleteBusy, setFolderDeleteBusy] = useState(false);

  // Expense dialogs
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogMode, setItemDialogMode] = useState<'add' | 'edit'>('add');
  const [itemEditingId, setItemEditingId] = useState<number | null>(null);
  const [itemDialogFolderId, setItemDialogFolderId] = useState<number | null>(null);
  const [expenseBusy, setExpenseBusy] = useState(false);

  const [expenseForm, setExpenseForm] = useState<{
    expense_title: string;
    category: CategoryKey;
    amount: string;
    date: string; // yyyy-mm-dd
    from_location: string;
    to_location: string;
  }>({
    expense_title: '',
    category: 'food',
    amount: '',
    date: '',
    from_location: '',
    to_location: ''
  });

  const visibleExpenses = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase();
    return expenses.filter((e) => {
      const displayKey = toDisplayCategoryKey(e.category);
      if (expenseCategoryFilter !== 'all' && displayKey !== expenseCategoryFilter) return false;
      if (!q) return true;
      const title = (e.expense_title || '').toLowerCase();
      return title.includes(q);
    });
  }, [expenses, expenseSearch, expenseCategoryFilter]);

  // Toastless state hint
  useEffect(() => {
    // Auto-open first folder if any and none opened.
    if (folders.length > 0 && openFolderValues.length === 0) {
      setOpenFolderValues([String(folders[0].id)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.length]);

  const grouped = useMemo(() => {
    const byFolder: Record<number, Record<CategoryKey, ExpenseRow[]>> = {};
    for (const f of folders) {
      byFolder[f.id] = { food: [], travel: [], fuel: [], stationary: [], other: [] };
    }
    for (const e of visibleExpenses) {
      const folderId = e.folder_id;
      const catKey = toDisplayCategoryKey(e.category);
      if (!byFolder[folderId]) byFolder[folderId] = { food: [], travel: [], fuel: [], stationary: [], other: [] };
      byFolder[folderId][catKey].push(e);
    }
    for (const folderId of Object.keys(byFolder)) {
      for (const key of CATEGORY_META.map((c) => c.key)) {
        byFolder[Number(folderId)][key].sort((a, b) => {
          const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bd - ad;
        });
      }
    }
    return byFolder;
  }, [folders, visibleExpenses]);

  const totals = useMemo(() => {
    const overall_total = visibleExpenses.reduce((sum, e) => sum + computeExpenseAmount(e), 0);
    const totals_by_category: Record<CategoryKey, number> = { food: 0, travel: 0, fuel: 0, stationary: 0, other: 0 };
    for (const e of visibleExpenses) {
      const key = toDisplayCategoryKey(e.category);
      totals_by_category[key] += computeExpenseAmount(e);
    }
    return { overall_total, totals_by_category };
  }, [visibleExpenses]);

  const openAddFolderDialog = () => {
    setFolderDialogMode('add');
    setEditingFolderId(null);
    setFolderForm({ folder_name: '', description: '' });
    setFolderDialogOpen(true);
  };

  const openEditFolderDialog = (folder: FolderRow) => {
    setFolderDialogMode('edit');
    setEditingFolderId(folder.id);
    setFolderForm({ folder_name: folder.folder_name || '', description: folder.description || '' });
    setFolderDialogOpen(true);
  };

  const submitFolderDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!folderForm.folder_name.trim()) {
      toast.error('Please enter folder name');
      return;
    }

    try {
      setFolderBusy(true);
      if (folderDialogMode === 'add') {
        const result = await api.call('POST', '/expenses/folder/add', {
          event_id: eventId,
          folder_name: folderForm.folder_name.trim(),
          description: folderForm.description || ''
        });
        if (!result.success) throw new Error(result.message || 'Failed to create folder');
      } else {
        const result = await api.call('PUT', `/expenses/folder/${editingFolderId}`, {
          folder_name: folderForm.folder_name.trim(),
          description: folderForm.description || ''
        });
        if (!result.success) throw new Error(result.message || 'Failed to update folder');
      }

      toast.success(`Folder ${folderDialogMode === 'add' ? 'created' : 'updated'}`);
      setFolderDialogOpen(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Folder operation failed');
    } finally {
      setFolderBusy(false);
    }
  };

  const requestFolderDelete = (folderId: number) => {
    setConfirmFolderDeleteId(folderId);
    setConfirmFolderDeleteOpen(true);
  };

  const confirmDeleteFolder = async () => {
    if (!canEdit || !confirmFolderDeleteId) return;
    try {
      setFolderDeleteBusy(true);
      const result = await api.call('DELETE', `/expenses/folder/${confirmFolderDeleteId}`);
      if (!result.success) throw new Error(result.message || 'Failed to delete folder');
      toast.success('Folder deleted');
      setConfirmFolderDeleteOpen(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Delete folder failed');
    } finally {
      setFolderDeleteBusy(false);
    }
  };

  const openAddItemDialog = (folderId: number) => {
    setItemDialogMode('add');
    setItemEditingId(null);
    setItemDialogFolderId(folderId);
    setExpenseForm({
      // Backend requires `expense_title`. We auto-fill it on submit and keep this hidden.
      expense_title: '',
      category: 'food',
      amount: '',
      date: '',
      from_location: '',
      to_location: ''
    });
    setItemDialogOpen(true);
  };

  const openEditItemDialog = (expense: ExpenseRow) => {
    setItemDialogMode('edit');
    setItemEditingId(expense.id);
    setItemDialogFolderId(expense.folder_id);
    const dateValue = expense.created_at ? new Date(expense.created_at).toISOString().slice(0, 10) : '';
    setExpenseForm({
      expense_title: expense.expense_title || '',
      category: toDisplayCategoryKey(expense.category),
      amount: String(Number(computeExpenseAmount(expense)).toFixed(2)),
      date: dateValue,
      from_location: expense.transport_from || '',
      to_location: expense.transport_to || ''
    });
    setItemDialogOpen(true);
  };

  const submitItemDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!itemDialogFolderId) {
      toast.error('Folder is required');
      return;
    }

    const amountNum = parseFloat(expenseForm.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Please enter an amount greater than 0');
      return;
    }
    const chosenDate = expenseForm.date || todayISO;
    if (!chosenDate) {
      toast.error('Please pick a date');
      return;
    }
    if (expenseForm.category === 'travel') {
      if (!expenseForm.from_location.trim() || !expenseForm.to_location.trim()) {
        toast.error('From and To locations are required for Travel expenses');
        return;
      }
    }

    const derivedExpenseTitle =
      expenseForm.expense_title.trim() ||
      `${CATEGORY_META.find((c) => c.key === expenseForm.category)?.label || 'Expense'} Expense`;

    const payloadBase = {
      // Include these even for update so backend validation is satisfied
      event_id: eventId,
      folder_id: itemDialogFolderId,
      expense_title: derivedExpenseTitle,
      category: normalizeCategoryForAPI(expenseForm.category),
      amount: amountNum,
      date: chosenDate,
      from_location: expenseForm.from_location || '',
      to_location: expenseForm.to_location || ''
    };

    try {
      setExpenseBusy(true);
      if (itemDialogMode === 'add') {
        const result = await api.call('POST', '/expenses/add', {
          ...payloadBase
        });
        if (!result.success) throw new Error(result.message || 'Failed to add expense');
        toast.success('Expense added');
      } else if (itemEditingId) {
        const result = await api.call('PUT', `/expenses/${itemEditingId}`, payloadBase);
        if (!result.success) throw new Error(result.message || 'Failed to update expense');
        toast.success('Expense updated');
      }

      setItemDialogOpen(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Expense operation failed');
    } finally {
      setExpenseBusy(false);
    }
  };

  const deleteExpense = async (expense: ExpenseRow) => {
    if (!canEdit) return;
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      setExpenseBusy(true);
      const result = await api.call('DELETE', `/expenses/${expense.id}`);
      if (!result.success) throw new Error(result.message || 'Failed to delete expense');
      toast.success('Expense deleted');
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setExpenseBusy(false);
    }
  };

  const downloadExport = async (type: 'pdf' | 'excel') => {
    try {
      if (!canEdit) return;
      const token = auth.getToken();
      if (!token) throw new Error('Not authenticated');

      const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      // Normalize in case `VITE_API_URL` is set with or without `/api` (or `/api/expenses`)
      const apiRoot = String(rawBase)
        .replace(/\/api\/expenses\/?$/, '')
        .replace(/\/api\/?$/, '');
      const url = `${apiRoot}/api/expenses/export/${type === 'excel' ? 'excel' : 'pdf'}/${eventId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const extension = type === 'pdf' ? 'pdf' : 'xlsx';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `expenses_${eventId}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`${type === 'pdf' ? 'PDF' : 'Excel'} downloaded`);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Expenses Summary</CardTitle>
            <CardDescription>
              Overall total: <span className="font-semibold text-red-600">{formatMoney(totals.overall_total)}</span>
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={() => downloadExport('excel')} disabled={!canEdit}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadExport('pdf')} disabled={!canEdit}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
            {canEdit && (
              <Button size="sm" onClick={openAddFolderDialog}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Create Folder
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
            <div className="flex-1">
              <Label>Search Expenses</Label>
              <Input
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                placeholder="Search by expense title..."
                className="mt-2"
              />
            </div>
            <div className="w-full md:w-64">
              <Label>Category Filter</Label>
              <Select
                value={expenseCategoryFilter}
                onValueChange={(v) => setExpenseCategoryFilter(v as any)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORY_META.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {CATEGORY_META.map((c) => (
              <div key={c.key} className="p-3 bg-muted rounded-md">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="font-bold">{formatMoney(totals.totals_by_category[c.key])}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {folders.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            No folders created yet.
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          value={openFolderValues}
          onValueChange={(v) => setOpenFolderValues(v as string[])}
          className="w-full"
        >
          {folders.map((folder) => {
            const folderExpenses = grouped[folder.id] || { food: [], travel: [], fuel: [], stationary: [], other: [] };
            const canManageThisFolder =
              canEdit && (role === 'admin' || (role === 'office_bearer' && currentUserId && folder.created_by === currentUserId));

            const folderTotal = (Object.values(folderExpenses) as ExpenseRow[][])
              .flat()
              .reduce((sum, e) => sum + computeExpenseAmount(e), 0);

            return (
              <AccordionItem key={folder.id} value={String(folder.id)} className="border rounded-lg mb-4 overflow-hidden">
                <AccordionTrigger className="px-4 py-3 bg-background hover:bg-muted/40">
                  <div className="w-full flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{folder.folder_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {folder.expense_count || 0} items
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-primary">{formatMoney(folderTotal)}</div>
                        <div className="text-xs text-muted-foreground">Folder total</div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">{folder.description || 'No description'}</div>

                    {canManageThisFolder && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:bg-blue-50"
                          onClick={async () => {
                            try {
                              const token = auth.getToken();
                              if (!token) throw new Error('Not authenticated');
                              const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                              const url = `${apiUrl}/finance/folder-report/excel/${folder.id}`;
                              const response = await fetch(url, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (!response.ok) throw new Error(`Export failed (${response.status})`);
                              const blob = await response.blob();
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = `${folder.folder_name}_report.xlsx`;
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                              toast.success('Folder report (Excel) downloaded');
                            } catch (err: any) {
                              toast.error(err?.message || 'Excel export failed');
                            }
                          }}
                          title="Export Excel"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:bg-green-50"
                          onClick={async () => {
                            try {
                              const token = auth.getToken();
                              if (!token) throw new Error('Not authenticated');
                              const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                              const url = `${apiUrl}/finance/folder-report/pdf/${folder.id}`;
                              const response = await fetch(url, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (!response.ok) throw new Error(`Export failed (${response.status})`);
                              const blob = await response.blob();
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = `${folder.folder_name}_report.pdf`;
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                              toast.success('Folder report (PDF) downloaded');
                            } catch (err: any) {
                              toast.error(err?.message || 'PDF export failed');
                            }
                          }}
                          title="Export PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:bg-blue-50"
                          onClick={() => openEditFolderDialog(folder)}
                          title="Edit folder"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => requestFolderDelete(folder.id)}
                          title="Delete folder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    <Accordion type="multiple" className="w-full">
                      {CATEGORY_META.map((cat) => {
                        const items = folderExpenses[cat.key] || [];
                        const total = items.reduce((sum, e) => sum + computeExpenseAmount(e), 0);
                        return (
                          <AccordionItem key={`${folder.id}-${cat.key}`} value={`${folder.id}-${cat.key}`} className="border-b last:border-b-0">
                            <AccordionTrigger className="py-3 px-2 hover:no-underline">
                              <div className="w-full flex items-center justify-between gap-2">
                                <div className="font-medium flex items-center gap-2">
                                  <Badge variant="outline">{cat.label}</Badge>
                                </div>
                                <div className="font-bold text-primary">{formatMoney(total)}</div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-2">
                              {items.length === 0 ? (
                                <div className="py-4 text-sm text-muted-foreground">No items.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Created By</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {items.map((item) => {
                                        const canManageThisExpense =
                                          canEdit && (role === 'admin' || (role === 'office_bearer' && currentUserId && item.created_by === currentUserId));
                                        const isTravel = cat.key === 'travel';
                                        return (
                                          <TableRow key={item.id}>
                                            <TableCell className="min-w-[220px]">
                                              <div className="font-medium">{item.expense_title}</div>
                                              {isTravel && (item.transport_from || item.transport_to) && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  {item.transport_from || '-'} → {item.transport_to || '-'}
                                                </div>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                                            <TableCell className="font-semibold">{formatMoney(computeExpenseAmount(item))}</TableCell>
                                            <TableCell>{item.created_by_name || '-'}</TableCell>
                                            <TableCell className="text-right">
                                              <div className="flex justify-end gap-2">
                                                {canManageThisExpense && (
                                                  <>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="text-blue-600 hover:bg-blue-50"
                                                      onClick={() => openEditItemDialog(item)}
                                                      title="Edit expense"
                                                    >
                                                      <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="text-destructive hover:bg-destructive/10"
                                                      onClick={() => deleteExpense(item)}
                                                      title="Delete expense"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                  </>
                                                )}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    <div className="flex justify-end">
                      {canEdit ? (
                        <Button onClick={() => openAddItemDialog(folder.id)} className="w-full md:w-auto">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                      ) : (
                        <div className="text-sm text-muted-foreground">View only</div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Add/Edit Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDialogMode === 'add' ? 'Create Folder' : 'Edit Folder'}</DialogTitle>
            <DialogDescription>
              {folderDialogMode === 'add'
                ? 'Create a new expense folder for this event.'
                : 'Update the folder name and description.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitFolderDialog} className="space-y-4">
            <div>
              <Label>Folder Name *</Label>
              <Input
                value={folderForm.folder_name}
                onChange={(e) => setFolderForm({ ...folderForm, folder_name: e.target.value })}
                placeholder="e.g., Venue Expenses"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={folderForm.description}
                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={folderBusy}>
                {folderBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Working...
                  </>
                ) : (
                  (folderDialogMode === 'add' ? 'Create Folder' : 'Update Folder')
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)} disabled={folderBusy}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Folder */}
      <Dialog open={confirmFolderDeleteOpen} onOpenChange={setConfirmFolderDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              This will delete the folder and all expenses inside it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              variant="destructive"
              onClick={confirmDeleteFolder}
              disabled={folderDeleteBusy}
            >
              {folderDeleteBusy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmFolderDeleteOpen(false)}
              disabled={folderDeleteBusy}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{itemDialogMode === 'add' ? 'Add Expense Item' : 'Edit Expense Item'}</DialogTitle>
            <DialogDescription>
              {itemDialogMode === 'add' ? 'Add a new expense entry to this folder.' : 'Update the selected expense entry.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitItemDialog} className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => {
                  const next = v as CategoryKey;
                  setExpenseForm((prev) => ({
                    ...prev,
                    category: next,
                    // Reset Travel fields if not Travel
                    from_location: next === 'travel' ? prev.from_location : '',
                    to_location: next === 'travel' ? prev.to_location : ''
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_META.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Amount * (INR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={expenseForm.date || todayISO}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                />
              </div>
            </div>

            {expenseForm.category === 'travel' && (
              <div className="border rounded-md p-4 space-y-3">
                <div className="text-sm font-medium">Travel Details</div>
                <div>
                  <Label>From Location *</Label>
                  <Input
                    value={expenseForm.from_location}
                    onChange={(e) => setExpenseForm({ ...expenseForm, from_location: e.target.value })}
                    placeholder="e.g., Chennai"
                  />
                </div>
                <div>
                  <Label>To Location *</Label>
                  <Input
                    value={expenseForm.to_location}
                    onChange={(e) => setExpenseForm({ ...expenseForm, to_location: e.target.value })}
                    placeholder="e.g., Bangalore"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Label>Created By</Label>
                <Input value={user?.name || '-'} disabled />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={expenseBusy}>
                {expenseBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  (itemDialogMode === 'add' ? 'Add Item' : 'Update Item')
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)} disabled={expenseBusy}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

