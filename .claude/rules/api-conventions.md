# API Conventions

## Speed Test API
- Uses `fast-speedtest-api` for internet speed measurements
- All API/network calls should have proper error handling
- Handle network failures gracefully with user-friendly messages
- Display loading states during speed tests
- Implement timeouts for long-running tests

## Data Flow
- Fetch speed data in the main App component
- Pass results down via props to display components
- Use React state for test results and status
