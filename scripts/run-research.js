const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── HARDCODED SEEDS ──────────────────────────────────────────────────────────
// Always researched every run. Competitors that appear as new entrants in 2+
// consecutive runs get auto-promoted and stored in Supabase (promoted_seeds),
// which is merged with these at runtime — no code changes needed.

const SEED_B2B = [
  { name: "Phyn Plus",                  segment: "B2B", subSegment: "Pro/Plumber",  focus: "plumber-installed smart water monitoring" },
  { name: "Resideo Leak Defense",       segment: "B2B", subSegment: "Pro/Plumber",  focus: "pro-installed leak detection and water shutoff" },
  { name: "SmartRent",                  segment: "B2B", subSegment: "Multi Family", focus: "smart home automation for multifamily operators" },
  { name: "Yardi Utility Management",   segment: "B2B", subSegment: "Multi Family", focus: "utility billing and submetering for multifamily" },
  { name: "RealPage Utility Management",segment: "B2B", subSegment: "Multi Family", focus: "utility management and RUBS for multifamily" },
  { name: "Conservice",                 segment: "B2B", subSegment: "Multi Family", focus: "utility billing outsourcing for multifamily" },
  { name: "Itron",                      segment: "B2B", subSegment: "Utility",      focus: "smart metering and utility data management" },
  { name: "Badger Meter",               segment: "B2B", subSegment: "Utility",      focus: "smart water meters and AMI for utilities" },
  { name: "Roost",                      segment: "B2B", subSegment: "Insurance",    focus: "smart home sensors distributed through insurance carriers" },
  { name: "Ting (Whisker Labs)",        segment: "B2B", subSegment: "Insurance",    focus: "fire and water risk monitoring via insurance programs" },
  { name: "WaterSignal",                segment: "B2B", subSegment: "Enterprise",   focus: "water leak detection for commercial facilities" },
  { name: "Aquicore",                   segment: "B2B", subSegment: "Enterprise",   focus: "water and energy monitoring for commercial real estate" },
];

const SEED_B2C = [
  { name: "Phyn Plus",         segment: "B2C", subSegment: null, focus: "consumer smart water monitoring" },
  { name: "Grohe Sense Guard", segment: "B2C", subSegment: null, focus: "consumer leak detection" },
  { name: "LeakSmart",         segment: "B2C", subSegment: null, focus: "consumer shutoff" },
  { name: "Govee Water Sensor",segment: "B2C", subSegment: null, focus: "low-cost consumer leak sensor" },
  { name: "Alert Labs",        segment: "B2C", subSegment: null, focus: "consumer water monitoring" },
];

const B2B_SUB_SEGMENTS = ["Pro/Plumber", "Multi Family", "Utility", "Insurance", "Enterprise"];

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

const DISCOVERY_SYSTEM = `You are a competitive intelligence researcher for FLO Technologies (smart water management: Flo by Moen shutoff, MUD property portal, RUBS submetering).

Find NEW companies NOT on the exclusion list. Focus on funded startups, 2024-2025 product launches, and emerging players.

B2B sub-segments:
- Pro/Plumber: smart water monitoring sold through professional plumber install/service channels
- Multi Family: multifamily operators (Greystar, NationalCore) — utility mgmt, submetering, smart water
- Utility: partnerships with water utilities and municipalities — AMI, smart metering, leak detection programs
- Insurance: partnerships with insurance carriers — hardware bundles, app integrations, monitoring services
- Enterprise: commercial buildings — restaurants, dental offices, data centers, hotels

Return ONLY valid JSON, no markdown:
{"discovered":[{"name":"Company","segment":"B2B or B2C","subSegment":"Pro/Plumber|Multi Family|Utility|Insurance|Enterprise|null","focus":"one sentence"}]}`;

