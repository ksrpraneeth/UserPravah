# Angular Simple Test Project

This is a simple Angular application for testing UserPravah's Angular analysis capabilities with basic routing patterns.

## Features

- Angular 17 with standalone components
- Basic routing configuration
- Multiple pages with navigation
- Template-based navigation with routerLink
- Programmatic navigation examples

## Routes

- `/` - Home page
- `/about` - About page
- `/contact` - Contact page
- `/users/:id` - User profile with dynamic parameter
- `/dashboard` - Dashboard page
- `/settings` - Settings page

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm start
# OR
ng serve
```

The app will be available at `http://localhost:4200`.

## UserPravah Analysis

To analyze this project with UserPravah:

```bash
userpravah . --framework angular
```

This will generate a flow diagram showing all routes and navigation patterns detected in the Angular application, including:
- Route definitions and hierarchical relationships
- Template-based navigation (routerLink)
- Programmatic navigation (router.navigate)
- Component-to-route mappings 