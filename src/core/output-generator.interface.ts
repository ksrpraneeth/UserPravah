import { AnalysisResult, RouteNode, FlowEdge } from "./types.js";

export interface OutputGenerationOptions {
  outputDirectory: string;
  filename?: string;
  generateImage?: boolean;
  theme?: string;
  layout?: string;
  [key: string]: any; // Allow format-specific options
}

export interface GeneratedOutput {
  filePath: string;
  format: string;
  additionalFiles?: string[]; // For formats that generate multiple files
}

export interface IOutputGenerator {
  /**
   * Gets the name/format of this output generator
   */
  getFormatName(): string;

  /**
   * Gets the file extension for the primary output
   */
  getFileExtension(): string;

  /**
   * Gets supported options for this output format
   */
  getSupportedOptions(): string[];

  /**
   * Generates output from the analysis result
   */
  generate(
    analysisResult: AnalysisResult,
    options: OutputGenerationOptions
  ): Promise<GeneratedOutput>;

  /**
   * Validates the provided options
   */
  validateOptions(options: OutputGenerationOptions): string[]; // Returns validation errors
}
