// Core types shared across all frameworks
export interface Route {
  path: string; // The segment path
  fullPath: string; // The accumulated path, should always start with / for root-level
  component?: string;
  children?: Route[];
  redirectTo?: string;
  loadChildren?: string;
  guards?: string[];
  data?: Record<string, any>;
  isRoot?: boolean; // Flag for the absolute root route
}

export interface NavigationFlow {
  from: string;
  to: string;
  type: "static" | "dynamic" | "guard" | "redirect" | "hierarchy";
  label?: string; // For guards, conditions, etc.
}

export interface MenuDefinition {
  title: string;
  path: string;
  children?: MenuDefinition[];
  roles?: string[];
}

export interface AnalysisResult {
  routes: Route[];
  flows: NavigationFlow[];
  menus: MenuDefinition[];
}

export interface ProjectAnalysisOptions {
  projectPath: string;
  framework: string;
  outputFormats: string[];
  configPath?: string;
  ignore?: string[];
}

export interface RouteNode {
  id: string; // Clean ID for output
  originalPath: string; // Original path with parameters
  displayName: string; // Display name for the node
  pathDepth: number; // Depth in the path hierarchy
  category: string; // Category based on the first path segment
  component?: string; // Associated component if any
  importance: number; // Importance score based on incoming/outgoing edges
  guards?: string[]; // Guards for the route
}

export interface FlowEdge {
  source: string; // Source node ID
  target: string; // Target node ID
  type: string; // Type of navigation
  label?: string; // Label for the edge
}
