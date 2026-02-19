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

// ---- Recursive XML-RPC response parser ----
const parseXmlRpcValue = (valueXml: string): any => {
  const trimmed = valueXml.trim();

  // <int> or <i4>
  const intMatch = trimmed.match(/<(?:int|i4)>\s*(-?\d+)\s*<\/(?:int|i4)>/);
  if (intMatch) return parseInt(intMatch[1], 10);

  // <double>
  const doubleMatch = trimmed.match(/<double>\s*([^<]+)\s*<\/double>/);
  if (doubleMatch) return parseFloat(doubleMatch[1]);

  // <boolean>
  const boolMatch = trimmed.match(/<boolean>\s*([01])\s*<\/boolean>/);
  if (boolMatch) return boolMatch[1] === '1';

  // <string>
  const stringMatch = trimmed.match(/<string>([\s\S]*?)<\/string>/);
  if (stringMatch) return stringMatch[1];

  // <nil/> or <nil />
  if (/<nil\s*\/>/.test(trimmed)) return null;

  // <array>
  const arrayMatch = trimmed.match(/<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>/);
  if (arrayMatch) {
    const items: any[] = [];
    const valueRegex = /<value>([\s\S]*?)<\/value>/g;
    let m;
    // We need a smarter approach for nested values
    const inner = arrayMatch[1];
    const values = splitTopLevelValues(inner);
    for (const v of values) {
      items.push(parseXmlRpcValue(v));
    }
    return items;
  }

  // <struct>
  const structMatch = trimmed.match(/<struct>([\s\S]*?)<\/struct>/);
  if (structMatch) {
    const obj: Record<string, any> = {};
    const memberRegex = /<member>\s*<name>([^<]+)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
    let m;
    while ((m = memberRegex.exec(structMatch[1])) !== null) {
      obj[m[1]] = parseXmlRpcValue(m[2]);
    }
    return obj;
  }

  // bare value (no type tag) – treat as string
  return trimmed;
};

// Split top-level <value>...</value> elements without breaking on nested ones
const splitTopLevelValues = (xml: string): string[] => {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let i = 0;
  while (i < xml.length) {
    if (xml.startsWith('<value>', i) || xml.startsWith('<value ', i)) {
      if (depth === 0) start = i;
      depth++;
      // skip past the tag
      const tagEnd = xml.indexOf('>', i);
      i = tagEnd + 1;
    } else if (xml.startsWith('</value>', i)) {
      depth--;
      if (depth === 0 && start >= 0) {
        // extract inner content of <value>...</value>
        const openEnd = xml.indexOf('>', start) + 1;
        const inner = xml.substring(openEnd, i);
        results.push(inner);
        start = -1;
      }
      i += '</value>'.length;
    } else {
      i++;
    }
  }
  return results;
};

const parseXmlRpcResponse = (xml: string): any => {
  // Check for fault
  if (xml.includes('<fault>')) {
    const faultMatch = xml.match(/<string>([\s\S]*?)<\/string>/);
    throw new Error(faultMatch?.[1] || 'XML-RPC fault');
  }

  // Find the top-level <value> inside <param>
  const paramValueMatch = xml.match(/<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>/);
  if (paramValueMatch) {
    return parseXmlRpcValue(paramValueMatch[1]);
  }

  // Fallback: find any <value>
  const valueMatch = xml.match(/<value>([\s\S]*?)<\/value>/);
  if (valueMatch) {
    return parseXmlRpcValue(valueMatch[1]);
  }

  return null;
};

// Clean and validate Odoo URL
const cleanOdooUrl = (url: string): string => {
  let cleanUrl = url.trim();
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/\/odoo\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/web\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/web\/login\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/jsonrpc\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/xmlrpc\/?.*$/, '');
  return cleanUrl;
};

