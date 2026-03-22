import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as speedTestUtils from './utils/speedTest';

vi.mock('./utils/speedTest', () => ({
    measurePing: vi.fn(),
    measureDownloadSpeed: vi.fn(),
    measureUploadSpeed: vi.fn(),
    getNetworkInfo: vi.fn()
}));

describe('Velocity App Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();

        speedTestUtils.getNetworkInfo.mockResolvedValue({
            provider: 'Mock Provider',
            type: 'Mock Connection',
            downlink: '10 Mbps',
            rtt: '50 ms',
            ip: '127.0.0.1'
        });
    });

    it('renders correctly on mount and dynamically grabs network details', async () => {
        render(<App />);

        // Check main title rendering safely
        expect(screen.getByText(/Velocity/i)).toBeInTheDocument();
        expect(screen.getByText(/True Network Performance Insights/i)).toBeInTheDocument();

        // Check initial speed string
        expect(screen.getByText('READY')).toBeInTheDocument();

        // Check initial info placeholder (Checking... before resolve)
        const checkingElements = screen.getAllByText(/Checking.../i);
        expect(checkingElements.length).toBeGreaterThan(0);

        // Wait for the async effect resolving network info to hit the UI
        await waitFor(() => {
            expect(screen.getByText('Mock Provider')).toBeInTheDocument();
        });
    });

    it('executes the full speed test sequence completely rendering the values safely', async () => {
        speedTestUtils.measurePing.mockResolvedValue({ ping: 25, jitter: 5 });

        // Simulate multiple intermediate download increments just like the real app
        speedTestUtils.measureDownloadSpeed.mockImplementation(async (onProgress) => {
            onProgress(50);
            onProgress(150);
            return 200; // Final download speed cap
        });

        // Simulate upload process chunks
        speedTestUtils.measureUploadSpeed.mockImplementation(async (onProgress) => {
            onProgress(20);
            return 50; // Final upload speed cap
        });

        render(<App />);

        const startButton = screen.getByRole('button', { name: /START TEST/i });
        expect(startButton).toBeInTheDocument();

        // Trigger the speed test core loop
        fireEvent.click(startButton);

        // Wait for the states to cleanly traverse
        expect(screen.getByText(/LATENCY.../i)).toBeInTheDocument();

        // Fast forward to end of state flow
        await waitFor(() => {
            expect(screen.getByText('DOWNLOAD SPEED')).toBeInTheDocument();
        }, { timeout: 4000 });

        // Verify all metrics resolved directly into dom without crashing
        expect(screen.getAllByText('200.0').length).toBeGreaterThan(0); // Speed checks
        expect(screen.getAllByText('50.0').length).toBeGreaterThan(0);  // Upload Checks
        expect(screen.getAllByText('25').length).toBeGreaterThan(0);    // Ping checks
        expect(screen.getAllByText('5').length).toBeGreaterThan(0);     // Jitter checks

        // Button transforms safely
        expect(screen.getByRole('button', { name: /TEST AGAIN/i })).toBeInTheDocument();
    });

    it('handles testing errors gracefully without crashing the React UI payload', async () => {
        // A network rejection mid testing algorithm
        speedTestUtils.measurePing.mockRejectedValue(new Error('Network Down simulated'));

        render(<App />);
        const startButton = screen.getByRole('button', { name: /START TEST/i });
        fireEvent.click(startButton);

        // Should revert the states back to idle cleanly
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /START TEST/i })).toBeInTheDocument();
            expect(screen.getByText('READY')).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
