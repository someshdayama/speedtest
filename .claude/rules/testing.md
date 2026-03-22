# Testing Conventions

## Framework
- **Test Runner**: Vitest (with `--pool=forks` flag)
- **DOM**: jsdom
- **Utilities**: React Testing Library + jest-dom matchers
- **Setup**: `src/setupTests.js` imports `@testing-library/jest-dom`

## File Structure
- Place test files alongside source files: `Component.test.jsx`
- Test setup in `src/setupTests.js`

## Guidelines
- Test behavior, not implementation details
- Use accessible queries: `screen.getByRole()`, `screen.getByText()`, `screen.getByLabelText()`
- Avoid `getByTestId()` — prefer semantic queries
- Mock network requests and external APIs
- Test all user interactions (clicks, inputs, form submissions)
- Test error states and loading states
- Cover edge cases (network failures, empty responses, timeouts)

## Running Tests
```bash
npm run test       # Run all tests once
npm run coverage   # Run tests with coverage report
```

## Coverage
- Aim for high coverage on utility functions and core logic
- Component tests should cover rendering, interactions, and error states