// Clean and extract database name
const cleanDatabaseName = (database: string, serverUrl: string): string => {
  let db = database.trim();
  if (db.includes('http://') || db.includes('https://') || db.includes('.odoo.com')) {
    const prefixMatch = db.match(/^([a-zA-Z0-9_-]+)(?:https?:|\.odoo)/i);
    if (prefixMatch) return prefixMatch[1];
    const urlMatch = db.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
    if (urlMatch) return urlMatch[1];
  }
  if (!db && serverUrl) {
    const urlMatch = serverUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
    if (urlMatch) return urlMatch[1];
  }
  return db;
};

// Map Odoo invoice record to local invoices table row
const mapOdooInvoiceToLocal = (record: any, userId: string): any => {
  const invoiceDate = record.invoice_date || record.date || new Date().toISOString().split('T')[0];
  const dueDate = record.invoice_date_due || invoiceDate;
  
  // Determine status from amount_residual
  let status: string = 'sent';
  if (record.state === 'cancel') {
    status = 'cancelled';
  } else if (record.amount_residual === 0 && record.amount_total > 0) {
    status = 'paid';
  } else if (record.state === 'draft') {
    status = 'draft';
  }

  // Extract currency name
  let currency = 'USD';
  if (record.currency_id) {
    if (Array.isArray(record.currency_id) && record.currency_id.length >= 2) {
      currency = record.currency_id[1]; // [id, name] format
    } else if (typeof record.currency_id === 'string') {
      currency = record.currency_id;
    }
  }

  // Notes from narration or ref
  const notes = record.narration || record.ref || null;

  return {
    invoice_number: record.name || `ODOO-${record.id}`,
    invoice_date: invoiceDate === false ? new Date().toISOString().split('T')[0] : invoiceDate,
    due_date: dueDate === false ? invoiceDate : dueDate,
    subtotal: record.amount_untaxed || 0,
    tax_amount: record.amount_tax || 0,
    total_amount: record.amount_total || 0,
    amount_paid: (record.amount_total || 0) - (record.amount_residual || 0),
    status,
    currency,
    notes,
    category: 'Odoo Import',
    source: 'odoo',
    user_id: userId,
  };
};

// Map Odoo bill record to local bills table row
const mapOdooBillToLocal = (record: any, userId: string): any => {
  const billDate = record.invoice_date || record.date || new Date().toISOString().split('T')[0];
  const dueDate = record.invoice_date_due || billDate;

  let status: string = 'pending';
  if (record.state === 'cancel') status = 'cancelled';
  else if (record.amount_residual === 0 && record.amount_total > 0) status = 'paid';
  else if (record.state === 'draft') status = 'draft';

  let currency = 'USD';
  if (record.currency_id) {
    if (Array.isArray(record.currency_id) && record.currency_id.length >= 2) currency = record.currency_id[1];
    else if (typeof record.currency_id === 'string') currency = record.currency_id;
  }

  return {
    bill_number: record.name || `ODOO-BILL-${record.id}`,
    bill_date: billDate === false ? new Date().toISOString().split('T')[0] : billDate,
    due_date: dueDate === false ? billDate : dueDate,
    subtotal: record.amount_untaxed || 0,
    tax_amount: record.amount_tax || 0,
    total_amount: record.amount_total || 0,
    amount_paid: (record.amount_total || 0) - (record.amount_residual || 0),
    status,
    currency,
    notes: record.narration || record.ref || null,
    category: 'Odoo Import',
    source: 'odoo',
    user_id: userId,
  };
};

// Map Odoo partner to local customers table row
const mapOdooCustomerToLocal = (record: any, userId: string): any => ({
  name: record.name || record.display_name || `Customer ${record.id}`,
  email: record.email || null,
  phone: record.phone || null,
  address: record.street || null,
  city: record.city || null,
  state: typeof record.state_id === 'object' && Array.isArray(record.state_id) ? record.state_id[1] : null,
  zip_code: record.zip || null,
  country: typeof record.country_id === 'object' && Array.isArray(record.country_id) ? record.country_id[1] : null,
  source: 'odoo',
  user_id: userId,
});

