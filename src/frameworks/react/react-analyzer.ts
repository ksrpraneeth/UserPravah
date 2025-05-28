import { IFrameworkAnalyzer } from "../../core/framework-analyzer.interface.js";
import {
  ProjectAnalysisOptions,
  AnalysisResult,
  Route,
  NavigationFlow,
  MenuDefinition,
} from "../../core/types.js";
import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  CallExpression,
  JsxElement,
  JsxSelfClosingElement,
  JsxAttribute,
  StringLiteral,
  ObjectLiteralExpression,
  PropertyAssignment,
  ArrayLiteralExpression,
  ArrowFunction,
  FunctionExpression,
  Identifier,
  VariableDeclaration,
  ImportDeclaration,
} from "ts-morph";
import * as fs from "fs";
import * as path from "path";
import glob from "fast-glob";

interface RouteConfig {
  path: string;
  component?: string;
  element?: string;
  children?: RouteConfig[];
  index?: boolean;
  redirect?: string;
  guards?: string[];
}

interface NavigationCall {
  from: string;
  to: string;
  type: "static" | "dynamic";
  method?: string;
}

export class ReactAnalyzer implements IFrameworkAnalyzer {
  private project!: Project;
  private routes: Route[] = [];
  private flows: NavigationFlow[] = [];
  private menus: MenuDefinition[] = [];
  private projectPath!: string;
  private processedComponents = new Set<string>();
  private componentToFileMap = new Map<string, string>();
  private fileToComponentMap = new Map<string, Set<string>>();
  private routeComponents = new Set<string>();

  getFrameworkName(): string {
    return "React";
  }

  async canAnalyze(projectPath: string): Promise<boolean> {
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
          deps["@tanstack/react-router"] ||
          deps["@reach/router"] ||
          deps["next"] ||
          deps["gatsby"] ||
          deps["@remix-run/react"]
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
      "src/App.jsx",
      "src/App.ts",
      "src/App.tsx",
      "src/index.js",
      "src/index.jsx",
      "src/index.ts",
      "src/index.tsx",
      "pages/index.js", // Next.js pages
      "app/page.tsx", // Next.js app router
      "src/routes/index.js", // Common pattern
    ];

    for (const file of commonReactFiles) {
      if (fs.existsSync(path.join(projectPath, file))) {
        return true;
      }
    }

