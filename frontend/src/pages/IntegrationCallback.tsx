import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function IntegrationCallback() {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, [provider, searchParams]);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const realmId = searchParams.get('realmId'); // QuickBooks specific
      const errorParam = searchParams.get('error');

      if (errorParam) {
        throw new Error(searchParams.get('error_description') || errorParam);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      if (provider === 'zoho') {
        const storedCredentials = localStorage.getItem('zoho_pending_credentials');
        if (!storedCredentials) {
          throw new Error('No pending credentials found');
        }

        const credentials = JSON.parse(storedCredentials);
        localStorage.removeItem('zoho_pending_credentials');

        const response = await supabase.functions.invoke('zoho-integration', {
          body: {
            action: 'exchange_token',
            code,
            ...credentials,
          },
        });

        if (response.error || response.data.error) {
          throw new Error(response.error?.message || response.data.error);
        }
      } else if (provider === 'quickbooks') {
        const storedCredentials = localStorage.getItem('quickbooks_pending_credentials');
        if (!storedCredentials) {
          throw new Error('No pending credentials found');
        }

        const credentials = JSON.parse(storedCredentials);
        localStorage.removeItem('quickbooks_pending_credentials');

        const response = await supabase.functions.invoke('quickbooks-integration', {
          body: {
            action: 'exchange_token',
            code,
            realm_id: realmId,
            ...credentials,
          },
        });

        if (response.error || response.data.error) {
          throw new Error(response.error?.message || response.data.error);
        }
      }

      setStatus('success');
      toast.success(`Successfully connected to ${provider}!`);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/integrations');
      }, 1500);
    } catch (err) {
      console.error('Callback error:', err);
      setError((err as Error).message);
      setStatus('error');
      toast.error(`Connection failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Connecting to {provider}...</h2>
            <p className="text-muted-foreground">Please wait while we complete the connection.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-primary">Connected Successfully!</h2>
            <p className="text-muted-foreground">Redirecting you back...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-destructive">Connection Failed</h2>
            <p className="text-muted-foreground max-w-md">{error}</p>
            <button
              onClick={() => navigate('/integrations')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Back to Integrations
            </button>
          </>
        )}
      </div>
    </div>
  );
}
