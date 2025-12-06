import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DeveloperCredit from '@/components/DeveloperCredit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { auth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Upload, FolderPlus, Folder, FileText, Trash2, ArrowLeft, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_ROOT = API_BASE.replace(/\/api\/?$/, '');

const Reports = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  
  // Folder creation state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  
  // File upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileTitle, setFileTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadTime, setUploadTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  
  // Filter state
  const [yearFilter, setYearFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('');

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadFolders();
    loadFiles();
  }, [currentFolder, yearFilter, monthFilter]);

  const loadFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/resources/folders`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load folders');
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append('resource_type', 'REPORT');
      if (yearFilter) queryParams.append('year', yearFilter);
      if (monthFilter) queryParams.append('month', monthFilter);
      
      const res = await fetch(`${API_BASE}/resources?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        let filtered = data.resources || [];
        if (currentFolder) {
          filtered = filtered.filter((r: any) => r.folder_id === currentFolder);
        } else {
          filtered = filtered.filter((r: any) => !r.folder_id || r.folder_id === null);
        }
        setFiles(filtered);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/resources/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          name: folderName.trim(),
          description: folderDescription.trim() || null,
          parent_id: currentFolder || null
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Folder created successfully!');
        setShowFolderModal(false);
        setFolderName('');
        setFolderDescription('');
        loadFolders();
        if (data.folder) {
          setCurrentFolder(data.folder.id);
          loadFiles();
        }
      } else {
        toast.error(data.message || 'Failed to create folder');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create folder');
    }
  };

  const handleDeleteFolder = async (id: number) => {
    if (!confirm('Are you sure you want to delete this folder? Resources inside will not be deleted.')) return;
    try {
      const res = await fetch(`${API_BASE}/resources/folders/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Folder deleted');
        loadFolders();
        if (currentFolder === id) {
          setCurrentFolder(null);
          loadFiles();
        }
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!fileTitle.trim()) {
        setFileTitle(file.name);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    
    if (!fileTitle.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', fileTitle.trim());
      fd.append('resource_type', 'REPORT');
      fd.append('upload_date', uploadDate);
      fd.append('upload_time', uploadTime + ':00'); // Add seconds
      if (selectedFolderId || currentFolder) {
        fd.append('folder_id', (selectedFolderId || currentFolder)!.toString());
      }
      
      const res = await fetch(`${API_BASE}/resources`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File uploaded successfully!');
        loadFiles();
        setShowUploadModal(false);
        setFileTitle('');
        setSelectedFile(null);
        setSelectedFolderId(null);
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      const res = await fetch(`${API_BASE}/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File deleted');
        loadFiles();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const buildFileUrl = (resource: any) => {
    const direct = resource?.url;
    if (direct && /^https?:\/\//i.test(direct)) return direct;
    const fallback = direct || resource?.path || (resource?.filename ? `/uploads/resources/${resource.filename}` : '');
    if (!fallback) return '';
    return `${API_ROOT}${fallback.startsWith('/') ? fallback : `/${fallback}`}`;
  };

  const getCurrentFolderName = () => {
    if (!currentFolder) return 'Root';
    const folder = folders.find(f => f.id === currentFolder);
    return folder?.name || 'Unknown';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      <DeveloperCredit />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="ghost" 
              onClick={() => {
                const user = auth.getUser();
                if (user?.role === 'admin') navigate('/admin');
                else if (user?.role === 'office_bearer') navigate('/office-bearer');
                else if (user?.role === 'student') navigate('/student');
                else navigate('/');
              }} 
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-primary">Reports</h1>
              <p className="text-muted-foreground">Create folders and upload report files</p>
            </div>
          </div>

          {/* Filters and Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex gap-3 flex-1">
              <div className="space-y-1">
                <Label htmlFor="year-filter">Year</Label>
                <Input
                  id="year-filter"
                  type="number"
                  placeholder="e.g., 2024"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="month-filter">Month</Label>
                <select
                  id="month-filter"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-40 px-3 py-2 border rounded-md"
                >
                  <option value="">All Months</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => setShowFolderModal(true)}
                className="gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                Create Folder
              </Button>
              <Button 
                onClick={() => setShowUploadModal(true)}
                variant="outline"
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          {currentFolder && (
            <div className="mb-4 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentFolder(null);
                  loadFiles();
                }}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Root
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{getCurrentFolderName()}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Folders Section */}
            <Card>
              <CardHeader>
                <CardTitle>Folders</CardTitle>
                <CardDescription>Organize your reports</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                ) : folders.filter(f => (currentFolder ? f.parent_id === currentFolder : !f.parent_id)).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No folders</p>
                ) : (
                  <div className="space-y-2">
                    {folders
                      .filter(f => (currentFolder ? f.parent_id === currentFolder : !f.parent_id))
                      .map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setCurrentFolder(folder.id);
                            loadFiles();
                          }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Folder className="w-5 h-5 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{folder.name}</p>
                              {folder.description && (
                                <p className="text-xs text-muted-foreground truncate">{folder.description}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Files Section */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>Uploaded report files</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                ) : files.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No files in this folder</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{file.title || file.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.upload_date && file.upload_time 
                                ? `${file.upload_date} ${file.upload_time}`
                                : new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(buildFileUrl(file), '_blank')}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {/* Create Folder Dialog */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Create a folder to organize your reports</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name *</Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-desc">Description (Optional)</Label>
              <Textarea
                id="folder-desc"
                value={folderDescription}
                onChange={(e) => setFolderDescription(e.target.value)}
                placeholder="Enter folder description"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowFolderModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload File Dialog */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Report File</DialogTitle>
            <DialogDescription>Upload a file to the current folder</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select File *</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-title">Display Name *</Label>
              <Input
                id="file-title"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="Enter display name for the file"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upload-date">Upload Date *</Label>
                <Input
                  id="upload-date"
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-time">Upload Time *</Label>
                <Input
                  id="upload-time"
                  type="time"
                  value={uploadTime}
                  onChange={(e) => setUploadTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-folder">Upload to Folder (Optional)</Label>
              <select
                id="upload-folder"
                value={selectedFolderId || currentFolder || ''}
                onChange={(e) => setSelectedFolderId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Root Folder</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setFileTitle('');
                setUploadDate(new Date().toISOString().split('T')[0]);
                setUploadTime(new Date().toTimeString().slice(0, 5));
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !fileTitle.trim()}>
                {uploading ? (
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;