const RESEARCH_SYSTEM = `You are an autonomous competitive intelligence agent for FLO Technologies.

FLO Products: Flo by Moen Smart Water Shutoff (~$500), FloProtect plans ($5-15/mo), MUD Property Manager Portal (B2B multifamily), RUBS submetering.

Research this competitor thoroughly using web search. Provide a complete SWOT analysis from FLO's perspective:
- Strengths: what this competitor does well that threatens FLO
- Weaknesses: gaps or vulnerabilities FLO can exploit  
- Opportunities: market gaps this competitor reveals that FLO could capture
- Threats: specific ways this competitor damages or could damage FLO's position

For B2B, focus on commercialization model per sub-segment:
- Pro/Plumber: how revenue flows through plumbers (reseller / installer / service contract)
- Multi Family: per-unit or per-property pricing, operator relationships
- Utility: program structure, municipality contracts, rate basis
- Insurance: carrier distribution model, hardware bundle vs app integration
- Enterprise: verticals served, contract structure, ACV

Return ONLY valid JSON, no markdown:
{
  "competitor": "name",
  "segment": "B2B or B2C",
  "subSegment": "Pro/Plumber|Multi Family|Utility|Insurance|Enterprise|null",
  "researchDate": "ISO date",
  "recentDevelopments": ["item1"],
  "pricing": "pricing summary",
  "commercializationModel": "how they make money in this channel",
  "strengths": ["s1", "s2"],
  "weaknesses": ["w1", "w2"],
  "opportunities": ["o1", "o2"],
  "threats": ["t1", "t2"],
  "floAdvantage": "FLO's key edge over this competitor",
  "threatLevel": "Low|Medium|High|Critical",
  "threatRationale": "one sentence why",
  "strategicSignal": "most important thing FLO leadership should know right now",
  "isNewEntrant": false
}`;

const REPORT_SYSTEM = `You are a senior product strategist at FLO Technologies writing the weekly competitive intelligence briefing.

Be specific — name companies, cite signals, call out commercialization models. No generic filler.

## Executive Summary
2-3 sentences on what matters most this week.

## New Market Entrants
Newly discovered companies this run with a one-liner on why each matters to FLO.

## Top Threats This Week
Top 3-5 by threat level with rationale.

## SWOT Summary for FLO
### Strengths to Leverage
### Weaknesses to Address
### Opportunities to Capture
### Threats to Monitor

## B2B Competitive Landscape
### Pro/Plumber Channel
### Multi Family
### Utility Partnerships
### Insurance Partnerships
### Enterprise Business

## B2C Competitive Landscape

## P0 Recommendations
3-5 specific, actionable items.

## Watch List
Emerging names to track over the next 30 days.`;

// ─── AGENTIC LOOP ─────────────────────────────────────────────────────────────

async function runLoop(system, prompt) {
  var messages = [{ role: "user", content: prompt }];
  var i = 0;
  while (i < 8) {
    i++;
    var res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
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
    messages.push({ role: "user", content: tools.map(function(t) { return { type: "tool_result", tool_use_id: t.id, content: "Search results returned." }; }) });
  }
  throw new Error("Max iterations reached");
}

// ─── PROMOTED SEEDS ───────────────────────────────────────────────────────────
// Supabase table: promoted_seeds
// Schema: name text PK, segment text, sub_segment text, focus text, first_seen text, run_count int

async function loadPromotedSeeds() {
  try {
    var res = await supabase.from("promoted_seeds").select("*");
    if (res.error) { console.log("Note: promoted_seeds table not found, skipping"); return []; }
    var promoted = (res.data || []).filter(function(r) { return r.run_count >= 2; });
    return promoted.map(function(r) {
      return { name: r.name, segment: r.segment, subSegment: r.sub_segment, focus: r.focus, isNewEntrant: false, autoPromoted: true };
    });
  } catch(e) { console.log("Could not load promoted seeds: " + e.message); return []; }
}

async function updatePromotedSeeds(newEntrantResults) {
  if (!newEntrantResults.length) return;
  for (var i = 0; i < newEntrantResults.length; i++) {
    var r = newEntrantResults[i];
    var name = r.competitor;
    try {
      var existing = await supabase.from("promoted_seeds").select("run_count").eq("name", name).single();
      if (existing.data) {
        var newCount = (existing.data.run_count || 1) + 1;
        await supabase.from("promoted_seeds").update({ run_count: newCount }).eq("name", name);
        if (newCount >= 2) console.log("  AUTO-PROMOTED to seeds: " + name + " (seen in " + newCount + " runs)");
      } else {
        await supabase.from("promoted_seeds").insert({
          name: name,
          segment: r.segment,
          sub_segment: r.subSegment || null,
          focus: r.strategicSignal || "",
          first_seen: new Date().toISOString(),
          run_count: 1
        });
        console.log("  Tracked new entrant for promotion: " + name + " (1/2 runs needed)");
      }
    } catch(e) { console.error("  promoted_seeds update failed for " + name + ": " + e.message); }
  }
}

// ─── DISCOVERY ────────────────────────────────────────────────────────────────

