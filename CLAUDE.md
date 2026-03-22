# Speedtest

> An internet speed test utility built with React, featuring a beautiful UI for measuring download/upload speeds.

## Tech Stack

- **Framework**: Vite + React 19
- **Speed Testing**: fast-speedtest-api
- **Icons**: Lucide React
- **Language**: JavaScript (JSX)
- **Styling**: Vanilla CSS
- **Testing**: Vitest + React Testing Library + jsdom

## Project Structure

```
src/
├── App.jsx          # Main app component with speed test logic
├── App.css          # App-specific styles
├── App.test.jsx     # Component tests
├── main.jsx         # Entry point
├── index.css        # Global styles
├── setupTests.js    # Test setup (Testing Library)
├── assets/          # Static assets
└── utils/           # Utility functions
```

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint check
npm run test       # Run tests (Vitest, forks pool)
npm run coverage   # Run tests with coverage
```

## Conventions

- Components are `.jsx` files in `src/`
- Tests use `.test.jsx` suffix alongside source files
- Utility functions go in `src/utils/`
- Use Lucide React for all icons
- CSS follows component-scoped patterns
- All new features should include corresponding tests
- Use `screen.getByRole()` and accessible queries in tests
