
import { useState, useEffect } from "react";
import {
    ClipboardCheck,
    Search,
    Filter,
    RefreshCw,
    User,
    Clock,
    Activity,
    Calendar as CalendarIcon,
    Shield,
    Smartphone,
    Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { format } from "date-fns";

interface ActivityLog {
    id: number;
    user_id: number | null;
    action: string;
    details: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    user_name?: string;
    user_email?: string;
    user_role?: string;
}

const ManageActivityLogs = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [actionFilter, setActionFilter] = useState("all");

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/activity-logs/all`,
                {
                    headers: {
                        'Authorization': `Bearer ${auth.getToken()}`
                    }
                }
            );
            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
                setFilteredLogs(data.logs);
            } else {
                toast.error(data.message || "Failed to fetch logs");
            }
        } catch (error) {
            console.error("Fetch logs error:", error);
            toast.error("Error connecting to server");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        let result = logs;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(log =>
                (log.user_name?.toLowerCase().includes(term)) ||
                (log.user_email?.toLowerCase().includes(term)) ||
                (log.action.toLowerCase().includes(term)) ||
                (log.details?.toLowerCase().includes(term))
            );
        }

        if (actionFilter !== "all") {
            result = result.filter(log => log.action === actionFilter);
        }

        setFilteredLogs(result);
    }, [searchTerm, actionFilter, logs]);

    const getActionBadgeVariant = (action: string) => {
        if (action.includes('LOGIN_SUCCESS')) return "default";
        if (action.includes('LOGIN_FAILED')) return "destructive";
        if (action.includes('CREATE')) return "default";
        if (action.includes('UPDATE')) return "secondary";
        if (action.includes('DELETE')) return "destructive";
        return "outline";
    };

    const getUniqueActions = () => {
        const actions = logs.map(l => l.action);
        return Array.from(new Set(actions)).sort();
    };

    return (
        <div className="min-h-screen flex flex-col">
            <DeveloperCredit />
            <main className="flex-1 w-full bg-background overflow-x-hidden">
                <div className="w-full py-8 px-4 space-y-8">
                    <div className="mb-4">
                        <BackButton to="/admin" />
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 px-2">
                        <div className="space-y-2">
                            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white leading-tight">System Activity Logs</h1>
                            <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-4 mt-2">
                                Real-time audit trail and security monitoring
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <Button
                                onClick={fetchLogs}
                                disabled={loading}
                                className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                Refresh Logs
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
                        <Card className="bg-card/40 backdrop-blur-xl border-border/40 shadow-2xl rounded-[2.5rem] overflow-hidden group hover:border-primary/40 transition-all duration-500">
                            <CardContent className="p-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 bg-primary/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                                        <Activity className="w-7 h-7 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Total Logs</p>
                                        <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{logs.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/40 backdrop-blur-xl border-border/40 shadow-2xl rounded-[2.5rem] overflow-hidden group hover:border-green-500/40 transition-all duration-500">
                            <CardContent className="p-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 bg-green-500/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                                        <User className="w-7 h-7 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Active Users</p>
                                        <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{new Set(logs.map(l => l.user_id)).size}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2 bg-card/40 backdrop-blur-xl border-border/40 shadow-2xl rounded-[2.5rem] overflow-hidden">
                            <CardContent className="p-6 h-full flex items-center">
                                <div className="flex flex-col sm:flex-row gap-4 w-full">
                                    <div className="relative flex-1 group">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
                                        <Input
                                            placeholder="Search logs by user, action or details..."
                                            className="pl-14 h-14 bg-background/50 border-border/40 rounded-2xl text-[13px] font-bold focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50 border-2"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-full sm:w-56">
                                        <Select value={actionFilter} onValueChange={setActionFilter}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-black text-[10px] uppercase tracking-widest border-2 px-6">
                                                <div className="flex items-center gap-2">
                                                    <Filter className="w-3.5 h-3.5 text-primary" />
                                                    <SelectValue placeholder="Action" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                                <SelectItem value="all" className="font-bold text-[10px] uppercase tracking-widest">All Actions</SelectItem>
                                                {getUniqueActions().map(action => (
                                                    <SelectItem key={action} value={action} className="font-bold text-[10px] uppercase tracking-widest">{action}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        {/* Mobile Feed View */}
                        <div className="grid grid-cols-1 gap-4 md:hidden px-2">
                            {filteredLogs.length === 0 ? (
                                <div className="py-24 text-center">
                                    <div className="w-20 h-20 bg-muted/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                                        <ClipboardCheck className="w-10 h-10 text-muted-foreground/30" />
                                    </div>
                                    <p className="font-black text-muted-foreground/40 uppercase tracking-[0.2em] text-[10px]">No Activity Records Found</p>
                                </div>
                            ) : (
                                filteredLogs.map((log) => (
                                    <Card key={log.id} className="rounded-[2.5rem] border-border/40 overflow-hidden bg-card/40 backdrop-blur-xl shadow-2xl group transition-all duration-300 active:scale-[0.98]">
                                        <CardContent className="p-6">
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary text-sm font-black uppercase shadow-inner group-hover:scale-105 transition-transform">
                                                        {log.user_name?.slice(0, 2) || "SY"}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-black text-foreground uppercase tracking-tight truncate max-w-[160px] text-lg leading-none mb-2">{log.user_name || "System"}</h3>
                                                        <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded-lg w-fit">
                                                            <Clock className="w-3 h-3 text-primary" />
                                                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant={getActionBadgeVariant(log.action) as any} className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-2">
                                                    {log.action}
                                                </Badge>
                                            </div>

                                            <div className="bg-background/40 backdrop-blur-md p-5 rounded-[1.5rem] border border-border/30 mb-5 relative group-hover:bg-background/60 transition-all">
                                                <p className="text-[11px] font-bold text-foreground/80 leading-relaxed italic line-clamp-3">
                                                    {log.details || "No details available."}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/20 rounded-2xl border border-border/20">
                                                    <Globe className="w-3.5 h-3.5 text-primary" />
                                                    <p className="text-[9px] font-black text-foreground uppercase tracking-widest">{log.ip_address || "127.0.0.1"}</p>
                                                </div>
                                                <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/20 rounded-2xl border border-border/20">
                                                    <Smartphone className="w-3.5 h-3.5 text-primary" />
                                                    <p className="text-[9px] font-black text-foreground uppercase tracking-widest truncate">
                                                        {log.user_agent?.includes('Windows') ? 'DESKTOP' : 'MOBILE'}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>

                        {/* Desktop View */}
                        <Card className="hidden md:block border-border/40 shadow-xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-md">
                            <CardHeader className="bg-muted/30 border-b pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-black uppercase tracking-tight">Timeline</CardTitle>
                                        <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-70">Audit history feed</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest border-2">
                                        {filteredLogs.length} Records
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="w-full">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow className="border-border/30">
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest">Timestamp</TableHead>
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest">User</TableHead>
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest">Action</TableHead>
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest">Details</TableHead>
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest">Source</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell colSpan={5} className="py-8 text-center animate-pulse">
                                                            <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2"></div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : filteredLogs.map((log) => (
                                                <TableRow key={log.id} className="hover:bg-muted/20 transition-all border-border/30 group">
                                                    <TableCell className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black uppercase">
                                                                {log.user_name?.slice(0, 2) || "SY"}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-sm font-black uppercase tracking-tight text-foreground truncate">
                                                                    {log.user_name || "System"}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                    {log.user_role || "INTERNAL"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={getActionBadgeVariant(log.action) as any}
                                                            className="text-[9px] font-black uppercase tracking-widest px-2 py-0 border-none"
                                                        >
                                                            {log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-md">
                                                        <div className="text-[10px] font-mono bg-muted/40 p-2 rounded-xl border border-border/30 group-hover:bg-muted/60 transition-colors line-clamp-1 italic">
                                                            {log.details}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-foreground">
                                                                <Globe className="w-3 h-3 text-primary" />
                                                                {log.ip_address || "127.0.0.1"}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                {log.user_agent?.includes('Windows') ? 'Windows' : 'Mobile'}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ManageActivityLogs;