const DISCOVERY_QUERIES = {
  "Pro/Plumber": [
    "new companies 2024 2025 smart water monitoring plumber installer channel professional service partner program funding",
    "startup plumber partnership smart home water leak detection installer revenue share program 2025",
    "companies commercializing smart water shutoff through plumbers service channel new entrant 2025"
  ],
  "Multi Family": [
    "new proptech startup 2024 2025 multifamily water monitoring submetering utility management series A funding",
    "multifamily smart water leak detection Greystar NationalCore RealPage new vendor 2025",
    "apartment utility billing submetering new entrant startup funding announcement 2024 2025"
  ],
  "Utility": [
    "new startup 2024 2025 water utility smart metering AMI leak detection municipality partnership",
    "water utility digital transformation startup funding smart metering conservation 2025",
    "companies partnering water utilities municipalities leak detection new product launch 2025"
  ],
  "Insurance": [
    "new startup 2024 2025 homeowners insurance water monitoring hardware partnership carrier distribution",
    "insurtech water leak sensor insurance bundled smart home company funding 2025",
    "home insurance water damage prevention technology new company partnership carrier 2025"
  ],
  "Enterprise": [
    "new startup 2024 2025 commercial building water monitoring leak detection restaurants hotels data centers",
    "enterprise water management IoT commercial facility startup series funding 2025",
    "smart water monitoring commercial real estate dental office restaurant new company 2025"
  ],
  "B2C": [
    "new consumer smart water sensor leak detection startup funding 2024 2025",
    "home water monitoring device new product launch consumer 2025",
    "smart home water leak detection new entrant company 2025"
  ]
};

async function discoverNewEntrants(allSeedNames, scope) {
  console.log("\nDiscovery phase — targeting 3+ new entrants per bucket...");
  var discovered = [];
  var seen = {};
  allSeedNames.forEach(function(n) { seen[n.toLowerCase()] = true; });

  var buckets = scope === "B2C"   ? ["B2C"] :
                scope === "B2B"   ? B2B_SUB_SEGMENTS :
                B2B_SUB_SEGMENTS.indexOf(scope) !== -1 ? [scope] :
                B2B_SUB_SEGMENTS.concat(["B2C"]); // full

  for (var b = 0; b < buckets.length; b++) {
    var bucket = buckets[b];
    var queries = DISCOVERY_QUERIES[bucket] || [];
    var bucketFound = [];
    console.log("  [" + bucket + "] searching...");

    for (var q = 0; q < queries.length; q++) {
      if (bucketFound.length >= 3) break;
      var prompt = queries[q] + "\n\nExclusion list (do NOT return these): " + allSeedNames.join(", ") + ". Return only new companies not on this list.";
      try {
        var raw = await runLoop(DISCOVERY_SYSTEM, prompt);
        var match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          var parsed = JSON.parse(match[0]);
          (parsed.discovered || []).forEach(function(c) {
            var key = c.name.toLowerCase().trim();
            if (!seen[key]) {
              seen[key] = true;
              c.isNewEntrant = true;
              c.segment = bucket === "B2C" ? "B2C" : "B2B";
              c.subSegment = bucket === "B2C" ? null : bucket;
              bucketFound.push(c);
            }
          });
        }
      } catch(e) { console.error("    Query " + (q+1) + " failed: " + e.message); }
    }

    var note = bucketFound.length >= 3 ? " ✓" : " (found " + bucketFound.length + ", target 3 — okay)";
    console.log("  [" + bucket + "] " + bucketFound.length + " new entrant(s)" + note);
    discovered = discovered.concat(bucketFound);
  }

  return discovered;
}

// ─── RESEARCH ─────────────────────────────────────────────────────────────────

