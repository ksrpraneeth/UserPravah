// Core exports
export { FlowAnalyzer } from "./core/flow-analyzer.js";
export { IFrameworkAnalyzer } from "./core/framework-analyzer.interface.js";
export {
  IOutputGenerator,
  OutputGenerationOptions,
  GeneratedOutput,
} from "./core/output-generator.interface.js";
export {
  Route,
  NavigationFlow,
  MenuDefinition,
  AnalysisResult,
  ProjectAnalysisOptions,
  RouteNode,
  FlowEdge,
} from "./core/types.js";

// Framework analyzers
export { AngularAnalyzer } from "./frameworks/angular/angular-analyzer.js";
export { ReactAnalyzer } from "./frameworks/react/react-analyzer.js";

// Output generators
export { DotGenerator } from "./outputs/dot/dot-generator.js";
export { JsonGenerator } from "./outputs/json/json-generator.js";
