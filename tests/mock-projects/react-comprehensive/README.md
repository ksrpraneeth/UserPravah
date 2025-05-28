# React Comprehensive Test Project

This is a comprehensive React application demonstrating advanced routing patterns and navigation flows for testing UserPravah's React analysis capabilities.

## Features

- **Advanced React Router v6 patterns**
  - Nested routing with outlet components
  - Protected routes with authentication guards
  - Lazy-loaded components with React.lazy()
  - Route redirects and error boundaries
  - Dynamic route parameters and search params

- **Multiple Navigation Methods**
  - Template-based navigation (Link, NavLink)
  - Programmatic navigation (useNavigate hook)
  - Conditional navigation patterns
  - Menu-driven navigation with hierarchical structure

- **Complex Component Architecture**
  - Layout components with nested routing
  - Protected route wrappers
  - Dynamic component loading
  - Context-based state management

## Routes Structure

### Public Routes
- `/` - Home page with overview
- `/about` - About page
- `/contact` - Contact page
- `/login` - Login page

### Protected Routes (require authentication)
- `/dashboard` - Main dashboard
- `/dashboard/analytics` - Analytics dashboard
- `/dashboard/reports` - Reports section

### User Management
- `/users` - Users listing
- `/users/:id` - User profile details
- `/users/:id/edit` - Edit user profile

### Admin Routes (require admin role)
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/admin/settings` - System settings

### Product Management
- `/products` - Products listing
- `/products/:id` - Product details
- `/products/categories/:category` - Products by category

### Settings & Profile
- `/settings` - User settings
- `/settings/profile` - Profile settings
- `/settings/security` - Security settings
- `/profile` - User profile

### Error Handling
- `/404` - Not found page
- `*` - Catch-all route

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will be available at `http://localhost:3000`.

## UserPravah Analysis

To analyze this project with UserPravah:

```bash
userpravah . --framework react
```

This will generate a comprehensive flow diagram showing:
- All routes and their hierarchical relationships
- Navigation flows between components
- Protected route patterns
- Dynamic routing with parameters
- Menu structure and component relationships

## Expected Analysis Results

UserPravah should detect:
- **24+ routes** including nested and dynamic routes
- **45+ navigation flows** from various navigation methods
- **Component mappings** between React components and routes
- **Menu structures** with hierarchical relationships
- **Protected route patterns** with authentication guards 