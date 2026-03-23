import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    uploadFn?: (file: File) => Promise<any>;
    title?: string;
    description?: string;
}

export function BulkUploadModal({ isOpen, onClose, onSuccess, uploadFn, title, description }: BulkUploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (!selectedFile.name.match(/\.(xlsx|csv|xls)$/)) {
                toast.error("Please select a valid Excel or CSV file");
                return;
            }
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            const upload = uploadFn || api.bulkUploadStudents;
            const response = await upload(file);
            if (response.success) {
                setResult(response.stats); // { total, success, skipped, skippedDetails }
                toast.success("Bulk upload completed");
                if (response.stats.success > 0) {
                    onSuccess(); // Refresh list only if something changed
                }
            } else {
                toast.error(response.message || "Upload failed");
            }
        } catch (error: any) {
            toast.error(error.message || "Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSample = () => {
        const sampleData = [{
            name: "John Doe",
            email: "john@student.college.edu",
            phone: "9876543210",
            department: "CSE",
            year: "3",
            register_no: "21CS001",
            academic_year: "2023-2024",
            dob: "2003-05-15",
            gender: "Male",
            blood_group: "O+",
            father_number: "9876543211",
            hosteller_dayscholar: "Hosteller",
            address: "123 Main St, City"
        }];
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sample");
        XLSX.writeFile(workbook, "bulk_upload_sample.xlsx");
    };

    const reset = () => {
        setFile(null);
        setResult(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-6">
                        <span>{title || "Bulk Student Upload"}</span>
                        <Button variant="outline" size="sm" onClick={downloadSample} className="h-8 gap-2 text-xs font-semibold text-primary hover:bg-primary/5 border-primary/20">
                            <Download className="w-3.5 h-3.5" /> Sample
                        </Button>
                    </DialogTitle>
                    <DialogDescription>
                        {description || <>Upload an Excel file (.xlsx) or CSV with columns: <b>name, email, phone, department, year, register_no, academic_year, dob, gender, blood_group, father_number, hosteller_dayscholar, address</b></>}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                    {!result ? (
                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-4 bg-slate-900/50">
                            <FileSpreadsheet className="w-12 h-12 text-slate-500" />
                            <div className="text-center">
                                <p className="text-sm text-slate-400 mb-2">Drag and drop or click to upload</p>
                                <input
                                    type="file"
                                    accept=".xlsx,.csv,.xls"
                                    className="hidden"
                                    id="bulk-upload-modal-input"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="bulk-upload-modal-input">
                                    <Button asChild className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 shadow-md h-12">
                                        <span>Select Excel / CSV File</span>
                                    </Button>
                                </label>
                            </div>
                            {file && (
                                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <button onClick={reset}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                                    <div className="text-2xl font-bold text-white">{result.total}</div>
                                    <div className="text-xs text-slate-500 uppercase">Total Rows</div>
                                </div>
                                <div className="bg-green-900/20 p-4 rounded-xl border border-green-900/50 text-center">
                                    <div className="text-2xl font-bold text-green-500">{result.success}</div>
                                    <div className="text-xs text-green-500/70 uppercase">Success</div>
                                </div>
                                <div className="bg-amber-900/20 p-4 rounded-xl border border-amber-900/50 text-center">
                                    <div className="text-2xl font-bold text-amber-500">{result.skipped}</div>
                                    <div className="text-xs text-amber-500/70 uppercase">Skipped</div>
                                </div>
                            </div>

                            {result.skippedDetails && result.skippedDetails.length > 0 && (
                                <div className="border border-slate-800 rounded-lg overflow-hidden">
                                    <div className="bg-slate-900 px-4 py-2 text-xs font-bold uppercase text-slate-400 border-b border-slate-800">
                                        Skipped / Failed Rows
                                    </div>
                                    <ScrollArea className="h-48">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-900/50 hover:bg-slate-900/50">
                                                    <TableHead className="h-8 text-xs">Identity</TableHead>
                                                    <TableHead className="h-8 text-xs">Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result.skippedDetails.map((item: any, idx: number) => (
                                                    <TableRow key={idx} className="hover:bg-slate-900/30 border-slate-800">
                                                        <TableCell className="py-2 text-xs font-mono text-slate-300">
                                                            {typeof item.email === 'string' ? item.email : JSON.stringify(item.row)}
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <Badge variant="outline" className="text-amber-500 border-amber-900/50 bg-amber-900/10 text-[10px]">
                                                                {item.reason}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    {result ? (
                        <Button onClick={handleClose} className="w-full">Close</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button onClick={handleUpload} disabled={!file || isUploading} className="bg-primary text-primary-foreground">
                                {isUploading ? 'Uploading & Processing...' : 'Upload Students'}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