    return false;
  }

  getSupportedExtensions(): string[] {
    return [".js", ".jsx", ".ts", ".tsx", ".mjs"];
  }

  getConfigFilePatterns(): string[] {
    return [
      "package.json",
      "tsconfig.json",
      "jsconfig.json",
      "next.config.js",
      "next.config.mjs",
      "gatsby-config.js",
      "remix.config.js",
      "vite.config.js",
      "vite.config.ts",
      "webpack.config.js",
    ];
  }

  async analyze(options: ProjectAnalysisOptions): Promise<AnalysisResult> {
    this.projectPath = options.projectPath;
    this.routes = [];
    this.flows = [];
    this.menus = [];
    this.processedComponents.clear();
    this.componentToFileMap.clear();
    this.fileToComponentMap.clear();
    this.routeComponents.clear();

    // Initialize ts-morph project
    const tsConfigPath = path.join(this.projectPath, "tsconfig.json");
    const jsConfigPath = path.join(this.projectPath, "jsconfig.json");

    if (fs.existsSync(tsConfigPath)) {
      this.project = new Project({
        tsConfigFilePath: tsConfigPath,
      });
    } else if (fs.existsSync(jsConfigPath)) {
      this.project = new Project({
        compilerOptions: JSON.parse(fs.readFileSync(jsConfigPath, "utf-8"))
          .compilerOptions,
      });
    } else {
      this.project = new Project({
        compilerOptions: {
          allowJs: true,
          jsx: 2, // JsxEmit.React
          module: 99, // ModuleKind.ESNext
          target: 99, // ScriptTarget.ESNext
          moduleResolution: 2, // ModuleResolutionKind.NodeJs
        },
      });
    }

    console.log("🔍 Starting React project analysis...");

    // Add source files
    await this.addSourceFiles();
    console.log(
      `📁 Total source files loaded: ${
        this.project.getSourceFiles().length
      }`
    );

    // Build component map
    this.buildComponentMap();

    // Detect routing library
    const routingLibrary = await this.detectRoutingLibrary();
    console.log(`📚 Detected routing library: ${routingLibrary || "none"}`);

    // Analyze based on detected routing library
    if (routingLibrary === "next") {
      await this.analyzeNextJsRouting();
    } else if (routingLibrary === "gatsby") {
      await this.analyzeGatsbyRouting();
    } else if (routingLibrary === "remix") {
      await this.analyzeRemixRouting();
    } else if (routingLibrary === "react-router") {
      await this.analyzeReactRouterRouting();
    } else if (routingLibrary === "tanstack-router") {
      await this.analyzeTanstackRouting();
    } else if (routingLibrary === "reach-router") {
      await this.analyzeReachRouterRouting();
    } else {
      // Generic React analysis - look for common patterns
      await this.analyzeGenericReactPatterns();
    }

    // Analyze navigation flows
    await this.analyzeNavigationFlows();

    // Analyze menu structures
    await this.analyzeMenuStructures();

    // Add hierarchical relationships
    this.addHierarchicalFlows();

    return {
      routes: this.routes,
      flows: this.flows,
      menus: this.menus,
    };
  }

  private async addSourceFiles(): Promise<void> {
    const patterns = [
      "**/*.{js,jsx,ts,tsx,mjs}",
      "!node_modules/**",
      "!dist/**",
      "!build/**",
      "!.next/**",
      "!.cache/**",
      "!public/**",
      "!coverage/**",
    ];

    const files = await glob(patterns, {
      cwd: this.projectPath,
      absolute: true,
    });

    this.project.addSourceFilesAtPaths(files);
  }

  private buildComponentMap(): void {
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      const components = this.extractComponentsFromFile(sourceFile);

      if (components.length > 0) {
        this.fileToComponentMap.set(filePath, new Set(components));
        for (const component of components) {
          this.componentToFileMap.set(component, filePath);
        }
      }
    }
  }

  private extractComponentsFromFile(sourceFile: SourceFile): string[] {
    const components: string[] = [];

    // Function declarations
    sourceFile.getFunctions().forEach((func) => {
      const name = func.getName();
      if (name && this.isComponentName(name)) {
        components.push(name);
      }
    });

    // Variable declarations with arrow functions or function expressions
    sourceFile.getVariableDeclarations().forEach((varDecl) => {
      const name = varDecl.getName();
      const initializer = varDecl.getInitializer();

      if (
        initializer &&
        this.isComponentName(name) &&
        (Node.isArrowFunction(initializer) ||
          Node.isFunctionExpression(initializer))
      ) {
        components.push(name);
      }
    });

    // Class declarations
    sourceFile.getClasses().forEach((classDecl) => {
      const name = classDecl.getName();
      if (name && this.isComponentName(name)) {
        // Check if extends React.Component or similar
        const extendsExpr = classDecl.getExtends();
        if (extendsExpr) {
          const extendsText = extendsExpr.getText();
          if (
            extendsText.includes("Component") ||
            extendsText.includes("PureComponent")
          ) {
            components.push(name);
          }
        }
      }
    });

    // Export statements
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      const name = defaultExport.getName();
      if (name && name !== "default" && this.isComponentName(name)) {
        components.push(name);
      }
    }

    return components;
  }

  private isComponentName(name: string): boolean {
    // React components typically start with uppercase
    return /^[A-Z]/.test(name);
  }

  private async detectRoutingLibrary(): Promise<string | null> {
    const packageJsonPath = path.join(this.projectPath, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        );
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (deps["next"]) return "next";
        if (deps["gatsby"]) return "gatsby";
        if (deps["@remix-run/react"]) return "remix";
        if (deps["react-router-dom"] || deps["react-router"])
          return "react-router";
        if (deps["@tanstack/react-router"]) return "tanstack-router";
        if (deps["@reach/router"]) return "reach-router";
      } catch (error) {
        console.warn("Error reading package.json:", error);
      }
    }

    return null;
  }

  private async analyzeReactRouterRouting(): Promise<void> {
    console.log("🛣️  Analyzing React Router routes...");

    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Find Route components and router configurations
      this.extractReactRouterRoutes(sourceFile);
      // Find Routes defined in objects or arrays
      this.extractReactRouterConfigRoutes(sourceFile);
    }
  }

  private extractReactRouterRoutes(sourceFile: SourceFile): void {
    // Find JSX Route elements
    const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
    const jsxSelfClosingElements = sourceFile.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement
    );

    const allJsxElements = [...jsxElements, ...jsxSelfClosingElements];

    for (const element of allJsxElements) {
      const tagName = this.getJsxTagName(element);

      if (tagName === "Route" || tagName === "PrivateRoute") {
        const routeInfo = this.extractRouteInfo(element);
        if (routeInfo) {
          this.addRoute(routeInfo);
        }
      }

      // Handle Routes component with children
      if (tagName === "Routes" || tagName === "Switch") {
        this.extractNestedRoutes(element);
      }
    }
  }

  private extractReactRouterConfigRoutes(sourceFile: SourceFile): void {
    // Look for route configuration arrays
    const arrayLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ArrayLiteralExpression
    );

    for (const array of arrayLiterals) {
      if (this.isRouteConfigArray(array)) {
        this.processRouteConfigArray(array);
      }
    }

    // Look for createBrowserRouter, createMemoryRouter, etc.
    const callExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    );

    for (const call of callExpressions) {
      const expression = call.getExpression().getText();
      if (
        expression.includes("createBrowserRouter") ||
        expression.includes("createMemoryRouter") ||
        expression.includes("createHashRouter")
      ) {
        const args = call.getArguments();
        if (args.length > 0 && Node.isArrayLiteralExpression(args[0])) {
          this.processRouteConfigArray(args[0]);
        }
      }
    }
  }

  private getJsxTagName(
    element: JsxElement | JsxSelfClosingElement
  ): string | null {
    if (Node.isJsxElement(element)) {
      return element.getOpeningElement().getTagNameNode().getText();
    } else if (Node.isJsxSelfClosingElement(element)) {
      return element.getTagNameNode().getText();
    }
    return null;
  }

  private extractRouteInfo(
    element: JsxElement | JsxSelfClosingElement
  ): RouteConfig | null {
    const attributes = this.getJsxAttributes(element);
    const routeInfo: RouteConfig = { path: "" };

    // Extract path
    const pathAttr = attributes.find((attr) => attr.name === "path");
    if (pathAttr) {
      routeInfo.path = this.extractAttributeValue(pathAttr.value);
    }

    // Extract component/element
    const componentAttr = attributes.find((attr) => attr.name === "component");
    const elementAttr = attributes.find((attr) => attr.name === "element");

    if (componentAttr) {
      routeInfo.component = this.extractAttributeValue(componentAttr.value);
    } else if (elementAttr) {
      routeInfo.element = this.extractJsxElementComponent(elementAttr.value);
    }

    // Extract index route
    const indexAttr = attributes.find((attr) => attr.name === "index");
    if (indexAttr) {
      routeInfo.index = true;
      routeInfo.path = ""; // Index routes don't have paths
    }

    // Extract guards/middleware
    const requireAuthAttr = attributes.find(
      (attr) => attr.name === "requireAuth"
    );
    const middlewareAttr = attributes.find(
      (attr) => attr.name === "middleware"
    );
    if (requireAuthAttr || middlewareAttr) {
      routeInfo.guards = ["AuthGuard"];
    }

    return routeInfo.path !== "" || routeInfo.index ? routeInfo : null;
  }

  private getJsxAttributes(
    element: JsxElement | JsxSelfClosingElement
  ): Array<{ name: string; value: any }> {
    const attributes: Array<{ name: string; value: any }> = [];

    let jsxAttributes: any[] = [];

    if (Node.isJsxElement(element)) {
      jsxAttributes = element.getOpeningElement().getAttributes();
    } else if (Node.isJsxSelfClosingElement(element)) {
      jsxAttributes = element.getAttributes();
    }

    for (const attr of jsxAttributes) {
      if (Node.isJsxAttribute(attr)) {
        const name = attr.getNameNode().getText();
        const initializer = attr.getInitializer();
        attributes.push({ name, value: initializer });
      }
    }

    return attributes;
  }

  private extractAttributeValue(value: any): string {
    if (!value) return "";

    if (Node.isStringLiteral(value)) {
      return value.getLiteralValue();
    } else if (Node.isJsxExpression(value)) {
      const expression = value.getExpression();
      if (expression) {
        if (Node.isIdentifier(expression)) {
          return expression.getText();
        } else if (Node.isStringLiteral(expression)) {
          return expression.getLiteralValue();
        }
        return expression.getText();
      }
    }

    return value.getText ? value.getText() : "";
  }

  private extractJsxElementComponent(value: any): string {
    if (!value) return "";

    if (Node.isJsxExpression(value)) {
      const expression = value.getExpression();
      if (expression) {
        const text = expression.getText();
        // Extract component name from JSX like <Component />
        const match = text.match(/<(\w+)/);
        if (match) {
          return match[1];
        }
        // Handle direct component references
        if (Node.isIdentifier(expression)) {
          return expression.getText();
        }
      }
    }

    return "";
  }

  private extractNestedRoutes(element: JsxElement | JsxSelfClosingElement): void {
    if (Node.isJsxElement(element)) {
      const children = element.getJsxChildren();
      for (const child of children) {
        if (
          Node.isJsxElement(child) ||
          Node.isJsxSelfClosingElement(child)
        ) {
          const tagName = this.getJsxTagName(child);
          if (tagName === "Route") {
            const routeInfo = this.extractRouteInfo(child);
            if (routeInfo) {
              this.addRoute(routeInfo);
            }
          }
        }
      }
    }
  }

  private isRouteConfigArray(array: ArrayLiteralExpression): boolean {
    const elements = array.getElements();
    if (elements.length === 0) return false;

    // Check if array contains route-like objects
    return elements.some((element) => {
      if (Node.isObjectLiteralExpression(element)) {
        const props = element.getProperties();
        return props.some(
          (prop) =>
            Node.isPropertyAssignment(prop) &&
            (prop.getName() === "path" ||
              prop.getName() === "element" ||
              prop.getName() === "component" ||
              prop.getName() === "children")
        );
      }
      return false;
    });
  }

  private processRouteConfigArray(
    array: ArrayLiteralExpression,
    parentPath: string = ""
  ): void {
    const elements = array.getElements();

    for (const element of elements) {
      if (Node.isObjectLiteralExpression(element)) {
        this.processRouteConfigObject(element, parentPath);
      }
    }
  }

  private processRouteConfigObject(
    obj: ObjectLiteralExpression,
    parentPath: string
  ): void {
    const routeConfig: RouteConfig = { path: "" };
    let children: ArrayLiteralExpression | null = null;

    for (const prop of obj.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const initializer = prop.getInitializer();

        if (name === "path" && initializer) {
          routeConfig.path = this.extractStringValue(initializer);
        } else if (name === "element" && initializer) {
          routeConfig.element = this.extractComponentFromInitializer(initializer);
        } else if (name === "component" && initializer) {
          routeConfig.component = this.extractComponentFromInitializer(initializer);
        } else if (name === "index" && initializer) {
          routeConfig.index = initializer.getText() === "true";
          if (routeConfig.index) {
            routeConfig.path = "";
          }
        } else if (name === "children" && initializer) {
          if (Node.isArrayLiteralExpression(initializer)) {
            children = initializer;
          }
        }
      }
    }

    // Add the route
    const fullPath = this.buildFullPath(parentPath, routeConfig.path);
    if (routeConfig.path !== "" || routeConfig.index) {
      this.addRoute({ ...routeConfig, path: fullPath });
    }

    // Process children
    if (children) {
      this.processRouteConfigArray(children, fullPath);
    }
  }

  private extractStringValue(node: Node): string {
    if (Node.isStringLiteral(node)) {
      return node.getLiteralValue();
    } else if (Node.isIdentifier(node)) {
      // Try to resolve the identifier
      const symbol = node.getSymbol();
      if (symbol) {
        const valueDeclaration = symbol.getValueDeclaration();
        if (valueDeclaration && Node.isVariableDeclaration(valueDeclaration)) {
          const initializer = valueDeclaration.getInitializer();
          if (initializer && Node.isStringLiteral(initializer)) {
            return initializer.getLiteralValue();
          }
        }
      }
    }
    return node.getText().replace(/['"]/g, "");
  }

  private extractComponentFromInitializer(node: Node): string {
    const text = node.getText();

    // Handle JSX elements like <Component />
    const jsxMatch = text.match(/<(\w+)/);
    if (jsxMatch) {
      return jsxMatch[1];
    }

    // Handle direct component references
    if (Node.isIdentifier(node)) {
      return node.getText();
    }

    // Handle lazy loading
    if (text.includes("lazy")) {
      const lazyMatch = text.match(/lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (lazyMatch) {
        const importPath = lazyMatch[1];
        return this.getComponentNameFromPath(importPath);
      }
    }

    return text;
  }

  private getComponentNameFromPath(importPath: string): string {
    const fileName = path.basename(importPath, path.extname(importPath));
    return this.kebabToPascalCase(fileName);
  }

  private kebabToPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private buildFullPath(parentPath: string, childPath: string): string {
    if (childPath.startsWith("/")) {
      return childPath;
    }
    
    const cleanParent = parentPath.endsWith("/") 
      ? parentPath.slice(0, -1) 
      : parentPath;
    
    const cleanChild = childPath.startsWith("/") 
      ? childPath.slice(1) 
      : childPath;
    
    if (cleanParent === "" || cleanParent === "/") {
      return "/" + cleanChild;
    }
    
    return cleanParent + "/" + cleanChild;
  }

  private addRoute(routeConfig: RouteConfig): void {
    const route: Route = {
      path: routeConfig.path,
      fullPath: routeConfig.path.startsWith("/")
        ? routeConfig.path
        : "/" + routeConfig.path,
      component: routeConfig.component || routeConfig.element,
      guards: routeConfig.guards,
    };

    // Avoid duplicates
    const exists = this.routes.some(
      (r) => r.fullPath === route.fullPath && r.component === route.component
    );

    if (!exists) {
      this.routes.push(route);
      if (route.component) {
        this.routeComponents.add(route.component);
      }
    }
  }

  private async analyzeNextJsRouting(): Promise<void> {
    console.log("🔷 Analyzing Next.js routing...");

    // Check for pages directory (Pages Router)
    const pagesDir = path.join(this.projectPath, "pages");
    if (fs.existsSync(pagesDir)) {
      await this.analyzeNextJsPagesRouter(pagesDir);
    }

    // Check for src/pages directory
    const srcPagesDir = path.join(this.projectPath, "src", "pages");
    if (fs.existsSync(srcPagesDir)) {
      await this.analyzeNextJsPagesRouter(srcPagesDir);
    }

    // Check for app directory (App Router)
    const appDir = path.join(this.projectPath, "app");
    if (fs.existsSync(appDir)) {
      await this.analyzeNextJsAppRouter(appDir);
    }

    // Check for src/app directory
    const srcAppDir = path.join(this.projectPath, "src", "app");
    if (fs.existsSync(srcAppDir)) {
      await this.analyzeNextJsAppRouter(srcAppDir);
    }
  }

  private async analyzeNextJsPagesRouter(pagesDir: string): Promise<void> {
    const pageFiles = await glob("**/*.{js,jsx,ts,tsx}", {
      cwd: pagesDir,
      absolute: true,
      ignore: ["_app.*", "_document.*", "api/**"],
    });

    for (const file of pageFiles) {
      const relativePath = path.relative(pagesDir, file);
      const routePath = this.nextJsFileToRoute(relativePath);
      const componentName = this.getComponentNameFromFile(file);

      this.routes.push({
        path: routePath,
        fullPath: routePath,
        component: componentName,
      });

      this.routeComponents.add(componentName);
    }
  }

  private async analyzeNextJsAppRouter(appDir: string): Promise<void> {
    const pageFiles = await glob("**/page.{js,jsx,ts,tsx}", {
      cwd: appDir,
      absolute: true,
    });

    for (const file of pageFiles) {
      const relativePath = path.relative(appDir, path.dirname(file));
      const routePath = this.nextJsAppDirToRoute(relativePath);
      const componentName = this.getComponentNameFromFile(file);

      this.routes.push({
        path: routePath,
        fullPath: routePath,
        component: componentName,
      });

      this.routeComponents.add(componentName);
    }

    // Also check for route.ts/js files (API routes)
    const routeFiles = await glob("**/route.{js,ts}", {
      cwd: appDir,
      absolute: true,
    });

    for (const file of routeFiles) {
      const relativePath = path.relative(appDir, path.dirname(file));
      const routePath = this.nextJsAppDirToRoute(relativePath);

      this.routes.push({
        path: routePath + " (API)",
        fullPath: routePath,
        component: "API Route",
      });
    }
  }

  private nextJsFileToRoute(filePath: string): string {
    let route = "/" + filePath.replace(/\.(js|jsx|ts|tsx)$/, "");

    // Handle index files
    route = route.replace(/\/index$/, "");

    // Convert [...param] to :param* (catch-all)
    route = route.replace(/\[\.\.\.([^\]]+)\]/g, ":$1*");

    // Convert [param] to :param
    route = route.replace(/\[([^\]]+)\]/g, ":$1");

    return route || "/";
  }

  private nextJsAppDirToRoute(dirPath: string): string {
    if (dirPath === ".") return "/";

    let route = "/" + dirPath;

    // Remove route groups (parentheses)
    route = route.replace(/\/\([^)]+\)/g, "");

    // Convert [...param] to :param* (catch-all)
    route = route.replace(/\[\.\.\.([^\]]+)\]/g, ":$1*");

    // Convert [param] to :param
    route = route.replace(/\[([^\]]+)\]/g, ":$1");

    return route;
  }

  private getComponentNameFromFile(filePath: string): string {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Handle special Next.js files
    if (fileName === "page" || fileName === "layout") {
      const dirName = path.basename(path.dirname(filePath));
      if (dirName && dirName !== "." && !dirName.startsWith("(")) {
        return this.kebabToPascalCase(dirName) + "Page";
      }
      return "Page";
    }

    return this.kebabToPascalCase(fileName);
  }

  private async analyzeGatsbyRouting(): Promise<void> {
    console.log("🟣 Analyzing Gatsby routing...");

    // Analyze pages directory
    const pagesDir = path.join(this.projectPath, "src", "pages");
    if (fs.existsSync(pagesDir)) {
      const pageFiles = await glob("**/*.{js,jsx,ts,tsx}", {
        cwd: pagesDir,
        absolute: true,
      });

      for (const file of pageFiles) {
        const relativePath = path.relative(pagesDir, file);
        const routePath = this.gatsbyFileToRoute(relativePath);
        const componentName = this.getComponentNameFromFile(file);

        this.routes.push({
          path: routePath,
          fullPath: routePath,
          component: componentName,
        });

        this.routeComponents.add(componentName);
      }
    }

    // Check for gatsby-node.js for programmatically created pages
    const gatsbyNodePath = path.join(this.projectPath, "gatsby-node.js");
    if (fs.existsSync(gatsbyNodePath)) {
      // This would require more complex parsing of createPage calls
      console.log("  Found gatsby-node.js - manual inspection may be needed for dynamic routes");
    }
  }

  private gatsbyFileToRoute(filePath: string): string {
    let route = "/" + filePath.replace(/\.(js|jsx|ts|tsx)$/, "");
    
    // Handle index files
    route = route.replace(/\/index$/, "");
    
    // Handle 404 page
    if (route === "/404") {
      return "/404";
    }
    
    // Convert {param} to :param
    route = route.replace(/\{([^}]+)\}/g, ":$1");
    
    return route || "/";
  }

  private async analyzeRemixRouting(): Promise<void> {
    console.log("🎸 Analyzing Remix routing...");

    // Analyze routes directory
    const routesDir = path.join(this.projectPath, "app", "routes");
    if (fs.existsSync(routesDir)) {
      const routeFiles = await glob("**/*.{js,jsx,ts,tsx}", {
        cwd: routesDir,
        absolute: true,
      });

      for (const file of routeFiles) {
        const relativePath = path.relative(routesDir, file);
        const routePath = this.remixFileToRoute(relativePath);
        const componentName = this.getComponentNameFromFile(file);

        this.routes.push({
          path: routePath,
          fullPath: routePath,
          component: componentName,
        });

        this.routeComponents.add(componentName);
      }
    }
  }

  private remixFileToRoute(filePath: string): string {
    let route = filePath.replace(/\.(js|jsx|ts|tsx)$/, "");
    
    // Handle index routes
    if (route.endsWith("/_index") || route === "_index") {
      route = route.replace(/\/_index$/, "").replace(/^_index$/, "/");
    }
    
    // Convert $ prefixed params to :param
    route = route.replace(/\$([^/]+)/g, ":$1");
    
    // Handle dot notation for nested routes
    route = route.replace(/\./g, "/");
    
    // Remove underscore prefixes (pathless routes)
    route = route.replace(/\/_/g, "/");
    
    return "/" + route;
  }

  private async analyzeTanstackRouting(): Promise<void> {
    console.log("🔄 Analyzing TanStack Router routes...");

    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Look for route definitions
      const callExpressions = sourceFile.getDescendantsOfKind(
        SyntaxKind.CallExpression
      );

      for (const call of callExpressions) {
        const expression = call.getExpression().getText();
        
        if (expression.includes("createRoute") || expression.includes("Route")) {
          const args = call.getArguments();
          if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
            this.processTanstackRoute(args[0]);
          }
        }
      }
    }
  }

  private processTanstackRoute(routeConfig: ObjectLiteralExpression): void {
    let path = "";
    let component = "";

    for (const prop of routeConfig.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const initializer = prop.getInitializer();

        if (name === "path" && initializer) {
          path = this.extractStringValue(initializer);
        } else if (name === "component" && initializer) {
          component = this.extractComponentFromInitializer(initializer);
        }
      }
    }

    if (path) {
      this.routes.push({
        path,
        fullPath: path.startsWith("/") ? path : "/" + path,
        component,
      });

      if (component) {
        this.routeComponents.add(component);
      }
    }
  }

  private async analyzeReachRouterRouting(): Promise<void> {
    console.log("🎯 Analyzing Reach Router routes...");

    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
      const jsxSelfClosingElements = sourceFile.getDescendantsOfKind(
        SyntaxKind.JsxSelfClosingElement
      );

      const allJsxElements = [...jsxElements, ...jsxSelfClosingElements];

      for (const element of allJsxElements) {
        const tagName = this.getJsxTagName(element);

        // Reach Router uses direct component names with path prop
        if (tagName && this.isComponentName(tagName)) {
          const attributes = this.getJsxAttributes(element);
          const pathAttr = attributes.find((attr) => attr.name === "path");

          if (pathAttr) {
            const path = this.extractAttributeValue(pathAttr.value);
            this.routes.push({
              path,
              fullPath: path.startsWith("/") ? path : "/" + path,
              component: tagName,
            });

            this.routeComponents.add(tagName);
          }
        }
      }
    }
  }

  private async analyzeGenericReactPatterns(): Promise<void> {
    console.log("🔍 Analyzing generic React patterns...");

    // Look for common routing patterns even without specific router library
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Look for switch/case statements that might indicate routing
      this.analyzeSwitchRouting(sourceFile);

      // Look for conditional rendering based on path/route state
      this.analyzeConditionalRouting(sourceFile);

      // Look for route-like configuration objects
      this.analyzeRouteConfigurations(sourceFile);
    }
  }

  private analyzeSwitchRouting(sourceFile: SourceFile): void {
    const switchStatements = sourceFile.getDescendantsOfKind(
      SyntaxKind.SwitchStatement
    );

    for (const switchStmt of switchStatements) {
      const expression = switchStmt.getExpression();
      const expressionText = expression.getText();

      // Check if switch is on pathname or route-like variable
      if (
        expressionText.includes("pathname") ||
        expressionText.includes("route") ||
        expressionText.includes("path")
      ) {
        const caseBlock = switchStmt.getCaseBlock();
        const clauses = caseBlock.getClauses();

        for (const clause of clauses) {
          if (clause.getKind() === SyntaxKind.CaseClause) {
            const caseClause = clause as any; // Cast to access CaseClause methods
            const caseExpression = caseClause.getExpression();
            if (caseExpression && Node.isStringLiteral(caseExpression)) {
              const path = caseExpression.getLiteralValue();
              
              // Try to find the component being rendered
              const statements = caseClause.getStatements();
              let component = "UnknownComponent";

              for (const stmt of statements) {
                const text = stmt.getText();
                const componentMatch = text.match(/<(\w+)/);
                if (componentMatch) {
                  component = componentMatch[1];
                  break;
                }
              }

              this.routes.push({
                path,
                fullPath: path.startsWith("/") ? path : "/" + path,
                component,
              });
            }
          }
        }
      }
    }
  }

  private analyzeConditionalRouting(sourceFile: SourceFile): void {
    // Look for patterns like: pathname === '/something' && <Component />
    const conditionalExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.ConditionalExpression
    );

    for (const conditional of conditionalExpressions) {
      const condition = conditional.getCondition();
      const conditionText = condition.getText();

      // Check if condition involves pathname comparison
      const pathMatch = conditionText.match(/['"]([^'"]+)['"]/);
      if (pathMatch && conditionText.includes("path")) {
        const path = pathMatch[1];
        
        // Try to extract component from the true branch
        const whenTrue = conditional.getWhenTrue();
        const trueBranchText = whenTrue.getText();
        const componentMatch = trueBranchText.match(/<(\w+)/);

        if (componentMatch) {
          this.routes.push({
            path,
            fullPath: path.startsWith("/") ? path : "/" + path,
            component: componentMatch[1],
          });
        }
      }
    }
  }

  private analyzeRouteConfigurations(sourceFile: SourceFile): void {
    // Look for objects/arrays that might contain route configurations
    const objectLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ObjectLiteralExpression
    );

    for (const obj of objectLiterals) {
      const properties = obj.getProperties();
      let hasPath = false;
      let hasComponent = false;
      let path = "";
      let component = "";

      for (const prop of properties) {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          const initializer = prop.getInitializer();

          if (name === "path" || name === "route" || name === "url") {
            hasPath = true;
            if (initializer) {
              path = this.extractStringValue(initializer);
            }
          } else if (
            name === "component" ||
            name === "element" ||
            name === "view" ||
            name === "page"
          ) {
            hasComponent = true;
            if (initializer) {
              component = this.extractComponentFromInitializer(initializer);
            }
          }
        }
      }

      if (hasPath && path) {
        this.routes.push({
          path,
          fullPath: path.startsWith("/") ? path : "/" + path,
          component: hasComponent ? component : "UnknownComponent",
        });
      }
    }
  }

  private async analyzeNavigationFlows(): Promise<void> {
    console.log("🧭 Analyzing navigation flows...");

    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Extract programmatic navigation
      this.extractProgrammaticNavigation(sourceFile);

      // Extract Link components
      this.extractLinkNavigation(sourceFile);

      // Extract anchor tags
      this.extractAnchorNavigation(sourceFile);
    }
  }

  private extractProgrammaticNavigation(sourceFile: SourceFile): void {
    const fromComponent = this.getMainComponentFromFile(sourceFile);
    if (!fromComponent) return;

    const callExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    );

    for (const call of callExpressions) {
      const expression = call.getExpression();
      const expressionText = expression.getText();

      // React Router navigation
      if (
        expressionText.includes("navigate") ||
        expressionText.includes("push") ||
        expressionText.includes("replace") ||
        expressionText.includes("redirect")
      ) {
        const args = call.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          let targetPath = "";

          if (Node.isStringLiteral(firstArg)) {
            targetPath = firstArg.getLiteralValue();
          } else if (Node.isTemplateExpression(firstArg)) {
            // Handle template literals
            targetPath = this.extractPathFromTemplate(firstArg);
          } else if (Node.isObjectLiteralExpression(firstArg)) {
            // Handle object with pathname
            const pathnameProp = firstArg.getProperty("pathname");
            if (pathnameProp && Node.isPropertyAssignment(pathnameProp)) {
              const initializer = pathnameProp.getInitializer();
              if (initializer && Node.isStringLiteral(initializer)) {
                targetPath = initializer.getLiteralValue();
              }
            }
          }

          if (targetPath) {
            this.flows.push({
              from: fromComponent,
              to: targetPath,
              type: "dynamic",
            });
          }
        }
      }

      // Next.js router
      if (expressionText === "router.push" || expressionText === "router.replace") {
        const args = call.getArguments();
        if (args.length > 0 && Node.isStringLiteral(args[0])) {
          const targetPath = args[0].getLiteralValue();
          this.flows.push({
            from: fromComponent,
            to: targetPath,
            type: "dynamic",
          });
        }
      }
    }
  }

  private extractLinkNavigation(sourceFile: SourceFile): void {
    const fromComponent = this.getMainComponentFromFile(sourceFile);
    if (!fromComponent) return;

    const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
    const jsxSelfClosingElements = sourceFile.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement
    );

    const allJsxElements = [...jsxElements, ...jsxSelfClosingElements];

    for (const element of allJsxElements) {
      const tagName = this.getJsxTagName(element);

      if (tagName === "Link" || tagName === "NavLink") {
        const attributes = this.getJsxAttributes(element);
        
        // React Router uses 'to' prop
        const toAttr = attributes.find((attr) => attr.name === "to");
        // Next.js uses 'href' prop
        const hrefAttr = attributes.find((attr) => attr.name === "href");

        const targetAttr = toAttr || hrefAttr;
        if (targetAttr) {
          const targetPath = this.extractAttributeValue(targetAttr.value);
          if (targetPath) {
            this.flows.push({
              from: fromComponent,
              to: targetPath,
              type: "static",
            });
          }
        }
      }
    }
  }

  private extractAnchorNavigation(sourceFile: SourceFile): void {
    const fromComponent = this.getMainComponentFromFile(sourceFile);
    if (!fromComponent) return;

    const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
    const jsxSelfClosingElements = sourceFile.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement
    );

    const allJsxElements = [...jsxElements, ...jsxSelfClosingElements];

    for (const element of allJsxElements) {
      const tagName = this.getJsxTagName(element);

      if (tagName === "a") {
        const attributes = this.getJsxAttributes(element);
        const hrefAttr = attributes.find((attr) => attr.name === "href");

        if (hrefAttr) {
          const href = this.extractAttributeValue(hrefAttr.value);
          // Only track internal links
          if (href && href.startsWith("/") && !href.startsWith("//")) {
            this.flows.push({
              from: fromComponent,
              to: href,
              type: "static",
            });
          }
        }
      }
    }
  }

  private extractPathFromTemplate(template: Node): string {
    // Simple extraction - in real implementation would need more sophisticated parsing
    const text = template.getText();
    // Extract static parts and indicate dynamic parts
    const cleaned = text.replace(/\$\{[^}]+\}/g, ":param");
    return cleaned.replace(/[`'"]/g, "");
  }

  private getMainComponentFromFile(sourceFile: SourceFile): string | null {
    const filePath = sourceFile.getFilePath();
    const components = this.fileToComponentMap.get(filePath);

    if (components && components.size > 0) {
      // Prefer default export or route component
      for (const component of components) {
        if (this.routeComponents.has(component)) {
          return component;
        }
      }
      // Return first component if no route component found
      return Array.from(components)[0];
    }

    // Fallback to filename
    return this.getComponentNameFromFile(filePath);
  }

  private async analyzeMenuStructures(): Promise<void> {
    console.log("📋 Analyzing menu structures...");

    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Look for navigation/menu related files
      const filePath = sourceFile.getFilePath();
      if (
        filePath.includes("nav") ||
        filePath.includes("menu") ||
        filePath.includes("sidebar") ||
        filePath.includes("header")
      ) {
        this.extractMenuFromFile(sourceFile);
      }
    }
  }

  private extractMenuFromFile(sourceFile: SourceFile): void {
    // Look for menu-like data structures
    const arrayLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ArrayLiteralExpression
    );

    for (const array of arrayLiterals) {
      if (this.isMenuArray(array)) {
        this.processMenuArray(array);
      }
    }

    // Also look for object literals that might be menus
    const objectLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ObjectLiteralExpression
    );

    for (const obj of objectLiterals) {
      if (this.isMenuObject(obj)) {
        const menu = this.extractMenuFromObject(obj);
        if (menu) {
          this.menus.push(menu);
        }
      }
    }
  }

  private isMenuArray(array: ArrayLiteralExpression): boolean {
    const elements = array.getElements();
    if (elements.length === 0) return false;

    // Check if array contains menu-like objects
    return elements.some((element) => {
      if (Node.isObjectLiteralExpression(element)) {
        const props = element.getProperties();
        const hasTitle = props.some(
          (prop) =>
            Node.isPropertyAssignment(prop) &&
            (prop.getName() === "title" ||
              prop.getName() === "label" ||
              prop.getName() === "name")
        );
        const hasPath = props.some(
          (prop) =>
            Node.isPropertyAssignment(prop) &&
            (prop.getName() === "path" ||
              prop.getName() === "href" ||
              prop.getName() === "to" ||
              prop.getName() === "url")
        );
        return hasTitle && hasPath;
      }
      return false;
    });
  }

  private isMenuObject(obj: ObjectLiteralExpression): boolean {
    const props = obj.getProperties();
    const hasTitle = props.some(
      (prop) =>
        Node.isPropertyAssignment(prop) &&
        (prop.getName() === "title" ||
          prop.getName() === "label" ||
          prop.getName() === "name")
    );
    const hasPath = props.some(
      (prop) =>
        Node.isPropertyAssignment(prop) &&
        (prop.getName() === "path" ||
          prop.getName() === "href" ||
          prop.getName() === "to" ||
          prop.getName() === "url")
    );
    return hasTitle && hasPath;
  }

  private processMenuArray(array: ArrayLiteralExpression): void {
    const elements = array.getElements();

    for (const element of elements) {
      if (Node.isObjectLiteralExpression(element)) {
        const menu = this.extractMenuFromObject(element);
        if (menu) {
          this.menus.push(menu);
        }
      }
    }
  }

  private extractMenuFromObject(
    obj: ObjectLiteralExpression
  ): MenuDefinition | null {
    let title = "";
    let path = "";
    let children: MenuDefinition[] = [];
    let roles: string[] = [];

    for (const prop of obj.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const initializer = prop.getInitializer();

        if (
          (name === "title" || name === "label" || name === "name") &&
          initializer
        ) {
          title = this.extractStringValue(initializer);
        } else if (
          (name === "path" || name === "href" || name === "to" || name === "url") &&
          initializer
        ) {
          path = this.extractStringValue(initializer);
        } else if (
          (name === "children" || name === "items" || name === "submenu") &&
          initializer &&
          Node.isArrayLiteralExpression(initializer)
        ) {
          children = this.extractMenuChildren(initializer);
        } else if (
          name === "roles" &&
          initializer &&
          Node.isArrayLiteralExpression(initializer)
        ) {
          roles = this.extractStringArray(initializer);
        }
      }
    }

    if (title && path) {
      return {
        title,
        path,
        children: children.length > 0 ? children : undefined,
        roles: roles.length > 0 ? roles : undefined,
      };
    }

    return null;
  }

  private extractMenuChildren(array: ArrayLiteralExpression): MenuDefinition[] {
    const children: MenuDefinition[] = [];
    const elements = array.getElements();

    for (const element of elements) {
      if (Node.isObjectLiteralExpression(element)) {
        const child = this.extractMenuFromObject(element);
        if (child) {
          children.push(child);
        }
      }
    }

    return children;
  }

  private extractStringArray(array: ArrayLiteralExpression): string[] {
    const strings: string[] = [];
    const elements = array.getElements();

    for (const element of elements) {
      if (Node.isStringLiteral(element)) {
        strings.push(element.getLiteralValue());
      }
    }

    return strings;
  }

  private addHierarchicalFlows(): void {
    // Add hierarchy relationships between routes
    const sortedRoutes = [...this.routes].sort(
      (a, b) => a.fullPath.length - b.fullPath.length
    );

    for (let i = 0; i < sortedRoutes.length; i++) {
      const route = sortedRoutes[i];
      
      // Find potential parent
      for (let j = i - 1; j >= 0; j--) {
        const potentialParent = sortedRoutes[j];
        
        if (
          route.fullPath.startsWith(potentialParent.fullPath + "/") &&
          potentialParent.fullPath !== "/"
        ) {
          this.flows.push({
            from: potentialParent.fullPath,
            to: route.fullPath,
            type: "hierarchy",
          });
          break;
        }
      }
    }
  }
}
