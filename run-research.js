const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");
const { COMPETITORS } = require("./competitors");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const RESEARCH_SYSTEM = `You are an autonomous competitive intelligence agent for FLO Technologies (smart water management).
FLO Products: Flo by Moen Smart Water Shutoff (~$500), Flo Smart Water Monitor, FloProtect plans ($5-15/mo), MUD Property Manager Portal (B2B multifamily), RUBS submetering.
Research the given competitor using web search. Find: recent product updates/pricing (last 90 days), current pricing, key strengths vs FLO, weaknesses vs FLO, strategic moves.
Return ONLY a valid JSON object, no markdown, no code fences, no extra text:
{"competitor":"name","segment":"B2B or B2C","researchDate":"ISO date","recentDevelopments":["item"],"pricing":"summary","strengths":["s1"],"weaknesses":["w1"],"floAdvantage":"FLO edge","threatLevel":"Low|Medium|High|Critical","threatRationale":"one sentence","strategicSignal":"most important thing FLO should know right now"}`;

const REPORT_SYSTEM = `You are a senior product strategist at FLO Technologies. Given competitive research data, write a weekly executive report in markdown:
## Executive Summary
## Top 3 Threats This Week
## Market Opportunities
## B2B Competitive Position
## B2C Competitive Position
## P0 Recommendations
## Watch List
Be specific, PM-crisp, action-oriented.`;

async function researchCompetitor(competitor, segment) {
  console.log(`  Researching ${competitor.name}...`);
  const messages = [
    {
      role: "user",
      content: `Research competitor: ${competitor.name} (${segment} - ${competitor.focus}). Use web search to find latest news, pricing, and strategic moves. Return JSON only.`,
    },
  ];

  let iterations = 0;
  while (iterations < 8) {
    iterations++;
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: RESEARCH_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    if (res.stop_reason === "end_turn") {
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`No JSON found for ${competitor.name}`);
      return JSON.parse(match[0]);
    }

    messages.push({ role: "assistant", content: res.content });
    const toolUses = res.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error(`Unexpected stop for ${competitor.name}`);
    }
    messages.push({
      role: "user",
      content: toolUses.map((t) => ({ type: "tool_result", tool_use_id: t.id, content: "Search results returned by tool." })),
    });
  }
  throw new Error(`Max iterations for ${competitor.name}`);
}

async function generateReport(competitorData) {
  console.log("  Generating executive report...");
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: REPORT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Weekly research data:\n${JSON.stringify(competitorData, null, 2)}\n\nGenerate the executive report.`,
      },
    ],
  });
  return res.content.map((b) => b.text || "").join("");
}

async function main() {
  const scope = process.env.SCOPE || "full";
  console.log(`\n🤖 FLO CI Agent starting — scope: ${scope}\n`);

  const toResearch = [];
  if (scope !== "B2C") COMPETITORS.B2B.forEach((c) => toResearch.push({ ...c, segment: "B2B" }));
  if (scope !== "B2B") COMPETITORS.B2C.forEach((c) => toResearch.push({ ...c, segment: "B2C" }));

  const results = [];
  const errors = [];

  for (let i = 0; i < toResearch.length; i++) {
    const comp = toResearch[i];
    console.log(`[${i + 1}/${toResearch.length}] ${comp.name} (${comp.segment})`);
    try {
      const data = await researchCompetitor(comp, comp.segment);
      results.push(data);
      console.log(`  ✓ Threat: ${data.threatLevel}`);
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`);
      errors.push({ competitor: comp.name, error: e.message });
    }
  }

  let executiveReport = "";
  try {
    executiveReport = await generateReport(results);
    console.log("  ✓ Executive report generated");
  } catch (e) {
    console.error(`  ✗ Report failed: ${e.message}`);
    errors.push({ step: "report_synthesis", error: e.message });
  }

  // Save to Supabase
  const { error } = await supabase.from("reports").insert({
    generated_at: new Date().toISOString(),
    scope,
    competitor_data: results,
    executive_report: executiveReport,
    errors,
  });

  if (error) {
    console.error("Supabase insert failed:", error.message);
    process.exit(1);
  }

  // Keep only last 10 reports
  const { data: allReports } = await supabase
    .from("reports")
    .select("id")
    .order("generated_at", { ascending: false });

  if (allReports && allReports.length > 10) {
    const toDelete = allReports.slice(10).map((r) => r.id);
    await supabase.from("reports").delete().in("id", toDelete);
  }

  console.log(`\n✅ Done! ${results.length} competitors analyzed, ${errors.length} errors.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
