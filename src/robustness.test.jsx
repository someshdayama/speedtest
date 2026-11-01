import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import * as speedTestUtils from './utils/speedTest';
import { STORAGE } from './constants';

vi.mock('./utils/speedTest', () => ({ startSpeedTest: vi.fn(), stopSpeedTest: vi.fn() }));
vi.mock('./hooks/useNetworkInfo', () => ({ default: () => ({ provider: 'Mock Provider' }) }));

const RUN = { date: new Date().toISOString(), download: 120, upload: 30, ping: 18, jitter: 2, dlData: [], ulData: [] };

describe('production robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('error boundary shows a recovery screen instead of a blank page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw new Error('boom'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(/Something went wrong/);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('going offline mid-test cancels cleanly and recovers when back online', () => {
    speedTestUtils.startSpeedTest.mockImplementation((cb) => {
      cb.onStatus('downloading');
      return new Promise(() => {}); // never settles: the test is "running"
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Start speed test/i }));
    expect(screen.getByRole('button', { name: /Cancel speed test/i })).toBeInTheDocument();

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(speedTestUtils.stopSpeedTest).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Connection lost/);

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start speed test/i })).toBeInTheDocument();
  });

  it('cancel stops the worker and returns to idle', () => {
    speedTestUtils.startSpeedTest.mockImplementation((cb) => { cb.onStatus('pinging'); return new Promise(() => {}); });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Start speed test/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel speed test/i }));
    expect(speedTestUtils.stopSpeedTest).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Start speed test/i })).toBeInTheDocument();
  });

  it('history sheet is an accessible dialog: focus moves in, Tab is trapped, Esc closes and restores focus', () => {
    window.localStorage.setItem(STORAGE.HISTORY, JSON.stringify([RUN]));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Open history, 1 past run/i }));

    const dialog = screen.getByRole('dialog', { name: 'History' });
    expect(dialog).toHaveFocus();

    const buttons = [...dialog.querySelectorAll('button')];
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(buttons[buttons.length - 1]).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /Open history/i })).toHaveFocus();
  });

  it('clearing history needs a second tap', () => {
    window.localStorage.setItem(STORAGE.HISTORY, JSON.stringify([RUN]));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Open history/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(window.localStorage.getItem(STORAGE.HISTORY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tap again/i }));
    expect(window.localStorage.getItem(STORAGE.HISTORY)).toBeNull();
    expect(screen.queryByRole('button', { name: /Open history/i })).not.toBeInTheDocument();
  });
});
