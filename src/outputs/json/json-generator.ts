import {
  IOutputGenerator,
  OutputGenerationOptions,
  GeneratedOutput,
} from "../../core/output-generator.interface.js";
import { AnalysisResult } from "../../core/types.js";
import * as fs from "fs";
import * as path from "path";

export class JsonGenerator implements IOutputGenerator {
  getFormatName(): string {
    return "json";
  }

  getFileExtension(): string {
    return ".json";
  }

  getSupportedOptions(): string[] {
    return [
      "outputDirectory",
      "filename",
      "pretty", // Pretty print JSON
      "includeMetadata", // Include analysis metadata
      "separateFiles", // Generate separate files for routes, flows, and menus
    ];
  }

  validateOptions(options: OutputGenerationOptions): string[] {
    const errors: string[] = [];

    if (!options.outputDirectory) {
      errors.push("outputDirectory is required");
    } else if (!fs.existsSync(options.outputDirectory)) {
      errors.push(`outputDirectory does not exist: ${options.outputDirectory}`);
    }

    return errors;
  }

  async generate(
    analysisResult: AnalysisResult,
    options: OutputGenerationOptions
  ): Promise<GeneratedOutput> {
    console.log("📝 Starting JSON generation...");

    const defaultOptions = {
      filename: "user-flows",
      pretty: true,
      includeMetadata: true,
      separateFiles: false,
      ...options,
    };

    const result: GeneratedOutput = {
      filePath: "",
      format: this.getFormatName(),
      additionalFiles: [],
    };

    if (defaultOptions.separateFiles) {
      // Generate separate files for each data type
      const files = await this.generateSeparateFiles(
        analysisResult,
        defaultOptions
      );
      result.filePath = files[0]; // Main file
      result.additionalFiles = files.slice(1);
    } else {
      // Generate single combined file
      result.filePath = await this.generateCombinedFile(
        analysisResult,
        defaultOptions
      );
    }

    console.log(`✅ JSON file(s) generated`);
    return result;
  }

  private async generateCombinedFile(
    analysisResult: AnalysisResult,
    options: any
  ): Promise<string> {
    const outputData: any = {
      routes: analysisResult.routes,
      flows: analysisResult.flows,
      menus: analysisResult.menus,
    };

    if (options.includeMetadata) {
      outputData.metadata = {
        generatedAt: new Date().toISOString(),
        analyzer: "UserPravah",
        summary: {
          totalRoutes: analysisResult.routes.length,
          totalFlows: analysisResult.flows.length,
          totalMenus: analysisResult.menus.length,
          routesByType: this.categorizeRoutes(analysisResult.routes),
          flowsByType: this.categorizeFlows(analysisResult.flows),
        },
      };
    }

    const jsonContent = options.pretty
      ? JSON.stringify(outputData, null, 2)
      : JSON.stringify(outputData);

    const filePath = path.join(
      options.outputDirectory,
      `${options.filename}.json`
    );
    fs.writeFileSync(filePath, jsonContent, "utf-8");

    return filePath;
  }

  private async generateSeparateFiles(
    analysisResult: AnalysisResult,
    options: any
  ): Promise<string[]> {
    const files: string[] = [];
    const baseDir = options.outputDirectory;
    const baseName = options.filename;

    // Routes file
    const routesFile = path.join(baseDir, `${baseName}-routes.json`);
    const routesData = {
      routes: analysisResult.routes,
      metadata: options.includeMetadata
        ? {
            generatedAt: new Date().toISOString(),
            type: "routes",
            count: analysisResult.routes.length,
            categories: this.categorizeRoutes(analysisResult.routes),
          }
        : undefined,
    };
    fs.writeFileSync(
      routesFile,
      options.pretty
        ? JSON.stringify(routesData, null, 2)
        : JSON.stringify(routesData),
      "utf-8"
    );
    files.push(routesFile);

    // Flows file
    const flowsFile = path.join(baseDir, `${baseName}-flows.json`);
    const flowsData = {
      flows: analysisResult.flows,
      metadata: options.includeMetadata
        ? {
            generatedAt: new Date().toISOString(),
            type: "flows",
            count: analysisResult.flows.length,
            categories: this.categorizeFlows(analysisResult.flows),
          }
        : undefined,
    };
    fs.writeFileSync(
      flowsFile,
      options.pretty
        ? JSON.stringify(flowsData, null, 2)
        : JSON.stringify(flowsData),
      "utf-8"
    );
    files.push(flowsFile);

    // Menus file (if any)
    if (analysisResult.menus.length > 0) {
      const menusFile = path.join(baseDir, `${baseName}-menus.json`);
      const menusData = {
        menus: analysisResult.menus,
        metadata: options.includeMetadata
          ? {
              generatedAt: new Date().toISOString(),
              type: "menus",
              count: analysisResult.menus.length,
            }
          : undefined,
      };
      fs.writeFileSync(
        menusFile,
        options.pretty
          ? JSON.stringify(menusData, null, 2)
          : JSON.stringify(menusData),
        "utf-8"
      );
      files.push(menusFile);
    }

    // Summary file
    if (options.includeMetadata) {
      const summaryFile = path.join(baseDir, `${baseName}-summary.json`);
      const summaryData = {
        summary: {
          generatedAt: new Date().toISOString(),
          analyzer: "UserPravah",
          totalRoutes: analysisResult.routes.length,
          totalFlows: analysisResult.flows.length,
          totalMenus: analysisResult.menus.length,
          files: files.map((f) => path.basename(f)),
          routesByType: this.categorizeRoutes(analysisResult.routes),
          flowsByType: this.categorizeFlows(analysisResult.flows),
        },
      };
      fs.writeFileSync(
        summaryFile,
        options.pretty
          ? JSON.stringify(summaryData, null, 2)
          : JSON.stringify(summaryData),
        "utf-8"
      );
      files.push(summaryFile);
    }

    return files;
  }

  private categorizeRoutes(routes: any[]): Record<string, number> {
    const categories: Record<string, number> = {
      withComponent: 0,
      withLazyLoading: 0,
      withRedirect: 0,
      withGuards: 0,
      withChildren: 0,
      root: 0,
    };

    for (const route of routes) {
      if (route.component) categories.withComponent++;
      if (route.loadChildren) categories.withLazyLoading++;
      if (route.redirectTo) categories.withRedirect++;
      if (route.guards && route.guards.length > 0) categories.withGuards++;
      if (route.children && route.children.length > 0)
        categories.withChildren++;
      if (route.isRoot) categories.root++;
    }

    return categories;
  }

  private categorizeFlows(flows: any[]): Record<string, number> {
    const categories: Record<string, number> = {
      static: 0,
      dynamic: 0,
      redirect: 0,
      hierarchy: 0,
      guard: 0,
    };

    for (const flow of flows) {
      if (categories.hasOwnProperty(flow.type)) {
        categories[flow.type]++;
      }
    }

    return categories;
  }
}
