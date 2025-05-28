# React Sample Test Project

This is a simple React application using React Router for testing UserPravah's React analysis capabilities.

## Features

- React Router v6 with basic routing
- Multiple pages with navigation
- Programmatic navigation examples
- Template-based navigation with Link components

## Routes

- `/` - Home page
- `/about` - About page
- `/contact` - Contact page
- `/users/:id` - User profile with dynamic parameter
- `/dashboard` - Dashboard page
- `/settings` - Settings page
- `*` - 404 Not Found page

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

This will generate a flow diagram showing all routes and navigation patterns detected in the application. 