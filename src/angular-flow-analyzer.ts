#!/usr/bin/env node
import { Project, SourceFile, SyntaxKind, Node, CallExpression, ArrayLiteralExpression, StringLiteral, ObjectLiteralExpression, PropertyAssignment, Identifier, ArrowFunction, ImportSpecifier } from 'ts-morph';
import { parse as parseHTML } from 'node-html-parser';
import { digraph, toDot, Subgraph, attribute } from 'ts-graphviz'; // Removed Style import
import * as fs from 'fs';
import * as path from 'path';
import glob from 'fast-glob';
import { execSync } from 'child_process';

// Types for our analysis
interface Route {
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

interface NavigationFlow {
    from: string;
    to: string;
    type: 'static' | 'dynamic' | 'guard' | 'redirect';
    condition?: string;
}

interface MenuDefinition {
    title: string;
    path: string;
    children?: MenuDefinition[];
    roles?: string[];
}

class AngularFlowAnalyzer {
    private project: Project;
    private routes: Route[] = [];
    private flows: NavigationFlow[] = [];
    private menus: MenuDefinition[] = [];
    private angularProjectPath: string;
    private processedRouteObjects = new Set<Node>(); // Track processed route object literals
    private processedLazyLoads = new Set<string>(); // To track lazy loads already processed

    // Helper to convert kebab-case to PascalCase for component names
    private kebabToPascalCase(filename: string): string {
        // Get the base name without any extension
        let name = path.basename(filename, path.extname(filename));
        
        // Remove common Angular "type" suffixes if they appear after a dot (e.g., app.component -> app)
        // Also handles cases like 'my-feature.component' becoming 'MyFeature'
        // And removes suffixes if they are part of the kebab name before a dot, e.g., 'my-component-name.routes' -> 'MyComponentName'
        name = name.replace(/\.(component|service|module|pipe|directive|guard|routes|page|config|store|effects|reducer|action|model|interface|enum|util|helper|constant|schema|validator|interceptor|resolver|adapter|facade|query|command|event|subscriber|listener|dto|vo|entity|repository|provider|factory|builder|handler|operator|stream|source|sink|transform|aggregator|projector|saga|orchestrator|coordinator|mediator|gateway|client|proxy|stub|mock|dummy|fake|spec|test|e2e|stories|bench)$/, '');
        
        // Convert kebab-case (e.g., 'my-awesome-feature') to PascalCase
        return name
            .split('-')
            .filter(part => part.length > 0) // Filter out empty strings from multiple hyphens like 'a--b'
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }

    constructor(angularProjectPath: string) {
        this.angularProjectPath = angularProjectPath;
        // Initialize ts-morph project
        this.project = new Project({
            tsConfigFilePath: path.join(this.angularProjectPath, 'tsconfig.json')
        });
    }

    async analyze(): Promise<void> {
        console.log('🚀 Script execution started...');
        console.log('🔍 Starting Angular project analysis...');
        
        await this.addSourceFiles();
        console.log(`올 Total TypeScript source files loaded: ${this.project.getSourceFiles().length}`); // Enhanced Log
        
        console.log('📍 Analyzing routing modules (initial pass)...');
        await this.analyzeRoutingModules('/');
        
        console.log('🔎 Analyzing template files and TS for navigation...');
        await this.analyzeSourceFilesForNavigation();
        
        console.log('📊 Generating flow diagram...');
        if (this.routes.length === 0 && this.flows.length === 0) {
            console.warn('⚠️ No routes or flows were extracted. The generated DOT file will be empty or minimal.');
        }
        await this.generateGraph();
    }

    private async addSourceFiles(): Promise<void> {
        // Add all TypeScript files
        const tsFiles = await glob('**/*.ts', {
            cwd: this.angularProjectPath,
            ignore: ['node_modules/**', 'dist/**']
        });
        
        // Add all HTML template files
        const htmlFiles = await glob('**/*.html', {
            cwd: this.angularProjectPath,
            ignore: ['node_modules/**', 'dist/**']
        });

        this.project.addSourceFilesAtPaths(tsFiles.map(f => path.join(this.angularProjectPath, f)));
    }

    private async analyzeRoutingModules(parentPathForThisContext: string, sourceFilesToSearch?: SourceFile[]): Promise<void> {
        let filesToProcess: SourceFile[];

        if (sourceFilesToSearch) {
            filesToProcess = sourceFilesToSearch;
            console.log(`   [AnalyzeRoutes] Specific scan for ${filesToProcess.length} file(s) with parent context: '${parentPathForThisContext}'`);
        } else {
            // INITIAL CALL - only find and process app.config.ts or app.module.ts
            console.log(`   [AnalyzeRoutes] Initial scan for top-level routing configuration. Parent context for this scan: '${parentPathForThisContext}' (this should be '/')`);
            if (parentPathForThisContext !== '/') {
                console.warn(`   ⚠️ Initial scan for top-level routes was called with parent context '${parentPathForThisContext}' instead of '/'. This might lead to incorrect root paths.`);
            }

            const appConfigTs = this.project.getSourceFile(sf => /app\.config\.ts$/.test(sf.getFilePath()));
            const appModuleTs = this.project.getSourceFile(sf => /app\.module\.ts$/.test(sf.getFilePath()));
            // More general top-level module patterns if app.module.ts is not standard
            const otherTopLevelModules = this.project.getSourceFiles().filter(sf => 
                /src\/app\/[^\/]+\.module\.ts$/.test(sf.getFilePath()) && sf !== appModuleTs
            );

            filesToProcess = [];
            if (appConfigTs) {
                console.log(`    Found app.config.ts: ${appConfigTs.getFilePath()}`);
                filesToProcess.push(appConfigTs);
            }
            // If app.config.ts (with provideRouter) exists, it's usually the main source of routes.
            // If not, app.module.ts (with RouterModule.forRoot) is the next candidate.
            if (appModuleTs && filesToProcess.length === 0) { 
                console.log(`    Found app.module.ts: ${appModuleTs.getFilePath()}`);
                filesToProcess.push(appModuleTs);
            } else if (appModuleTs && filesToProcess.length > 0) {
                 console.log(`    app.config.ts already found, app.module.ts (${appModuleTs.getFilePath()}) will be scanned if it contains RouterModule.forRoot/forChild, but app.config.ts usually takes precedence for provideRouter.`);
                 // Potentially add appModuleTs too if it might contain RouterModule and routes not in app.config.ts
                 // However, this can lead to conflicts if routes are duplicated. For now, prioritize one.
            }

            if (filesToProcess.length === 0 && otherTopLevelModules.length > 0) {
                console.log(`    No app.config.ts or app.module.ts found. Checking other potential top-level modules in src/app/ (e.g., main.ts might import one).`);
                // This is a heuristic: pick the first one or a common one like 'core.module.ts'
                // A more robust solution would trace imports from main.ts
                // For now, let's be cautious to avoid too many false positives for the root context.
                // filesToProcess.push(otherTopLevelModules[0]); 
                // console.log(`    Using ${otherTopLevelModules[0].getFilePath()} as a potential top-level module.`);
            }

            if (filesToProcess.length === 0) {
                console.warn("   ⚠️ No clear top-level routing configuration file (app.config.ts, app.module.ts, or other obvious top-level module in src/app) found for initial route scan. Analysis might be incomplete or start from an arbitrary point if any other file defines routes with root-like paths.");
                // As a last resort, if absolutely no top-level config is found, the old behavior of scanning many files might be needed,
                // but it's prone to the context errors we're trying to solve. So, we'll proceed with an empty set for now if none are explicitly found.
            }
        }
        
        for (const sourceFile of filesToProcess) {
            const filePath = sourceFile.getFilePath();
            // For the initial scan, parentPathForThisContext will be '/', which is correct for app.config/app.module.
            // For subsequent scans (from loadChildren), parentPathForThisContext is the crucial parent's fullPath.
            console.log(`   [AnalyzeRoutes] Processing file: ${filePath} using parent context: '${parentPathForThisContext}'`);
            this.extractRoutes(sourceFile, parentPathForThisContext);
        }
    }

    private extractRoutes(sourceFile: SourceFile, parentPathForThisFileContext: string): void {
        console.log(`   [ExtractRoutes] SourceFile: ${sourceFile.getFilePath()}, Using ParentContextPath: '${parentPathForThisFileContext}'`);
        
        const processedArrayLiterals = new Set<ArrayLiteralExpression>(); // Track arrays processed in this specific call to extractRoutes

        // Priority 1: Find calls to provideRouter, RouterModule.forRoot, RouterModule.forChild
        const routingFunctionCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
            const exprText = call.getExpression().getText();
            return exprText.endsWith('provideRouter') || exprText.endsWith('RouterModule.forRoot') || exprText.endsWith('RouterModule.forChild');
        });