async function researchCompetitor(comp) {
  var label = comp.name + " [" + comp.segment + (comp.subSegment ? "/" + comp.subSegment : "") + "]" + (comp.isNewEntrant ? " [NEW]" : comp.autoPromoted ? " [PROMOTED]" : "");
  console.log("  " + label);
  var subCtx = comp.subSegment ? " Sub-segment focus: " + comp.subSegment + "." : "";
  var newCtx = comp.isNewEntrant ? " This is a newly discovered competitor — provide extra detail on what they do and why they are a threat to FLO." : "";
  var prompt = "Research competitor: " + comp.name + " (" + comp.segment + " — " + (comp.focus || "smart water management") + ")." + subCtx + newCtx + " Use web search. Return JSON only.";
  var raw = await runLoop(RESEARCH_SYSTEM, prompt);
  var match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON for " + comp.name);
  var result = JSON.parse(match[0]);
  result.isNewEntrant = comp.isNewEntrant || false;
  result.subSegment = result.subSegment || comp.subSegment || null;
  return result;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  var scope = process.env.SCOPE || "full";
  console.log("FLO CI Agent — scope: " + scope);
  console.log("=".repeat(50));

  // 1. Merge hardcoded seeds + auto-promoted seeds from Supabase
  var promoted = await loadPromotedSeeds();
  if (promoted.length) console.log("Loaded " + promoted.length + " auto-promoted seed(s) from previous runs");

  var allSeeds = SEED_B2B.concat(SEED_B2C).concat(promoted);
  var seedMap = {};
  allSeeds = allSeeds.filter(function(s) { var k = s.name.toLowerCase(); if (seedMap[k]) return false; seedMap[k] = true; return true; });

  // Filter by scope
  var seedsToResearch = allSeeds.filter(function(s) {
    if (scope === "B2B") return s.segment === "B2B";
    if (scope === "B2C") return s.segment === "B2C";
    if (B2B_SUB_SEGMENTS.indexOf(scope) !== -1) return s.segment === "B2B" && s.subSegment === scope;
    return true;
  });

  var allSeedNames = allSeeds.map(function(s) { return s.name; });
  console.log("Seeds to research: " + seedsToResearch.length);

  // 2. Discover new entrants (3+ per bucket target)
  var newEntrants = await discoverNewEntrants(allSeedNames, scope);
  console.log("New entrants to research: " + newEntrants.length);

  // 3. Research everything: seeds + new entrants
  var toResearch = seedsToResearch.concat(newEntrants);
  console.log("\nTotal to research: " + toResearch.length);
  console.log("=".repeat(50));

  var results = [];
  var errors = [];

  for (var i = 0; i < toResearch.length; i++) {
    var comp = toResearch[i];
    console.log("[" + (i + 1) + "/" + toResearch.length + "] " + comp.name);
    try {
      var d = await researchCompetitor(comp);
      results.push(d);
      console.log("    → Threat: " + d.threatLevel);
    } catch(e) {
      console.error("    → Failed: " + e.message);
      errors.push({ competitor: comp.name, error: e.message });
    }
    if (i < toResearch.length - 1) {
      await new Promise(function(r) { setTimeout(r, 30000); });
    }
  }

  // 4. Auto-promote new entrants seen in 2+ runs
  var newEntrantResults = results.filter(function(r) { return r.isNewEntrant; });
  if (newEntrantResults.length) {
    console.log("\nUpdating promotion tracker for " + newEntrantResults.length + " new entrant(s)...");
    await updatePromotedSeeds(newEntrantResults);
  }

  // 5. Generate executive report (seeds + new entrants combined)
  var executiveReport = "";
  var seedCount = results.filter(function(r) { return !r.isNewEntrant; }).length;
  var newCount = newEntrantResults.length;
  try {
    var res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: REPORT_SYSTEM,
      messages: [{ role: "user", content: "Weekly CI data: " + seedCount + " seeded competitors + " + newCount + " newly discovered.\n\n" + JSON.stringify(results, null, 2) + "\n\nGenerate the executive report." }]
    });
    executiveReport = res.content.map(function(b) { return b.text || ""; }).join("");
    console.log("\nExecutive report generated");
  } catch(e) {
    console.error("Report generation failed: " + e.message);
    errors.push({ step: "report_synthesis", error: e.message });
  }

  // 6. Persist to Supabase
  var ins = await supabase.from("reports").insert({
    generated_at: new Date().toISOString(),
    scope: scope,
    competitor_data: results,
    executive_report: executiveReport,
    errors: errors
  });
  if (ins.error) { console.error("Supabase error:", ins.error.message); process.exit(1); }

  // Prune to last 10 reports
  var all = await supabase.from("reports").select("id").order("generated_at", { ascending: false });
  if (all.data && all.data.length > 10) {
    await supabase.from("reports").delete().in("id", all.data.slice(10).map(function(r) { return r.id; }));
  }

  console.log("\n" + "=".repeat(50));
  console.log("Done. " + results.length + " researched (" + seedCount + " seeds + " + newCount + " new entrants). " + errors.length + " error(s).");
}

main().catch(function(e) { console.error(e); process.exit(1); });
