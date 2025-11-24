'use client';

import { Edit, FileText, Loader2,Plus, Target, Trash2, Upload } from "lucide-react";
import { useEffect, useRef,useState } from 'react';
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Strategy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parameters?: {
    fileName?: string;
    fileType?: string;
    fileContent?: string;
  };
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    file: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [useOcr, setUseOcr] = useState(false);
  const [useLLM, setUseLLM] = useState(true);
  const [useAsync, setUseAsync] = useState(false);
  const [viewDialog, setViewDialog] = useState<{ open: boolean; title: string; content: string }>(
    { open: false, title: '', content: '' }
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/strategies');
      const data = await response.json();
      if (data.success) {
        setStrategies(data.strategies);
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
      toast.error('Failed to fetch strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }
      // If user edited or provided content, send it along
      if (fileContent && fileContent.trim().length > 0) {
        formDataToSend.append('fileContent', fileContent);
      }
      // Include ingestion flags (Phase 2)
      formDataToSend.append('useOcr', String(useOcr));
      formDataToSend.append('useLLM', String(useLLM));
      // For updates, include the id to match /api/strategies PUT handler
      if (editingStrategy) {
        formDataToSend.append('id', editingStrategy.id);
      }

      // Decide endpoint: use new ingest route when creating and either non-.md file or AI interpretation requested
      let url = '/api/strategies/upload';
      let method: 'POST' | 'PUT' = 'POST';
      if (editingStrategy) {
        url = '/api/strategies';
        method = 'PUT';
      } else {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const isMd = ext === 'md';
        if (!isMd || useLLM) {
          // If background processing requested and a file is present, try async first
          if (useAsync && formData.file) {
            try {
              const enqueueResp = await fetch('/api/strategies/ingest/async', { method: 'POST', body: formDataToSend });
              const enqueueData = await enqueueResp.json();
              if (enqueueResp.ok && enqueueData.success && enqueueData.jobId) {
                toast.message('Ingestion started in background');
                // Poll for completion
                const startedAt = Date.now();
                const timeoutMs = 2 * 60 * 1000; // 2 minutes
                const poll = async () => {
                  const statusResp = await fetch(`/api/strategies/ingest/status?jobId=${encodeURIComponent(enqueueData.jobId)}`);
                  const status = await statusResp.json();
                  if (!statusResp.ok || !status.success) {
                    throw new Error(status.error || 'Status check failed');
                  }
                  if (status.state === 'completed' && status.result) {
                    toast.success('Strategy ingested');
                    setIsCreateDialogOpen(false);
                    setEditingStrategy(null);
                    setFormData({ name: '', description: '', file: null });
                    setFileContent('');
                    setFileName('');
                    await fetchStrategies();
                    return true;
                  }
                  if (status.state === 'failed') {
                    throw new Error(status.failedReason || 'Ingestion failed');
                  }
                  if (Date.now() - startedAt > timeoutMs) {
                    throw new Error('Timed out waiting for ingestion');
                  }
                  await new Promise(r => setTimeout(r, 2000));
                  return await poll();
                };
                await poll();
                return; // done
              } else {
                // Fallback to sync if async unavailable
                toast.message('Async ingestion unavailable, falling back to synchronous');
              }
            } catch (err: any) {
              toast.message('Async ingestion failed, falling back to synchronous');
            }
          }
          url = '/api/strategies/ingest';
          method = 'POST';
        }
      }

      const response = await fetch(url, {
        method,
        body: formDataToSend,
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingStrategy ? 'Strategy updated successfully' : 'Strategy created successfully');
        setIsCreateDialogOpen(false);
        setEditingStrategy(null);
        setFormData({ name: '', description: '', file: null });
        setFileContent('');
        setFileName('');
        fetchStrategies();
      } else {
        toast.error(data.error || 'Failed to save strategy');
      }
    } catch (error) {
      console.error('Error saving strategy:', error);
      toast.error('Failed to save strategy');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch('/api/strategies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Strategy deleted successfully');
        fetchStrategies();
      } else {
        toast.error(data.error || 'Failed to delete strategy');
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      toast.error('Failed to delete strategy');
    }
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setFormData({
      name: strategy.name,
      description: strategy.description,
      file: null,
    });
    setFileContent(strategy.parameters?.fileContent ?? '');
    setFileName(strategy.parameters?.fileName ?? '');
    setIsCreateDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      const allowed = ['.md', '.txt', '.pdf', '.docx'];
      if (!allowed.includes(ext) && !file.type.startsWith('image/')) {
        toast.error('Unsupported file. Allowed: .md, .txt, .pdf, .docx, or image');
        e.target.value = '';
        return;
      }
      setFormData(prev => ({ ...prev, file }));
      setFileName(file.name);
      // Preview only for text-like files (.md/.txt)
      if (ext === '.md' || ext === '.txt') {
        const reader = new FileReader();
        reader.onload = () => {
          setFileContent((reader.result as string) || '');
        };
        reader.readAsText(file);
      } else {
        setFileContent('');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', file: null });
    setEditingStrategy(null);
    setFileContent('');
    setFileName('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>My Strategies</span>
        </CardTitle>
        <CardDescription>
          Manage your trading strategies or create new ones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">
            {strategies.length} {strategies.length === 1 ? 'Strategy' : 'Strategies'}
          </h3>
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Strategy</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingStrategy ? 'Edit Strategy' : 'Create New Strategy'}
                </DialogTitle>
                <DialogDescription>
                  {editingStrategy 
                    ? 'Update your trading strategy details and file.'
                    : 'Add a new trading strategy with optional file upload.'
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div>
                    <Label htmlFor="strategy-name">Strategy Name</Label>
                    <Input
                      id="strategy-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter strategy name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your trading strategy"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="file">Strategy File (Optional)</Label>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <Input
                        id="file"
                        type="file"
                        accept=".md,.txt,.pdf,.docx,image/*"
                        onChange={handleFileChange}
                        className="cursor-pointer hidden"
                        ref={fileInputRef}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> {fileName ? 'Change File' : 'Choose File'}
                      </Button>
                      {fileName && (
                        <>
                          <Badge variant="outline">{fileName}</Badge>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setFormData(prev => ({ ...prev, file: null })); setFileName(''); setFileContent(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                            Remove file
                          </Button>
                        </>
                      )}
                      <p className="text-xs text-muted-foreground basis-full">
                        Upload .md, .txt, .pdf, .docx, or an image. Text files are previewable. PDFs/DOCX are converted to text during ingestion. Images may require OCR in later phases.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <Label>Use AI to interpret strategy</Label>
                        <p className="text-xs text-muted-foreground">Extract rules/spec from unstructured text during ingestion.</p>
                      </div>
                      <Switch checked={useLLM} onCheckedChange={setUseLLM} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <Label>Use OCR for images</Label>
                        <p className="text-xs text-muted-foreground">For scanned PDFs/images (enabled in later phase).</p>
                      </div>
                      <Switch checked={useOcr} onCheckedChange={setUseOcr} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <Label>Process in background</Label>
                        <p className="text-xs text-muted-foreground">Queue ingestion as a background job (recommended for large PDFs/images). Falls back to sync if unavailable.</p>
                      </div>
                      <Switch checked={useAsync} onCheckedChange={setUseAsync} />
                    </div>
                  </div>
                  {(fileContent || editingStrategy?.parameters?.fileContent) && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label>File Content {fileName ? `(${fileName})` : ''}</Label>
                        {fileName && (
                          <Badge variant="outline" className="ml-2">{fileName}</Badge>
                        )}
                      </div>
                      <Textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        placeholder="File content preview (editable)"
                        className="min-h-[50vh] resize-y font-mono text-sm"
                        rows={18}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingStrategy ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingStrategy ? 'Update Strategy' : 'Create Strategy'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {strategies.length === 0 ? (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No strategies yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first trading strategy to get started.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Strategy
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold">{strategy.name}</h4>
                        <Badge variant={strategy.isActive ? "default" : "secondary"}>
                          {strategy.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {strategy.parameters?.fileName && (
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <FileText className="h-3 w-3" />
                            <span>{strategy.parameters.fileName}</span>
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mb-3">{strategy.description}</p>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(strategy.createdAt).toLocaleDateString()}
                        {strategy.updatedAt !== strategy.createdAt && (
                          <span className="ml-4">
                            Updated: {new Date(strategy.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {strategy.parameters?.fileContent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewDialog({ open: true, title: strategy.parameters?.fileName || 'File', content: strategy.parameters?.fileContent || '' })}
                        >
                          <FileText className="h-4 w-4 mr-1" /> View
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(strategy)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Strategy</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{strategy.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(strategy.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog(v => ({ ...v, open }))}>
          <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewDialog.title || 'File'}</DialogTitle>
              <DialogDescription>Preview of the uploaded file.</DialogDescription>
            </DialogHeader>
            <Textarea value={viewDialog.content} readOnly rows={32} className="min-h-[70vh] font-mono text-sm" />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
