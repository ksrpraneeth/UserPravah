import { IFrameworkAnalyzer } from "../../core/framework-analyzer.interface.js";
import {
  ProjectAnalysisOptions,
  AnalysisResult,
  Route,
  NavigationFlow,
  MenuDefinition,
} from "../../core/types.js";
import * as fs from "fs";
import * as path from "path";
import glob from "fast-glob";

export class ReactAnalyzer implements IFrameworkAnalyzer {
  private routes: Route[] = [];
  private flows: NavigationFlow[] = [];
  private menus: MenuDefinition[] = [];
  private projectPath!: string;

  getFrameworkName(): string {
    return "React";
  }

  async canAnalyze(projectPath: string): Promise<boolean> {
    // Check for React-specific files and dependencies
    const packageJsonPath = path.join(projectPath, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        );
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Check for React and common React routing libraries
        if (
          deps["react"] ||
          deps["@types/react"] ||
          deps["react-router-dom"] ||
          deps["@reach/router"] ||
          deps["next"]
        ) {
          return true;
        }
      } catch (error) {
        // Invalid package.json
      }
    }

    // Check for common React project structures
    const commonReactFiles = [
      "src/App.js",
      "src/App.tsx",
      "src/index.js",
      "src/index.tsx",
      "next.config.js", // Next.js
    ];

    for (const file of commonReactFiles) {
      if (fs.existsSync(path.join(projectPath, file))) {
        return true;
      }
    }

    return false;
  }

  getSupportedExtensions(): string[] {
    return [".js", ".jsx", ".ts", ".tsx"];
  }

  getConfigFilePatterns(): string[] {
    return [
      "package.json",
      "tsconfig.json",
      "next.config.js",
      "vite.config.js",
      "webpack.config.js",
    ];
  }

  async analyze(options: ProjectAnalysisOptions): Promise<AnalysisResult> {
    this.projectPath = options.projectPath;
    this.routes = [];
    this.flows = [];
    this.menus = [];

    console.log("🔍 Starting React project analysis...");

    // Get all React files
    const reactFiles = await this.getReactFiles();
    console.log(`📁 Found ${reactFiles.length} React files`);

    // Analyze routing
    await this.analyzeReactRouter(reactFiles);
    await this.analyzeNextJsRouting();

    // Analyze navigation flows
    await this.analyzeNavigationFlows(reactFiles);

    return {
      routes: this.routes,
      flows: this.flows,
      menus: this.menus,
    };
  }

  private async getReactFiles(): Promise<string[]> {
    const patterns = [
      "**/*.{js,jsx,ts,tsx}",
      "!node_modules/**",
      "!dist/**",
      "!build/**",
      "!.next/**",
    ];

    const files = await glob(patterns, {
      cwd: this.projectPath,
      absolute: true,
    });

    return files;
  }

  private async analyzeReactRouter(files: string[]): Promise<void> {
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");

      // Look for React Router Route components
      const routeMatches = content.match(
        /<Route[^>]*path=["']([^"']+)["'][^>]*>/g
      );
      if (routeMatches) {
        for (const match of routeMatches) {
          const pathMatch = match.match(/path=["']([^"']+)["']/);
          const componentMatch =
            match.match(/component=\{([^}]+)\}/) ||
            match.match(/element=\{<([^>]+)>/);

          if (pathMatch) {
            const routePath = pathMatch[1];
            const component = componentMatch ? componentMatch[1] : undefined;

            this.routes.push({
              path: routePath,
              fullPath: routePath.startsWith("/") ? routePath : "/" + routePath,
              component: component,
            });
          }
        }
      }

      // Look for useNavigate, useHistory, or Link components for navigation flows
      this.extractNavigationFromFile(content, file);
    }
  }

  private async analyzeNextJsRouting(): Promise<void> {
    // Next.js file-based routing
    const pagesDir = path.join(this.projectPath, "pages");
    const appDir = path.join(this.projectPath, "app"); // App Router (Next.js 13+)

    if (fs.existsSync(pagesDir)) {
      await this.analyzeNextJsPagesRouter(pagesDir);
    }

    if (fs.existsSync(appDir)) {
      await this.analyzeNextJsAppRouter(appDir);
    }
  }

  private async analyzeNextJsPagesRouter(pagesDir: string): Promise<void> {
    const pageFiles = await glob("**/*.{js,jsx,ts,tsx}", {
      cwd: pagesDir,
      absolute: true,
    });

    for (const file of pageFiles) {
      const relativePath = path.relative(pagesDir, file);
      let routePath =
        "/" +
        relativePath
          .replace(/\.(js|jsx|ts|tsx)$/, "")
          .replace(/\/index$/, "")
          .replace(/\[([^\]]+)\]/g, ":$1"); // Convert [id] to :id

      if (routePath === "/") routePath = "/";
      else if (routePath.endsWith("/")) routePath = routePath.slice(0, -1);

      const component = this.getComponentNameFromFile(file);

      this.routes.push({
        path:
          relativePath
            .replace(/\.(js|jsx|ts|tsx)$/, "")
            .replace(/\/index$/, "") || "/",
        fullPath: routePath,
        component: component,
      });
    }
  }

  private async analyzeNextJsAppRouter(appDir: string): Promise<void> {
    const pageFiles = await glob("**/page.{js,jsx,ts,tsx}", {
      cwd: appDir,
      absolute: true,
    });

    for (const file of pageFiles) {
      const relativePath = path.relative(appDir, path.dirname(file));
      let routePath = "/" + relativePath.replace(/\([^)]+\)/g, ""); // Remove route groups

      if (routePath === "/") routePath = "/";
      else if (routePath.endsWith("/")) routePath = routePath.slice(0, -1);

      const component = this.getComponentNameFromFile(file);

      this.routes.push({
        path: relativePath || "/",
        fullPath: routePath,
        component: component,
      });
    }
  }

  private extractNavigationFromFile(content: string, filePath: string): void {
    const componentName = this.getComponentNameFromFile(filePath);

    // Look for useNavigate calls
    const navigateMatches = content.match(/navigate\(['"`]([^'"`]+)['"`]\)/g);
    if (navigateMatches) {
      for (const match of navigateMatches) {
        const pathMatch = match.match(/navigate\(['"`]([^'"`]+)['"`]\)/);
        if (pathMatch) {
          this.flows.push({
            from: componentName,
            to: pathMatch[1],
            type: "dynamic",
          });
        }
      }
    }

    // Look for Link components
    const linkMatches = content.match(/<Link[^>]+to=["']([^"']+)["'][^>]*>/g);
    if (linkMatches) {
      for (const match of linkMatches) {
        const pathMatch = match.match(/to=["']([^"']+)["']/);
        if (pathMatch) {
          this.flows.push({
            from: componentName,
            to: pathMatch[1],
            type: "static",
          });
        }
      }
    }

    // Look for Next.js router.push calls
    const routerPushMatches = content.match(
      /router\.push\(['"`]([^'"`]+)['"`]\)/g
    );
    if (routerPushMatches) {
      for (const match of routerPushMatches) {
        const pathMatch = match.match(/router\.push\(['"`]([^'"`]+)['"`]\)/);
        if (pathMatch) {
          this.flows.push({
            from: componentName,
            to: pathMatch[1],
            type: "dynamic",
          });
        }
      }
    }
  }

  private getComponentNameFromFile(filePath: string): string {
    const fileName = path.basename(filePath, path.extname(filePath));

    // Convert kebab-case or snake_case to PascalCase
    return fileName
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private async analyzeNavigationFlows(files: string[]): Promise<void> {
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      this.extractNavigationFromFile(content, file);
    }
  }
}
