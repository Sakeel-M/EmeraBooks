import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const ZOHO_BOOKS_API = 'https://books.zoho.com/api/v3';

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
    console.log(`Zoho integration action: ${action}`);

    switch (action) {
      case 'get_auth_url': {
        const { client_id, redirect_uri } = params;
        
        // Validate required fields
        if (!client_id || !client_id.trim()) {
          throw new Error('Client ID is required. Get it from Zoho API Console');
        }
        if (!redirect_uri || !redirect_uri.trim()) {
          throw new Error('Redirect URI is required');
        }
        
        const scope = 'ZohoBooks.fullaccess.all';
        
        const authUrl = `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?` +
          `scope=${scope}&client_id=${client_id.trim()}&response_type=code&` +
          `access_type=offline&redirect_uri=${encodeURIComponent(redirect_uri.trim())}`;
        
        console.log('Generated Zoho auth URL');
        
        return new Response(JSON.stringify({ auth_url: authUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'exchange_token': {
        const { code, client_id, client_secret, redirect_uri, organization_id } = params;
        
        // Validate required fields
        if (!code) throw new Error('Authorization code is missing');
        if (!client_id || !client_id.trim()) throw new Error('Client ID is required');
        if (!client_secret || !client_secret.trim()) throw new Error('Client Secret is required');
        if (!redirect_uri) throw new Error('Redirect URI is required');
        
        console.log('Exchanging authorization code for tokens');
        
        const tokenResponse = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: client_id.trim(),
            client_secret: client_secret.trim(),
            redirect_uri,
          }),
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
          console.error('Zoho token error:', tokenData.error);
          throw new Error(tokenData.error_description || tokenData.error);
        }

        // Store connection in database
        const { error: insertError } = await supabaseClient
          .from('connections')
          .upsert({
            user_id: user.id,
            connection_name: 'Zoho Books',
            connection_type: 'zoho',
            api_key: tokenData.access_token,
            config: {
              refresh_token: tokenData.refresh_token,
              organization_id: organization_id?.trim(),
              expires_in: tokenData.expires_in,
              token_type: tokenData.token_type,
            },
            status: 'active',
            last_sync: new Date().toISOString(),
          }, { onConflict: 'user_id,connection_type' });

        if (insertError) {
          console.error('Error storing connection:', insertError);
          throw new Error('Connected to Zoho but failed to save connection details');
        }

        console.log('Successfully connected to Zoho Books');

        return new Response(JSON.stringify({ success: true, ...tokenData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'refresh_token': {
        const { refresh_token, client_id, client_secret } = params;
        
        if (!refresh_token) throw new Error('Refresh token is required');
        if (!client_id) throw new Error('Client ID is required');
        if (!client_secret) throw new Error('Client Secret is required');
        
        const refreshResponse = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token,
            client_id,
            client_secret,
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
        const { access_token, organization_id, entity_type } = params;
        
        if (!access_token) throw new Error('Access token is missing');
        if (!organization_id) throw new Error('Organization ID is missing');
        if (!entity_type) throw new Error('Entity type is required');
        
        const endpoints: Record<string, string> = {
          customers: '/contacts',
          vendors: '/contacts?contact_type=vendor',
          invoices: '/invoices',
          bills: '/bills',
        };

        const endpoint = endpoints[entity_type];
        if (!endpoint) {
          throw new Error(`Unsupported entity type: ${entity_type}. Supported types: customers, vendors, invoices, bills`);
        }

        console.log(`Fetching ${entity_type} from Zoho Books`);

        const response = await fetch(
          `${ZOHO_BOOKS_API}${endpoint}?organization_id=${organization_id}`,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${access_token}`,
            },
          }
        );

        const data = await response.json();
        
        if (data.code !== 0 && data.message) {
          throw new Error(data.message);
        }
        
        // Log sync operation
        await supabaseClient.from('sync_logs').insert({
          user_id: user.id,
          sync_type: 'import',
          entity_type,
          records_processed: data[entity_type]?.length || 0,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'push_data': {
        const { access_token, organization_id, entity_type, data } = params;
        
        if (!access_token) throw new Error('Access token is missing');
        if (!organization_id) throw new Error('Organization ID is missing');
        if (!entity_type) throw new Error('Entity type is required');
        if (!data || !Array.isArray(data)) throw new Error('Data array is required');
        
        const endpoints: Record<string, string> = {
          customers: '/contacts',
          vendors: '/contacts',
          invoices: '/invoices',
          bills: '/bills',
        };

        const endpoint = endpoints[entity_type];
        if (!endpoint) {
          throw new Error(`Unsupported entity type: ${entity_type}. Supported types: customers, vendors, invoices, bills`);
        }

        console.log(`Pushing ${data.length} ${entity_type} to Zoho Books`);

        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const item of data) {
          try {
            const response = await fetch(
              `${ZOHO_BOOKS_API}${endpoint}?organization_id=${organization_id}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Zoho-oauthtoken ${access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(item),
              }
            );

            const result = await response.json();
            results.push(result);
            if (result.code === 0) successCount++;
            else failCount++;
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
          .eq('connection_type', 'zoho');

        console.log('Disconnected from Zoho Books');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}. Supported actions: get_auth_url, exchange_token, refresh_token, fetch_data, push_data, disconnect`);
    }
  } catch (error) {
    console.error('Zoho integration error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
