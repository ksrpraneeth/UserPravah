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
   * Recursively search for framework projects up to maxDepth levels deep
   */
  private async findFrameworkProjectsRecursively(
    rootPath: string,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<{ framework: string; path: string }[]> {
    const results: { framework: string; path: string }[] = [];

    if (currentDepth > maxDepth) {
      return results;
    }

    // Check current directory for frameworks
    for (const [name, analyzer] of this.frameworkAnalyzers) {
      if (await analyzer.canAnalyze(rootPath)) {
        results.push({ framework: name, path: rootPath });
        console.log(`✅ Found ${name} project at: ${rootPath}`);
      }
    }

    // If we found a framework at this level and it's not the root, we can return early
    // to avoid finding nested projects within the same framework
    if (results.length > 0 && currentDepth > 0) {
      return results;
    }

    // Search subdirectories if we haven't reached max depth
    if (currentDepth < maxDepth) {
      try {
        const entries = fs.readdirSync(rootPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            const subPath = path.join(rootPath, entry.name);
            const subResults = await this.findFrameworkProjectsRecursively(
              subPath,
              maxDepth,
              currentDepth + 1
            );
            results.push(...subResults);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
        console.warn(`⚠️ Could not read directory: ${rootPath}`);
      }
    }

    return results;
  }

  /**
   * Check if a directory should be skipped during recursive search
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nyc_output',
      'tmp',
      'temp',
      '.cache',
      '.vscode',
      '.idea',
      '__pycache__',
      '.pytest_cache',
      'venv',
      '.venv',
      'env',
      '.env'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Auto-detect the framework for a project, searching recursively up to 3 levels deep
   */
  async detectFramework(projectPath: string): Promise<string | null> {
    console.log(`🔍 Searching for frameworks in ${projectPath} (up to 3 levels deep)...`);
    
    const foundProjects = await this.findFrameworkProjectsRecursively(projectPath, 3);
    
    if (foundProjects.length === 0) {
      console.log("❌ No framework projects found");
      return null;
    }

    if (foundProjects.length === 1) {
      console.log(`✅ Found single ${foundProjects[0].framework} project at: ${foundProjects[0].path}`);
      return foundProjects[0].framework;
    }

    // Multiple projects found - prioritize by depth (closer to root) and then by framework preference
    foundProjects.sort((a, b) => {
      const depthA = a.path.split(path.sep).length;
      const depthB = b.path.split(path.sep).length;
      
      if (depthA !== depthB) {
        return depthA - depthB; // Prefer shallower paths
      }
      
      // If same depth, prefer Angular over React (arbitrary preference)
      const frameworkPriority: { [key: string]: number } = { 'angular': 1, 'react': 2 };
      const priorityA = frameworkPriority[a.framework.toLowerCase()] || 999;
      const priorityB = frameworkPriority[b.framework.toLowerCase()] || 999;
      
      return priorityA - priorityB;
    });

    console.log(`🎯 Multiple projects found, selecting: ${foundProjects[0].framework} at ${foundProjects[0].path}`);
    console.log(`   Other projects found:`);
    foundProjects.slice(1).forEach(project => {
      console.log(`   - ${project.framework} at ${project.path}`);
    });

    return foundProjects[0].framework;
  }

  /**
   * Get the detected project path for a framework
   */
  async getFrameworkProjectPath(projectPath: string, frameworkName?: string): Promise<string> {
    const foundProjects = await this.findFrameworkProjectsRecursively(projectPath, 3);
    
    if (frameworkName) {
      const project = foundProjects.find(p => p.framework.toLowerCase() === frameworkName.toLowerCase());
      return project ? project.path : projectPath;
    }
    
    // Return the first (highest priority) project path
    return foundProjects.length > 0 ? foundProjects[0].path : projectPath;
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
    let actualProjectPath = options.projectPath;

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
      
      // Get the actual project path where the framework was detected
      actualProjectPath = await this.getFrameworkProjectPath(options.projectPath, frameworkName);
      if (actualProjectPath !== options.projectPath) {
        console.log(`📁 Using framework project path: ${actualProjectPath}`);
      }
    } else {
      // Even if framework is specified, get the correct project path
      actualProjectPath = await this.getFrameworkProjectPath(options.projectPath, frameworkName);
      if (actualProjectPath !== options.projectPath) {
        console.log(`📁 Using framework project path: ${actualProjectPath}`);
      }
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

    // Create modified options with the actual project path
    const modifiedOptions: ProjectAnalysisOptions = {
      ...options,
      projectPath: actualProjectPath
    };

    // Perform the analysis
    console.log(`📊 Analyzing with ${frameworkName} analyzer...`);
    const result = await analyzer.analyze(modifiedOptions);

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
