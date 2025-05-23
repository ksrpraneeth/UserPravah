import { IFrameworkAnalyzer } from "./framework-analyzer.interface.js";
import {
  IOutputGenerator,
  OutputGenerationOptions,
  GeneratedOutput,
} from "./output-generator.interface.js";
import { ProjectAnalysisOptions, AnalysisResult } from "./types.js";
import * as fs from "fs";
import * as path from "path";

export class FlowAnalyzer {
  private frameworkAnalyzers = new Map<string, IFrameworkAnalyzer>();
  private outputGenerators = new Map<string, IOutputGenerator>();

  /**
   * Register a framework analyzer
   */
  registerFrameworkAnalyzer(analyzer: IFrameworkAnalyzer): void {
    this.frameworkAnalyzers.set(
      analyzer.getFrameworkName().toLowerCase(),
      analyzer
    );
  }

  /**
   * Register an output generator
   */
  registerOutputGenerator(generator: IOutputGenerator): void {
    this.outputGenerators.set(
      generator.getFormatName().toLowerCase(),
      generator
    );
  }

  /**
   * Get all registered framework names
   */
  getAvailableFrameworks(): string[] {
    return Array.from(this.frameworkAnalyzers.keys());
  }

  /**
   * Get all registered output format names
   */
  getAvailableOutputFormats(): string[] {
    return Array.from(this.outputGenerators.keys());
  }

  /**
   * Auto-detect the framework for a project
   */
  async detectFramework(projectPath: string): Promise<string | null> {
    for (const [name, analyzer] of this.frameworkAnalyzers) {
      if (await analyzer.canAnalyze(projectPath)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Analyze a project using the specified or auto-detected framework
   */
  async analyze(options: ProjectAnalysisOptions): Promise<AnalysisResult> {
    console.log("🚀 Starting project analysis...");

    // Validate project path
    if (!fs.existsSync(options.projectPath)) {
      throw new Error(`Project path does not exist: ${options.projectPath}`);
    }

    let frameworkName = options.framework.toLowerCase();

    // Auto-detect framework if not specified or if specified framework is not available
    if (
      !frameworkName ||
      frameworkName === "auto" ||
      !this.frameworkAnalyzers.has(frameworkName)
    ) {
      console.log("🔍 Auto-detecting framework...");
      const detectedFramework = await this.detectFramework(options.projectPath);

      if (!detectedFramework) {
        throw new Error(
          `Could not detect framework for project at: ${
            options.projectPath
          }. Available frameworks: ${this.getAvailableFrameworks().join(", ")}`
        );
      }

      frameworkName = detectedFramework;
      console.log(`✅ Detected framework: ${frameworkName}`);
    }

    // Get the framework analyzer
    const analyzer = this.frameworkAnalyzers.get(frameworkName);
    if (!analyzer) {
      throw new Error(
        `No analyzer registered for framework: ${frameworkName}. Available: ${this.getAvailableFrameworks().join(
          ", "
        )}`
      );
    }

    // Perform the analysis
    console.log(`📊 Analyzing with ${frameworkName} analyzer...`);
    const result = await analyzer.analyze(options);

    console.log(
      `✨ Analysis complete! Found ${result.routes.length} routes and ${result.flows.length} navigation flows.`
    );
    return result;
  }

  /**
   * Generate outputs in the specified formats
   */
  async generateOutputs(
    analysisResult: AnalysisResult,
    outputFormats: string[],
    baseOptions: Partial<OutputGenerationOptions>
  ): Promise<GeneratedOutput[]> {
    console.log("📄 Generating outputs...");

    const outputs: GeneratedOutput[] = [];
    const defaultOptions: OutputGenerationOptions = {
      outputDirectory: process.cwd(),
      ...baseOptions,
    };

    for (const formatName of outputFormats) {
      const generator = this.outputGenerators.get(formatName.toLowerCase());
      if (!generator) {
        console.warn(
          `⚠️ No generator registered for format: ${formatName}. Available: ${this.getAvailableOutputFormats().join(
            ", "
          )}`
        );
        continue;
      }

      try {
        // Validate options for this generator
        const errors = generator.validateOptions(defaultOptions);
        if (errors.length > 0) {
          console.warn(
            `⚠️ Invalid options for ${formatName} generator:`,
            errors
          );
          continue;
        }

        console.log(`🎨 Generating ${formatName} output...`);
        const output = await generator.generate(analysisResult, defaultOptions);
        outputs.push(output);
        console.log(`✅ Generated ${formatName}: ${output.filePath}`);

        if (output.additionalFiles) {
          output.additionalFiles.forEach((file) => {
            console.log(`   📎 Additional file: ${file}`);
          });
        }
      } catch (error) {
        console.error(`❌ Error generating ${formatName} output:`, error);
      }
    }

    return outputs;
  }

  /**
   * Full analysis and output generation workflow
   */
  async analyzeAndGenerate(
    options: ProjectAnalysisOptions,
    outputOptions: Partial<OutputGenerationOptions> = {}
  ): Promise<{ analysis: AnalysisResult; outputs: GeneratedOutput[] }> {
    const analysis = await this.analyze(options);
    const outputs = await this.generateOutputs(
      analysis,
      options.outputFormats,
      outputOptions
    );

    return { analysis, outputs };
  }
}
