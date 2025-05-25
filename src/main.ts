#!/usr/bin/env node

import { FlowAnalyzer } from "./core/flow-analyzer.js";
import { AngularAnalyzer } from "./frameworks/angular/angular-analyzer.js";
import { ReactAnalyzer } from "./frameworks/react/react-analyzer.js";
import { DotGenerator } from "./outputs/dot/dot-generator.js";
import { JsonGenerator } from "./outputs/json/json-generator.js";
import { ProjectAnalysisOptions } from "./core/types.js";

async function main() {
  console.log("🚀 UserPravah - Universal User Flow Analyzer");

  // Check for help flag first
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  // CLI argument parsing
  if (process.argv.length < 3) {
    console.error("❌ Error: Please provide the path to your project");
    console.log("Usage: user-pravah <project-path> [options]");
    console.log("");
    console.log("Options:");
    console.log(
      "  --framework <name>     Specify framework (auto-detect if not provided)"
    );
    console.log(
      "  --output <formats>     Output formats (comma-separated, default: dot)"
    );
    console.log(
      "  --output-dir <path>    Output directory (default: current directory)"
    );
    console.log(
      "  --theme <theme>        Theme for DOT output (default, dark, colorful)"
    );
    console.log(
      "  --layout <layout>      Layout for DOT output (LR, TB, BT, RL)"
    );
    console.log("  --no-image            Skip image generation for DOT output");
    console.log("");
    console.log("Examples:");
    console.log("  user-pravah ./my-angular-app");
    console.log("  user-pravah ./my-app --framework angular --output dot,json");
    console.log("  user-pravah ./my-app --theme dark --layout TB");
    process.exit(1);
  }

  const projectPath = process.argv[2];

  // Parse CLI arguments
  const args = process.argv.slice(3);
  const options: ProjectAnalysisOptions = {
    projectPath,
    framework: "auto",
    outputFormats: ["dot"],
  };

  const outputOptions: any = {
    outputDirectory: process.cwd(),
    generateImage: true,
    theme: "light",
    layout: "LR",
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--framework":
        if (nextArg) {
          options.framework = nextArg;
          i++;
        }
        break;
      case "--output":
        if (nextArg) {
          options.outputFormats = nextArg.split(",").map((f) => f.trim());
          i++;
        }
        break;
      case "--output-dir":
        if (nextArg) {
          outputOptions.outputDirectory = nextArg;
          i++;
        }
        break;
      case "--theme":
        if (nextArg) {
          outputOptions.theme = nextArg;
          i++;
        }
        break;
      case "--layout":
        if (nextArg) {
          outputOptions.layout = nextArg;
          outputOptions.rankdir = nextArg; // For DOT compatibility
          i++;
        }
        break;
      case "--no-image":
        outputOptions.generateImage = false;
        break;
    }
  }

  try {
    // Initialize the flow analyzer
    const analyzer = new FlowAnalyzer();

    // Register framework analyzers
    analyzer.registerFrameworkAnalyzer(new AngularAnalyzer());
    analyzer.registerFrameworkAnalyzer(new ReactAnalyzer());
    // Future: analyzer.registerFrameworkAnalyzer(new VueAnalyzer());

    // Register output generators
    analyzer.registerOutputGenerator(new DotGenerator());
    analyzer.registerOutputGenerator(new JsonGenerator());
    // Future: analyzer.registerOutputGenerator(new MermaidGenerator());
    // Future: analyzer.registerOutputGenerator(new HtmlGenerator());

    console.log(`🔍 Project path: ${options.projectPath}`);
    console.log(
      `🎯 Framework: ${
        options.framework === "auto" ? "auto-detect" : options.framework
      }`
    );
    console.log(`📄 Output formats: ${options.outputFormats.join(", ")}`);
    console.log(`📁 Output directory: ${outputOptions.outputDirectory}`);

    // Available frameworks and formats
    console.log(
      `\n📋 Available frameworks: ${analyzer
        .getAvailableFrameworks()
        .join(", ")}`
    );
    console.log(
      `📋 Available output formats: ${analyzer
        .getAvailableOutputFormats()
        .join(", ")}`
    );

    // Perform analysis and generate outputs
    const result = await analyzer.analyzeAndGenerate(options, outputOptions);

    console.log("\n✨ Analysis Summary:");
    console.log(`   📍 Routes found: ${result.analysis.routes.length}`);
    console.log(`   🔄 Navigation flows: ${result.analysis.flows.length}`);
    console.log(`   📂 Menu definitions: ${result.analysis.menus.length}`);

    console.log("\n🎨 Generated Outputs:");
    result.outputs.forEach((output) => {
      console.log(`   📄 ${output.format.toUpperCase()}: ${output.filePath}`);
      if (output.additionalFiles) {
        output.additionalFiles.forEach((file) => {
          console.log(`      🖼️  Image: ${file}`);
        });
      }
    });

    console.log("\n🎉 Analysis complete!");
  } catch (error) {
    console.error("❌ Fatal Error during analysis:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  console.error("❌ Startup Error:", error);
  process.exit(1);
});

function showHelp() {
  console.log(`
🚀 UserPravah - Universal User Flow Analyzer

USAGE:
  userpravah <project-path> [options]

ARGUMENTS:
  <project-path>         Path to the project to analyze

OPTIONS:
  --framework <name>     Force specific framework (angular, react)
  --output <formats>     Output formats (dot, json) - comma separated
  --output-dir <path>    Output directory (default: current directory)
  --theme <theme>        Theme for DOT output (light, dark)
  --layout <direction>   Graph layout direction (LR, TB, BT, RL)
  --no-image            Skip PNG image generation
  --help                Show this help message

EXAMPLES:
  userpravah ./my-angular-app
  userpravah ./my-react-app --framework react --output dot,json
  userpravah ./project --theme dark --layout TB
  userpravah ./project --output-dir ./output --no-image

SUPPORTED FRAMEWORKS:
  - Angular (routing modules, standalone components)
  - React (React Router, Next.js App Router)

OUTPUT FORMATS:
  - DOT: Graphviz format with PNG image generation
  - JSON: Structured data format
`);
}
