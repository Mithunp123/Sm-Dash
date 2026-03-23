import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DeveloperCredit from '@/components/DeveloperCredit';
import { BackButton } from '@/components/BackButton';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Upload, Trash2, QrCode, Loader2 } from 'lucide-react';

const EventFinanceSettings = () => {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [fundraisingEnabled, setFundraisingEnabled] = useState(false);
  const [qrCodePath, setQrCodePath] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [showQrUpload, setShowQrUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('admin')) {
      navigate('/login');
      return;
    }

    loadSettings();
  }, []);

  // Load settings
  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await api.call('GET', '/fundraising/status');

      if (result.success) {
        setFundraisingEnabled(result.fundraising_enabled);
        setQrCodePath(result.qr_code_path);
      }
    } catch (err) {
      toast.error('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle fundraising
  const handleToggleFundraising = async (enabled) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  // Handle QR upload
  const handleQRUpload = async () => {
    try {
      if (!qrFile) {
        toast.error('Please select a file');
        return;
      }

      setUploading(true);
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
      setUploading(false);
    }
  };

  // Delete QR code
  const handleDeleteQR = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
          <h1 className="text-4xl font-bold mt-4 mb-2">Finance Settings</h1>
          <p className="text-muted-foreground">Manage fundraising and payment configurations</p>
        </div>

        {/* Fundraising Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Fund Raising Status</CardTitle>
              <CardDescription>
                Enable or disable fund raising for events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <h3 className="font-semibold">Enable Fund Raising</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    When enabled, office bearers can add fund collections and office bearers can view fundraising module
                  </p>
                </div>
                <Switch
                  checked={fundraisingEnabled}
                  onCheckedChange={(checked) => handleToggleFundraising(checked)}
                  disabled={loading}
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
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Replace QR Code
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDeleteQR}
                      disabled={loading}
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
                  <Button onClick={() => setShowQrUpload(true)}>
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
            <CardTitle className="text-blue-900 dark:text-blue-100">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-blue-800 dark:text-blue-200">
            <p>
              <strong>1. Enable Fund Raising:</strong> Toggle the switch above to activate the fund raising module for office bearers
            </p>
            <p>
              <strong>2. Upload QR Code:</strong> Upload a QR code image that links to your payment gateway or UPI
            </p>
            <p>
              <strong>3. Share Access:</strong> Once enabled, office bearers can add cash and online payment entries
            </p>
            <p>
              <strong>4. Track Collections:</strong> All collections are automatically tracked with payer details and payment mode
            </p>
          </CardContent>
        </Card>
      </main>

      {/* QR Upload Dialog */}
      <Dialog open={showQrUpload} onOpenChange={setShowQrUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('qr-input').click()}
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
                <p className="text-xs text-muted-foreground mt-1">
                  {(qrFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleQRUpload}
                disabled={!qrFile || uploading}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowQrUpload(false);
                  setQrFile(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventFinanceSettings;
