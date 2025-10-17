#!/usr/bin/env node

// get app names from command line args
const { execSync } = require("child_process");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("❌ You must provide an app name.\nExample: yarn run project-name");
  process.exit(1);
} else if (args.length > 1) {
  console.error("❌ You can't provide more than one app names.\nExample: yarn run project-name");
  process.exit(1);
} else {
    const progectName = args[0]
    const command = `nx serve ${progectName}`;
    
    console.log(`🏃 Running: ${command}\n`);
    execSync(command, { stdio: "inherit" });
}

