import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QB_OAUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, ...params } = await req.json();
    console.log(`QuickBooks integration action: ${action}`);

    switch (action) {
      case 'get_auth_url': {
        const { client_id, redirect_uri } = params;
        
        // Validate required fields
        if (!client_id || !client_id.trim()) {
          throw new Error('Client ID is required. Get it from Intuit Developer Portal');
        }
        if (!redirect_uri || !redirect_uri.trim()) {
          throw new Error('Redirect URI is required');
        }
        
        const scope = 'com.intuit.quickbooks.accounting';
        const state = crypto.randomUUID();
        
        const authUrl = `${QB_OAUTH_URL}?` +
          `client_id=${client_id.trim()}&` +
          `redirect_uri=${encodeURIComponent(redirect_uri.trim())}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent(scope)}&` +
          `state=${state}`;
        
        console.log('Generated QuickBooks auth URL');
        
        return new Response(JSON.stringify({ auth_url: authUrl, state }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'exchange_token': {
        const { code, client_id, client_secret, redirect_uri, realm_id } = params;
        
        // Validate required fields
        if (!code) throw new Error('Authorization code is missing');
        if (!client_id || !client_id.trim()) throw new Error('Client ID is required');
        if (!client_secret || !client_secret.trim()) throw new Error('Client Secret is required');
        if (!redirect_uri) throw new Error('Redirect URI is required');
        
        console.log('Exchanging authorization code for tokens');
        
        const credentials = btoa(`${client_id.trim()}:${client_secret.trim()}`);
        
        const tokenResponse = await fetch(QB_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri,
          }),
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
          console.error('QuickBooks token error:', tokenData.error);
          throw new Error(tokenData.error_description || tokenData.error);
        }

        // Store connection in database
        const { error: insertError } = await supabaseClient
          .from('connections')
          .upsert({
            user_id: user.id,
            connection_name: 'QuickBooks',
            connection_type: 'quickbooks',
            api_key: tokenData.access_token,
            config: {
              refresh_token: tokenData.refresh_token,
              realm_id,
              expires_in: tokenData.expires_in,
              token_type: tokenData.token_type,
            },
            status: 'active',
            last_sync: new Date().toISOString(),
          }, { onConflict: 'user_id,connection_type' });

        if (insertError) {
          console.error('Error storing connection:', insertError);
          throw new Error('Connected to QuickBooks but failed to save connection details');
        }

        console.log('Successfully connected to QuickBooks');

        return new Response(JSON.stringify({ success: true, realm_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'refresh_token': {
        const { refresh_token, client_id, client_secret } = params;
        
        if (!refresh_token) throw new Error('Refresh token is required');
        if (!client_id) throw new Error('Client ID is required');
        if (!client_secret) throw new Error('Client Secret is required');
        
        const credentials = btoa(`${client_id}:${client_secret}`);
        
        const refreshResponse = await fetch(QB_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token,
          }),
        });

        const refreshData = await refreshResponse.json();
        
        if (refreshData.error) {
          throw new Error(refreshData.error_description || refreshData.error);
        }
        
        return new Response(JSON.stringify(refreshData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'fetch_data': {
        const { access_token, realm_id, entity_type } = params;
        
        if (!access_token) throw new Error('Access token is missing');
        if (!realm_id) throw new Error('Realm ID (Company ID) is missing');
        if (!entity_type) throw new Error('Entity type is required');
        
        const endpoints: Record<string, string> = {
          customers: '/query?query=select * from Customer',
          vendors: '/query?query=select * from Vendor',
          invoices: '/query?query=select * from Invoice',
          bills: '/query?query=select * from Bill',
        };

        const endpoint = endpoints[entity_type];
        if (!endpoint) {
          throw new Error(`Unsupported entity type: ${entity_type}. Supported types: customers, vendors, invoices, bills`);
        }

        console.log(`Fetching ${entity_type} from QuickBooks`);

        const response = await fetch(
          `${QB_API_BASE}/${realm_id}${endpoint}`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Accept': 'application/json',
            },
          }
        );

        const data = await response.json();
        
        if (data.Fault) {
          const errorMsg = data.Fault.Error?.[0]?.Message || 'QuickBooks API error';
          throw new Error(errorMsg);
        }
        
        const entityMap: Record<string, string> = {
          customers: 'Customer',
          vendors: 'Vendor',
          invoices: 'Invoice',
          bills: 'Bill',
        };

        const records = data.QueryResponse?.[entityMap[entity_type]] || [];

        // Log sync operation
        await supabaseClient.from('sync_logs').insert({
          user_id: user.id,
          sync_type: 'import',
          entity_type,
          records_processed: records.length,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ data: records }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'push_data': {
        const { access_token, realm_id, entity_type, data } = params;
        
        if (!access_token) throw new Error('Access token is missing');
        if (!realm_id) throw new Error('Realm ID (Company ID) is missing');
        if (!entity_type) throw new Error('Entity type is required');
        if (!data || !Array.isArray(data)) throw new Error('Data array is required');
        
        const entityMap: Record<string, string> = {
          customers: 'customer',
          vendors: 'vendor',
          invoices: 'invoice',
          bills: 'bill',
        };

        const entityName = entityMap[entity_type];
        if (!entityName) {
          throw new Error(`Unsupported entity type: ${entity_type}. Supported types: customers, vendors, invoices, bills`);
        }

        console.log(`Pushing ${data.length} ${entity_type} to QuickBooks`);

        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const item of data) {
          try {
            const response = await fetch(
              `${QB_API_BASE}/${realm_id}/${entityName}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${access_token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify(item),
              }
            );

            const result = await response.json();
            
            if (result.Fault) {
              failCount++;
              results.push({ error: result.Fault.Error?.[0]?.Message || 'Unknown error' });
            } else {
              successCount++;
              results.push(result);
            }
          } catch (error) {
            failCount++;
            results.push({ error: (error as Error).message });
          }
        }

        // Log sync operation
        await supabaseClient.from('sync_logs').insert({
          user_id: user.id,
          sync_type: 'export',
          entity_type,
          records_processed: successCount,
          records_failed: failCount,
          status: failCount === 0 ? 'completed' : 'completed_with_errors',
          completed_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ results, successCount, failCount }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        await supabaseClient
          .from('connections')
          .delete()
          .eq('user_id', user.id)
          .eq('connection_type', 'quickbooks');

        console.log('Disconnected from QuickBooks');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}. Supported actions: get_auth_url, exchange_token, refresh_token, fetch_data, push_data, disconnect`);
    }
  } catch (error) {
    console.error('QuickBooks integration error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
