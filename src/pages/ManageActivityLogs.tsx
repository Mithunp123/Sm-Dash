
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
        if (action.includes('LOGIN_SUCCESS')) return "success";
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
        <div className="container mx-auto py-8 px-4 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <ClipboardCheck className="w-8 h-8 text-primary" />
                        System Activity Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor all user actions and system events across the platform.
                    </p>
                </div>
                <Button
                    onClick={fetchLogs}
                    disabled={loading}
                    variant="outline"
                    className="shrink-0 gap-2 border-primary/20 hover:border-primary/50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="bg-primary/5 border-primary/10 shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Activity className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Logs</p>
                                <p className="text-2xl font-bold">{logs.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-green-500/5 border-green-500/10 shadow-sm text-green-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium opacity-80">Active Users</p>
                                <p className="text-2xl font-bold">{new Set(logs.map(l => l.user_id)).size}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by user, action or details..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="w-full sm:w-48">
                                <Select value={actionFilter} onValueChange={setActionFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by Action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Actions</SelectItem>
                                        {getUniqueActions().map(action => (
                                            <SelectItem key={action} value={action}>{action}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/50 shadow-md">
                <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Activity Timeline</CardTitle>
                            <CardDescription>Most recent actions appearing first</CardDescription>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs">
                            Showing {filteredLogs.length} entries
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-b-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                    <TableHead className="w-[200px]">User</TableHead>
                                    <TableHead className="w-[180px]">Action</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="w-[150px]">Source IP</TableHead>
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
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground italic">
                                            <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            No matching activity logs found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-muted/20 transition-colors group">
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                                        {log.user_name?.slice(0, 2).toUpperCase() || "SY"}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold truncate">
                                                            {log.user_name || "System"}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">
                                                            {log.user_role || "INTERNAL"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={getActionBadgeVariant(log.action) as any}
                                                    className="text-[10px] px-2 py-0 border-transparent shadow-none"
                                                >
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-md">
                                                <div className="text-xs font-mono bg-muted/30 p-1.5 rounded border border-border/30 group-hover:bg-muted/50 transition-colors break-all line-clamp-2">
                                                    {log.details}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <Globe className="w-3 h-3 text-muted-foreground" />
                                                        {log.ip_address || "127.0.0.1"}
                                                    </div>
                                                    {log.user_agent && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate max-w-[120px]" title={log.user_agent}>
                                                            <Smartphone className="w-2.5 h-2.5 shrink-0" />
                                                            {log.user_agent.includes('Windows') ? 'Windows' :
                                                                log.user_agent.includes('Android') ? 'Android' :
                                                                    log.user_agent.includes('iPhone') ? 'iPhone' : 'Browser'}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ManageActivityLogs;
