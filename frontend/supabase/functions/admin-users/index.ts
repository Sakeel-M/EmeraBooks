import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller identity
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const callerId = user.id;

  // Use service role client for admin operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Check if caller is admin
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (req.method === "GET") {
      // List all users with stats
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listError) throw listError;

      // Get all roles
      const { data: allRoles } = await adminClient.from("user_roles").select("user_id, role");

      // Get per-user counts
      const userIds = users.map((u) => u.id);

      const [filesRes, invoicesRes, billsRes, transactionsRes] = await Promise.all([
        adminClient.from("uploaded_files").select("user_id"),
        adminClient.from("invoices").select("user_id"),
        adminClient.from("bills").select("user_id"),
        adminClient.from("transactions").select("user_id"),
      ]);

      const countBy = (rows: any[] | null) => {
        const map: Record<string, number> = {};
        (rows || []).forEach((r) => {
          map[r.user_id] = (map[r.user_id] || 0) + 1;
        });
        return map;
      };

      const fileCounts = countBy(filesRes.data);
      const invoiceCounts = countBy(invoicesRes.data);
      const billCounts = countBy(billsRes.data);
      const txCounts = countBy(transactionsRes.data);

      const rolesMap: Record<string, string[]> = {};
      (allRoles || []).forEach((r) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      const enrichedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || null,
        avatar_url: u.user_metadata?.avatar_url || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: rolesMap[u.id] || [],
        stats: {
          files: fileCounts[u.id] || 0,
          invoices: invoiceCounts[u.id] || 0,
          bills: billCounts[u.id] || 0,
          transactions: txCounts[u.id] || 0,
        },
      }));

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      // Assign or remove role
      const { user_id, role, action } = await req.json();
      if (!user_id || !role || !action) {
        return new Response(JSON.stringify({ error: "Missing user_id, role, or action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "assign") {
        const { error } = await adminClient.from("user_roles").insert({ user_id, role });
        if (error) throw error;
      } else if (action === "remove") {
        const { error } = await adminClient.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const { user_id } = await req.json();
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-deletion
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
