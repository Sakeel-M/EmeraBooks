import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to build XML-RPC request
const buildXmlRpcRequest = (methodName: string, params: any[]) => {
  const paramToXml = (param: any): string => {
    if (typeof param === 'string') {
      return `<value><string>${param}</string></value>`;
    } else if (typeof param === 'number') {
      return Number.isInteger(param) 
        ? `<value><int>${param}</int></value>`
        : `<value><double>${param}</double></value>`;
    } else if (typeof param === 'boolean') {
      return `<value><boolean>${param ? 1 : 0}</boolean></value>`;
    } else if (Array.isArray(param)) {
      return `<value><array><data>${param.map(paramToXml).join('')}</data></array></value>`;
    } else if (param && typeof param === 'object') {
      const members = Object.entries(param).map(([key, value]) => 
        `<member><name>${key}</name>${paramToXml(value)}</member>`
      ).join('');
      return `<value><struct>${members}</struct></value>`;
    }
    return `<value><string></string></value>`;
  };

  const paramsXml = params.map(p => `<param>${paramToXml(p)}</param>`).join('');
  
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>${paramsXml}</params>
</methodCall>`;
};

// Helper to parse XML-RPC response
const parseXmlRpcResponse = (xml: string): any => {
  // Check for fault
  if (xml.includes('<fault>')) {
    const faultMatch = xml.match(/<string>([^<]*)<\/string>/);
    throw new Error(faultMatch?.[1] || 'XML-RPC fault');
  }
  
  // Extract value - handle different types
  const intMatch = xml.match(/<int>(\d+)<\/int>/) || xml.match(/<i4>(\d+)<\/i4>/);
  if (intMatch) {
    return parseInt(intMatch[1], 10);
  }
  
  const boolMatch = xml.match(/<boolean>([01])<\/boolean>/);
  if (boolMatch) {
    return boolMatch[1] === '1';
  }
  
  const stringMatch = xml.match(/<string>([^<]*)<\/string>/);
  if (stringMatch) {
    return stringMatch[1];
  }

  // For arrays, return raw for now (complex parsing)
  if (xml.includes('<array>')) {
    return xml; // Return raw XML for complex responses
  }
  
  return null;
};

// Clean and validate Odoo URL
const cleanOdooUrl = (url: string): string => {
  let cleanUrl = url.trim();
  
  // Remove trailing slashes
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  
  // Remove common wrong suffixes
  cleanUrl = cleanUrl.replace(/\/odoo\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/web\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/web\/login\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/jsonrpc\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/xmlrpc\/?.*$/, '');
  
  return cleanUrl;
};

// Clean and extract database name from potentially malformed input
const cleanDatabaseName = (database: string, serverUrl: string): string => {
  let db = database.trim();
  
  // If database contains URL patterns, try to extract just the subdomain/db name
  if (db.includes('http://') || db.includes('https://') || db.includes('.odoo.com')) {
    // Pattern: "sakeel1https://sakeel1.odoo.com" -> extract "sakeel1" at the start
    const prefixMatch = db.match(/^([a-zA-Z0-9_-]+)(?:https?:|\.odoo)/i);
    if (prefixMatch) {
      console.log(`Extracted database name from malformed input: ${prefixMatch[1]}`);
      return prefixMatch[1];
    }
    
    // Pattern: "https://sakeel1.odoo.com" -> extract "sakeel1"
    const urlMatch = db.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
    if (urlMatch) {
      console.log(`Extracted database name from URL: ${urlMatch[1]}`);
      return urlMatch[1];
    }
  }
  
  // If database is empty or invalid, try to extract from server URL
  if (!db && serverUrl) {
    const urlMatch = serverUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
    if (urlMatch) {
      console.log(`Auto-extracted database name from server URL: ${urlMatch[1]}`);
      return urlMatch[1];
    }
  }
  
  return db;
};

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
    console.log(`Odoo integration action: ${action}`, { params: { ...params, api_key: '[REDACTED]' } });

    // XML-RPC call helper
    const xmlRpc = async (url: string, methodName: string, rpcParams: any[]) => {
      console.log(`Making XML-RPC call to: ${url}, method: ${methodName}`);
      
      const body = buildXmlRpcRequest(methodName, rpcParams);
      console.log(`Request body (first 500 chars): ${body.substring(0, 500)}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'text/xml',
          'Accept': 'text/xml',
        },
        body,
      });
      
      const responseText = await response.text();
      console.log(`Response status: ${response.status}, body (first 500 chars): ${responseText.substring(0, 500)}`);
      
      // Check if we got HTML instead of XML (common error)
      if (responseText.trim().startsWith('<!') || responseText.includes('<!DOCTYPE')) {
        throw new Error('Odoo returned an HTML page instead of XML. This usually means: 1) The URL is incorrect, 2) API access is not enabled on your Odoo plan, or 3) The endpoint path is wrong. Please verify your Odoo URL and ensure your plan includes API access.');
      }
      
      if (!response.ok) {
        throw new Error(`Odoo API returned status ${response.status}: ${responseText.substring(0, 200)}`);
      }
      
      return parseXmlRpcResponse(responseText);
    };

    // JSON-RPC call helper (fallback)
    const jsonRpc = async (url: string, service: string, method: string, rpcParams: any[]) => {
      console.log(`Making JSON-RPC call to: ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service,
            method,
            args: rpcParams,
          },
          id: Math.random().toString(36).substring(7),
        }),
      });
      
      const responseText = await response.text();
      console.log(`JSON-RPC response (first 500 chars): ${responseText.substring(0, 500)}`);
      
      // Check if we got HTML instead of JSON
      if (responseText.trim().startsWith('<!') || responseText.includes('<!DOCTYPE')) {
        throw new Error('HTML_RESPONSE');
      }
      
      try {
        const result = JSON.parse(responseText);
        if (result.error) {
          console.error('Odoo RPC error:', result.error);
          throw new Error(result.error.data?.message || result.error.message || 'Odoo API error');
        }
        return result;
      } catch (e) {
        if ((e as Error).message === 'HTML_RESPONSE') throw e;
        throw new Error(`Invalid JSON response from Odoo: ${responseText.substring(0, 100)}`);
      }
    };

    switch (action) {
      case 'connect': {
        const { server_url, database, username, api_key } = params;
        
        // Validate required fields
        if (!server_url || !server_url.trim()) {
          throw new Error('Server URL is required. Example: https://your-company.odoo.com');
        }
        if (!username || !username.trim()) {
          throw new Error('Username/Email is required');
        }
        if (!api_key || !api_key.trim()) {
          throw new Error('API Key is required. Generate one from your Odoo user profile under "Account Security" → "API Keys"');
        }

        // Clean and validate URL
        const rawUrl = server_url.trim();
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
          throw new Error('Server URL must start with http:// or https://. Example: https://your-company.odoo.com');
        }

        const cleanUrl = cleanOdooUrl(rawUrl);
        console.log(`Original URL: ${rawUrl}, Cleaned URL: ${cleanUrl}`);
        
        // Clean and extract database name - auto-extract from URL if needed
        let db = cleanDatabaseName(database || '', cleanUrl);
        
        // If still no database, try to extract from the cleaned URL
        if (!db) {
          const urlMatch = cleanUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
          if (urlMatch) {
            db = urlMatch[1];
            console.log(`Auto-extracted database name from URL: ${db}`);
          }
        }
        
        if (!db) {
          throw new Error('Could not determine database name. For Odoo.com accounts, this is usually your subdomain (e.g., for mycompany.odoo.com, enter "mycompany")');
        }
        
        console.log(`Using database name: ${db}`);
        
        const user_email = username.trim();
        const key = api_key.trim();

        // Try XML-RPC first (more reliable for Odoo)
        let uid: any = null;
        let usedMethod = '';

        try {
          console.log(`Attempting XML-RPC authentication to: ${cleanUrl}/xmlrpc/2/common`);
          uid = await xmlRpc(`${cleanUrl}/xmlrpc/2/common`, 'authenticate', [db, user_email, key, {}]);
          usedMethod = 'XML-RPC';
          console.log(`XML-RPC authentication result: uid=${uid}`);
        } catch (xmlError) {
          console.log(`XML-RPC failed: ${(xmlError as Error).message}, trying JSON-RPC...`);
          
          // Fall back to JSON-RPC
          try {
            const authResult = await jsonRpc(`${cleanUrl}/jsonrpc`, 'common', 'authenticate', [db, user_email, key, {}]);
            uid = authResult.result;
            usedMethod = 'JSON-RPC';
            console.log(`JSON-RPC authentication result: uid=${uid}`);
          } catch (jsonError) {
            const jsonErrorMsg = (jsonError as Error).message;
            if (jsonErrorMsg === 'HTML_RESPONSE') {
              throw new Error(
                'Odoo API is not accessible. This could mean:\n' +
                '1. The URL is incorrect - it should be just your Odoo domain (e.g., https://mycompany.odoo.com)\n' +
                '2. Your Odoo plan may not include API access (requires Custom pricing plan)\n' +
                '3. External API access may be disabled in your Odoo settings\n\n' +
                'Please verify your URL and check if API access is enabled in your Odoo account.'
              );
            }
            throw new Error(`Authentication failed: ${jsonErrorMsg}`);
          }
        }

        if (!uid || uid === false) {
          throw new Error(
            'Authentication failed. Please verify:\n' +
            '1. Database name is correct (case-sensitive)\n' +
            '2. Username/email matches your Odoo login\n' +
            '3. API key is valid and not expired\n' +
            '4. Your user has API access permissions'
          );
        }

        console.log(`Successfully authenticated with Odoo using ${usedMethod}. User ID: ${uid}`);

        // Store connection in database
        const { error: insertError } = await supabaseClient
          .from('connections')
          .upsert({
            user_id: user.id,
            connection_name: 'Odoo',
            connection_type: 'odoo',
            api_key: key,
            config: {
              server_url: cleanUrl,
              database: db,
              username: user_email,
              uid,
              auth_method: usedMethod,
            },
            status: 'active',
            last_sync: new Date().toISOString(),
          }, { onConflict: 'user_id,connection_type' });

        if (insertError) {
          console.error('Error storing connection:', insertError);
          throw new Error('Connected to Odoo but failed to save connection details');
        }

        return new Response(JSON.stringify({ success: true, uid }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'fetch_data': {
        const { server_url, database, uid, api_key, entity_type, auth_method, connection_id } = params;
        
        // Validate required parameters
        if (!server_url) throw new Error('Server URL is missing from connection config');
        if (!database) throw new Error('Database is missing from connection config');
        if (!uid) throw new Error('User ID is missing from connection config');
        if (!api_key) throw new Error('API Key is missing from connection config');
        if (!entity_type) throw new Error('Entity type is required');
        
        const models: Record<string, string> = {
          customers: 'res.partner',
          vendors: 'res.partner',
          invoices: 'account.move',
          bills: 'account.move',
          payments: 'account.payment',
          journal_entries: 'account.move',
          products: 'product.product',
          accounts: 'account.account',
        };

        const model = models[entity_type];
        if (!model) {
          throw new Error(`Unsupported entity type: ${entity_type}. Supported types: customers, vendors, invoices, bills, payments, journal_entries, products, accounts`);
        }

        // Build domain filter
        let domain: any[] = [];
        if (entity_type === 'customers') {
          domain = [['customer_rank', '>', 0]];
        } else if (entity_type === 'vendors') {
          domain = [['supplier_rank', '>', 0]];
        } else if (entity_type === 'invoices') {
          domain = [['move_type', '=', 'out_invoice']];
        } else if (entity_type === 'bills') {
          domain = [['move_type', '=', 'in_invoice']];
        } else if (entity_type === 'payments') {
          domain = []; // All payments
        } else if (entity_type === 'journal_entries') {
          domain = [['move_type', '=', 'entry']]; // Journal entries only
        } else if (entity_type === 'products') {
          domain = []; // All products
        } else if (entity_type === 'accounts') {
          domain = []; // All accounts
        }

        let result;
        try {
          if (auth_method === 'XML-RPC') {
            result = await xmlRpc(
              `${server_url}/xmlrpc/2/object`,
              'execute_kw',
              [database, uid, api_key, model, 'search_read', [domain], { limit: 100 }]
            );
          } else {
            const jsonResult = await jsonRpc(`${server_url}/jsonrpc`, 'object', 'execute_kw', 
              [database, uid, api_key, model, 'search_read', [domain], { limit: 100 }]
            );
            result = jsonResult.result;
          }
        } catch (error) {
          throw new Error(`Failed to fetch ${entity_type}: ${(error as Error).message}`);
        }

        // Create sync log entry first
        const { data: syncLog, error: syncLogError } = await supabaseClient
          .from('sync_logs')
          .insert({
            user_id: user.id,
            connection_id: connection_id || null,
            sync_type: 'import',
            entity_type,
            records_processed: Array.isArray(result) ? result.length : 0,
            records_failed: 0,
            status: 'completed',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (syncLogError) {
          console.error('Error creating sync log:', syncLogError);
        }

        // Store individual record details if we have results and sync log
        if (syncLog && Array.isArray(result) && result.length > 0) {
          const recordsToInsert = result.map((record: any) => ({
            sync_log_id: syncLog.id,
            external_id: String(record.id),
            record_name: record.display_name || record.name || `Record ${record.id}`,
            record_data: record,
            status: 'success',
          }));

          const { error: recordsError } = await supabaseClient
            .from('sync_log_records')
            .insert(recordsToInsert);

          if (recordsError) {
            console.error('Error storing sync records:', recordsError);
          }
        }

        return new Response(JSON.stringify({ data: result, sync_log_id: syncLog?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'push_data': {
        const { server_url, database, uid, api_key, entity_type, data, auth_method, connection_id } = params;
        
        // Validate required parameters
        if (!server_url) throw new Error('Server URL is missing from connection config');
        if (!database) throw new Error('Database is missing from connection config');
        if (!uid) throw new Error('User ID is missing from connection config');
        if (!api_key) throw new Error('API Key is missing from connection config');
        if (!entity_type) throw new Error('Entity type is required');
        if (!data || !Array.isArray(data)) throw new Error('Data array is required');
        
        const models: Record<string, string> = {
          customers: 'res.partner',
          vendors: 'res.partner',
          invoices: 'account.move',
          bills: 'account.move',
          payments: 'account.payment',
          journal_entries: 'account.move',
          products: 'product.product',
          accounts: 'account.account',
        };

        const model = models[entity_type];
        if (!model) {
          throw new Error(`Unsupported entity type: ${entity_type}. Supported types: customers, vendors, invoices, bills, payments, journal_entries, products, accounts`);
        }

        // Create sync log entry first
        const { data: syncLog, error: syncLogError } = await supabaseClient
          .from('sync_logs')
          .insert({
            user_id: user.id,
            connection_id: connection_id || null,
            sync_type: 'export',
            entity_type,
            records_processed: 0,
            records_failed: 0,
            status: 'pending',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (syncLogError) {
          console.error('Error creating sync log:', syncLogError);
        }

        const results = [];
        const recordsToInsert = [];
        let successCount = 0;
        let failCount = 0;

        for (const item of data) {
          try {
            let createResult;
            if (auth_method === 'XML-RPC') {
              createResult = await xmlRpc(
                `${server_url}/xmlrpc/2/object`,
                'execute_kw',
                [database, uid, api_key, model, 'create', [item]]
              );
            } else {
              const jsonResult = await jsonRpc(`${server_url}/jsonrpc`, 'object', 'execute_kw',
                [database, uid, api_key, model, 'create', [item]]
              );
              createResult = jsonResult.result;
            }

            if (createResult) {
              successCount++;
              results.push({ id: createResult });
              if (syncLog) {
                recordsToInsert.push({
                  sync_log_id: syncLog.id,
                  record_id: item.local_id || null,
                  external_id: String(createResult),
                  record_name: item.name || item.display_name || `Record ${createResult}`,
                  record_data: item,
                  status: 'success',
                });
              }
            } else {
              failCount++;
              results.push({ error: 'Unknown error' });
              if (syncLog) {
                recordsToInsert.push({
                  sync_log_id: syncLog.id,
                  record_id: item.local_id || null,
                  record_name: item.name || item.display_name || 'Unknown',
                  record_data: item,
                  status: 'failed',
                  error_message: 'Unknown error',
                });
              }
            }
          } catch (error) {
            failCount++;
            results.push({ error: (error as Error).message });
            if (syncLog) {
              recordsToInsert.push({
                sync_log_id: syncLog.id,
                record_id: item.local_id || null,
                record_name: item.name || item.display_name || 'Unknown',
                record_data: item,
                status: 'failed',
                error_message: (error as Error).message,
              });
            }
          }
        }

        // Store individual record details
        if (syncLog && recordsToInsert.length > 0) {
          const { error: recordsError } = await supabaseClient
            .from('sync_log_records')
            .insert(recordsToInsert);

          if (recordsError) {
            console.error('Error storing sync records:', recordsError);
          }
        }

        // Update sync log with final counts
        if (syncLog) {
          await supabaseClient
            .from('sync_logs')
            .update({
              records_processed: successCount,
              records_failed: failCount,
              status: failCount === 0 ? 'completed' : 'completed_with_errors',
              completed_at: new Date().toISOString(),
            })
            .eq('id', syncLog.id);
        }

        return new Response(JSON.stringify({ results, successCount, failCount, sync_log_id: syncLog?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        await supabaseClient
          .from('connections')
          .delete()
          .eq('user_id', user.id)
          .eq('connection_type', 'odoo');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}. Supported actions: connect, fetch_data, push_data, disconnect`);
    }
  } catch (error) {
    console.error('Odoo integration error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
