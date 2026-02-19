import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Search, Grid, List, FileText, Download, Trash2, File, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/export";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Documents() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("newest");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${user.id}/${Date.now()}-${sanitizedName}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("documents").insert([{ file_name: file.name, file_path: fileName, file_type: file.type, file_size: file.size, user_id: user.id }]);
      if (dbError) throw dbError;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documents"] }); toast({ title: "Success", description: "Document uploaded successfully" }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      const { error: storageError } = await supabase.storage.from('documents').remove([doc.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("documents").delete().eq("id", doc.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documents"] }); toast({ title: "Success", description: "Document deleted successfully" }); setDeleteId(null); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) Array.from(files).forEach(file => uploadMutation.mutate(file));
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from('documents').download(doc.file_path);
    if (error) { toast({ title: "Error", description: "Failed to download file", variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = doc.file_name; a.click(); URL.revokeObjectURL(url);
  };

  let filteredDocuments = documents.filter(doc => doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()));
  if (sortBy === "oldest") filteredDocuments = [...filteredDocuments].reverse();
  if (sortBy === "name") filteredDocuments = [...filteredDocuments].sort((a, b) => a.file_name.localeCompare(b.file_name));
  if (sortBy === "size") filteredDocuments = [...filteredDocuments].sort((a, b) => (b.file_size || 0) - (a.file_size || 0));

  const getFileTypeBadge = (fileType: string) => {
    if (fileType?.includes('pdf')) return <Badge className="bg-red-500/10 text-red-600 border-red-200 text-[10px] px-1.5">PDF</Badge>;
    if (fileType?.includes('image')) return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5">IMG</Badge>;
    if (fileType?.includes('sheet') || fileType?.includes('excel')) return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px] px-1.5">XLS</Badge>;
    if (fileType?.includes('word') || fileType?.includes('document')) return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5">DOC</Badge>;
    return <Badge variant="secondary" className="text-[10px] px-1.5">FILE</Badge>;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('pdf')) return <FileText className="h-10 w-10 text-red-500" />;
    return <File className="h-10 w-10 text-primary" />;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">Store and organize your financial documents</p>
          </div>
          <label htmlFor="file-upload">
            <Button asChild><span><Upload className="w-4 h-4 mr-2" />Upload Document</span></Button>
          </label>
          <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2 items-center">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] h-9">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="size">Size</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setViewMode('grid')}><Grid className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="h-36 w-full rounded-none" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card><CardContent className="pt-6">
            <EmptyState icon={FileText} title="No Documents Yet" description="Upload your first document to get started. Supported formats: PDF, images, Excel, Word, and more." actionLabel="Upload Document" onAction={() => document.getElementById('file-upload')?.click()} />
          </CardContent></Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="hover:shadow-lg transition-all group overflow-hidden">
                <CardContent className="p-0">
                  {/* Thumbnail area */}
                  <div className="h-36 bg-secondary/50 flex items-center justify-center relative">
                    {getFileIcon(doc.file_type || '')}
                    <div className="absolute top-2 right-2">{getFileTypeBadge(doc.file_type || '')}</div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleDownload(doc)}><Download className="h-3 w-3 mr-1" />Download</Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeleteId(doc.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="font-medium truncate text-sm">{doc.file_name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{formatDate(doc.created_at || '')}</p>
                      <p className="text-xs text-muted-foreground">{((doc.file_size || 0) / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="p-0">
            <div className="divide-y">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">{getFileIcon(doc.file_type || '')}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{doc.file_name}</p>
                        {getFileTypeBadge(doc.file_type || '')}
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(doc.created_at || '')} • {((doc.file_size || 0) / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(doc)}><Download className="h-4 w-4 mr-2" />Download</Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}

        <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} onConfirm={() => { const doc = documents.find(d => d.id === deleteId); if (doc) deleteMutation.mutate(doc); }} title="Delete Document?" description="This will permanently delete this document. This action cannot be undone." />
      </div>
    </Layout>
  );
}
