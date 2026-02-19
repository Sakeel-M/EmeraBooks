import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Integration icons
const ZohoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const OdooIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h2v6H7v-6zm4 0h2v6h-2v-6zm4 0h2v6h-2v-6z"/>
  </svg>
);

const QuickBooksIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
);

interface Connection {
  id: string;
  connection_type: string;
  status: string;
  last_sync?: string | null;
  config?: any;
  api_key?: string | null;
}

export default function Integrations() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('connections')
        .select('*')
        .in('connection_type', ['zoho', 'odoo', 'quickbooks']);

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConnection = (type: string) => {
    return connections.find(c => c.connection_type === type) || null;
  };

  const handleZohoConnect = async (credentials: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in first');
      return;
    }

    // For Zoho, we need to redirect to OAuth
    const redirectUri = `${window.location.origin}/integrations/callback/zoho`;
    
    const response = await supabase.functions.invoke('zoho-integration', {
      body: {
        action: 'get_auth_url',
        client_id: credentials.client_id,
        redirect_uri: redirectUri,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Store credentials temporarily for callback
    localStorage.setItem('zoho_pending_credentials', JSON.stringify({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      organization_id: credentials.organization_id,
      redirect_uri: redirectUri,
    }));

    // Redirect to Zoho OAuth
    window.location.href = response.data.auth_url;
  };

  const handleOdooConnect = async (credentials: any) => {
    const response = await supabase.functions.invoke('odoo-integration', {
      body: {
        action: 'connect',
        ...credentials,
      },
    });

    if (response.error || response.data.error) {
      throw new Error(response.error?.message || response.data.error);
    }

    await fetchConnections();
  };

  const handleQuickBooksConnect = async (credentials: any) => {
    const redirectUri = `${window.location.origin}/integrations/callback/quickbooks`;
    
    const response = await supabase.functions.invoke('quickbooks-integration', {
      body: {
        action: 'get_auth_url',
        client_id: credentials.client_id,
        redirect_uri: redirectUri,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Store credentials temporarily for callback
    localStorage.setItem('quickbooks_pending_credentials', JSON.stringify({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: redirectUri,
    }));

    // Redirect to QuickBooks OAuth
    window.location.href = response.data.auth_url;
  };

  const handleDisconnect = async (type: string) => {
    const functionName = `${type}-integration`;
    
    const response = await supabase.functions.invoke(functionName, {
      body: { action: 'disconnect' },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    await fetchConnections();
  };

  const handleSync = async (type: string, entityType: string, direction: 'import' | 'export') => {
    const connection = getConnection(type);
    if (!connection) {
      throw new Error('No connection found');
    }

    const functionName = `${type}-integration`;
    const action = direction === 'import' ? 'fetch_data' : 'push_data';

    // Get data to export if needed
    let exportData = [];
    if (direction === 'export') {
      const { data, error } = await supabase
        .from(entityType as 'customers' | 'vendors' | 'invoices' | 'bills')
        .select('*')
        .limit(100);
      
      if (error) throw error;
      exportData = data || [];
    }

    const body: any = {
      action,
      entity_type: entityType,
      access_token: connection.config?.access_token || connection.api_key,
      connection_id: connection.id,
    };

    if (type === 'zoho') {
      body.organization_id = connection.config?.organization_id;
    } else if (type === 'odoo') {
      body.server_url = connection.config?.server_url;
      body.database = connection.config?.database;
      body.uid = connection.config?.uid;
      body.api_key = connection.api_key;
      body.password = connection.config?.password;
      body.auth_method = connection.config?.auth_method;
    } else if (type === 'quickbooks') {
      body.realm_id = connection.config?.realm_id;
    }

    if (direction === 'export') {
      body.data = exportData;
    }

    const response = await supabase.functions.invoke(functionName, { body });

    if (response.error || response.data.error) {
      throw new Error(response.error?.message || response.data.error);
    }

    // Update last_sync timestamp
    await supabase
      .from('connections')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', connection.id);

    await fetchConnections();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your accounting software to sync data automatically.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <IntegrationCard
            name="Zoho Books"
            description="Sync invoices, bills, customers and vendors with Zoho Books."
            icon={<ZohoIcon />}
            type="zoho"
            connection={getConnection('zoho')}
            onConnect={handleZohoConnect}
            onDisconnect={() => handleDisconnect('zoho')}
            onSync={(entityType, direction) => handleSync('zoho', entityType, direction)}
          />

          <IntegrationCard
            name="Odoo"
            description="Connect to your Odoo instance for complete ERP integration."
            icon={<OdooIcon />}
            type="odoo"
            connection={getConnection('odoo')}
            onConnect={handleOdooConnect}
            onDisconnect={() => handleDisconnect('odoo')}
            onSync={(entityType, direction) => handleSync('odoo', entityType, direction)}
          />

          <IntegrationCard
            name="QuickBooks"
            description="Integrate with QuickBooks Online for seamless accounting."
            icon={<QuickBooksIcon />}
            type="quickbooks"
            connection={getConnection('quickbooks')}
            onConnect={handleQuickBooksConnect}
            onDisconnect={() => handleDisconnect('quickbooks')}
            onSync={(entityType, direction) => handleSync('quickbooks', entityType, direction)}
          />
        </div>
      </div>
    </Layout>
  );
}
