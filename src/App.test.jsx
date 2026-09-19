import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as speedTestUtils from './utils/speedTest';


vi.mock('./utils/speedTest', () => ({
    startSpeedTest: vi.fn(),
    stopSpeedTest: vi.fn()
}));

vi.mock('./hooks/useNetworkInfo', () => ({
  default: () => ({
    provider: 'Mock Provider',
    type: 'Mock Connection',
    downlink: '10 Mbps',
    ip: '127.0.0.1'
  })
}));

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

describe('Velocity App Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        localStorageMock.getItem.mockReturnValue(JSON.stringify([]));
    });

    it('renders correctly on mount', () => {
        render(<App />);

        expect(screen.getAllByText(/Velocity/i)[0]).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Start speed test/i })).toBeInTheDocument();
    });

    it('executes the full speed test sequence completely rendering the values safely', async () => {
        speedTestUtils.startSpeedTest.mockImplementation(async (callbacks) => {
            callbacks.onStatus('pinging');
            callbacks.onPing(25, 5);
            await Promise.resolve();
            callbacks.onStatus('downloading');
            callbacks.onDownloadProgress(100);
            await Promise.resolve();
            callbacks.onDownloadComplete(200, 30);
            await Promise.resolve();
            callbacks.onStatus('uploading');
            callbacks.onUploadProgress(25);
            await Promise.resolve();
            callbacks.onUploadComplete(50, 40);
            callbacks.onStatus('finished');
        });

        render(<App />);

        const startButton = screen.getByRole('button', { name: /Start speed test/i });
        fireEvent.click(startButton);

        await waitFor(() => {
            expect(screen.getByRole('article', { name: /Download/i })).toBeInTheDocument();
        }, { timeout: 4000 });

        expect(screen.getByRole('button', { name: /Run test again/i })).toBeInTheDocument();
        expect(screen.getByText('Mock Provider')).toBeInTheDocument();
    });

    it('handles testing errors gracefully without crashing the React UI payload', async () => {
        speedTestUtils.startSpeedTest.mockImplementation((callbacks) => {
            callbacks.onError(new Error('Network Down simulated'));
        });

        render(<App />);
        const startButton = screen.getByRole('button', { name: /Start speed test/i });
        fireEvent.click(startButton);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/Network Down simulated/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Start speed test/i })).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
