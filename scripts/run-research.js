const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");
const { COMPETITORS } = require("./competitors");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const RESEARCH_SYSTEM = `You are an autonomous competitive intelligence agent for FLO Technologies (smart water management).
FLO Products: Flo by Moen Smart Water Shutoff (~$500), Flo Smart Water Monitor, FloProtect plans ($5-15/mo), MUD Property Manager Portal (B2B multifamily), RUBS submetering.
Research the given competitor using web search. Find recent product updates/pricing (last 90 days), current pricing, key strengths vs FLO, weaknesses vs FLO, strategic moves.
Return ONLY a valid JSON object, no markdown, no code fences:
{"competitor":"name","segment":"B2B or B2C","researchDate":"ISO date","recentDevelopments":["item"],"pricing":"summary","strengths":["s1"],"weaknesses":["w1"],"floAdvantage":"FLO edge","threatLevel":"Low|Medium|High|Critical","threatRationale":"one sentence","strategicSignal":"most important thing FLO should know"}`;

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
  console.log("  Researching " + competitor.name + "...");
  const messages = [{ role: "user", content: "Research competitor: " + competitor.name + " (" + segment + " - " + competitor.focus + "). Use web search. Return JSON only." }];
  let iterations = 0;
  while (iterations < 8) {
    iterations++;
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: RESEARCH_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages
    });
    if (res.stop_reason === "end_turn") {
      const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON for " + competitor.name);
      return JSON.parse(match[0]);
    }
    messages.push({ role: "assistant", content: res.content });
    const toolUses = res.content.filter(b => b.type === "tool_use");
    if (!toolUses.length) {
      const text = res.content.filter(b => b.type === "text").map(
