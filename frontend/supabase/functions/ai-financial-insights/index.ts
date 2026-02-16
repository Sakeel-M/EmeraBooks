import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { totalIncome, totalExpenses, netSavings, transactionCount, topCategories, currency } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const categorySummary = topCategories
      .map((c: any) => `${c.name}: ${c.amount.toFixed(2)} ${currency}`)
      .join(", ");

    const prompt = `Analyze this financial data and provide insights:
- Total Income: ${totalIncome.toFixed(2)} ${currency}
- Total Expenses: ${totalExpenses.toFixed(2)} ${currency}
- Net Savings: ${netSavings.toFixed(2)} ${currency}
- Transaction Count: ${transactionCount}
- Top Spending Categories: ${categorySummary}

Provide a financial health assessment.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a financial analyst AI. Analyze the provided financial data and call the function with your analysis.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_financial_insights",
              description: "Return structured financial insights based on the analysis.",
              parameters: {
                type: "object",
                properties: {
                  financial_health_score: {
                    type: "number",
                    description: "Score from 0-100 representing overall financial health",
                  },
                  score_category: {
                    type: "string",
                    description: "Category: Excellent, Good, Fair, or Poor",
                  },
                  key_insights: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 key financial insights",
                  },
                  spending_patterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 observed spending patterns",
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 actionable financial recommendations",
                  },
                },
                required: ["financial_health_score", "score_category", "key_insights", "spending_patterns", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_financial_insights" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    const insights = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-financial-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
