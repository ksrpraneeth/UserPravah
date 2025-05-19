# UserPravah Test Coverage

This document outlines the Angular routing and navigation features covered by the mock project tests and identifies areas for future test expansion.

## Current Test Coverage

The existing mock projects (`simple-app` and `lazy-load-app`) cover the following scenarios:

### I. Route Definition & Configuration (`app.config.ts`, `*.routes.ts`)

*   **Basic Routes:**
    *   Path to Component mapping (e.g., `{ path: '', component: HomeComponent }`) - `simple-app`, `lazy-load-app`
    *   Route `title` property - `simple-app`, `lazy-load-app`
*   **Redirects:**
    *   `redirectTo` property (e.g., `{ path: 'home', redirectTo: '', pathMatch: 'full' }`) - `simple-app`
    *   `pathMatch: 'full'` - `simple-app`
*   **Path Parameters:**
    *   Dynamic segments in paths (e.g., `{ path: 'about/:id', ... }`) - `simple-app`
*   **Wildcard Routes:**
    *   Catch-all path (`{ path: '**', ... }`) - `simple-app`
*   **Lazy Loading:**
    *   `loadChildren` with dynamic `import()` syntax (e.g., `loadChildren: () => import(...).then(m => m.ROUTES_ARRAY)`) - `lazy-load-app`
    *   `loadComponent` with dynamic `import()` syntax (e.g., `loadComponent: () => import(...).then(m => m.StandaloneComponent)`) - `lazy-load-app`
*   **Route Properties:**
    *   `data` property on a route definition - `lazy-load-app`
    *   `canActivate` property (array of guards) on a route definition - `lazy-load-app`
*   **Nested Routes / Children:**
    *   Basic child routes within a lazy-loaded module's routes file - `lazy-load-app` (`lazy-feature.routes.ts`)

### II. Navigation Mechanisms

*   **Template-based Navigation:**
    *   `routerLink` directive (e.g., `<a routerLink="/">`) - `simple-app`, `lazy-load-app`
    *   `routerLink` with path parameters (e.g., `<a routerLink="/about/test-id">`) - `simple-app`
    *   `routerLink` in components using inline `template` - `simple-app` (Home, App), `lazy-load-app` (Home, App, Lazy, StandaloneDetail)
    *   `routerLink` in components using `templateUrl` - `simple-app` (About)
*   **Programmatic Navigation (in .ts files):**
    *   `Router.navigate([...])` - `simple-app` (HomeComponent)
    *   `Router.navigate([...])` with path parameters - `simple-app` (HomeComponent)
    *   `Router.navigateByUrl('...')` - `simple-app` (HomeComponent)
    *   Conditional programmatic navigation (e.g., inside an `if` block) - `simple-app` (HomeComponent)

### III. Component Configurations Related to Routing

*   **Standalone Components:** All mock projects currently use standalone components. - `simple-app`, `lazy-load-app`
*   **`templateUrl` vs. inline `template`:** Both are used. - `simple-app` (About uses `templateUrl`, others inline), `lazy-load-app` (all inline)
*   **`ActivatedRoute`:** Usage to read route parameters (`snapshot.paramMap.get()`). - `simple-app` (AboutComponent)

## Future Test Coverage (Potential Gaps / Enhancements)

*   **NgModule-based Routing:**
    *   `RouterModule.forRoot([...])`
    *   `RouterModule.forChild([...])`
    *   Modules importing other modules that provide routes (via `@NgModule.imports`).
    *   Legacy `loadChildren` string syntax (e.g., `loadChildren: './path/to/module#ModuleName'''`).
*   **Advanced Route Definitions & Structures:**
    *   Spreading imported `Routes` arrays (e.g., `const routes: Routes = [...commonRoutes, { path: 'local' }];`).
    *   Deeply nested `children` arrays defined within a single `Routes` array.
    *   Empty path parent routes for grouping/layout children (e.g., `{ path: '', children: [...] }`).
    *   Componentless routes (routes that only group children or apply guards without rendering a component themselves, often used with an empty path).
*   **Advanced Navigation:**
    *   Navigation with `NavigationExtras` (e.g., `queryParams`, `fragment`, `relativeTo`).
    *   `Router.navigate` with `relativeTo: ActivatedRoute`.
    *   Navigation from services or non-component classes.
*   **Outlets:**
    *   Named `router-outlet` and routes targeting them.
*   **Guards (Advanced):**
    *   `canLoad`, `canActivateChild`, `resolve`, `canDeactivate` (parsing their presence, not execution).
*   **Error Handling / Edge Cases:**
    *   Malformed route configurations (how the parser handles them gracefully or reports issues).
    *   Non-existent import paths for `loadChildren` or `loadComponent`.

This document should be updated as new test cases are added or the tool's capabilities expand. 