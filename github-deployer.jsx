import { useState } from "react";

const OWNER = "SyedShahid-FBIN";
const REPO = "flo-ci-agent";
const TOKEN = "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";

const FILES = [
  {
    path: "README.md",
    content: `# FLO Competitive Intelligence Agent
### 100% Free · GitHub Actions · Supabase · GitHub Pages

Autonomous competitive intelligence agent for FLO Technologies. Researches 13 competitors across B2B and B2C smart water management every Monday, generates executive reports, and serves them via a shareable dashboard.

## Setup Steps
1. Enable GitHub Pages: Settings → Pages → Branch: main, Folder: /docs
   ⚠️ GitHub Pages for private repos requires a paid GitHub plan (Pro/Team/Enterprise Cloud). Use a public repo on a free account.
2. Create Supabase project at supabase.com, run supabase-setup.sql
3. Add secrets: Settings → Secrets → Actions → ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY
4. Trigger first run: Actions → FLO Competitive Intelligence Agent → Run workflow

## Dashboard URL
https://SyedShahid-FBIN.github.io/flo-ci-agent

## Cost
- GitHub Actions: Free
- GitHub Pages: Free (public repo) / Paid plan required (private repo)
- Supabase: Free
- Anthropic API: ~$0.20/week
`
  },
  {
    path: "supabase-setup.sql",
    content: `-- Run this in your Supabase project → SQL Editor → New Query

create table if not exists reports (
  id           bigserial primary key,
  generated_at timestamptz not null default now(),
  scope        text not null default 'full',
  competitor_data jsonb not null default '[]',
  executive_report text not null default '',
  errors       jsonb not null default '[]'
);

alter table reports enable row level security;

create policy "Public read" on reports
  for select using (true);

create policy "Service insert" on reports
  for insert with check (true);

create policy "Service delete" on reports
  for delete using (true);
`
  },
  {
    path: "scripts/package.json",
    content: `{
  "name": "flo-ci-scripts",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "@supabase/supabase-js": "^2.44.0"
  }
}
`
  },
  {
    path: "scripts/competitors.js",
    content: `const COMPETITORS = {
  B2B: [
    { name: "SmartRent", focus: "smart home automation for multifamily" },
    { name: "Quext IoT", focus: "IoT platform for multifamily properties" },
    { name: "Yardi Utility Management", focus: "utility billing and submetering" },
    { name: "RealPage Utility Management", focus: "utility management and RUBS billing" },
    { name: "Conservice", focus: "utility management services for multifamily" },
    { name: "Livable", focus: "utility billing and cost recovery for landlords" },
    { name: "Ratio Utilities", focus: "submetering and utility management" },
  ],
  B2C: [
    { name: "Phyn Plus", focus: "smart water monitoring for homeowners" },
    { name: "Grohe Sense Guard", focus: "leak detection and water shutoff" },
    { name: "Resideo Leak Defense", focus: "water leak detection home automation" },
    { name: "Leak Smart", focus: "automatic water shutoff valve" },
    { name: "Govee Water Sensor", focus: "affordable water leak sensors" },
    { name: "Alert Labs", focus: "water monitoring for insurance and property" },
  ],
};

module.exports = { COMPETITORS };
`
  },
  {
    path: "scripts/build-dashboard.js",
    content: `const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  console.log("Building dashboard data...");
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(10);

  if (error) { console.error("Failed to fetch reports:", error.message); process.exit(1); }

  const settings = reports.length
    ? { lastRun: reports[0].generated_at, scope: reports[0].scope }
    : { lastRun: null };

  const output = { reports: reports || [], settings, builtAt: new Date().toISOString() };
  const outPath = path.join(__dirname, "../docs/data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log("Written " + reports.length + " reports to docs/data.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
`
  },
  {
    path: "scripts/run-research.js",
    content: `const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");
const { COMPETITORS } = require("./competitors");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const RESEARCH_SYSTEM = \`You are an autonomous competitive intelligence agent for FLO Technologies (smart water management).
FLO Products: Flo by Moen Smart Water Shutoff (~$500), Flo Smart Water Monitor, FloProtect plans ($5-15/mo), MUD Property Manager Portal (B2B multifamily), RUBS submetering.
Research the given competitor using web search. Find recent product updates/pricing (last 90 days), current pricing, key strengths vs FLO, weaknesses vs FLO, strategic moves.
Return ONLY a valid JSON object, no markdown, no code fences:
{"competitor":"name","segment":"B2B or B2C","researchDate":"ISO date","recentDevelopments":["item"],"pricing":"summary","strengths":["s1"],"weaknesses":["w1"],"floAdvantage":"FLO edge","threatLevel":"Low|Medium|High|Critical","threatRationale":"one sentence","strategicSignal":"most important thing FLO should know"}\`;

const REPORT_SYSTEM = \`You are a senior product strategist at FLO Technologies. Given competitive research data, write a weekly executive report in markdown:
## Executive Summary
## Top 3 Threats This Week
## Market Opportunities
## B2B Competitive Position
## B2C Competitive Position
## P0 Recommendations
## Watch List
Be specific, PM-crisp, action-oriented.\`;

async function researchCompetitor(competitor, segment) {
  console.log("  Researching " + competitor.name + "...");
  const messages = [{ role: "user", content: "Research competitor: " + competitor.name + " (" + segment + " - " + competitor.focus + "). Use web search. Return JSON only." }];
  let iterations = 0;
  while (iterations < 8) {
    iterations++;
    const res = await anthropic.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: RESEARCH_SYSTEM, tools: [{ type: "web_search_20250305", name: "web_search" }], messages });
    if (res.stop_reason === "end_turn") {
      const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
      const match = text.match(/\\{[\\s\\S]*\\}/);
      if (!match) throw new Error("No JSON for " + competitor.name);
      return JSON.parse(match[0]);
    }
    messages.push({ role: "assistant", content: res.content });
    const toolUses = res.content.filter(b => b.type === "tool_use");
    if (!toolUses.length) {
      const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
      const match = text.match(/\\{[\\s\\S]*\\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Unexpected stop for " + competitor.name);
    }
    messages.push({ role: "user", content: toolUses.map(t => ({ type: "tool_result", tool_use_id: t.id, content: "Results returned." })) });
  }
  throw new Error("Max iterations for " + competitor.name);
}

async function generateReport(competitorData) {
  const res = await anthropic.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: REPORT_SYSTEM,
    messages: [{ role: "user", content: "Research data:\\n" + JSON.stringify(competitorData, null, 2) + "\\n\\nGenerate the executive report." }] });
  return res.content.map(b => b.text || "").join("");
}

async function main() {
  const scope = process.env.SCOPE || "full";
  console.log("FLO CI Agent starting — scope: " + scope);
  const toResearch = [];
  if (scope !== "B2C") COMPETITORS.B2B.forEach(c => toResearch.push({ ...c, segment: "B2B" }));
  if (scope !== "B2B") COMPETITORS.B2C.forEach(c => toResearch.push({ ...c, segment: "B2C" }));

  const results = [], errors = [];
  for (let i = 0; i < toResearch.length; i++) {
    const comp = toResearch[i];
    console.log("[" + (i+1) + "/" + toResearch.length + "] " + comp.name);
    try { const d = await researchCompetitor(comp, comp.segment); results.push(d); console.log("  Threat: " + d.threatLevel); }
    catch(e) { console.error("  Failed: " + e.message); errors.push({ competitor: comp.name, error: e.message }); }
  }

  let executiveReport = "";
  try { executiveReport = await generateReport(results); }
  catch(e) { errors.push({ step: "report_synthesis", error: e.message }); }

  const { error } = await supabase.from("reports").insert({ generated_at: new Date().toISOString(), scope, competitor_data: results, executive_report: executiveReport, errors });
  if (error) { console.error("Supabase error:", error.message); process.exit(1); }

  const { data: all } = await supabase.from("reports").select("id").order("generated_at", { ascending: false });
  if (all && all.length > 10) await supabase.from("reports").delete().in("id", all.slice(10).map(r => r.id));

  console.log("Done! " + results.length + " competitors analyzed.");
}

main().catch(e => { console.error(e); process.exit(1); });
`
  },
  {
    path: ".github/workflows/research.yml",
    content: `name: FLO Competitive Intelligence Agent

on:
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:
    inputs:
      scope:
        description: "Research scope"
        required: false
        default: "full"
        type: choice
        options:
          - full
          - B2B
          - B2C

jobs:
  run-research:
    name: Run Competitive Research
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: write
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: scripts/package.json
      - name: Install dependencies
        run: cd scripts && npm ci
      - name: Run research agent
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: \${{ secrets.SUPABASE_KEY }}
          SCOPE: \${{ github.event.inputs.scope || 'full' }}
        run: cd scripts && node run-research.js
      - name: Rebuild dashboard data
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: \${{ secrets.SUPABASE_KEY }}
        run: cd scripts && node build-dashboard.js
      - name: Commit updated dashboard
        run: |
          git config --global user.name "FLO CI Agent"
          git config --global user.email "ci-agent@flo.local"
          git add docs/data.json
          git diff --staged --quiet || git commit -m "chore: update CI data [\$(date -u '+%Y-%m-%d')]"
          git push
`
  },
  {
    path: "docs/data.json",
    content: `{"reports":[],"settings":{"lastRun":null},"builtAt":null}
`
  },
  {
    path: "docs/index.html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FLO Competitive Intelligence</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .tab-on  { border-bottom: 2px solid #2563eb; color: #2563eb; }
    .tab-off { border-bottom: 2px solid transparent; color: #64748b; }
    .badge-Critical { background:#fee2e2; color:#b91c1c; }
    .badge-High     { background:#ffedd5; color:#c2410c; }
    .badge-Medium   { background:#fef9c3; color:#a16207; }
    .badge-Low      { background:#dcfce7; color:#15803d; }
  </style>
</head>
<body class="bg-slate-50 h-screen flex flex-col overflow-hidden">
<div class="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-white font-bold shadow">FLO</div>
    <div>
      <div class="font-bold text-slate-800">Competitive Intelligence Agent</div>
      <div class="text-xs text-slate-400">Autonomous · GitHub Actions · Supabase · 100% Free</div>
    </div>
  </div>
  <div class="flex items-center gap-3">
    <div id="last-run" class="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full hidden"></div>
    <a href="https://github.com/SyedShahid-FBIN/flo-ci-agent/actions/workflows/research.yml" target="_blank"
      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">▶ Trigger Run</a>
  </div>
</div>
<div class="bg-white border-b border-slate-200 px-5 flex flex-shrink-0">
  <button onclick="setTab('dashboard')" id="tab-dashboard" class="px-4 py-2.5 text-sm font-medium tab-on">📊 Dashboard</button>
  <button onclick="setTab('report')"    id="tab-report"    class="px-4 py-2.5 text-sm font-medium tab-off">📋 Report</button>
  <button onclick="setTab('landscape')" id="tab-landscape" class="px-4 py-2.5 text-sm font-medium tab-off">🗺 Landscape</button>
  <button onclick="setTab('history')"   id="tab-history"   class="px-4 py-2.5 text-sm font-medium tab-off">📅 History</button>
</div>
<div class="flex-1 overflow-y-auto" id="content">
  <div class="flex items-center justify-center h-full text-slate-400"><div class="text-center"><div class="text-5xl mb-3">⏳</div><p>Loading...</p></div></div>
</div>
<script>
const META = { B2B:["SmartRent","Quext IoT","Yardi Utility Management","RealPage Utility Management","Conservice","Livable","Ratio Utilities"], B2C:["Phyn Plus","Grohe Sense Guard","Resideo Leak Defense","Leak Smart","Govee Water Sensor","Alert Labs"] };
let S = { reports:[], settings:{}, tab:"dashboard", selReport:null, selComp:null, seg:"B2B" };

async function init() {
  try {
    const r = await fetch("data.json?t="+Date.now());
    const d = await r.json();
    S.reports = d.reports||[]; S.settings = d.settings||{};
    if (S.reports.length) S.selReport = S.reports[0];
    if (S.settings.lastRun) {
      const el = document.getElementById("last-run");
      const days = Math.max(0,Math.ceil((new Date(S.settings.lastRun).getTime()+7*86400000-Date.now())/86400000));
      el.textContent = "Last run "+new Date(S.settings.lastRun).toLocaleDateString()+" · Next in "+days+"d";
      el.classList.remove("hidden");
    }
  } catch(e) { console.error(e); }
  render();
}

function badge(l) { return '<span class="text-xs px-2 py-0.5 rounded-full font-semibold badge-'+l+'">'+l+'</span>'; }
function fmt(d) { return new Date(d).toLocaleDateString(); }
function fmtFull(d) { return new Date(d).toLocaleString(); }
function mdRender(text) {
  if (!text) return "<p class='text-slate-400 text-sm'>No content.</p>";
  return text.split("\\n").map(line => {
    if (line.startsWith("## ")) return '<h2 class="text-base font-bold text-slate-800 mt-4 mb-1 pt-3 border-t border-slate-100">'+line.slice(3)+'</h2>';
    if (line.startsWith("### ")) return '<h3 class="text-sm font-semibold text-slate-700 mt-3 mb-1">'+line.slice(4)+'</h3>';
    if (line.match(/^\\d+\\.\\s/)) return '<p class="text-sm text-slate-700 ml-3 my-0.5">'+line+'</p>';
    if (line.startsWith("- ")) return '<div class="flex gap-2 ml-3 my-0.5"><span class="text-blue-400 text-xs mt-1">●</span><span class="text-sm text-slate-700">'+line.slice(2)+'</span></div>';
    if (!line.trim()) return '<div class="h-1"></div>';
    return '<p class="text-sm text-slate-700 leading-relaxed my-0.5">'+line+'</p>';
  }).join("");
}

function setTab(t) {
  S.tab = t;
  ["dashboard","report","landscape","history"].forEach(id => document.getElementById("tab-"+id).className="px-4 py-2.5 text-sm font-medium "+(t===id?"tab-on":"tab-off"));
  render();
}

function render() {
  const c = document.getElementById("content");
  const latest = S.reports[0];
  const highs = latest?.competitor_data?.filter(x=>x.threatLevel==="Critical"||x.threatLevel==="High")||[];
  const total = META.B2B.length+META.B2C.length;
  if (S.tab==="dashboard") {
    c.innerHTML = '<div class="p-5 space-y-4">'+
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+
      [{l:"Tracked",v:total,s:META.B2B.length+" B2B · "+META.B2C.length+" B2C",col:"blue"},{l:"Reports",v:S.reports.length,s:S.reports.length?"Last "+fmt(S.reports[0].generated_at):"None yet",col:"purple"},{l:"High Threats",v:highs.length,s:highs.map(x=>x.competitor).slice(0,2).join(", ")||"Run to detect",col:"red"},{l:"Next Cron",v:S.settings.lastRun?"Soon":"Now",s:"Every Mon 9am UTC",col:"green"}]
      .map(card=>'<div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"><div class="text-3xl font-bold text-'+card.col+'-600">'+card.v+'</div><div class="text-xs font-semibold text-slate-700 mt-1">'+card.l+'</div><div class="text-xs text-slate-400 mt-0.5 truncate">'+card.s+'</div></div>').join("")+
      '</div><div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"><div class="font-semibold text-sm mb-2">Trigger a Manual Run</div><p class="text-xs text-slate-500 mb-3">Go to GitHub Actions → Run workflow → choose scope.</p><a href="https://github.com/SyedShahid-FBIN/flo-ci-agent/actions/workflows/research.yml" target="_blank" class="inline-block bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Open GitHub Actions ↗</a><p class="text-xs text-slate-400 mt-2">Also runs automatically every Monday at 9am UTC.</p></div>'+
      '<div class="grid grid-cols-2 gap-4">'+["B2B","B2C"].map(seg=>'<div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"><div class="font-semibold text-sm mb-3">'+(seg==="B2B"?"🏢 B2B":"🏠 B2C")+'</div>'+META[seg].map(name=>{const d=latest?.competitor_data?.find(x=>x.competitor===name);return'<div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded px-1" onclick="'+(d?'pickComp('+JSON.stringify(JSON.stringify(d))+')':"")+'"><span class="text-sm font-medium">'+name+'</span>'+(d?badge(d.threatLevel):'<span class="text-xs text-slate-300">Pending</span>')+'</div>';}).join("")+'</div>').join("")+'</div>'+
      (!latest?'<div class="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center"><div class="text-5xl mb-3">🤖</div><div class="font-bold text-blue-800 text-lg mb-1">Agent Ready</div><div class="text-sm text-blue-600">No runs yet. Add your secrets then trigger the first run from GitHub Actions.</div></div>':"")+
      '</div>';
  } else if (S.tab==="report") {
    if (!S.selReport) { c.innerHTML='<div class="flex flex-col items-center justify-center h-64 text-slate-400 text-center"><div class="text-4xl mb-3">📋</div><p>No reports yet.</p></div>'; return; }
    c.innerHTML='<div class="p-5"><div class="flex items-center justify-between mb-4"><div><h2 class="font-bold text-lg">Weekly Competitive Intelligence Report</h2><div class="text-sm text-slate-400">Generated '+fmtFull(S.selReport.generated_at)+' · '+(S.selReport.competitor_data?.length||0)+' competitors · '+S.selReport.scope+'</div></div>'+(S.reports.length>1?'<select onchange="pickReport(this.value)" class="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">'+S.reports.map((r,i)=>'<option value="'+i+'" '+(i===S.reports.indexOf(S.selReport)?"selected":"")+'>'+( i===0?"Latest — ":"")+fmt(r.generated_at)+'</option>').join("")+'</select>':"")+'</div><div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">'+mdRender(S.selReport.executive_report)+'</div></div>';
  } else if (S.tab==="landscape") {
    if (!latest?.competitor_data?.length) { c.innerHTML='<div class="flex flex-col items-center justify-center h-64 text-slate-400 text-center"><div class="text-4xl mb-3">🗺</div><p>Run the agent to populate.</p></div>'; return; }
    const seg = latest.competitor_data.filter(x=>x.segment===S.seg);
    c.innerHTML='<div class="p-5"><div class="grid grid-cols-3 gap-4"><div class="col-span-1"><div class="flex gap-2 mb-3">'+["B2B","B2C"].map(s=>'<button onclick="setSeg(\''+s+'\')" class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors '+(S.seg===s?"bg-blue-600 text-white":"bg-white border border-slate-200 text-slate-600")+'">'+s+'</button>').join("")+'</div>'+seg.map(comp=>'<div onclick="pickComp('+JSON.stringify(JSON.stringify(comp))+')" class="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer mb-1 '+(S.selComp?.competitor===comp.competitor?"bg-blue-600 text-white":"bg-white hover:bg-slate-100 border border-slate-200")+'"><span class="text-sm font-medium">'+comp.competitor+'</span>'+badge(comp.threatLevel)+'</div>').join("")+'</div><div class="col-span-2">'+(S.selComp?'<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"><div class="flex justify-between items-start"><div><h3 class="font-bold text-lg">'+S.selComp.competitor+'</h3><div class="text-sm text-slate-400">'+S.selComp.segment+' · '+fmt(S.selComp.researchDate)+'</div></div>'+badge(S.selComp.threatLevel)+'</div>'+(S.selComp.strategicSignal?'<div class="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3"><div class="text-xs font-bold text-amber-700 mb-1">⚡ KEY SIGNAL</div><div class="text-sm text-amber-800">'+S.selComp.strategicSignal+'</div></div>':"")+(S.selComp.pricing?'<div><div class="text-xs font-bold text-slate-500 uppercase mb-1">Pricing</div><div class="text-sm">'+S.selComp.pricing+'</div></div>':"")+'<div class="grid grid-cols-2 gap-4"><div><div class="text-xs font-bold text-green-700 uppercase mb-2">✅ Strengths</div><ul>'+(S.selComp.strengths||[]).map(s=>'<li class="text-sm flex gap-2 mb-1"><span class="text-green-400 text-xs">●</span>'+s+'</li>').join("")+'</ul></div><div><div class="text-xs font-bold text-red-700 uppercase mb-2">🔴 Weaknesses</div><ul>'+(S.selComp.weaknesses||[]).map(w=>'<li class="text-sm flex gap-2 mb-1"><span class="text-red-400 text-xs">●</span>'+w+'</li>').join("")+'</ul></div></div>'+(S.selComp.floAdvantage?'<div class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3"><div class="text-xs font-bold text-blue-700 mb-1">🎯 FLO ADVANTAGE</div><div class="text-sm text-blue-800">'+S.selComp.floAdvantage+'</div></div>':"")+'</div>':'<div class="flex items-center justify-center h-full text-slate-400 text-sm">← Select a competitor</div>')+'</div></div></div>';
  } else if (S.tab==="history") {
    c.innerHTML='<div class="p-5"><h2 class="font-bold text-lg mb-4">Report History</h2>'+(!S.reports.length?'<div class="text-slate-400 text-center py-16">No reports yet.</div>':'<div class="space-y-3">'+S.reports.map((r,i)=>'<div onclick="pickAndView('+i+')" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm cursor-pointer hover:border-blue-300"><div class="flex items-center justify-between"><div><span class="font-semibold text-sm">'+(i===0?"✨ Latest — ":"")+fmtFull(r.generated_at)+'</span><div class="text-xs text-slate-400 mt-0.5">'+(r.competitor_data?.length||0)+' competitors · '+r.scope+'</div></div></div></div>').join("")+'</div>')+'</div>';
  }
}

function pickComp(s) { S.selComp=JSON.parse(s); setTab("landscape"); }
function setSeg(s) { S.seg=s; render(); }
function pickReport(i) { S.selReport=S.reports[parseInt(i)]; render(); }
function pickAndView(i) { S.selReport=S.reports[i]; setTab("report"); }
init();
</script>
</body>
</html>
`
  }
];

async function createOrUpdateFile(path, content, token, owner, repo, setLog) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  };

  // Check if file exists (to get sha for update)
  let sha;
  try {
    const existing = await fetch(url, { headers });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch {}

  const body = {
    message: `deploy: add ${path}`,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  setLog(l => [...l, { path, status: "done" }]);
}

export default function Uploader() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");

  const deploy = async () => {
    setRunning(true);
    setLog([]);
    setError("");
    try {
      // First verify token works
      const check = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
        headers: { Authorization: `token ${TOKEN}` }
      });
      if (!check.ok) {
        const e = await check.json();
        throw new Error(`Repo access failed: ${e.message}. Make sure the repo "${REPO}" exists.`);
      }

      for (const file of FILES) {
        setLog(l => [...l, { path: file.path, status: "uploading" }]);
        await createOrUpdateFile(file.path, file.content, TOKEN, OWNER, REPO, setLog);
        await new Promise(r => setTimeout(r, 300)); // small delay to avoid rate limits
      }
      setDone(true);
    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  };

  const total = FILES.length;
  const completed = log.filter(l => l.status === "done").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg w-full max-w-lg p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-white font-bold shadow">FLO</div>
          <div>
            <div className="font-bold text-slate-800 text-lg">GitHub Auto-Deployer</div>
            <div className="text-xs text-slate-400">Pushing {total} files to {OWNER}/{REPO}</div>
          </div>
        </div>

        {/* Repo info */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm">
          <div className="flex justify-between mb-1"><span className="text-slate-500">Repository</span><span className="font-mono font-medium">{OWNER}/{REPO}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Files to deploy</span><span className="font-medium">{total} files</span></div>
        </div>

        {/* Progress */}
        {(running || done) && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{done ? "Complete!" : `Uploading... ${completed}/${total}`}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {FILES.map(file => {
                const entry = log.find(l => l.path === file.path);
                const status = entry?.status;
                return (
                  <div key={file.path} className="flex items-center gap-2 text-xs">
                    {!status && <span className="w-4 text-slate-300">○</span>}
                    {status === "uploading" && <span className="w-4 animate-spin inline-block border border-blue-500 border-t-transparent rounded-full w-3 h-3" />}
                    {status === "done" && <span className="w-4 text-green-500">✓</span>}
                    <span className={`font-mono ${status === "done" ? "text-slate-600" : status === "uploading" ? "text-blue-600 font-medium" : "text-slate-300"}`}>{file.path}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Success */}
        {done && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6">
            <div className="font-semibold text-green-800 mb-3">🎉 All files deployed!</div>
            <div className="text-sm text-green-700 space-y-1">
              <p>Next steps:</p>
              <p>1. Enable GitHub Pages: <strong>Settings → Pages → Branch: main, Folder: /docs</strong></p>
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-1">⚠️ GitHub Pages for <strong>private</strong> repositories requires a paid GitHub plan (Pro, Team, or Enterprise). If you are on a free account, ensure the repository is <strong>public</strong> so the dashboard can be hosted.</p>
              <p>2. Create Supabase project & run <strong>supabase-setup.sql</strong></p>
              <p>3. Add 3 secrets: <strong>Settings → Secrets → Actions</strong></p>
              <p>4. Trigger first run: <strong>Actions → FLO CI Agent → Run workflow</strong></p>
            </div>
            <a href={`https://github.com/${OWNER}/${REPO}`} target="_blank"
              className="inline-block mt-3 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900">
              View Repository ↗
            </a>
          </div>
        )}

        {/* Button */}
        {!done && (
          <button onClick={deploy} disabled={running}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
            {running
              ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />Deploying...</>
              : "🚀 Deploy to GitHub"}
          </button>
        )}
      </div>
    </div>
  );
}