        for (const call of routingFunctionCalls) {
            if (call.getArguments().length > 0) {
                const firstArg = call.getArguments()[0];
                if (Node.isArrayLiteralExpression(firstArg)) {
                    // console.log(`      Found direct ArrayLiteral in ${call.getExpression().getText()} in ${sourceFile.getFilePath()}`);
                    this.processRouteArrayLiteral(firstArg, parentPathForThisFileContext, sourceFile);
                    processedArrayLiterals.add(firstArg);
                } else if (Node.isIdentifier(firstArg)) {
                    const identifierName = firstArg.getText();
                    // console.log(`      Found Identifier '${identifierName}' in ${call.getExpression().getText()} in ${sourceFile.getFilePath()}. Attempting to resolve...`);
                    try {
                        const definitions = firstArg.getDefinitionNodes();
                        for (const def of definitions) {
                            if (Node.isVariableDeclaration(def)) {
                                const initializer = def.getInitializer();
                                if (initializer && Node.isArrayLiteralExpression(initializer)) {
                                    // console.log(`        Resolved '${identifierName}' to an ArrayLiteral in the same file.`);
                                    this.processRouteArrayLiteral(initializer, parentPathForThisFileContext, sourceFile);
                                    processedArrayLiterals.add(initializer);
                                } 
                            } else if (Node.isImportSpecifier(def) || Node.isExportSpecifier(def) || Node.isNamespaceImport(def) || Node.isExportAssignment(def)){
                                const importSourceFile = def.getSourceFile();
                                if (importSourceFile && importSourceFile !== sourceFile) {
                                    console.log(`        Identifier '${identifierName}' is imported from ${importSourceFile.getFilePath()}. Analyzing imported file with context '${parentPathForThisFileContext}'.`);
                                    this.project.addSourceFileAtPathIfExists(importSourceFile.getFilePath());
                                    this.project.resolveSourceFileDependencies();
                                    // Call analyzeRoutingModules for the imported file, ensuring it gets the correct parent context.
                                    // This is better than directly calling extractRoutes here, as analyzeRoutingModules handles specific file processing.
                                    this.analyzeRoutingModules(parentPathForThisFileContext, [importSourceFile]);
                                    // We assume analyzeRoutingModules will set its own flag or handle processing, so don't set mainRoutesArrayFoundAndProcessed here.
                                } else if (importSourceFile === sourceFile) {
                                     const localDeclarations = sourceFile.getVariableDeclarations().filter(vd => vd.getName() === identifierName);
                                     for(const localDec of localDeclarations){
                                        const initializer = localDec.getInitializer();
                                        if (initializer && Node.isArrayLiteralExpression(initializer)) {
                                            this.processRouteArrayLiteral(initializer, parentPathForThisFileContext, sourceFile);
                                            processedArrayLiterals.add(initializer);
                                            break; 
                                        }
                                     }
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`      Error resolving identifier '${identifierName}' in ${sourceFile.getFilePath()}: ${error}`);
                    }
                }
            }
        }

        // ---- START NEW LOGIC TO PARSE NGMODULE IMPORTS ----
        if (sourceFile.getFilePath().endsWith('.module.ts')) {
            console.log(`   [ExtractRoutes - NgModuleScan] File ${sourceFile.getFilePath()} is a module. Scanning @NgModule imports.`);
            const ngModuleDecorators = sourceFile.getDescendantsOfKind(SyntaxKind.Decorator).filter(d => d.getName() === 'NgModule');

            for (const decorator of ngModuleDecorators) {
                const decoratorArg = decorator.getArguments()[0];
                if (decoratorArg && Node.isObjectLiteralExpression(decoratorArg)) {
                    const importsProperty = decoratorArg.getProperty('imports');
                    if (importsProperty && Node.isPropertyAssignment(importsProperty)) {
                        const importsInitializer = importsProperty.getInitializer();
                        if (importsInitializer && Node.isArrayLiteralExpression(importsInitializer)) {
                            console.log(`   [ExtractRoutes - NgModuleScan] Found imports array in @NgModule of ${sourceFile.getFilePath()}`);
                            for (const imp of importsInitializer.getElements()) {
                                if (Node.isIdentifier(imp)) {
                                    const importName = imp.getText();
                                    console.log(`   [ExtractRoutes - NgModuleScan]   Found imported identifier: ${importName}`);
                                    try {
                                        const definitionNodes = imp.getDefinitionNodes();
                                        let foundAndProcessedImport = false;

                                        // Detailed logging (can be kept or removed after debugging)
                                        if (importName === 'AppRoutingModule' || importName === 'AuthModule') {
                                            console.log(`   [ExtractRoutes - NgModuleScan - DETAIL] For '${importName}', found ${definitionNodes.length} definition nodes:`);
                                            definitionNodes.forEach((dn, index) => {
                                                console.log(`   [ExtractRoutes - NgModuleScan - DETAIL]   DefNode #${index}: Kind='${dn.getKindName()}', File='${dn.getSourceFile().getFilePath()}'`);
                                                if (Node.isImportSpecifier(dn)) {
                                                    const importDecl = dn.getImportDeclaration();
                                                    console.log(`   [ExtractRoutes - NgModuleScan - DETAIL]     ImportSpecifier details: ModuleSpecifier='${importDecl.getModuleSpecifierValue()}', ImportedFromFile='${importDecl.getModuleSpecifierSourceFile()?.getFilePath() || 'COULD NOT RESOLVE SPECIFIER SOURCE FILE'}'`);
                                                }
                                            });
                                        }

                                        for (const defNode of definitionNodes) {
                                            const definitionSourceFile = defNode.getSourceFile();
                                            // Check if the definition node (e.g., ClassDeclaration) is in a DIFFERENT file
                                            if (definitionSourceFile && definitionSourceFile.getFilePath() !== sourceFile.getFilePath()) {
                                                // We're interested if this definition from another file is a class (typical for Angular modules)
                                                // or other relevant top-level declarations that might contain routes.
                                                if (Node.isClassDeclaration(defNode) || Node.isFunctionDeclaration(defNode) /* potentially add other kinds if needed */) {
                                                    console.log(`   [ExtractRoutes - NgModuleScan]     ACTION: '${importName}' definition (Kind: ${defNode.getKindName()}) found in different file '${definitionSourceFile.getFilePath()}'. Scheduling analysis.`);
                                                    this.project.addSourceFileAtPathIfExists(definitionSourceFile.getFilePath());
                                                    this.project.resolveSourceFileDependencies();
                                                    // Analyze this newly discovered source file
                                                    this.analyzeRoutingModules(parentPathForThisFileContext, [definitionSourceFile]);
                                                    foundAndProcessedImport = true;
                                                    break; // Found the relevant cross-file module declaration
                                                }
                                            } else if (Node.isImportSpecifier(defNode)) {
                                                // This handles cases where the definition IS an import specifier itself,
                                                // which might still be useful if the above direct ClassDeclaration check fails for some reason.
                                                const importDeclaration = defNode.getImportDeclaration();
                                                const importedSourceFileViaSpecifier = importDeclaration.getModuleSpecifierSourceFile();
                                                if (importedSourceFileViaSpecifier && importedSourceFileViaSpecifier.getFilePath() !== sourceFile.getFilePath()) {
                                                     console.log(`   [ExtractRoutes - NgModuleScan]     ACTION (via ImportSpecifier): ${importName} is imported from ${importedSourceFileViaSpecifier.getFilePath()}. Scheduling analysis.`);
                                                    this.project.addSourceFileAtPathIfExists(importedSourceFileViaSpecifier.getFilePath());
                                                    this.project.resolveSourceFileDependencies();
                                                    this.analyzeRoutingModules(parentPathForThisFileContext, [importedSourceFileViaSpecifier]);
                                                    foundAndProcessedImport = true;
                                                    break;
                                                }
                                            }
                                        }

                                        if (!foundAndProcessedImport) {
                                             console.log(`   [ExtractRoutes - NgModuleScan]     No actionable cross-file module definition found for ${importName} after checking ${definitionNodes.length} definition(s).`);
                                             definitionNodes.forEach(dn => {
                                                 console.log(`   [ExtractRoutes - NgModuleScan]       Checked DefNode Kind for ${importName}: ${dn.getKindName()} in File: ${dn.getSourceFile().getFilePath()}`);
                                             });
                                        }
                                    } catch (err) {
                                        console.warn(`   [ExtractRoutes - NgModuleScan]     Error resolving identifier ${importName} in @NgModule imports: ${err}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // ---- END NEW LOGIC TO PARSE NGMODULE IMPORTS ----

        // Fallback or General Scan: 
        // Always run this for all files, but skip arrays already processed by the targeted scan above.
        // console.log(`   [ExtractRoutes] Performing general scan for route arrays in ${sourceFile.getFilePath()}`);
        const allArrayLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);
        for (const arr of allArrayLiterals) {
            if (processedArrayLiterals.has(arr)) {
                // console.log(`   [ExtractRoutes] Skipping array already processed by targeted scan.`);
                continue;
            }

            // Basic structural check: does it look like it might contain route objects?
            const hasRouteLikeElements = arr.getElements().some(el => {
                if (Node.isObjectLiteralExpression(el)) {
                    return el.getProperties().some(prop => 
                        Node.isPropertyAssignment(prop) && 
                        (prop.getName() === 'path' || prop.getName() === 'component' || prop.getName() === 'loadChildren' || prop.getName() === 'redirectTo' || prop.getName() === 'children')
                    );
                }
                return false;
            });

            if (hasRouteLikeElements) {
                // console.log(`   [ExtractRoutes] General scan found a potential route array in ${sourceFile.getFilePath()} at line ${arr.getStartLineNumber()}. Processing it.`);
                this.processRouteArrayLiteral(arr, parentPathForThisFileContext, sourceFile);
            } else {
                // console.log(`   [ExtractRoutes] General scan found an array in ${sourceFile.getFilePath()} at line ${arr.getStartLineNumber()} that does not appear to contain route objects.`);
            }
        }
    }

    // Helper method to process a resolved ArrayLiteralExpression containing routes
    private processRouteArrayLiteral(routeArrayNode: ArrayLiteralExpression, parentRouteContextFullPath: string, sourceFile: SourceFile) {
        console.log(`  [ProcessArrayLiteral] START processing array from file: ${sourceFile.getFilePath()}, ParentContext: '${parentRouteContextFullPath}', Number of elements: ${routeArrayNode.getElements().length}`);
        const parsedRoutes = this.parseRouteArray(routeArrayNode, parentRouteContextFullPath, sourceFile);
        console.log(`  [ProcessArrayLiteral] FINISHED parseRouteArray. Number of parsed routes from this array: ${parsedRoutes.length}`);
        for (const pr of parsedRoutes) {
            // console.log(`    [ProcessArrayLiteral] Considering parsed route: path='${pr.path}', fp='${pr.fullPath}', comp='${pr.component || 'N/A'}', children#='${pr.children?.length || 0}', redirectTo='${pr.redirectTo || 'N/A'}', loadChildren='${pr.loadChildren || 'N/A'}'`);
            this.addRouteToCollection(pr);
        }
    }

    private addRouteToCollection(pr: Route) {
        if (!pr || (!pr.component && !pr.loadChildren && !pr.redirectTo && (!pr.children || pr.children.length === 0) && pr.path === '')) {
            // console.log(`      [AddRoute] Skipping route object that is effectively empty or a simple pathless placeholder: ${pr?.fullPath}`);
            return;
        }
        console.log(`    [AddRoute] Considering to add route: path='${pr.path}', fp='${pr.fullPath}', comp='${pr.component || 'N/A'}', children#='${pr.children?.length || 0}', redirectTo='${pr.redirectTo || 'N/A'}', loadChildren='${pr.loadChildren || 'N/A'}'`);

        // Attempt to find an existing route by fullPath first, as this is the unique identifier for a page.
        const existingRouteByPathIndex = this.routes.findIndex(r => r.fullPath === pr.fullPath);

        if (existingRouteByPathIndex !== -1) {
            const existingRoute = this.routes[existingRouteByPathIndex];
            // If an existing route for the same fullPath is found:
            // 1. If new route has a component and old one didn't, OR
            // 2. If new route has loadChildren and old one didn't, OR
            // 3. If new route has redirectTo and old one didn't,
            // then the new one is more specific/complete for this path.
            let updateReason = '';
            if (pr.component && !existingRoute.component) updateReason = 'new component';
            else if (pr.loadChildren && !existingRoute.loadChildren) updateReason = 'new loadChildren';
            else if (pr.redirectTo && !existingRoute.redirectTo) updateReason = 'new redirectTo';
            // 4. Or if new one has children and old one didn't (less common to override this way)
            // else if (pr.children && pr.children.length > 0 && (!existingRoute.children || existingRoute.children.length === 0)) updateReason = 'new children';

            if (updateReason) {
                console.log(`      [AddRoute] Updating existing route at ${pr.fullPath} because of ${updateReason}. Old comp: ${existingRoute.component}, New comp: ${pr.component}`);
                // Preserve children from the old route if the new one doesn't have them but the old one did (e.g. a grouping route being given a component)
                if (!pr.children && existingRoute.children && existingRoute.children.length > 0 && existingRoute.component !== pr.component) {
                    // Be careful not to wipe out children if we are just adding a component to a path that was a parent.
                    // This case needs very careful thought. Usually, a path is either a parent OR has a component.
                    // For now, if a component is added, it might become a terminal route for that path.
                    console.log(`        New route for ${pr.fullPath} has new ${updateReason}, old route had children. Deciding on children preservation...`);
                    // If the new definition has a component, it usually implies it's the endpoint for that path.
                    // If the old one was just a grouping path, its children are effectively superseded for this specific path if a component is now defined.
                }
                this.routes[existingRouteByPathIndex] = pr; 
            } else if (pr.component && existingRoute.component && pr.component !== existingRoute.component) {
                 console.warn(`      [AddRoute] Ambiguous route definition for ${pr.fullPath}. Existing component: ${existingRoute.component}, New component: ${pr.component}. Keeping existing.`);
            } else {
                // console.log(`      [AddRoute] Existing route at ${pr.fullPath} is same or more complete. Skipping new.`);
            }
            return; // Handled existing path
        }

        // If no route exists for this fullPath, then check for existing component (for different paths)
        // This was the old logic, useful if a component was first defined with a generic path then a more specific one.
        const existingRouteByComponentIndex = this.routes.findIndex(r => r.component && pr.component && r.component === pr.component);
        if (existingRouteByComponentIndex !== -1) {
            const existingRoute = this.routes[existingRouteByComponentIndex];
            if (pr.fullPath.length > existingRoute.fullPath.length || (existingRoute.path === '**' && (pr.component || pr.loadChildren))) {
                console.log(`      [AddRoute] Replacing existing route for component ${pr.component} (old path: ${existingRoute.fullPath}) with new, more specific path: ${pr.fullPath}`);
                this.routes[existingRouteByComponentIndex] = pr;
            } else {
                // console.log(`      [AddRoute] Existing route for component ${pr.component} (path: ${existingRoute.fullPath}) is more specific or same as new route (path: ${pr.fullPath}). Skipping new.`);
            }
            return; // Handled by component specificity
        }

        // If neither fullPath nor component matched for replacement, add as new route (final duplication check)
        const trulyDuplicate = this.routes.find(r => 
            r.fullPath === pr.fullPath && 
            ( (r.component && pr.component && r.component === pr.component) || 
              (r.loadChildren && pr.loadChildren && r.loadChildren === pr.loadChildren) ||
              (r.redirectTo && pr.redirectTo && r.redirectTo === pr.redirectTo) ||
              ( !r.component && !pr.component && !r.loadChildren && !pr.loadChildren && !r.redirectTo && !pr.redirectTo && (r.children && r.children.length > 0) && (pr.children && pr.children.length > 0) )
            )
        );
        if (!trulyDuplicate) {
            // console.log(`      [AddRoute] Adding new route: ${pr.fullPath}`);
            this.routes.push(pr);
        } else {
            // console.log(`      [AddRoute] Skipping truly duplicate route: ${pr.fullPath} (${pr.component || pr.loadChildren || pr.redirectTo || 'path-only with children'})`);
        }
    }

    private parseRouteArray(node: Node, parentRouteContextFullPath: string, sourceFile: SourceFile): Route[] {
        console.log(` [ParseRouteArray] START. ParentContext: '${parentRouteContextFullPath}', Input node kind: ${node.getKindName()}, SourceFile: ${sourceFile.getFilePath()}`);
        const routes: Route[] = [];
        if (Node.isArrayLiteralExpression(node)) {
            node.getElements().forEach(element => {
                if (Node.isObjectLiteralExpression(element)) {
                    if (this.processedRouteObjects.has(element)) {
                        console.log(`  [ParseRouteArray] Skipping already processed route object in ${sourceFile.getFilePath()} at line ${element.getStartLineNumber()}`);
                        return; 
                    }
                    const route = this.parseRouteObject(element, parentRouteContextFullPath, sourceFile);
                    if (route) {
                        console.log(`  [ParseRouteArray] Successfully parsed an object. Result: path='${route.path}', fp='${route.fullPath}', comp='${route.component || 'N/A'}'`);
                        this.processedRouteObjects.add(element); 
                        routes.push(route);
                        if (route.loadChildren) {
                            console.log(`  [ParseRouteArray] Found loadChildren for route path: '${route.path}', fullPath: '${route.fullPath}'. Target: '${route.loadChildren}'. Scheduling lazy load.`);
                            this.loadAndParseLazyModule(route.loadChildren, route.fullPath, sourceFile)
                                .catch(err => {
                                    console.warn(`⚠️ Error processing lazy module ${route.loadChildren} (parent: ${route.fullPath}): ${err.message}`);
                                });
                        }
                    } else {
                        console.log(`  [ParseRouteArray] parseRouteObject returned null for an element.`);
                    }
                }
            });
        }
        console.log(` [ParseRouteArray] END. Returning ${routes.length} routes from this array literal.`);
        return routes;
    }

    private parseRouteObject(node: ObjectLiteralExpression, parentRouteContextFullPath: string, sourceFile: SourceFile): Route | null {
        console.log(`[ParseRouteObject] START. ParentContext: '${parentRouteContextFullPath}', SourceFile: ${sourceFile.getFilePath()}, Line: ${node.getStartLineNumber()}`);
        const props: { [key: string]: any } = {};
        let pathSegmentFromProps: string | undefined = undefined;

        node.getProperties().forEach(prop => {
            if (Node.isPropertyAssignment(prop)) {
                const name = prop.getNameNode().getText();
                const initializer = prop.getInitializer();
                console.log(`  [ParseRouteObject] path: '${pathSegmentFromProps || parentRouteContextFullPath}', Found property: '${name}', Initializer Kind: ${initializer?.getKindName()}`);
                if (!initializer) return;

                switch (name) {
                    case 'path':
                        if (Node.isStringLiteral(initializer)) pathSegmentFromProps = initializer.getLiteralValue();
                        break;
                    case 'component':
                        if (Node.isIdentifier(initializer)) props[name] = initializer.getText();
                        break;
                    case 'loadComponent': 
                        if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
                            const importCall = initializer.getDescendantsOfKind(SyntaxKind.CallExpression)
                                .find(call => call.getExpression().getText() === 'import');
                            if (importCall && importCall.getArguments().length > 0) {
                                // Attempt to get component name from .then(m => m.ComponentName)
                                const thenPropertyAccess = importCall.getParentWhile(n => n.getKind() !== SyntaxKind.PropertyAccessExpression && n !== initializer.getBody());
                                if (thenPropertyAccess && Node.isPropertyAccessExpression(thenPropertyAccess)){
                                    const standaloneCompName = thenPropertyAccess.getNameNode().getText();
                                    console.log(`    [ParseRouteObject] Extracted component name '${standaloneCompName}' from loadComponent for path '${pathSegmentFromProps || parentRouteContextFullPath}'`);
                                    props['component'] = standaloneCompName; // Store it as if it were a direct component property
                                } else {
                                    // Fallback: try to derive from the import path if no .then(m => m.Comp) is found
                                    const importPathNode = importCall.getArguments()[0];
                                    if (Node.isStringLiteral(importPathNode)) {
                                        const importedFileName = importPathNode.getLiteralValue().split('/').pop()?.split('.')[0];
                                        if (importedFileName) {
                                            const derivedCompName = this.kebabToPascalCase(importedFileName);
                                            console.log(`    [ParseRouteObject] No direct component access in loadComponent's .then(). Derived component name '${derivedCompName}' from import path '${importPathNode.getLiteralValue()}' for path '${pathSegmentFromProps || parentRouteContextFullPath}'`);
                                            props['component'] = derivedCompName;
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    case 'loadChildren':
                        console.log(`[ParseRouteObject] Found 'loadChildren' property for path '${pathSegmentFromProps || parentRouteContextFullPath}'. Initializer Kind: ${initializer.getKindName()}, Text: ${initializer.getText().substring(0, 100)}...`);
                        if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
                            const importCall = initializer.getDescendantsOfKind(SyntaxKind.CallExpression)
                                .find(call => call.getExpression().getText() === 'import');
                            if (importCall && importCall.getArguments().length > 0) {
                                const importPathNode = importCall.getArguments()[0];
                                if (Node.isStringLiteral(importPathNode)) {
                                    props[name] = importPathNode.getLiteralValue(); 
                                    console.log(`    [ParseRouteObject] Extracted loadChildren target via import() directly in function: '${props[name]}'`);
                                } else {
                                    console.log(`    [ParseRouteObject] loadChildren function's import() argument is not a StringLiteral: ${importPathNode.getKindName()}`);
                                }
                            } else {
                                console.log(`    [ParseRouteObject] loadChildren function does not contain a direct import() call or import() has no arguments.`);
                            }
                        } else if (Node.isStringLiteral(initializer)){
                             props[name] = initializer.getLiteralValue();
                             console.log(`    [ParseRouteObject] Extracted loadChildren target (string literal): '${props[name]}'`);
                        } else if (Node.isIdentifier(initializer)) {
                            console.log(`    [ParseRouteObject] loadChildren initializer is an Identifier: '${initializer.getText()}'. Attempting to resolve it.`);
                            try {
                                const definitions = initializer.getDefinitionNodes();
                                for (const def of definitions) {
                                    if (Node.isVariableDeclaration(def) || Node.isFunctionDeclaration(def) || Node.isPropertyAssignment(def) ) {
                                        let functionBodyNode: Node | undefined = undefined;
                                        if (Node.isVariableDeclaration(def)) functionBodyNode = def.getInitializer();
                                        else if (Node.isFunctionDeclaration(def)) functionBodyNode = def; // FunctionDeclaration node itself
                                        else if (Node.isPropertyAssignment(def)) functionBodyNode = def.getInitializer();
                                       
                                        if (functionBodyNode && (Node.isArrowFunction(functionBodyNode) || Node.isFunctionExpression(functionBodyNode) || Node.isFunctionDeclaration(functionBodyNode))) {
                                            console.log(`        [ParseRouteObject] Resolved identifier '${initializer.getText()}' to a function-like structure (Kind: ${functionBodyNode.getKindName()}).`);
                                            const importCall = functionBodyNode.getDescendantsOfKind(SyntaxKind.CallExpression)
                                                .find(call => call.getExpression().getText() === 'import');
                                            if (importCall && importCall.getArguments().length > 0) {
                                                const importPathNode = importCall.getArguments()[0];
                                                if (Node.isStringLiteral(importPathNode)) {
                                                    props[name] = importPathNode.getLiteralValue();
                                                    console.log(`        [ParseRouteObject] Extracted loadChildren target via resolved identifier's import(): '${props[name]}'`);
                                                    break; // Found it
                                                }
                                            }
                                        }
                                    }
                                }
                                if (!props[name]) {
                                    console.log(`    [ParseRouteObject] Could not resolve loadChildren identifier '${initializer.getText()}' to a function with an import().`);
                                }
                            } catch (err) {
                                console.error(`    [ParseRouteObject] Error resolving loadChildren identifier '${initializer.getText()}': ${err}`);
                            }
                        } else {
                            console.log(`    [ParseRouteObject] loadChildren initializer is not a recognized type. Kind: ${initializer.getKindName()}`);
                        }
                        break;
                    case 'redirectTo':
                        if (Node.isStringLiteral(initializer)) props[name] = initializer.getLiteralValue();
                        break;
                    case 'children':
                        if (Node.isArrayLiteralExpression(initializer)) props[name] = initializer; // Store AST node
                        break;
                    case 'canActivate':
                        if (Node.isArrayLiteralExpression(initializer)) props[name] = initializer; // Store AST node
                        break;
                    case 'data':
                        if (Node.isObjectLiteralExpression(initializer)) props[name] = initializer; // Store AST node
                        break;
                }
            }
        });

        if (pathSegmentFromProps === undefined) {
            // It's common for a route to be just children or redirectTo, path can be optional if parent provides it or it's empty.
            // However, if it has no path, component, children, loadChildren, or redirectTo, it's not a useful route.
            if (!props['component'] && !props['children'] && !props['loadChildren'] && !props['redirectTo'] && !props['loadComponent']) {
                console.log(`[ParseRouteObject] Skipping object with no path and no other defining properties (comp, children, loadChildren, redirectTo) at line ${node.getStartLineNumber()} in ${sourceFile.getFilePath()}`);
                return null;
            }
            // If path is undefined, but other properties exist, treat path as '' for this segment.
            pathSegmentFromProps = ''; 
        }

        const route: Route = { path: pathSegmentFromProps, fullPath: '' };
        console.log(`[ParseRouteObject] pathSegmentFromProps: '${pathSegmentFromProps}'`);

        // Calculate fullPath for the current route object
        if (parentRouteContextFullPath === '/' && route.path === '') { // True root of the application
            route.fullPath = '/';
            if (!this.routes.some(r => r.isRoot)) { // Mark as root only if no other root exists
                route.isRoot = true;
            }
        } else if (parentRouteContextFullPath === '/') { // Direct child of the application root
            route.fullPath = `/${route.path}`;
        } else { // Nested route
            route.fullPath = route.path === '' ? parentRouteContextFullPath : `${parentRouteContextFullPath}/${route.path}`;
        }

        // Normalize fullPath: remove double slashes, then remove trailing slash unless it's just "/"
        route.fullPath = route.fullPath.replace(/\/\//g, '/');
        if (route.fullPath !== '/' && route.fullPath.endsWith('/')) {
            route.fullPath = route.fullPath.slice(0, -1);
        }
         // Ensure fullPath is at least '/' if it somehow became empty (e.g. parent '/', path '')
        if (route.fullPath === '') route.fullPath = '/';
        console.log(`[ParseRouteObject] Calculated fullPath: '${route.fullPath}', componentFromProps: '${props['component'] || 'N/A'}'`);


        // Assign other properties
        if (props['component']) route.component = props['component'] as string;
        if (props['redirectTo']) route.redirectTo = props['redirectTo'] as string;
        if (props['loadChildren']) route.loadChildren = props['loadChildren'] as string;

        if (props['canActivate'] && Node.isArrayLiteralExpression(props['canActivate'])) {
            route.guards = (props['canActivate'] as ArrayLiteralExpression).getElements().map(el => el.getText());
        }

        if (props['data'] && Node.isObjectLiteralExpression(props['data'])) {
            route.data = {};
            (props['data'] as ObjectLiteralExpression).getProperties().forEach(dataProp => {
                if (Node.isPropertyAssignment(dataProp)) {
                    const dataKey = dataProp.getNameNode().getText();
                    const dataValueNode = dataProp.getInitializer();
                    if (dataValueNode) {
                        route.data![dataKey] = Node.isStringLiteral(dataValueNode) ? dataValueNode.getLiteralValue() : dataValueNode.getText();
                    }
                }
            });
        }

        // IMPORTANT: If there are children, parse them using the *newly calculated and finalized* route.fullPath
        // This is critical: children's full paths are relative to their immediate parent's full path.
        if (props['children'] && Node.isArrayLiteralExpression(props['children'])) {
            // console.log(`    Parsing children for ${route.fullPath} (parent context was ${parentRouteContextFullPath}, path segment ${route.path})`);
            const childRoutes = this.parseRouteArray(props['children'] as ArrayLiteralExpression, route.fullPath, sourceFile);
            // Assign to route.children for structural integrity if needed elsewhere, but also add them to the main collection.
            route.children = childRoutes;
            for (const childRoute of childRoutes) {
                this.addRouteToCollection(childRoute);
            }
        }
        
        console.log(`[ParseRouteObject] END. Returning route object for path: '${route.fullPath}'`);
        return route;
    }

    private async loadAndParseLazyModule(modulePathString: string, parentRouteFullPathForLazyModule: string, originatingSourceFile: SourceFile): Promise<void> {
        let resolvedModulePath = modulePathString;
        let exportName: string | undefined = undefined; // For cases like './module#ExportedRoutesArray'
    
        console.log(`  [LoadAndParseLazy] For modulePath: '${modulePathString}', OriginatingFile: ${originatingSourceFile.getFilePath()}, Using ParentRoutePathForLazy: '${parentRouteFullPathForLazyModule}'`);
    
        // Avoid re-processing if this exact lazy load (path + parent context) was already triggered
        // This is a simple guard, might need more sophisticated caching if complex scenarios arise
        const lazyLoadSignature = `${modulePathString}#${parentRouteFullPathForLazyModule}`;
        if (this.processedLazyLoads.has(lazyLoadSignature)) {
            // console.log(`  Skipping already processed lazy load: ${lazyLoadSignature}`);
            return;
        }
    
        if (resolvedModulePath.includes('#')) {
            [resolvedModulePath, exportName] = resolvedModulePath.split('#');
        }
    
        // console.log(`  Attempting to lazy load: Path='${resolvedModulePath}', Export='${exportName}', ParentRoutePath='${parentRouteFullPathForLazyModule}'`);

        // Resolve the module path relative to the originating source file's directory
        const baseDir = path.dirname(originatingSourceFile.getFilePath());
        let absolutePathToTry = path.resolve(baseDir, resolvedModulePath);
    
        // Check for common extensions or if it's a directory
        const extensionsToTry = ['', '.ts', '.module.ts', '.routes.ts'];
        let foundPath: string | undefined = undefined;
    
        for (const ext of extensionsToTry) {
            let currentTry = absolutePathToTry + ext;
            if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
                foundPath = currentTry;
                break;
            }
        }
        
        if (!foundPath && fs.existsSync(absolutePathToTry) && fs.lstatSync(absolutePathToTry).isDirectory()) {
            // If it's a directory, look for common routing file patterns inside it
            // This is a simplified heuristic. Angular's resolution can be more complex (e.g. package.json main/module fields)
            const defaultFiles = ['index.ts', `${path.basename(absolutePathToTry)}.routes.ts`, `${path.basename(absolutePathToTry)}.module.ts`];
            for (const defaultFile of defaultFiles) {
                let currentTry = path.join(absolutePathToTry, defaultFile);
                if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
                    foundPath = currentTry;
                    // console.log(`    Lazy path resolved to directory, found default file: ${foundPath}`);
                    break;
                }
            }
        }

        if (!foundPath) {
            // Fallback: Try resolving from project 'src' or 'src/app' if not found relative to current file
            // This helps with paths like 'app/features/my-feature/my-feature.module'
             const fallbackBasePaths = [path.join(this.angularProjectPath, 'src'), path.join(this.angularProjectPath, 'src/app')];
             for (const basePath of fallbackBasePaths) {
                absolutePathToTry = path.resolve(basePath, resolvedModulePath.startsWith('./') ? resolvedModulePath.substring(2) : resolvedModulePath);
                for (const ext of extensionsToTry) {
                    let currentTry = absolutePathToTry + ext;
                    if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
                        foundPath = currentTry;
                        break;
                    }
                }
                if (foundPath) break;
                 if (!foundPath && fs.existsSync(absolutePathToTry) && fs.lstatSync(absolutePathToTry).isDirectory()) {
                    const defaultFiles = ['index.ts', `${path.basename(absolutePathToTry)}.routes.ts`, `${path.basename(absolutePathToTry)}.module.ts`];
                    for (const defaultFile of defaultFiles) {
                        let currentTry = path.join(absolutePathToTry, defaultFile);
                         if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
                            foundPath = currentTry;
                            break;
                        }
                    }
                    if (foundPath) break;
                }
            }
        }

        if (!foundPath) {
            console.warn(`   ⚠️ Could not resolve lazy-loaded file path: '${modulePathString}' (tried from ${baseDir} and fallbacks). Parent: ${parentRouteFullPathForLazyModule}.`);
            return;
        }
        
        // console.log(`   Successfully resolved lazy module path to: ${foundPath}`);
        const lazyLoadedSourceFile = this.project.addSourceFileAtPathIfExists(foundPath) || this.project.getSourceFile(foundPath);

        if (lazyLoadedSourceFile) {
            this.project.resolveSourceFileDependencies(); // Important after adding a new file
            // console.log(`   Added/Got source file for lazy module: ${lazyLoadedSourceFile.getFilePath()}`);
            // Now, analyze this specific file (or files if it's a module that points to a routing file)
            // The parent path for routes defined in this lazy module is the full path of the route that loaded it.
            
            // If an exportName was specified (e.g., modulePath#ExportedArray), we'd ideally look for that.
            // For now, the existing extractRoutes will scan for any route arrays in the file.
            // A more advanced version would look for `export const ${exportName} = [...]`.
            
            if (foundPath.endsWith('.module.ts')) {
                // If it's a module file, try to find its dedicated routing file first.
                const moduleDir = path.dirname(foundPath);
                const baseModuleName = path.basename(foundPath, '.module.ts');
                const patterns = [`${baseModuleName}-routing.module.ts`, `${baseModuleName}.routing.module.ts`, `${baseModuleName}.routes.ts`];
                let routingFileFound = false;
                for (const pattern of patterns) {
                    const routingFilePath = path.join(moduleDir, pattern);
                    if (fs.existsSync(routingFilePath)) {
                        // console.log(`    Found dedicated routing file for module ${baseModuleName}: ${routingFilePath}`);
                        const routingSourceFile = this.project.addSourceFileAtPathIfExists(routingFilePath) || this.project.getSourceFile(routingFilePath);
                        if (routingSourceFile) {
                            this.project.resolveSourceFileDependencies();
                            // Analyze the routing file with the parentRouteFullPathForLazyModule context
                            console.log(`    [LoadAndParseLazy] Calling analyzeRoutingModules for DEDICATED routing file: ${routingSourceFile.getFilePath()} with ParentContextPath: '${parentRouteFullPathForLazyModule}'`);
                            await this.analyzeRoutingModules(parentRouteFullPathForLazyModule, [routingSourceFile]);
                            routingFileFound = true;
                            break; 
                        }
                    }
                }
                if (!routingFileFound) {
                    // If no dedicated routing file, parse the module file itself for RouterModule.forChild/forRoot or inline routes.
                    // console.log(`    No dedicated routing file for ${baseModuleName}, parsing module file itself: ${lazyLoadedSourceFile.getFilePath()}`);
                    console.log(`    [LoadAndParseLazy] Calling analyzeRoutingModules for MODULE file ITSELF: ${lazyLoadedSourceFile.getFilePath()} with ParentContextPath: '${parentRouteFullPathForLazyModule}'`);
                    await this.analyzeRoutingModules(parentRouteFullPathForLazyModule, [lazyLoadedSourceFile]);
                }
            } else {
                // If it's a .routes.ts file or other .ts file, parse it directly.
                // console.log(`    Parsing non-module lazy loaded file directly: ${lazyLoadedSourceFile.getFilePath()}`);
                console.log(`    [LoadAndParseLazy] Calling analyzeRoutingModules for NON-MODULE lazy file: ${lazyLoadedSourceFile.getFilePath()} with ParentContextPath: '${parentRouteFullPathForLazyModule}'`);
                await this.analyzeRoutingModules(parentRouteFullPathForLazyModule, [lazyLoadedSourceFile]);
            }
        } else {
            console.warn(`   ⚠️ Could not add or find source file in project for resolved path: ${foundPath}`);
        }
        this.processedLazyLoads.add(lazyLoadSignature); // Mark this lazy load combination as processed
    }

    private async analyzeSourceFilesForNavigation(): Promise<void> {
        const sourceFiles = this.project.getSourceFiles();
        for (const sourceFile of sourceFiles) {
            // Programmatic navigation in TS files
            // console.log(`  [NavScan] Checking TS file for navigation: ${sourceFile.getFilePath()}`);
            this.extractProgrammaticNavigation(sourceFile);
            
            // Template-based navigation in HTML files (indirectly via TS component files)
            const filePath = sourceFile.getFilePath();
            if (filePath.endsWith('.component.ts')) {
                const componentClass = sourceFile.getClasses()[0]; // Assuming one class per file
                if (componentClass) {
                    console.log(`  [NavScan-Component] Processing component class: ${componentClass.getName()} in ${filePath}`);
                    let templatePath: string | null = null;
                    let templateContent: string | null = null;
                    let isInlineTemplate = false;

                    const decorator = componentClass.getDecorator('Component');
                    if (decorator) {
                        const decoratorArgs = decorator.getArguments();
                        if (decoratorArgs.length > 0 && Node.isObjectLiteralExpression(decoratorArgs[0])) {
                            const metadata = decoratorArgs[0] as ObjectLiteralExpression;
                            const templateUrlProp = metadata.getProperty('templateUrl');
                            if (templateUrlProp && Node.isPropertyAssignment(templateUrlProp)) {
                                const initializer = templateUrlProp.getInitializer();
                                if (initializer && Node.isStringLiteral(initializer)){
                                    const relativePath = initializer.getLiteralValue();
                                    console.log(`    [NavScan-Decorator] Found templateUrl: '${relativePath}' in @Component decorator.`);
                                    templatePath = path.resolve(path.dirname(filePath), relativePath);
                                } else {
                                     console.log(`    [NavScan-Decorator] templateUrl initializer is not a string literal. Kind: ${initializer?.getKindName()}`);
                                }
                            } else {
                                 console.log(`    [NavScan-Decorator] No 'templateUrl' property assignment found in @Component metadata.`);
                            }

                            if (!templatePath) { // Only check for inline if templateUrl isn't found or resolved
                                const templateProp = metadata.getProperty('template');
                                if (templateProp && Node.isPropertyAssignment(templateProp)) {
                                    const initializer = templateProp.getInitializer();
                                    if (initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))) {
                                        templateContent = initializer.getLiteralText();
                                        isInlineTemplate = true;
                                        console.log(`    [NavScan-Decorator] Found inline template in @Component decorator.`);
                                    } else {
                                        console.log(`    [NavScan-Decorator] 'template' property initializer is not a simple string/template literal. Kind: ${initializer?.getKindName()}`);
                                    }
                                } else {
                                     console.log(`    [NavScan-Decorator] No 'template' property assignment found in @Component metadata.`);
                                }
                            }
                        } else {
                             console.log(`    [NavScan-Decorator] @Component decorator has no arguments or first argument is not an ObjectLiteral.`);
                        }
                    } else {
                        console.log(`    [NavScan-Component] No @Component decorator found for class ${componentClass.getName()}.`);
                    }

                    if (templatePath) {
                        if (fs.existsSync(templatePath)) {
                            templateContent = fs.readFileSync(templatePath, 'utf-8');
                            console.log(`    [NavScan-Component] Reading HTML template for navigation: ${templatePath}`);
                        } else {
                            console.log(`    [NavScan-Component] Template file NOT FOUND at resolved path: ${templatePath}`);
                            templateContent = null; // Ensure it's null if not found
                        }
                    }

                    if (templateContent) {
                        this.extractTemplateNavigation(templateContent, isInlineTemplate ? filePath : templatePath!, this.kebabToPascalCase(path.basename(filePath)));
                    }

                } else {
                    console.log(`  [NavScan-Component] No class found in component file: ${filePath}`);
                }
            }
        }
    }

    private extractProgrammaticNavigation(sourceFile: SourceFile): void {
        const navigateCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
            .filter(call => {
                const expr = call.getExpression();
                const exprText = expr.getText();

                // ---- START MODIFIED LOGGING ----
                if (sourceFile.getFilePath().includes('business-create.component.ts')) {
                    console.log(`[DEBUG BusinessCreate NavScan] File: ${sourceFile.getFilePath()}, Line: ${call.getStartLineNumber()}, Candidate Call Expression Text: '${exprText}'`);
                }
                // ---- END MODIFIED LOGGING ----

                const isRouterCall = exprText.match(/router\.(navigate|navigateByUrl)/);
                // ---- START MODIFIED LOGGING ----
                if (isRouterCall && sourceFile.getFilePath().includes('business-create.component.ts')) {
                    console.log(`[DEBUG BusinessCreate NavScan] MATCHED router call: ${exprText} in ${sourceFile.getFilePath()} at line ${call.getStartLineNumber()}`);
                }
                // ---- END MODIFIED LOGGING ----
                if (isRouterCall) {
                     console.log(`    [NavScan-TS] Found router call: ${exprText} in ${sourceFile.getFilePath()} at line ${call.getStartLineNumber()}`);
                }
                return !!isRouterCall;
            });

        for (const call of navigateCalls) {
            const flow = this.parseNavigationCall(call, sourceFile.getFilePath());
            if (flow) {
                this.flows.push(flow);
            }
        }
    }

    private parseNavigationCall(callNode: CallExpression, filePath: string): NavigationFlow | null {
        const expression = callNode.getExpression().getText(); // e.g., "this.router.navigate" or "this.router.navigateByUrl"
        const isNavigateCall = expression.endsWith('router.navigate') || expression.endsWith('router.navigateByUrl');
        if (!isNavigateCall) {
            return null;
        }

        const navArgs = callNode.getArguments();
        if (navArgs.length === 0) {
            return null;
        }

        const targetPathNode = navArgs[0];
        let targetPath: string | undefined;

        if (Node.isArrayLiteralExpression(targetPathNode)) {
            let segments: string[] = [];
            targetPathNode.getElements().forEach(elNode => {
                if (Node.isStringLiteral(elNode)) {
                    segments.push(elNode.getLiteralValue());
                } else {
                    const elText = elNode.getText();
                    // Heuristic: if the expression text (variable name, etc.) contains 'id', map to ':id'
                    // This is common for route parameters like /path/:id
                    // Otherwise, create a param from the expression text, e.g., :someVariable
                    if (elText.toLowerCase().includes('id')) {
                        segments.push(':id'); 
                    } else {
                        segments.push(`:${elText.replace(/[^a-zA-Z0-9_]/g, '')}`); 
                    }
                }
            });

            if (segments.length > 0) {
                let builtPath = "";
                // Check if the first segment defines an absolute path
                if (segments[0].startsWith('/')) {
                    builtPath = segments[0]; // Start with the first segment as is
                    for (let i = 1; i < segments.length; i++) {
                        // Append subsequent segments, ensuring a single slash separator
                        if (!builtPath.endsWith('/')) {
                            builtPath += '/';
                        }
                        // Avoid double slashes if segment itself starts with one
                        builtPath += segments[i].startsWith('/') ? segments[i].substring(1) : segments[i];
                    }
                } else {
                    // All segments are relative, or the first one is relative.
                    // Join them, removing any leading/trailing slashes from individual segments first,
                    // then join with '/'. This assembled path will be treated as relative to the current route later.
                    builtPath = segments.map(s => s.replace(/^\/+|\/+$/g, '')).filter(s => s).join('/');
                }
                targetPath = builtPath.replace(/\/\//g, '/'); // Replace any double slashes
            }
            // Further normalization (like trailing slash removal for non-root) happens later in the function.

        } else if (Node.isStringLiteral(targetPathNode)) {
            targetPath = targetPathNode.getLiteralValue();
        }

        if (targetPath === undefined) {
            console.log(`[AngularFlowAnalyzer] Could not extract target path from navigation call in ${filePath}`);
            return null;
        }

        let fromContextIdentifier: string;
        const containingClass = callNode.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
        if (containingClass && containingClass.getNameNode()) {
            fromContextIdentifier = containingClass.getName()!;
        } else {
            const baseName = path.basename(filePath, path.extname(filePath));
            const strippedName = baseName.replace(/\.(component|service|guard)$/, '');
            fromContextIdentifier = this.kebabToPascalCase(strippedName);
        }

        if (!targetPath.startsWith('/')) {
            let baseComponentRoutePath: string | undefined;

            // Find the route associated with the component/file doing the navigation
            // This now only relies on matching the component class name
            const currentRoute = this.routes.find(r => r.component === fromContextIdentifier);

            if (currentRoute && currentRoute.fullPath) {
                baseComponentRoutePath = currentRoute.fullPath;
                try {
                    const ensuredBasePath = baseComponentRoutePath.startsWith('/') ? baseComponentRoutePath : '/' + baseComponentRoutePath;
                    const baseUrlString = 'http://dummy.com' + ensuredBasePath;
                    const baseUrl = new URL(baseUrlString);
                    targetPath = new URL(targetPath, baseUrl).pathname;
                    console.log(`[AngularFlowAnalyzer] Resolved relative path: original="${navArgs[0].getText()}", base="${baseComponentRoutePath}", resolved="${targetPath}" in ${filePath}`);
                } catch (e: any) {
                    console.warn(`[AngularFlowAnalyzer] Failed to resolve relative path "${targetPath}" against base "${baseComponentRoutePath}" in ${filePath}. Error: ${e.message}`);
                }
            } else {
                console.warn(`[AngularFlowAnalyzer] Could not find current route for context "${fromContextIdentifier}" (from file ${filePath}) to resolve relative navigation target "${targetPath}". Flow might be incorrect.`);
            }
        }

        // Attempt to extract a brief condition/label from leading comments or an enclosing if-statement
        let conditionLabel: string | undefined = undefined;

        // Check for an enclosing if-statement
        const enclosingIf = callNode.getFirstAncestorByKind(SyntaxKind.IfStatement);
        if (enclosingIf) {
            const condText = enclosingIf.getExpression().getText();
            conditionLabel = condText.length > 40 ? condText.substring(0, 37) + '...' : condText;
        }

        // If no if-statement, look for leading comments right before the call
        if (!conditionLabel) {
            const leadingCommentRanges = callNode.getLeadingCommentRanges();
            if (leadingCommentRanges && leadingCommentRanges.length > 0) {
                const srcFileText = callNode.getSourceFile().getFullText();
                const commentRange = leadingCommentRanges[0] as any;
                const commentStart = commentRange.pos;
                const commentEnd = commentRange.end;
                const commentText = srcFileText.substring(commentStart, commentEnd)
                    .replace(/\*|\/\//g, '')
                    .trim();
                if (commentText) {
                    conditionLabel = commentText.length > 40 ? commentText.substring(0, 37) + '...' : commentText;
                }
            }
        }

        const from = (containingClass && containingClass.getNameNode()) ? containingClass.getName()! : fromContextIdentifier;
        console.log(`[AngularFlowAnalyzer] Extracted programmatic navigation: from "${from}" to "${targetPath}" in ${filePath}${conditionLabel ? ' condition="' + conditionLabel + '"' : ''}`);
        return { from, to: targetPath, type: 'dynamic', condition: conditionLabel };
    }

    private extractTemplateNavigation(content: string, templateFilePath: string, fromComponentName: string): void {
        const root = parseHTML(content);
        const routerLinks = root.querySelectorAll('[routerLink]');
        console.log(`    [NavScan-HTML] Found ${routerLinks.length} [routerLink] attributes in ${templateFilePath} (component: ${fromComponentName})`);
        
        for (const link of routerLinks) {
            const routePath = link.getAttribute('routerLink');
            console.log(`      [NavScan-HTML] routerLink value: '${routePath}'`);
            if (routePath) {
                let normalizedToPath = routePath.trim();
                 if (!normalizedToPath.startsWith('/')) {
                    // Relative path, could be complex to resolve fully to an absolute fullPath here
                    // For now, we'll keep it, graph might show it as a separate node if not matched by a fullPath
                } else if (normalizedToPath !== '/' && normalizedToPath.endsWith('/')) {
                    normalizedToPath = normalizedToPath.slice(0, -1); // remove trailing for non-root
                }

                this.flows.push({
                    from: fromComponentName, 
                    to: normalizedToPath, 
                    type: 'static'
                });
            }
        }
    }

    private getNodeColor(routePath: string): string {
        // Generic color scheme
        if (routePath === '/') return '#FF8C00'; // Orange for Root
        if (routePath.startsWith('/auth') || routePath.startsWith('/login') || routePath.startsWith('/oauth')) return '#ADD8E6'; // Light Blue for Auth - common enough
        if (routePath === '/**') return '#D3D3D3'; // Grey for wildcard/redirect catch-all
        // Default color for all other route nodes
        return '#E8E8E8'; // A light grey/off-white for general nodes
    }

    private deriveDisplayName(routePathSegment: string): string {
        if (!routePathSegment || routePathSegment === '/' || routePathSegment === '') return 'Segment';
        return routePathSegment
            .replace(/^[:*]/, '') // Remove starting : or *
            .split(/[-_]/) // Split by dash or underscore
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    private async generateGraph(): Promise<void> {
        // Create a properly structured graph with organized layout
        const g = digraph('AngularFlows', {
            rankdir: 'LR',
            splines: 'polyline',  // Use polyline instead of curved for better label support
            nodesep: 1.2,
            ranksep: 1.8,
            overlap: false,
            concentrate: true
        });
        
        // Configure node styling
        g.attributes.node.set(attribute.shape, 'box');
        g.attributes.node.set(attribute.style, 'filled,rounded');
        g.attributes.node.set(attribute.fontname, 'Arial');
        g.attributes.node.set(attribute.fontsize, 11);
        g.attributes.node.set(attribute.margin, "0.15,0.1");
        g.attributes.node.set(attribute.height, 0.6);
        
        // Configure edge styling
        g.attributes.edge.set(attribute.fontname, 'Arial');
        g.attributes.edge.set(attribute.fontsize, 9);
        
        console.log('Starting generic graph generation...');
        // ---- START DEBUG LOGGING ----
        console.log(`[DEBUG generateGraph - InitialCheck] Total this.routes: ${this.routes.length}`);
        console.log(`[DEBUG generateGraph - InitialCheck] Total this.flows: ${this.flows.length}`);
        // ---- END DEBUG LOGGING ----

        console.log(`Total routes found: ${this.routes.length}`);
        console.log(`Total navigation flows found: ${this.flows.length}`);
        
        // Define data structures to organize the graph
        interface RouteNode {
            id: string;              // Clean ID for DOT
            originalPath: string;    // Original path with parameters
            displayName: string;     // Display name for the node
            pathDepth: number;       // Depth in the path hierarchy (for ranking)
            category: string;        // Category based on the first path segment
            component?: string;      // Associated component if any
            importance: number;      // Importance score based on incoming/outgoing edges
        }
        
        interface FlowEdge {
            source: string;          // Source node ID
            target: string;          // Target node ID
            type: string;            // Type of navigation (static, dynamic, redirect)
            condition?: string;      // Any condition for this navigation
        }
        
        // Map to store all nodes by their original path
        const routeNodes = new Map<string, RouteNode>();
        // Array to store all edges
        const flowEdges: FlowEdge[] = [];
        // Set to track existing edges to avoid duplicates
        const existingEdges = new Set<string>();
        
        // ---- START DEBUG LOGGING for this.routes ----
        console.log(`[DEBUG generateGraph - Routes PreCheck] Dumping relevant this.routes entries:`);
        this.routes.forEach(r => {
            if (r.fullPath.includes('business/create') || r.fullPath.includes('business/:id/connect') || r.fullPath.includes('posts/create')) {
                console.log(`[DEBUG generateGraph - Routes PreCheck] Route: fullPath='${r.fullPath}', component='${r.component}', path='${r.path}'`);
            }
        });
        // ---- END DEBUG LOGGING for this.routes ----
        
        // Helper function to clean route paths for DOT compatibility
        const cleanRoutePath = (path: string): string => {
            // Replace parameters like :id with id
            return path.replace(/:[^\/]+/g, (match) => match.substring(1));
        };
        
        // Function to determine node category based on its path
        const getNodeCategory = (path: string): string => {
            // Generic approach - use the first segment of the path
            const segments = path.split('/').filter(Boolean);
            if (segments.length === 0) return 'root';
            
            return segments[0].toLowerCase();
        };
        
        // Function to get a color for the node based on its category
        const getNodeColor = (category: string, importance: number): string => {
            // Create a consistent color palette based on category hash
            const stringToHexColor = (str: string): string => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                
                // Create a 6-digit hex color
                let color = '#';
                for (let i = 0; i < 3; i++) {
                    // Extract R, G, B components and ensure they're bright enough (>80)
                    const value = ((hash >> (i * 8)) & 0xFF);
                    const brightValue = Math.max(value, 120); // Ensure colors are bright enough
                    color += ('00' + brightValue.toString(16)).substr(-2);
                }
                
                return color;
            };
            
            if (category === 'root') return '#FF8C00'; // Root is always orange
            
            // Generate color from category name
            const baseColor = stringToHexColor(category);
            
            return baseColor;
        };
        
        // STEP 1: Process all routes and create structured node data
        for (const route of this.routes) {
            if (!route.fullPath) continue;
            
            // Skip wildcard routes
            if (route.fullPath.includes('**')) continue;
            
            // Clean the path for DOT compatibility
            const cleanPath = cleanRoutePath(route.fullPath);
            
            // Calculate the path depth for ranking purposes
            const pathDepth = route.fullPath.split('/').filter(Boolean).length;
            
            // Determine node category
            const category = getNodeCategory(route.fullPath);
            
            // Generate the display name
            let displayName = '';
            if (route.fullPath === '/') {
                displayName = 'Root';
            } else if (route.component) {
                // Use component name if available
                displayName = route.component.replace(/Component$/, '');
                // Convert camelCase to Title Case
                displayName = displayName
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase())
                    .trim();
            } else {
                // Use the last path segment
                const lastSegment = route.fullPath.split('/').filter(Boolean).pop() || '';
                displayName = this.deriveDisplayName(lastSegment);
            }
            
            // Store the node information - initialize with importance 0, will calculate later
            routeNodes.set(route.fullPath, {
                id: cleanPath,
                originalPath: route.fullPath,
                displayName,
                pathDepth,
                category,
                component: route.component,
                importance: 0
            });
            
            // Add redirects to the edges array
            if (route.redirectTo) {
                let targetPath = route.redirectTo;
                if (!targetPath.startsWith('/')) {
                    const parentDir = route.fullPath.substring(0, route.fullPath.lastIndexOf('/') + 1) || '/';
                    targetPath = path.posix.resolve(parentDir, targetPath).replace(/\\/g, '/');
                }
                
                targetPath = targetPath.replace(/\/\//g, '/');
                if (targetPath !== '/' && targetPath.endsWith('/')) {
                    targetPath = targetPath.slice(0, -1);
                }
                
                flowEdges.push({
                    source: route.fullPath,
                    target: targetPath,
                    type: 'redirect'
                });
            }
        }
        
        // STEP 2: Process parent-child relationships
        for (const [routePath, node] of routeNodes.entries()) {
            if (routePath === '/') continue;
            
            // Determine parent path
            let parentPath = path.dirname(routePath);
            if (parentPath === '.') parentPath = '/';
            if (parentPath !== '/' && parentPath.endsWith('/')) parentPath = parentPath.slice(0, -1);
            if (parentPath === '') parentPath = '/';
            
            // Add parent-child relationship to edges if both exist
            if (routeNodes.has(parentPath) && parentPath !== routePath) {
                flowEdges.push({
                    source: parentPath,
                    target: routePath,
                    type: 'hierarchy'
                });
            }
        }
        
        // STEP 3: Process navigation flows from the analysis
        // Map component names to route paths
        const componentToRoute = new Map<string, string>();
        for (const [routePath, node] of routeNodes.entries()) {
            if (node.component) {
                // ---- START DEBUG LOGGING for componentToRoute population ----
                if (node.originalPath.includes('business/create') || node.originalPath.includes('business/:id/connect') || node.originalPath.includes('posts/create') || 
                    node.component.includes('BusinessCreate') || node.component.includes('SocialAccountConnect')) {
                    console.log(`[DEBUG generateGraph - componentToRoute] Mapping component: '${node.component}' to routePath: '${routePath}' (Original Node Path: '${node.originalPath}')`);
                }
                // ---- END DEBUG LOGGING for componentToRoute population ----
                componentToRoute.set(node.component, routePath);
                // Also map without Component suffix
                const baseName = node.component.replace(/Component$/, '');
                if (baseName !== node.component) { // Log if a different baseName is also mapped
                     // ---- START DEBUG LOGGING for componentToRoute population ----
                    if (node.originalPath.includes('business/create') || node.originalPath.includes('business/:id/connect') || node.originalPath.includes('posts/create') || 
                        baseName.includes('BusinessCreate') || baseName.includes('SocialAccountConnect')) {
                        console.log(`[DEBUG generateGraph - componentToRoute] Also mapping baseName: '${baseName}' to routePath: '${routePath}'`);
                    }
                    // ---- END DEBUG LOGGING for componentToRoute population ----
                componentToRoute.set(baseName, routePath);
                }
            }
        }
        
        // Add all actual navigation flows to the edges
        for (const flow of this.flows) {
            if (!flow.from || !flow.to) continue;
            
            // Source can be a component or a route
            let sourcePath = componentToRoute.get(flow.from); // Try with the exact name first
            if (!sourcePath) {
                const baseName = flow.from.replace(/Component$/, '');
                sourcePath = componentToRoute.get(baseName); // Try with "Component" suffix removed
            }
            if (!sourcePath && flow.from.startsWith('/')) { // Fallback if flow.from is already a path
                sourcePath = flow.from;
            }
            
            // Target should be a route path
            let targetPath = flow.to;
            if (!targetPath.startsWith('/')) {
                if (sourcePath) {
                    const parentDir = sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1) || '/';
                    targetPath = path.posix.resolve(parentDir, targetPath).replace(/\\/g, '/');
                } else {
                    targetPath = '/' + targetPath;
                }
            }
            
            // Normalize paths
            targetPath = targetPath.replace(/\/\//g, '/');
            if (targetPath !== '/' && targetPath.endsWith('/')) {
                targetPath = targetPath.slice(0, -1);
            }

            // ---- START DEBUG LOGGING ----
            if (flow.from === 'BusinessCreateComponent' || flow.from === 'SocialAccountConnectComponent') {
                console.log(`[DEBUG generateGraph - FlowProcessing] Processing flow: from '${flow.from}' to '${flow.to}'`);
                console.log(`[DEBUG generateGraph - FlowProcessing]   Attempting to find sourcePath for '${flow.from}'. Mapped to: '${sourcePath}'`);
                console.log(`[DEBUG generateGraph - FlowProcessing]   Target path normalized: '${targetPath}'`);
                if (sourcePath) {
                    console.log(`[DEBUG generateGraph - FlowProcessing]   Does routeNodes have sourcePath '${sourcePath}'? ${routeNodes.has(sourcePath)}`);
                } else {
                    console.log(`[DEBUG generateGraph - FlowProcessing]   sourcePath is undefined for flow.from '${flow.from}'.`);
                }
                // Check if targetPath (even if parameterized) can be resolved to a node
                let targetNodeViaDirectGet = routeNodes.get(targetPath);
                console.log(`[DEBUG generateGraph - FlowProcessing]   Direct lookup for targetNode '${targetPath}' in routeNodes: ${targetNodeViaDirectGet ? 'FOUND (' + targetNodeViaDirectGet.id + ')' : 'NOT FOUND'}`);
                if (!targetNodeViaDirectGet) {
                    let targetNodeViaRegex = Array.from(routeNodes.values()).find(node => {
                        const pattern = node.originalPath.replace(/:[^\/]+/g, '[^/]+');
                        const regex = new RegExp(`^${pattern}$`);
                        return regex.test(targetPath!);
                    });
                    console.log(`[DEBUG generateGraph - FlowProcessing]   Regex lookup for targetNode '${targetPath}' in routeNodes: ${targetNodeViaRegex ? 'FOUND (' + targetNodeViaRegex.id + ')' : 'NOT FOUND'}`);
                }

            }
            // ---- END DEBUG LOGGING ----
            
            // Add to edges if source exists
            if (sourcePath && routeNodes.has(sourcePath) && targetPath) { // Ensure targetPath is also somewhat valid
                flowEdges.push({
                    source: sourcePath,
                    target: targetPath, // targetPath here is still potentially parameterized, e.g., /business/:id/connect
                    type: flow.type,
                    condition: flow.condition
                });
            } else {
                // ---- START DEBUG LOGGING ----
                if (flow.from === 'BusinessCreateComponent' || flow.from === 'SocialAccountConnectComponent') {
                     console.log(`[DEBUG generateGraph - FlowProcessing] SKIPPING adding to flowEdges: sourcePath='${sourcePath}' (foundInRouteNodes=${routeNodes.has(sourcePath || '')}), targetPath='${targetPath}'`);
                }
                // ---- END DEBUG LOGGING ----
            }
        }
        
        // STEP 4: Calculate node importance based on edge connections
        // ... existing code ...
        
        // STEP 6: Create nodes in their respective subgraphs
        // ---- START DEBUG LOGGING ----
        console.log(`[DEBUG generateGraph - NodeCreation] Starting STEP 6. Number of routeNodes to process: ${routeNodes.size}`);
        // ---- END DEBUG LOGGING ----
        for (const [routePath, node] of routeNodes.entries()) {
            const color = getNodeColor(node.category, node.importance); // getNodeColor function is defined in the file
            g.createNode(node.id, { // Use node.id which is the cleaned path
                label: `${node.displayName}\\n(${node.originalPath.replace(/"/g, '\\"')})`, // Show display name and original path, escape quotes
                fillcolor: color,
                fontcolor: '#333333', // Dark font for readability
            });
        }
        
        // STEP 7: Create all edges
        // ---- START DEBUG LOGGING ----
        console.log(`[DEBUG generateGraph - EdgeCreation] Starting STEP 7. Number of flowEdges to process: ${flowEdges.length}`);
        // ---- END DEBUG LOGGING ----
        for (const edge of flowEdges) {
            const sourceNode = routeNodes.get(edge.source);
            let actualTargetNode = routeNodes.get(edge.target);

            // If direct target lookup fails, try to match against parameterized routes in routeNodes
            // This is useful if edge.target is an instantiated path (e.g., /business/123/connect)
            // and routeNodes contains the template (e.g., /business/:id/connect)
            if (!actualTargetNode && edge.target) {
                for (const [_, rn] of routeNodes.entries()) {
                    // Create a regex from the originalPath of the routeNode, replacing :param with a general matcher
                    const patternText = rn.originalPath.replace(/:[^\\/]+/g, '[^/]+');
                    const regex = new RegExp(`^${patternText}$`);
                    if (regex.test(edge.target)) {
                        actualTargetNode = rn;
                    break;
            }
                }
            }

            if (sourceNode && actualTargetNode) {
                const edgeKey = `${sourceNode.id}->${actualTargetNode.id}->${edge.type}${edge.condition ? '->' + edge.condition : ''}`;
                if (!existingEdges.has(edgeKey)) {
                    let edgeAttrs: any = {
                        label: '', // Set label to empty string to remove it from the graph
                    };
                    if (edge.type === 'redirect') {
                        edgeAttrs.style = 'dashed';
                        edgeAttrs.color = 'blue';
                        // edgeAttrs.label remains empty
                    } else if (edge.type === 'dynamic') {
                        edgeAttrs.color = '#006400'; // DarkGreen
                        // edgeAttrs.label remains empty
                    } else if (edge.type === 'static') {
                        edgeAttrs.color = '#4682B4'; // SteelBlue
                        // edgeAttrs.label remains empty
                    } else if (edge.type === 'hierarchy') {
                        edgeAttrs.color = '#A9A9A9'; // DarkGray
                        edgeAttrs.arrowhead = 'none';
                        // edgeAttrs.label remains empty
            }
            
                    g.createEdge([sourceNode.id, actualTargetNode.id], edgeAttrs);
                    existingEdges.add(edgeKey);
                }
            } else {
                console.log(`[DEBUG generateGraph - EdgeCreation] Skipping edge: Source '${edge.source}' (node found=${!!sourceNode}) to Target '${edge.target}' (node found=${!!actualTargetNode})`);
            }
        }
        
        // Write the graph to a file
        const dotOutputDirectory = process.cwd();
        const dotPath = path.join(dotOutputDirectory, 'user-flows.dot');
        fs.writeFileSync(dotPath, toDot(g));
        console.log(`DOT file written to: ${dotPath}`);
        
        // Generate PNG using Graphviz
        try {
            const pngPath = path.join(dotOutputDirectory, 'user-flows.png');
            execSync(`dot -Tpng "${dotPath}" -o "${pngPath}"`);
            console.log(`PNG file generated: ${pngPath}`);
        } catch (error) {
            console.error('Error generating PNG (Graphviz may not be installed):', error);
        }
    }
}

// CLI interface
if (process.argv.length < 3) {
    console.error('❌ Error: Please provide the path to your Angular project');
    process.exit(1);
}

const angularProjectPath = process.argv[2];
console.log(`🛠️  Analyzing project at: ${angularProjectPath}`);

const analyzer = new AngularFlowAnalyzer(angularProjectPath);
analyzer.analyze()
    .then(() => {
        console.log('✨ Analysis complete! Dot file should be generated.');
    })
    .catch(error => {
        console.error('❌ Fatal Error during analysis:', error);
        process.exit(1); // Exit if there's a major error
    });