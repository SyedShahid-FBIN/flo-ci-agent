const { createClient } = require("@supabase/supabase-js");
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

  if (error) {
    console.error("Failed to fetch reports:", error.message);
    process.exit(1);
  }

  const settings = reports.length
    ? { lastRun: reports[0].generated_at, scope: reports[0].scope }
    : { lastRun: null };

  const output = { reports: reports || [], settings, builtAt: new Date().toISOString() };

  const outPath = path.join(__dirname, "../docs/data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`✓ Written ${reports.length} reports to docs/data.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
