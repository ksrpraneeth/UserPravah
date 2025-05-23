import { AnalysisResult, ProjectAnalysisOptions } from "./types.js";

export interface IFrameworkAnalyzer {
  /**
   * Gets the name of the framework this analyzer supports
   */
  getFrameworkName(): string;

  /**
   * Checks if this analyzer can handle the given project
   */
  canAnalyze(projectPath: string): Promise<boolean>;

  /**
   * Analyzes the project and extracts routes, navigation flows, and menus
   */
  analyze(options: ProjectAnalysisOptions): Promise<AnalysisResult>;

  /**
   * Gets the file extensions this analyzer should process
   */
  getSupportedExtensions(): string[];

  /**
   * Gets common configuration file patterns for this framework
   */
  getConfigFilePatterns(): string[];
}
