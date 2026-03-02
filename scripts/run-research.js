const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");
const { COMPETITORS } = require("./competitors");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const RESEARCH_SYSTEM = "You are an autonomous competitive intelligence agent for FLO Technologies (smart water management).\n" +
"FLO Products: Flo by Moen Smart Water Shutoff (~$500), Flo Smart Water Monitor, FloProtect plans ($5-15/mo), MUD Property Manager Portal (B2B multifamily), RUBS submetering.\n" +
"Research the given competitor using web search. Find recent product updates/pricing (last 90 days), current pricing, key strengths vs FLO, weaknesses vs FLO, strategic moves.\n" +
'Return ONLY a valid JSON object, no markdown, no code fences:\n' +
'{"competitor":"name","segment":"B2B or B2C","researchDate":"ISO date","recentDevelopments":["item"],"pricing":"summary","strengths":["s1"],"weaknesses":["w1"],"floAdvantage":"FLO edge","threatLevel":"Low|Medium|High|Critical","threatRationale":"one sentence","strategicSignal":"most important thing FLO should know"}';

const REPORT_SYSTEM = "You are a senior product strategist at FLO Technologies. Given competitive research data, write a weekly executive report in markdown:\n" +
"## Executive Summary\n## Top 3 Threats This Week\n## Market Opportunities\n## B2B Competitive Position\n## B2C Competitive Position\n## P0 Recommendations\n## Watch List\n" +
"Be specific, PM-crisp, action-oriented.";

async function researchCompetitor(competitor, segment) {
  console.log("Researching " + competitor.name + "...");
  const messages = [{
    role: "user",
    content: "Research competitor: " + competitor.name + " (" + segment + " - " + competitor.focus + "). Use web search. Return JSON only."
  }];
  let iterations = 0;
  while (iterations < 8) {
    iterations++;
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: RESEARCH_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: messages
    });
    if (res.stop_reason === "end_turn") {
      const text = res.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON for " + competitor.name);
      return JSON.parse(match[0]);
    }
    messages.push({ role: "assistant", content: res.content });
    const toolUses = res.content.filter(function(b) { return b.type === "tool_use"; });
    if (!toolUses.length) {
      const text = res.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Unexpected stop for " + competitor.name);
    }
    messages.push({
      role: "user",
      content: toolUses.map(function(t) { return { type: "tool_result", tool_use_id: t.id, content: "Results returned." }; })
    });
  }
  throw new Error("Max iterations for " + competitor.name);
}

async function generateReport(competitorData) {
  console.log("Generating executive report...");
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: REPORT_SYSTEM,
    messages: [{
      role: "user",
      content: "Research data:\n" + JSON.stringify(competitorData, null, 2) + "\n\nGenerate the executive report."
    }]
  });
  return res.content.map(function(b) { return b.text || ""; }).join("");
}

async function main() {
  const scope = process.env.SCOPE || "full";
  console.log("FLO CI Agent starting - scope: " + scope);
  const toResearch = [];
  if (scope !== "B2C") COMPETITORS.B2B.forEach(function(c) { toResearch.push(Object.assign({}, c, { segment: "B2B" })); });
  if (scope !== "B2B") COMPETITORS.B2C.forEach(function(c) { toResearch.push(Object.assign({}, c, { segment: "B2C" })); });

  const results = [];
  const errors = [];

  for (let i = 0; i < toResearch.length; i++) {
    const comp = toResearch[i];
    console.log("[" + (i + 1) + "/" + toResearch.length + "] " + comp.name);
    try {
      const d = await researchCompetitor(comp, comp.segment);
      results.push(d);
      console.log("Threat: " + d.threatLevel);
    } catch(e) {
      console.error("Failed: " + e.message);
      errors.push({ competitor: comp.name, error: e.message });
    }
  }

  let executiveReport = "";
  try {
    executiveReport = await generateReport(results);
    console.log("Executive report generated");
  } catch(e) {
    errors.push({ step: "report_synthesis", error: e.message });
  }

  const { error } = await supabase.from("reports").insert({
    generated_at: new Date().toISOString(),
    scope: scope,
    competitor_data: results,
    executive_report: executiveReport,
    errors: errors
  });
  if (error) { console.error("Supabase error:", error.message); process.exit(1); }

  const { data: all } = await supabase.from("reports").select("id").order("generated_at", { ascending: false });
  if (all && all.length > 10) {
    await supabase.from("reports").delete().in("id", all.slice(10).map(function(r) { return r.id; }));
  }

  console.log("Done! " + results.length + " competitors analyzed.");
}

main().catch(function(e) { console.error(e); process.exit(1); });
