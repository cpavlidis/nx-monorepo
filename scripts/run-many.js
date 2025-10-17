#!/usr/bin/env node

// get app names from command line args
const { execSync } = require("child_process");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("❌ You must provide at least one app name.\nExample: yarn run-many admin-layout user-layout");
  process.exit(1);
}

const projects = args.join(",");
const command = `nx run-many -t serve -p ${projects}`;

console.log(`🏃 Running: ${command}\n`);
execSync(command, { stdio: "inherit" });
