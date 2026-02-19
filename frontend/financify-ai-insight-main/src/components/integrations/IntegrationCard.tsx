import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, Unlink, RefreshCw, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  type: 'zoho' | 'odoo' | 'quickbooks';
  connection?: {
    id: string;
    status: string;
    last_sync?: string;
    config?: any;
  } | null;
  onConnect: (credentials: any) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSync: (entityType: string, direction: 'import' | 'export') => Promise<void>;
}

interface CredentialField {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}

export function IntegrationCard({
  name,
  description,
  icon,
  type,
  connection,
  onConnect,
  onDisconnect,
  onSync,
}: IntegrationCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncingEntity, setSyncingEntity] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isConnected = connection?.status === 'active';

  const getCredentialFields = (): CredentialField[] => {
    switch (type) {
      case 'zoho':
        return [
          { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Your Zoho Client ID', helpText: 'From Zoho API Console', required: true },
          { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••••••••••', helpText: 'From Zoho API Console', required: true },
          { key: 'organization_id', label: 'Organization ID', type: 'text', placeholder: 'Your Zoho Organization ID', helpText: 'Found in Zoho Books Settings', required: true },
        ];
      case 'odoo':
        return [
          { key: 'server_url', label: 'Server URL', type: 'text', placeholder: 'https://mycompany.odoo.com', helpText: 'Just your Odoo domain - do NOT include /odoo or /web at the end', required: true },
          { key: 'database', label: 'Database Name', type: 'text', placeholder: 'mycompany', helpText: 'Usually your company/account name (check Odoo login page)', required: true },
          { key: 'username', label: 'Username/Email', type: 'text', placeholder: 'admin@company.com', helpText: 'Your Odoo login email address', required: true },
          { key: 'password', label: 'Login Password', type: 'password', placeholder: '••••••••••••••••', helpText: 'Your Odoo login password (required for Odoo Online session auth)', required: true },
          { key: 'api_key', label: 'API Key (Optional)', type: 'password', placeholder: '••••••••••••••••', helpText: 'From Account Security → API Keys. Optional fallback for Custom plans.', required: false },
        ];
      case 'quickbooks':
        return [
          { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Your QuickBooks Client ID', helpText: 'From Intuit Developer Portal', required: true },
          { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••••••••••', helpText: 'From Intuit Developer Portal', required: true },
        ];
      default:
        return [];
    }
  };

  const getSetupInstructions = () => {
    switch (type) {
      case 'zoho':
        return (
          <div className="space-y-3 text-sm">
            <p className="font-medium">How to get your Zoho Books credentials:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to <a href="https://api-console.zoho.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Zoho API Console</a></li>
              <li>Click "Add Client" and select "Server-based Applications"</li>
              <li>Fill in your app details and set the redirect URI</li>
              <li>Add scope: <code className="bg-muted px-1 rounded">ZohoBooks.fullaccess.all</code></li>
              <li>Copy the Client ID and Client Secret</li>
              <li>For Organization ID: Go to Zoho Books → Settings → Organization Profile</li>
            </ol>
          </div>
        );
      case 'odoo':
        return (
          <div className="space-y-3 text-sm">
            <p className="font-medium">How to get your Odoo credentials:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li><strong>Server URL:</strong> Your Odoo domain only (e.g., <code className="bg-muted px-1 rounded">https://mycompany.odoo.com</code>)
                <br/><span className="text-xs text-destructive">⚠️ Do NOT include /odoo, /web, or /login at the end</span>
              </li>
              <li><strong>Database:</strong> Usually your company/account name. Check your Odoo login page or URL.</li>
              <li><strong>Username:</strong> Your Odoo login email address</li>
              <li><strong>API Key:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Log into Odoo and click your profile icon (top right)</li>
                  <li>Go to "My Profile" or "Preferences"</li>
                  <li>Click "Account Security" tab</li>
                  <li>Under "API Keys", click "New API Key"</li>
                  <li>Enter a description and click "Generate Key"</li>
                  <li>Copy the key immediately (shown only once!)</li>
                </ul>
              </li>
            </ol>
            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
              <strong className="text-amber-600 dark:text-amber-400">💡 Tip:</strong> Your <strong>Login Password</strong> is required for session-based auth (works on all Odoo plans).
              The API Key is optional and only needed as a fallback for Custom plans with external API access enabled.
            </div>
          </div>
        );
      case 'quickbooks':
        return (
          <div className="space-y-3 text-sm">
            <p className="font-medium">How to get your QuickBooks credentials:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to <a href="https://developer.intuit.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Intuit Developer Portal</a></li>
              <li>Sign in and click "Dashboard"</li>
              <li>Click "Create an app" and select "QuickBooks Online and Payments"</li>
              <li>Choose your app settings and create the app</li>
              <li>Go to "Keys & credentials" in your app dashboard</li>
              <li>Copy the Client ID and Client Secret (use Production keys for live data)</li>
            </ol>
          </div>
        );
      default:
        return null;
    }
  };

  const validateForm = (): boolean => {
    const fields = getCredentialFields();
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      if (field.required && !credentials[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    // Special validation for Odoo server URL
    if (type === 'odoo' && credentials.server_url) {
      const url = credentials.server_url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        newErrors.server_url = 'Server URL must start with http:// or https://';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = (): boolean => {
    const fields = getCredentialFields();
    return fields.every(field => !field.required || credentials[field.key]?.trim());
  };

  const handleConnect = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields correctly');
      return;
    }

    setIsConnecting(true);
    try {
      await onConnect(credentials);
      setShowConnectDialog(false);
      setCredentials({});
      setErrors({});
      toast.success(`Connected to ${name} successfully!`);
    } catch (error) {
      toast.error(`Failed to connect: ${(error as Error).message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsConnecting(true);
    try {
      await onDisconnect();
      toast.success(`Disconnected from ${name}`);
    } catch (error) {
      toast.error(`Failed to disconnect: ${(error as Error).message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async (entityType: string, direction: 'import' | 'export') => {
    const syncKey = `${entityType}_${direction}`;
    setSyncingEntity(syncKey);
    try {
      await onSync(entityType, direction);
      toast.success(`${direction === 'import' ? 'Imported' : 'Exported'} ${entityType} successfully!`);
    } catch (error) {
      toast.error(`Sync failed: ${(error as Error).message}`);
    } finally {
      setSyncingEntity(null);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    const newCredentials = { ...credentials, [key]: value };
    
    // Auto-suggest database name from server URL for Odoo
    if (type === 'odoo' && key === 'server_url' && !credentials.database) {
      const match = value.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
      if (match) {
        newCredentials.database = match[1];
      }
    }
    
    setCredentials(newCredentials);
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors({ ...errors, [key]: '' });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="whitespace-nowrap shrink-0">
            {isConnected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && connection?.last_sync && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(connection.last_sync).toLocaleString()}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isConnected ? (
            <Dialog open={showConnectDialog} onOpenChange={(open) => {
              setShowConnectDialog(open);
              if (!open) {
                setErrors({});
                setShowInstructions(false);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Link2 className="w-4 h-4" />
                  Connect
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Connect to {name}</DialogTitle>
                  <DialogDescription>
                    Enter your {name} credentials to establish the connection.
                  </DialogDescription>
                </DialogHeader>
                
                <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 w-full justify-start text-muted-foreground hover:text-foreground">
                      <HelpCircle className="w-4 h-4" />
                      {showInstructions ? 'Hide setup instructions' : 'Need help finding your credentials?'}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 p-4 bg-muted/50 rounded-lg">
                    {getSetupInstructions()}
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-4 py-4">
                  {getCredentialFields().map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key} className="flex items-center gap-1">
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={credentials[field.key] || ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={errors[field.key] ? 'border-destructive' : ''}
                      />
                      {field.helpText && !errors[field.key] && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                      {errors[field.key] && (
                        <p className="text-xs text-destructive">{errors[field.key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConnect} disabled={isConnecting || !isFormValid()}>
                    {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Connect
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <>
              <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Sync Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sync Data with {name}</DialogTitle>
                    <DialogDescription>
                      Choose what data to sync and the direction.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      {['customers', 'vendors', 'invoices', 'bills', 'payments', 'journal_entries', 'products', 'accounts'].map((entityType) => (
                        <div key={entityType} className="space-y-2">
                          <p className="text-sm font-medium capitalize">{entityType.replace('_', ' ')}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSync(entityType, 'import')}
                              disabled={syncingEntity !== null}
                            >
                              {syncingEntity === `${entityType}_import` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Import'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSync(entityType, 'export')}
                              disabled={syncingEntity !== null}
                            >
                              {syncingEntity === `${entityType}_export` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Export'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="outline" className="gap-2" onClick={handleDisconnect} disabled={isConnecting}>
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Disconnect
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
