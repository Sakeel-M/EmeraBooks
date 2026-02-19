import { Layout } from "@/components/layout/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, CheckCircle, XCircle, Clock, ArrowUpDown, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface SyncLog {
  id: string;
  connection_id: string | null;
  sync_type: string;
  entity_type: string;
  status: string | null;
  records_processed: number | null;
  records_failed: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string | null;
  connection?: {
    connection_name: string;
    connection_type: string;
  } | null;
}

interface SyncLogRecord {
  id: string;
  sync_log_id: string;
  record_id: string | null;
  external_id: string | null;
  record_name: string | null;
  record_data: any;
  status: string | null;
  error_message: string | null;
  created_at: string | null;
}

const SyncHistory = () => {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedSyncLog, setSelectedSyncLog] = useState<SyncLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncLogToDelete, setSyncLogToDelete] = useState<SyncLog | null>(null);

  const { data: syncLogs, isLoading, refetch } = useQuery({
    queryKey: ['sync-logs', filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('sync_logs')
        .select(`
          *,
          connection:connections(connection_name, connection_type)
        `)
        .order('created_at', { ascending: false });

      if (filterType !== "all") {
        query = query.eq('entity_type', filterType);
      }
      if (filterStatus !== "all") {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncLog[];
    },
  });

  const { data: syncRecords, isLoading: isLoadingRecords } = useQuery({
    queryKey: ['sync-log-records', selectedSyncLog?.id],
    queryFn: async () => {
      if (!selectedSyncLog?.id) return [];
      
      const { data, error } = await supabase
        .from('sync_log_records')
        .select('*')
        .eq('sync_log_id', selectedSyncLog.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SyncLogRecord[];
    },
    enabled: !!selectedSyncLog?.id,
  });

  const handleRowClick = (syncLog: SyncLog) => {
    setSelectedSyncLog(syncLog);
    setShowDetailDialog(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, syncLog: SyncLog) => {
    e.stopPropagation();
    setSyncLogToDelete(syncLog);
    setShowDeleteConfirm(true);
  };

  const handleDeleteSyncLog = async (syncLog: SyncLog) => {
    setDeletingId(syncLog.id);
    try {
      // First delete related sync_log_records
      const { error: recordsError } = await supabase
        .from('sync_log_records')
        .delete()
        .eq('sync_log_id', syncLog.id);

      if (recordsError) throw recordsError;

      // Then delete the sync log itself
      const { error: logError } = await supabase
        .from('sync_logs')
        .delete()
        .eq('id', syncLog.id);

      if (logError) throw logError;

      toast.success('Sync log deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      
      // Close dialogs if needed
      if (selectedSyncLog?.id === syncLog.id) {
        setShowDetailDialog(false);
        setSelectedSyncLog(null);
      }
    } catch (error) {
      console.error('Error deleting sync log:', error);
      toast.error('Failed to delete sync log');
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(false);
      setSyncLogToDelete(null);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('sync_log_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast.success('Record deleted');
      queryClient.invalidateQueries({ queryKey: ['sync-log-records', selectedSyncLog?.id] });
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Failed to delete record');
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'completed_with_errors':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Partial</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getIntegrationBadge = (type: string | null) => {
    const colors: Record<string, string> = {
      odoo: "bg-purple-500/15 text-purple-600 border-purple-500/30",
      quickbooks: "bg-blue-500/15 text-blue-600 border-blue-500/30",
      zoho: "bg-orange-500/15 text-orange-600 border-orange-500/30",
    };
    return (
      <Badge className={colors[type?.toLowerCase() || ''] || "bg-muted text-muted-foreground"}>
        {type || 'Unknown'}
      </Badge>
    );
  };

  const getRecordStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const columns: ColumnDef<SyncLog>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.original.created_at;
        return date ? format(new Date(date), "MMM dd, yyyy HH:mm") : "-";
      },
    },
    {
      accessorKey: "connection.connection_type",
      header: "Integration",
      cell: ({ row }) => getIntegrationBadge(row.original.connection?.connection_type || null),
    },
    {
      accessorKey: "sync_type",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize font-medium">{row.original.sync_type}</span>
      ),
    },
    {
      accessorKey: "entity_type",
      header: "Entity",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.entity_type}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: "records_processed",
      header: "Processed",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.records_processed ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "records_failed",
      header: "Failed",
      cell: ({ row }) => {
        const failed = row.original.records_failed ?? 0;
        return (
          <span className={`font-mono text-sm ${failed > 0 ? 'text-destructive' : ''}`}>
            {failed}
          </span>
        );
      },
    },
    {
      accessorKey: "error_message",
      header: "Error",
      cell: ({ row }) => {
        const error = row.original.error_message;
        if (!error) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-destructive text-sm max-w-[200px] truncate block" title={error}>
            {error}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(row.original);
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => handleDeleteClick(e, row.original)}
            disabled={deletingId === row.original.id}
          >
            {deletingId === row.original.id ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  const stats = {
    total: syncLogs?.length ?? 0,
    completed: syncLogs?.filter(l => l.status === 'completed' || l.status === 'completed_with_errors').length ?? 0,
    failed: syncLogs?.filter(l => l.status === 'failed').length ?? 0,
    totalRecords: syncLogs?.reduce((acc, l) => acc + (l.records_processed ?? 0), 0) ?? 0,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sync History</h1>
            <p className="text-muted-foreground">View all import and export operations</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Syncs</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-2xl text-destructive">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Records Processed</CardDescription>
              <CardTitle className="text-2xl">{stats.totalRecords.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Sync Logs</CardTitle>
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Entity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="customers">Customers</SelectItem>
                    <SelectItem value="vendors">Vendors</SelectItem>
                    <SelectItem value="invoices">Invoices</SelectItem>
                    <SelectItem value="bills">Bills</SelectItem>
                    <SelectItem value="payments">Payments</SelectItem>
                    <SelectItem value="journal_entries">Journal Entries</SelectItem>
                    <SelectItem value="products">Products</SelectItem>
                    <SelectItem value="accounts">Accounts</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={syncLogs || []}
              isLoading={isLoading}
              showColumnToggle={false}
              emptyMessage="No sync operations found"
            />
          </CardContent>
        </Card>

        {/* Sync Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Sync Details
                {selectedSyncLog && (
                  <span className="text-sm font-normal text-muted-foreground">
                    - {selectedSyncLog.sync_type} {selectedSyncLog.entity_type}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {selectedSyncLog && (
              <div className="space-y-4">
                {/* Summary Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Integration</p>
                    {getIntegrationBadge(selectedSyncLog.connection?.connection_type || null)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedSyncLog.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Processed</p>
                    <p className="font-mono font-medium">{selectedSyncLog.records_processed ?? 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className={`font-mono font-medium ${(selectedSyncLog.records_failed ?? 0) > 0 ? 'text-destructive' : ''}`}>
                      {selectedSyncLog.records_failed ?? 0}
                    </p>
                  </div>
                </div>

                {selectedSyncLog.error_message && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{selectedSyncLog.error_message}</p>
                  </div>
                )}

                {/* Records List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Synced Records</h4>
                    {syncRecords && syncRecords.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete All Records
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete all synced records?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove all {syncRecords.length} record entries from this sync log. The actual data (customers, vendors, etc.) will remain in your database.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={async () => {
                                if (!selectedSyncLog) return;
                                try {
                                  const { error } = await supabase
                                    .from('sync_log_records')
                                    .delete()
                                    .eq('sync_log_id', selectedSyncLog.id);
                                  if (error) throw error;
                                  toast.success('All records deleted');
                                  queryClient.invalidateQueries({ queryKey: ['sync-log-records', selectedSyncLog.id] });
                                } catch (error) {
                                  toast.error('Failed to delete records');
                                }
                              }}
                            >
                              Delete All
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <ScrollArea className="h-[300px] border rounded-md">
                    {isLoadingRecords ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : syncRecords && syncRecords.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>External ID</TableHead>
                            <TableHead>Local ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.record_name || '-'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {record.external_id || '-'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {record.record_id ? record.record_id.substring(0, 8) + '...' : '-'}
                              </TableCell>
                              <TableCell>
                                {getRecordStatusBadge(record.status)}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-destructive text-sm">
                                {record.error_message || '-'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteRecord(record.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                        <p className="text-sm">No individual records tracked for this sync</p>
                        <p className="text-xs mt-1">Records are tracked for syncs after this feature was enabled</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Delete entire sync log button */}
                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete This Sync Log
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this sync log?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this sync log and all its associated records. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => selectedSyncLog && handleDeleteSyncLog(selectedSyncLog)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete sync log?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this sync log ({syncLogToDelete?.entity_type} {syncLogToDelete?.sync_type}) and all its associated records. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSyncLogToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => syncLogToDelete && handleDeleteSyncLog(syncLogToDelete)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default SyncHistory;