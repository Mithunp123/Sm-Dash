import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DeveloperCredit from '@/components/DeveloperCredit';
import { Shield, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ManageProfileFields = () => {
  const navigate = useNavigate();
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // wait for permissions to load
    if (permissionsLoading) return;

    // allow admins or users with the profile fields permission
    const userIsAdmin = auth.hasRole('admin');
    if (!userIsAdmin && !permissions?.can_manage_profile_fields) {
      navigate('/admin');
      return;
    }

    load();
  }, [navigate, permissionsLoading, permissions]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.getProfileFieldSettings();
      if (res.success) setFields(res.fields || []);
    } catch (err: any) {
      toast.error('Failed to load settings: ' + (err.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      const payload = fields.map(f => ({ field_name: f.field_name, editable_by_student: !!f.editable_by_student, visible: !!f.visible }));
      const res = await api.updateProfileFieldSettings(payload);
      if (res.success) {
        setFields(res.fields || []);
        toast.success('Profile field settings updated');
      }
    } catch (err: any) {
      toast.error('Failed to save settings: ' + (err.message || 'Unknown'));
    }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) {
      toast.error('Label cannot be empty');
      return;
    }
    try {
      const res = await api.addProfileField(newFieldLabel, newFieldType);
      if (res.success) {
        setFields(res.fields || []);
        toast.success('Field added successfully');
        setShowAddDialog(false);
        setNewFieldLabel('');
        setNewFieldType('text');
      }
    } catch (err: any) {
      toast.error('Failed to add field: ' + (err.message || 'Unknown'));
    }
  };

  const handleDeleteField = async (field_name: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    try {
      const res = await api.deleteProfileField(field_name);
      if (res.success) {
        setFields(res.fields || []);
        toast.success('Field deleted successfully');
      }
    } catch (err: any) {
      toast.error('Failed to delete field: ' + (err.message || 'Unknown'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-primary">Profile Field Settings</h1>
                  <p className="text-muted-foreground">Control which profile fields students can edit and visibility. Add custom fields.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={load}>Refresh</Button>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Add Field
                </Button>
                <Button onClick={save}>Save Settings</Button>
              </div>
            </div>

            <Card className="gradient-card">
              <CardHeader>
                <CardTitle>Predefined Fields</CardTitle>
                <CardDescription>Toggle whether students can edit each field and whether the field is visible</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fields.filter(f => !f.is_custom).map((f) => (
                      <div key={f.field_name} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{f.label}</div>
                          <div className="text-sm text-muted-foreground">Field name: {f.field_name}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">Editable by student</div>
                            <Switch checked={f.editable_by_student == 1} onCheckedChange={(v) => setFields(fields.map(x => x.field_name === f.field_name ? { ...x, editable_by_student: v ? 1 : 0 } : x))} />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm">Visible</div>
                            <Switch checked={f.visible == 1} onCheckedChange={(v) => setFields(fields.map(x => x.field_name === f.field_name ? { ...x, visible: v ? 1 : 0 } : x))} />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {fields.some(f => f.is_custom) && (
              <Card className="gradient-card mt-6">
                <CardHeader>
                  <CardTitle>Custom Fields</CardTitle>
                  <CardDescription>Custom fields you have added</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {fields.filter(f => f.is_custom).map((f) => (
                      <div key={f.field_name} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{f.label}</div>
                          <div className="text-sm text-muted-foreground">Field name: {f.field_name} (Type: {f.field_type})</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">Editable by student</div>
                            <Switch checked={f.editable_by_student == 1} onCheckedChange={(v) => setFields(fields.map(x => x.field_name === f.field_name ? { ...x, editable_by_student: v ? 1 : 0 } : x))} />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm">Visible</div>
                            <Switch checked={f.visible == 1} onCheckedChange={(v) => setFields(fields.map(x => x.field_name === f.field_name ? { ...x, visible: v ? 1 : 0 } : x))} />
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteField(f.field_name)}
                            className="gap-1"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Profile Field</DialogTitle>
            <DialogDescription>Create a new custom profile field for students</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="field-label" className="text-sm font-medium">Field Label</Label>
              <Input
                id="field-label"
                placeholder="e.g., Photo, Admission Number, Register Number"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">This will be displayed as the field name in forms</p>
            </div>
            <div>
              <Label htmlFor="field-type" className="text-sm font-medium">Field Type</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger id="field-type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddField}>Add Field</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ManageProfileFields;
