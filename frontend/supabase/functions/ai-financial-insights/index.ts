import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      totalIncome,
      totalExpenses,
      netSavings,
      transactionCount,
      topCategories,
      currency,
      periodFrom,
      periodTo,
    } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured in Supabase secrets");

    const categorySummary = (topCategories as any[])
      .map((c) => `  • ${c.name}: ${Number(c.amount).toFixed(2)} ${currency}`)
      .join("\n");

    const period = periodFrom && periodTo ? `${periodFrom} to ${periodTo}` : "the selected period";
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : "0";
    const expenseRatio = totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : "N/A";

    const prompt = `You are a financial analyst. Analyze the following REAL financial data and return a JSON object.

Period: ${period}
Total Income: ${Number(totalIncome).toFixed(2)} ${currency}
Total Expenses: ${Number(totalExpenses).toFixed(2)} ${currency}
Net Savings: ${Number(netSavings).toFixed(2)} ${currency}
Savings Rate: ${savingsRate}%
Expense-to-Income Ratio: ${expenseRatio}%
Transaction Count: ${transactionCount}
Top Spending Categories:
${categorySummary || "  (no expense data)"}

IMPORTANT: Your analysis MUST reference the actual numbers above. Do NOT give generic advice.
Mention specific amounts, categories, and percentages from the data.

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "financial_health_score": <integer 0-100 based on savings rate, expense ratio, and patterns>,
  "score_category": "<Excellent|Good|Fair|Poor>",
  "key_insights": [
    "<specific insight using actual numbers from the data>",
    "<specific insight>",
    "<specific insight>"
  ],
  "spending_patterns": [
    "<specific pattern observed from the category breakdown>",
    "<specific pattern>",
    "<specific pattern>"
  ],
  "recommendations": [
    "<actionable recommendation specific to this data>",
    "<actionable recommendation>",
    "<actionable recommendation>"
  ]
}

Rules:
- financial_health_score: 70-100 if savings rate > 20%, 40-69 if 5-20%, 0-39 if negative or < 5%
- Each insight/pattern/recommendation MUST mention at least one specific number or category name from the data
- Do not use placeholder text like "your income" or "your expenses" — use the actual values`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        temperature: 1,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("Anthropic API error:", status, errText);
      if (status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
      if (status === 402) throw new Error("API credits exhausted.");
      throw new Error(`Anthropic API error: ${status}`);
    }

    const result = await response.json();
    const rawText = result.content?.[0]?.text?.trim();

    if (!rawText) throw new Error("Empty response from AI");

    // Strip markdown code fences if present
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let insights;
    try {
      insights = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse AI JSON:", jsonText);
      throw new Error("AI returned invalid JSON");
    }

    // Validate required fields
    if (
      typeof insights.financial_health_score !== "number" ||
      !insights.score_category ||
      !Array.isArray(insights.key_insights) ||
      !Array.isArray(insights.spending_patterns) ||
      !Array.isArray(insights.recommendations)
    ) {
      throw new Error("AI response missing required fields");
    }

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
