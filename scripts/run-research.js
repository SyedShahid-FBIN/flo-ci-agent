const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const SEED_B2B = ["SmartRent","Quext IoT","Yardi Utility Management","RealPage Utility Management","Conservice","Livable","Ratio Utilities"];
const SEED_B2C = ["Phyn Plus","Grohe Sense Guard","Resideo Leak Defense","Leak Smart","Govee Water Sensor","Alert Labs"];

const DISCOVERY_SYSTEM = "You are a competitive intelligence researcher for FLO Technologies (smart water management: Flo by Moen shutoff, MUD property portal, RUBS submetering). Search the web to discover companies competing with FLO in both B2B (multifamily, proptech, utility billing) and B2C (homeowner leak detection, smart water). Include funded startups and new entrants. Return ONLY JSON: {\"discovered\":[{\"name\":\"Company\",\"segment\":\"B2B or B2C\",\"focus\":\"what they do\"}]}";

const RESEARCH_SYSTEM = "You are an autonomous competitive intelligence agent for FLO Technologies (smart water management). FLO Products: Flo by Moen Smart Water Shutoff (~$500), FloProtect plans ($5-15/mo), MUD Property Manager Portal (B2B multifamily), RUBS submetering. Research the competitor using web search. Return ONLY JSON: {\"competitor\":\"name\",\"segment\":\"B2B or B2C\",\"researchDate\":\"ISO date\",\"recentDevelopments\":[\"item\"],\"pricing\":\"summary\",\"strengths\":[\"s1\"],\"weaknesses\":[\"w1\"],\"floAdvantage\":\"edge\",\"threatLevel\":\"Low|Medium|High|Critical\",\"threatRationale\":\"one sentence\",\"strategicSignal\":\"most important thing FLO should know\",\"isNewEntrant\":false}";

const REPORT_SYSTEM = "You are a senior product strategist at FLO Technologies. Write a weekly executive report in markdown with these sections: ## Executive Summary ## New Market Entrants ## Top 3 Threats This Week ## Market Opportunities ## B2B Competitive Position ## B2C Competitive Position ## P0 Recommendations ## Watch List. Be specific and PM-crisp.";

async function runLoop(system, prompt) {
  var messages = [{ role: "user", content: prompt }];
  var i = 0;
  while (i < 8) {
    i++;
    var res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: system,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: messages
    });
    if (res.stop_reason === "end_turn") {
      return res.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("");
    }
    messages.push({ role: "assistant", content: res.content });
    var tools = res.content.filter(function(b) { return b.type === "tool_use"; });
    if (!tools.length) return res.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("");
    messages.push({ role: "user", content: tools.map(function(t) { return { type: "tool_result", tool_use_id: t.id, content: "Results returned." }; }) });
  }
  throw new Error("Max iterations");
}

async function discoverCompetitors(existingNames) {
  console.log("Discovering competitors dynamically...");
  var queries = [
    "Search for new and emerging companies competing with FLO Technologies in smart water management in 2025. Find funded startups, new products in B2B multifamily utility management and B2C home water leak detection.",
    "Search for new entrants funded startups proptech water management multifamily submetering smart home water 2024 2025 funding announcements product launches.",
    "FLO Technologies competitors smart water shutoff leak detection new companies 2025"
  ];
  var all = [];
  var seen = {};
  for (var q = 0; q < queries.length; q++) {
    try {
      var raw = await runLoop(DISCOVERY_SYSTEM, queries[q]);
      var match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        var parsed = JSON.parse(match[0]);
        if (parsed.discovered) {
          parsed.discovered.forEach(function(c) {
            var key = c.name.toLowerCase().trim();
            if (!seen[key]) { seen[key] = true; c.isNewEntrant = existingNames.indexOf(c.name) === -1; all.push(c); }
          });
        }
      }
    } catch(e) { console.error("Discovery query " + (q+1) + " failed: " + e.message); }
  }
  // Merge seeds
  SEED_B2B.forEach(function(name) { var k = name.toLowerCase(); if (!seen[k]) { seen[k]=true; all.push({ name:name, segment:"B2B", focus:"smart water B2B", isNewEntrant:false }); } });
  SEED_B2C.forEach(function(name) { var k = name.toLowerCase(); if (!seen[k]) { seen[k]=true; all.push({ name:name, segment:"B2C", focus:"smart water B2C", isNewEntrant:false }); } });
  var newOnes = all.filter(function(c) { return c.isNewEntrant; });
  console.log("Total: " + all.length + " competitors (" + newOnes.length + " new entrants)");
  newOnes.forEach(function(c) { console.log("  NEW: " + c.name + " (" + c.segment + ")"); });
  return all;
}