// Map Odoo partner to local vendors table row
const mapOdooVendorToLocal = (record: any, userId: string): any => ({
  name: record.name || record.display_name || `Vendor ${record.id}`,
  email: record.email || null,
  phone: record.phone || null,
  address: record.street || null,
  city: record.city || null,
  state: typeof record.state_id === 'object' && Array.isArray(record.state_id) ? record.state_id[1] : null,
  zip_code: record.zip || null,
  country: typeof record.country_id === 'object' && Array.isArray(record.country_id) ? record.country_id[1] : null,
  category: 'Odoo Import',
  source: 'odoo',
  user_id: userId,
});

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
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Unauthorized');

    const { action, ...params } = await req.json();
    console.log(`Odoo integration action: ${action}`, { params: { ...params, api_key: '[REDACTED]' } });

    // XML-RPC call helper
    const xmlRpc = async (url: string, methodName: string, rpcParams: any[]) => {
      console.log(`Making XML-RPC call to: ${url}, method: ${methodName}`);
      const body = buildXmlRpcRequest(methodName, rpcParams);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml' },
        body,
      });
      const responseText = await response.text();
      console.log(`Response status: ${response.status}, body (first 500 chars): ${responseText.substring(0, 500)}`);
      if (responseText.trim().startsWith('<!') || responseText.includes('<!DOCTYPE')) {
        throw new Error('Odoo returned an HTML page instead of XML.');
      }
      if (!response.ok) {
        throw new Error(`Odoo API returned status ${response.status}: ${responseText.substring(0, 200)}`);
      }
      return parseXmlRpcResponse(responseText);
    };

    // JSON-RPC call helper
    const jsonRpc = async (url: string, service: string, method: string, rpcParams: any[]) => {
      console.log(`Making JSON-RPC call to: ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { service, method, args: rpcParams },
          id: Math.random().toString(36).substring(7),
        }),
      });
      const responseText = await response.text();
      console.log(`JSON-RPC response (first 500 chars): ${responseText.substring(0, 500)}`);
      if (responseText.trim().startsWith('<!') || responseText.includes('<!DOCTYPE')) {
        throw new Error('HTML_RESPONSE');
      }
      try {
        const result = JSON.parse(responseText);
        if (result.error) {
          const errMsg = result.error.data?.message || result.error.message || 'Odoo API error';
          if (errMsg.toLowerCase().includes('access denied') || errMsg.toLowerCase().includes('accessdenied')) {
            throw new Error('ACCESS_DENIED: ' + errMsg);
          }
          throw new Error(errMsg);
        }
        return result;
      } catch (e) {
        if ((e as Error).message === 'HTML_RESPONSE') throw e;
        if ((e as Error).message.startsWith('ACCESS_DENIED:')) throw e;
        throw new Error(`Invalid JSON response from Odoo: ${responseText.substring(0, 100)}`);
      }
    };

    // Session-based authentication helper (uses same API as Odoo web UI)
    const odooSessionAuth = async (serverUrl: string, database: string, username: string, password: string): Promise<{ sessionId: string; uid: number }> => {
      console.log(`Attempting session auth to ${serverUrl}/web/session/authenticate`);
      const response = await fetch(`${serverUrl}/web/session/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { db: database, login: username, password },
          id: Math.random().toString(36).substring(7),
        }),
      });

      const setCookie = response.headers.get('set-cookie') || '';
      const sessionMatch = setCookie.match(/session_id=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : '';

      const responseText = await response.text();
      console.log(`Session auth response (first 300 chars): ${responseText.substring(0, 300)}`);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('Session auth returned invalid JSON');
      }

      if (result.error) {
        throw new Error(result.error.data?.message || result.error.message || 'Session auth failed');
      }

      const uid = result.result?.uid;
      if (!uid || uid === false) {
        throw new Error('Session authentication failed. Invalid credentials.');
      }

      if (!sessionId) {
        console.log('Warning: No session cookie received, will try with uid anyway');
      }

      return { sessionId, uid };
    };

    // Web dataset API helper (same API the Odoo web UI uses)
    const odooWebFetch = async (serverUrl: string, sessionId: string, model: string, method: string, args: any[], kwargs: any = {}): Promise<any> => {
      console.log(`Web API call: ${model}.${method}`);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionId) {
        headers['Cookie'] = `session_id=${sessionId}`;
      }

      const response = await fetch(`${serverUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model,
            method,
            args,
            kwargs,
          },
          id: Math.random().toString(36).substring(7),
        }),
      });

      const responseText = await response.text();
      console.log(`Web API response (first 500 chars): ${responseText.substring(0, 500)}`);

      if (responseText.trim().startsWith('<!') || responseText.includes('<!DOCTYPE')) {
        throw new Error('Web API returned HTML instead of JSON');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('Web API returned invalid JSON');
      }

      if (result.error) {
        const errMsg = result.error.data?.message || result.error.message || 'Web API error';
        throw new Error(errMsg);
      }

      return result.result;
    };

    switch (action) {
      case 'connect': {
        const { server_url, database, username, api_key, password } = params;
        
        if (!server_url || !server_url.trim()) throw new Error('Server URL is required.');
        if (!username || !username.trim()) throw new Error('Username/Email is required');
        if (!password || !password.trim()) throw new Error('Login Password is required.');
        const key = api_key?.trim() || '';

        const rawUrl = server_url.trim();
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
          throw new Error('Server URL must start with http:// or https://');
        }

        const cleanUrl = cleanOdooUrl(rawUrl);
        let db = cleanDatabaseName(database || '', cleanUrl);
        if (!db) {
          const urlMatch = cleanUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.odoo\.com/i);
          if (urlMatch) db = urlMatch[1];
        }
        if (!db) throw new Error('Could not determine database name.');
        
        const user_email = username.trim();
        const pwd = password.trim();

        let uid: any = null;
        let usedMethod = '';
        let sessionId = '';

        // Try session-based auth first with login password (works on all Odoo plans)
        try {
          console.log('Trying session-based auth with login password...');
          const session = await odooSessionAuth(cleanUrl, db, user_email, pwd);
          uid = session.uid;
          sessionId = session.sessionId;
          usedMethod = 'Session';
          console.log(`Session auth successful, uid=${uid}`);
        } catch (sessionError) {
          console.log(`Session auth failed: ${(sessionError as Error).message}, trying XML-RPC...`);
        }

        // Fallback to XML-RPC auth (uses API key if provided, otherwise password)
        if (!uid && key) {
          try {
            uid = await xmlRpc(`${cleanUrl}/xmlrpc/2/common`, 'authenticate', [db, user_email, key, {}]);
            usedMethod = 'XML-RPC';
          } catch (xmlError) {
            console.log(`XML-RPC failed: ${(xmlError as Error).message}, trying JSON-RPC...`);
          }
        }

        // Fallback to JSON-RPC auth
        if (!uid && key) {
          try {
            const authResult = await jsonRpc(`${cleanUrl}/jsonrpc`, 'common', 'authenticate', [db, user_email, key, {}]);
            uid = authResult.result;
            usedMethod = 'JSON-RPC';
          } catch (jsonError) {
            const msg = (jsonError as Error).message;
            if (msg === 'HTML_RESPONSE') {
              throw new Error('Odoo API is not accessible. Check URL and API access.');
            }
            throw new Error(`Authentication failed: ${msg}`);
          }
        }

        if (!uid || uid === false) throw new Error('Authentication failed. Verify credentials.');

        // Verify data access works by doing a simple read test
        let dataAccessMethod = usedMethod;
        try {
          if (sessionId) {
            // Test with Web API
            await odooWebFetch(cleanUrl, sessionId, 'res.partner', 'search_read', [[['id', '>', 0]]], { limit: 1, fields: ['id', 'name'] });
            dataAccessMethod = 'Session';
            console.log('Data access verified via Web API');
          } else {
            // Test with JSON-RPC
            const testResult = await jsonRpc(`${cleanUrl}/jsonrpc`, 'object', 'execute_kw',
              [db, uid, key, 'res.partner', 'search_read', [[['id', '>', 0]]], { limit: 1, fields: ['id', 'name'] }]);
            console.log('Data access verified via JSON-RPC');
          }
        } catch (accessError) {
          const msg = (accessError as Error).message;
          console.log(`Data access test failed: ${msg}`);
          // Don't block connection, just warn - data fetching will try session approach
          if (msg.toLowerCase().includes('access denied')) {
            console.log('Standard API access denied, will use session-based approach for data fetching');
            dataAccessMethod = 'Session';
          }
        }

        const { error: insertError } = await supabaseClient
          .from('connections')
          .upsert({
            user_id: user.id,
            connection_name: 'Odoo',
            connection_type: 'odoo',
            api_key: key,
            config: { server_url: cleanUrl, database: db, username: user_email, password: pwd, uid, auth_method: usedMethod, data_access_method: dataAccessMethod },
            status: 'active',
            last_sync: new Date().toISOString(),
          }, { onConflict: 'user_id,connection_type' });

        if (insertError) throw new Error('Connected to Odoo but failed to save connection details');

        return new Response(JSON.stringify({ success: true, uid }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'fetch_data': {
        const { server_url, database, uid, api_key, entity_type, auth_method, connection_id } = params;
        
        if (!server_url) throw new Error('Server URL is missing');
        if (!database) throw new Error('Database is missing');
        if (!uid) throw new Error('User ID is missing');
        if (!entity_type) throw new Error('Entity type is required');
        
        // Retrieve username and password from connection config for session auth
        let username = '';
        let password = params.password || '';
        if (connection_id) {
          const { data: conn } = await supabaseClient
            .from('connections')
            .select('config')
            .eq('id', connection_id)
            .single();
          username = conn?.config?.username || '';
          if (!password) password = conn?.config?.password || '';
        }

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
        if (!model) throw new Error(`Unsupported entity type: ${entity_type}`);

        // Build domain filter - broadened to capture all non-cancelled records
        let domain: any[] = [];
        if (entity_type === 'customers') domain = [['customer_rank', '>', 0]];
        else if (entity_type === 'vendors') domain = [['supplier_rank', '>', 0]];
        else if (entity_type === 'invoices') domain = [['move_type', '=', 'out_invoice'], ['state', '!=', 'cancel']];
        else if (entity_type === 'bills') domain = [['move_type', '=', 'in_invoice'], ['state', '!=', 'cancel']];
        else if (entity_type === 'journal_entries') domain = [['move_type', '=', 'entry']];

        // Specify fields for invoices to ensure we get what we need
        const invoiceFields = ['id', 'name', 'invoice_date', 'invoice_date_due', 'date', 'amount_untaxed', 'amount_tax', 'amount_total', 'amount_residual', 'state', 'move_type', 'currency_id', 'partner_id', 'ref', 'narration', 'display_name'];
        const fetchKwargs: any = { limit: 100 };
        if (entity_type === 'invoices' || entity_type === 'bills') {
          fetchKwargs.fields = invoiceFields;
        }

        let result: any;
        let fetchMethod = '';
        const errors: string[] = [];

        // Strategy 1: Session-based Web API with login password (works on all Odoo plans)
        if (username && password) {
          try {
            console.log(`Strategy 1: Session-based Web API for ${entity_type} (using login password)...`);
            const session = await odooSessionAuth(server_url, database, username, password);
            console.log(`Session auth successful, uid=${session.uid}, sessionId=${session.sessionId ? 'present' : 'missing'}`);
            
            result = await odooWebFetch(
              server_url, 
              session.sessionId, 
              model, 
              'search_read', 
              [domain], 
              fetchKwargs
            );
            fetchMethod = 'Web API';
            console.log(`Web API fetch successful, got ${Array.isArray(result) ? result.length : 0} records`);
          } catch (webError) {
            const msg = (webError as Error).message;
            console.log(`Web API failed: ${msg}`);
            errors.push(`Web API: ${msg}`);
          }
        }

        // Strategy 2: JSON-RPC (standard API)
        if (!result) {
          try {
            console.log(`Strategy 2: JSON-RPC for ${entity_type}...`);
            const jsonResult = await jsonRpc(`${server_url}/jsonrpc`, 'object', 'execute_kw',
              [database, uid, api_key, model, 'search_read', [domain], fetchKwargs]
            );
            result = jsonResult.result;
            fetchMethod = 'JSON-RPC';
            console.log(`JSON-RPC fetch successful, got ${Array.isArray(result) ? result.length : 0} records`);
          } catch (jsonError) {
            const msg = (jsonError as Error).message;
            console.log(`JSON-RPC fetch failed: ${msg}`);
            errors.push(`JSON-RPC: ${msg}`);
          }
        }

        // Strategy 3: XML-RPC (legacy fallback)
        if (!result) {
          try {
            console.log(`Strategy 3: XML-RPC for ${entity_type}...`);
            result = await xmlRpc(
              `${server_url}/xmlrpc/2/object`,
              'execute_kw',
              [database, uid, api_key, model, 'search_read', [domain], fetchKwargs]
            );
            fetchMethod = 'XML-RPC';
            console.log(`XML-RPC fetch result type: ${typeof result}, isArray: ${Array.isArray(result)}`);
          } catch (xmlError) {
            const msg = (xmlError as Error).message;
            console.log(`XML-RPC fetch failed: ${msg}`);
            errors.push(`XML-RPC: ${msg}`);
          }
        }

        // If all strategies failed, provide actionable error
        if (!result && errors.length > 0) {
          const hasAccessDenied = errors.some(e => e.toLowerCase().includes('access denied') || e.toLowerCase().includes('accessdenied'));
          if (hasAccessDenied) {
            throw new Error(
              'Access Denied by Odoo. This usually means: (1) Your Odoo plan may restrict external API access, or (2) Your user account lacks permission to read this data. ' +
              'Try using an Administrator account or check your Odoo subscription plan. Details: ' + errors.join('; ')
            );
          }
          throw new Error('All fetch methods failed: ' + errors.join('; '));
        }

        let records = Array.isArray(result) ? result : [];
        
        // If we got 0 records with filters, try without domain filters as diagnostic fallback
        if (records.length === 0 && domain.length > 0 && username && password) {
          console.log(`Got 0 records with domain filter ${JSON.stringify(domain)}, trying without filters as fallback...`);
          try {
            const session = await odooSessionAuth(server_url, database, username, password);
            const fallbackResult = await odooWebFetch(
              server_url, session.sessionId, model, 'search_read', [[]], { limit: 100, fields: fetchKwargs.fields || ['id', 'name'] }
            );
            const fallbackRecords = Array.isArray(fallbackResult) ? fallbackResult : [];
            console.log(`Fallback (no filter) returned ${fallbackRecords.length} records for model ${model}`);
            if (fallbackRecords.length > 0) {
              // Use these records - they exist but our filter was too restrictive
              records = fallbackRecords;
              console.log(`Using ${records.length} unfiltered records`);
            }
          } catch (fallbackError) {
            console.log(`Fallback fetch failed: ${(fallbackError as Error).message}`);
          }
        }
        
        console.log(`Total records fetched for ${entity_type}: ${records.length}`);

        // Create sync log entry
        const { data: syncLog, error: syncLogError } = await supabaseClient
          .from('sync_logs')
          .insert({
            user_id: user.id,
            connection_id: connection_id || null,
            sync_type: 'import',
            entity_type,
            records_processed: records.length,
            records_failed: 0,
            status: 'completed',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (syncLogError) console.error('Error creating sync log:', syncLogError);

        // Store individual record details in sync_log_records
        if (syncLog && records.length > 0) {
          const recordsToInsert = records.map((record: any) => ({
            sync_log_id: syncLog.id,
            external_id: String(record.id),
            record_name: record.display_name || record.name || `Record ${record.id}`,
            record_data: record,
            status: 'success',
          }));

          const { error: recordsError } = await supabaseClient
            .from('sync_log_records')
            .insert(recordsToInsert);

          if (recordsError) console.error('Error storing sync records:', recordsError);
        }

        // ---- Map fetched data to local tables ----
        let mappedCount = 0;

        // Helper to upsert a record by a unique key
        const upsertRecord = async (table: string, record: any, uniqueKey: string) => {
          const { data: existing } = await supabaseClient
            .from(table)
            .select('id')
            .eq(uniqueKey, record[uniqueKey])
            .eq('user_id', user.id)
            .maybeSingle();

          if (existing) {
            await supabaseClient.from(table).update(record).eq('id', existing.id);
          } else {
            await supabaseClient.from(table).insert(record);
          }
        };

        if (records.length > 0) {
          for (const record of records) {
            try {
              if (entity_type === 'invoices') {
                const localInvoice = mapOdooInvoiceToLocal(record, user.id);
                await upsertRecord('invoices', localInvoice, 'invoice_number');
              } else if (entity_type === 'bills') {
                const localBill = mapOdooBillToLocal(record, user.id);
                await upsertRecord('bills', localBill, 'bill_number');
              } else if (entity_type === 'customers') {
                const localCustomer = mapOdooCustomerToLocal(record, user.id);
                await upsertRecord('customers', localCustomer, 'name');
              } else if (entity_type === 'vendors') {
                const localVendor = mapOdooVendorToLocal(record, user.id);
                await upsertRecord('vendors', localVendor, 'name');
              }
              mappedCount++;
            } catch (mapError) {
              console.error(`Error mapping ${entity_type} record:`, mapError);
            }
          }
          console.log(`Mapped ${mappedCount} ${entity_type} to local table`);

          if (syncLog) {
            await supabaseClient
              .from('sync_logs')
              .update({ records_processed: mappedCount })
              .eq('id', syncLog.id);
          }
        }

        return new Response(JSON.stringify({ data: records, sync_log_id: syncLog?.id, mapped: mappedCount }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'push_data': {
        const { server_url, database, uid, api_key, entity_type, data, auth_method, connection_id } = params;
        
        if (!server_url) throw new Error('Server URL is missing');
        if (!database) throw new Error('Database is missing');
        if (!uid) throw new Error('User ID is missing');
        if (!entity_type) throw new Error('Entity type is required');
        if (!data || !Array.isArray(data)) throw new Error('Data array is required');
        
        // Retrieve username and password from connection config for session auth
        let pushUsername = '';
        let pushPassword = params.password || '';
        if (connection_id) {
          const { data: conn } = await supabaseClient
            .from('connections')
            .select('config')
            .eq('id', connection_id)
            .single();
          pushUsername = conn?.config?.username || '';
          if (!pushPassword) pushPassword = conn?.config?.password || '';
        }

        const pushModels: Record<string, string> = {
          customers: 'res.partner', vendors: 'res.partner',
          invoices: 'account.move', bills: 'account.move',
          payments: 'account.payment', journal_entries: 'account.move',
          products: 'product.product', accounts: 'account.account',
        };

        const pushModel = pushModels[entity_type];
        if (!pushModel) throw new Error(`Unsupported entity type: ${entity_type}`);

        // Map local data to Odoo-compatible fields
        const mapLocalToOdoo = (item: any): any => {
          if (entity_type === 'invoices' || entity_type === 'bills') {
            const mapped: any = {
              move_type: entity_type === 'invoices' ? 'out_invoice' : 'in_invoice',
            };
            if (item.invoice_date) mapped.invoice_date = item.invoice_date;
            if (item.due_date) mapped.invoice_date_due = item.due_date;
            if (item.notes) mapped.narration = item.notes;
            if (item.invoice_number) mapped.ref = item.invoice_number;
            // Don't send: invoice_number (Odoo auto-generates 'name'), total_amount, subtotal, tax_amount (computed by Odoo)
            return mapped;
          }
          if (entity_type === 'customers' || entity_type === 'vendors') {
            const mapped: any = {};
            if (item.name) mapped.name = item.name;
            if (item.email) mapped.email = item.email;
            if (item.phone) mapped.phone = item.phone;
            if (item.address) mapped.street = item.address;
            if (item.city) mapped.city = item.city;
            if (item.state) mapped.state_id = false; // Would need lookup
            if (item.zip_code) mapped.zip = item.zip_code;
            if (item.country) mapped.country_id = false; // Would need lookup
            if (entity_type === 'customers') mapped.customer_rank = 1;
            if (entity_type === 'vendors') mapped.supplier_rank = 1;
            return mapped;
          }
          // For other entity types, pass through but remove local-only fields
          const { id, user_id, created_at, updated_at, source_file_id, ...rest } = item;
          return rest;
        };

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

        if (syncLogError) console.error('Error creating sync log:', syncLogError);

        const results = [];
        const recordsToInsert: any[] = [];
        let successCount = 0;
        let failCount = 0;

        // Get session for session-based auth
        let pushSession: { sessionId: string; uid: number } | null = null;
        if (pushUsername && pushPassword) {
          try {
            pushSession = await odooSessionAuth(server_url, database, pushUsername, pushPassword);
            console.log(`Session auth for export successful, uid=${pushSession.uid}`);
          } catch (sessionErr) {
            console.log(`Session auth for export failed: ${(sessionErr as Error).message}`);
          }
        }

        for (const item of data) {
          try {
            const mappedItem = mapLocalToOdoo(item);
            console.log(`Exporting mapped item:`, JSON.stringify(mappedItem).substring(0, 300));
            
            let createResult;

            // Strategy 1: Session-based Web API
            if (pushSession) {
              try {
                createResult = await odooWebFetch(
                  server_url, pushSession.sessionId, pushModel, 'create', [[mappedItem]], {}
                );
              } catch (webErr) {
                console.log(`Web API create failed: ${(webErr as Error).message}, falling back...`);
              }
            }

            // Strategy 2: JSON-RPC fallback
            if (!createResult && api_key) {
              try {
                const jsonResult = await jsonRpc(`${server_url}/jsonrpc`, 'object', 'execute_kw',
                  [database, uid, api_key, pushModel, 'create', [mappedItem]]);
                createResult = jsonResult.result;
              } catch (jsonErr) {
                console.log(`JSON-RPC create failed: ${(jsonErr as Error).message}`);
              }
            }

            // Strategy 3: XML-RPC fallback
            if (!createResult && api_key) {
              createResult = await xmlRpc(`${server_url}/xmlrpc/2/object`, 'execute_kw',
                [database, uid, api_key, pushModel, 'create', [mappedItem]]);
            }

            if (createResult) {
              successCount++;
              results.push({ id: createResult });
              if (syncLog) {
                recordsToInsert.push({
                  sync_log_id: syncLog.id,
                  record_id: item.id || null,
                  external_id: String(createResult),
                  record_name: item.name || item.invoice_number || item.display_name || `Record ${createResult}`,
                  record_data: mappedItem,
                  status: 'success',
                });
              }
            } else {
              failCount++;
              results.push({ error: 'No result returned from Odoo' });
              if (syncLog) {
                recordsToInsert.push({
                  sync_log_id: syncLog.id,
                  record_id: item.id || null,
                  record_name: item.name || item.invoice_number || 'Unknown',
                  record_data: mappedItem, status: 'failed', error_message: 'No result returned',
                });
              }
            }
          } catch (error) {
            failCount++;
            results.push({ error: (error as Error).message });
            if (syncLog) {
              recordsToInsert.push({
                sync_log_id: syncLog.id,
                record_id: item.id || null,
                record_name: item.name || item.invoice_number || 'Unknown',
                record_data: item, status: 'failed', error_message: (error as Error).message,
              });
            }
          }
        }

        if (syncLog && recordsToInsert.length > 0) {
          await supabaseClient.from('sync_log_records').insert(recordsToInsert);
        }

        if (syncLog) {
          await supabaseClient.from('sync_logs').update({
            records_processed: successCount,
            records_failed: failCount,
            status: failCount === 0 ? 'completed' : 'completed_with_errors',
            completed_at: new Date().toISOString(),
          }).eq('id', syncLog.id);
        }

        return new Response(JSON.stringify({ results, successCount, failCount, sync_log_id: syncLog?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        await supabaseClient.from('connections').delete()
          .eq('user_id', user.id).eq('connection_type', 'odoo');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Odoo integration error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