async function researchCompetitor(comp) {
  console.log("Researching " + comp.name + (comp.isNewEntrant ? " [NEW]" : "") + "...");
  var prompt = "Research competitor: " + comp.name + " (" + comp.segment + " - " + (comp.focus||"smart water") + "). " + (comp.isNewEntrant ? "This is a newly discovered competitor - give extra detail on what they do and why they threaten FLO. " : "") + "Use web search. Return JSON only.";
  var raw = await runLoop(RESEARCH_SYSTEM, prompt);
  var match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON for " + comp.name);
  var result = JSON.parse(match[0]);
  result.isNewEntrant = comp.isNewEntrant || false;
  return result;
}

async function main() {
  var scope = process.env.SCOPE || "full";
  console.log("FLO Dynamic CI Agent - scope: " + scope);

  // Load previously known competitors
  var existingNames = [];
  try {
    var prev = await supabase.from("reports").select("competitor_data").order("generated_at", { ascending: false }).limit(1);
    if (prev.data && prev.data.length && prev.data[0].competitor_data) {
      existingNames = prev.data[0].competitor_data.map(function(c) { return c.competitor; });
      console.log("Previously tracked: " + existingNames.length + " competitors");
    }
  } catch(e) { console.log("No previous data, starting fresh"); }

  // Dynamically discover competitors
  var discovered = await discoverCompetitors(existingNames);
  var toResearch = discovered.filter(function(c) {
    if (scope === "B2B") return c.segment === "B2B";
    if (scope === "B2C") return c.segment === "B2C";
    return true;
  });

  var results = [];
  var errors = [];
  for (var i = 0; i < toResearch.length; i++) {
    var comp = toResearch[i];
    console.log("[" + (i+1) + "/" + toResearch.length + "] " + comp.name);
    try {
      var d = await researchCompetitor(comp);
      results.push(d);
      console.log("  Threat: " + d.threatLevel);
    } catch(e) {
      console.error("  Failed: " + e.message);
      errors.push({ competitor: comp.name, error: e.message });
    }
    if (i < toResearch.length - 1) {
      console.log("Waiting 15s...");
      await new Promise(function(resolve) { setTimeout(resolve, 15000); });
    }
  }

  var executiveReport = "";
  try {
    var newCount = results.filter(function(r) { return r.isNewEntrant; }).length;
    var res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 1000, system: REPORT_SYSTEM,
      messages: [{ role: "user", content: "Research data (" + results.length + " competitors, " + newCount + " new entrants):\n" + JSON.stringify(results, null, 2) + "\n\nGenerate the executive report." }]
    });
    executiveReport = res.content.map(function(b) { return b.text || ""; }).join("");
    console.log("Executive report generated");
  } catch(e) { errors.push({ step: "report_synthesis", error: e.message }); }

  var ins = await supabase.from("reports").insert({ generated_at: new Date().toISOString(), scope: scope, competitor_data: results, executive_report: executiveReport, errors: errors });
  if (ins.error) { console.error("Supabase error:", ins.error.message); process.exit(1); }

  var all = await supabase.from("reports").select("id").order("generated_at", { ascending: false });
  if (all.data && all.data.length > 10) await supabase.from("reports").delete().in("id", all.data.slice(10).map(function(r) { return r.id; }));

  console.log("Done! " + results.length + " competitors, " + results.filter(function(r){return r.isNewEntrant;}).length + " new entrants found.");
}

main().catch(function(e) { console.error(e); process.exit(1); });
