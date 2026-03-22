import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { measurePing, measureDownloadSpeed, measureUploadSpeed, getNetworkInfo } from './speedTest';

describe('speedTest utilities', () => {
    let mockXhrs = [];

    beforeEach(() => {
        mockXhrs = [];
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('performance', {
            now: vi.fn()
        });

        // We'll set up XMLHttpRequest mock dynamically in the tests that need it or provide a base factory
        vi.stubGlobal('XMLHttpRequest', vi.fn(() => {
            const xhrMock = {
                open: vi.fn(),
                send: vi.fn(),
                setRequestHeader: vi.fn(),
                abort: vi.fn(),
                upload: {}
            };
            mockXhrs.push(xhrMock);
            return xhrMock;
        }));

        // Mock Blob (speed test uses Blob for payload)
        vi.stubGlobal('Blob', class Blob {
            constructor() {
                this.size = 5 * 1024 * 1024;
            }
        });

        // Mock navigator connection for getNetworkInfo
        Object.defineProperty(global.navigator, 'connection', {
            value: { effectiveType: '4g', downlink: 10, rtt: 50 },
            configurable: true,
            writable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('measurePing', () => {
        it('returns latency and jitter correctly', async () => {
            performance.now
                .mockReturnValueOnce(100)
                .mockReturnValueOnce(150)
                .mockReturnValueOnce(200)
                .mockReturnValueOnce(270);

            fetch.mockResolvedValue({ ok: true });

            const result = await measurePing();
            expect(result.ping).toBe(50);
            expect(result.jitter).toBe(20);
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('returns 0 for ping and jitter on fetch failure', async () => {
            fetch.mockRejectedValue(new Error('Network error'));
            performance.now.mockReturnValue(100);

            const result = await measurePing();
            expect(result.ping).toBe(0);
            expect(result.jitter).toBe(0);
        });
    });

    describe('measureDownloadSpeed', () => {
        it('calculates download speed correctly over simulated streams', async () => {
            const mockRead = vi.fn()
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(10 * 1024 * 1024) })
                .mockResolvedValueOnce({ done: true });

            fetch.mockResolvedValue({
                body: { getReader: () => ({ read: mockRead, cancel: vi.fn() }) }
            });

            let timeCount = 1000;
            performance.now.mockImplementation(() => {
                timeCount += 500;
                return timeCount;
            });

            const speed = await measureDownloadSpeed(vi.fn());
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(speed).toBeGreaterThan(0);
        });

        it('returns 0 on missing body support', async () => {
            fetch.mockResolvedValue({}); // no body

            const speed = await measureDownloadSpeed(vi.fn());
            expect(speed).toBe(0);
        });

        it('handles timeout gracefully', async () => {
            const mockCancel = vi.fn();
            const mockRead = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ done: false, value: new Uint8Array(1024) }), 10)));

            fetch.mockResolvedValue({
                body: { getReader: () => ({ read: mockRead, cancel: mockCancel }) }
            });

            // Start=1000, maxDuration=15000. Second check needs to be > 16000 to trigger cancel.
            let times = [1000, 1000, 18000];
            let timeIndex = 0;
            performance.now.mockImplementation(() => times[timeIndex++] || 20000);

            const speed = await measureDownloadSpeed(vi.fn());
            expect(mockCancel).toHaveBeenCalled();
            expect(Math.floor(speed)).toBe(0); // Very tiny float might result on simulated early frame
        });

        it('returns 0 on real failure', async () => {
            fetch.mockRejectedValue(new Error('Fatal error'));
            const speed = await measureDownloadSpeed(vi.fn());
            expect(speed).toBe(0);
        });
    });

    describe('measureUploadSpeed', () => {
        let perfSpy;

        beforeEach(() => {
            let timeCount = 1000;
            perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
                timeCount += 500;
                return timeCount;
            });
        });

        afterEach(() => {
            perfSpy.mockRestore();
        });

        it('calculates upload speed correctly on success via fetch', async () => {
            let resolveFetch;
            fetch.mockReturnValueOnce(new Promise(res => { resolveFetch = res; }));

            const promise = measureUploadSpeed(vi.fn());

            // Await execution block synchronously trick
            await new Promise(r => setTimeout(r, 200));

            resolveFetch({ ok: true });

            const speed = await promise;
            expect(speed).toBeGreaterThan(0);
        });

        it('handles abort/error gracefully on upload', async () => {
            let rejectFetch;
            fetch.mockReturnValueOnce(new Promise((_, rej) => { rejectFetch = rej; }));

            const promise = measureUploadSpeed(vi.fn());

            await new Promise(r => setTimeout(r, 200));

            rejectFetch(new Error('Network error'));

            const speed = await promise;
            expect(speed).toBeGreaterThan(0);
        });

        it('returns 0 on immediate failure without interval ticks', async () => {
            fetch.mockRejectedValueOnce(new Error('Immediate fail'));
            perfSpy.mockImplementation(() => 1000); // Freeze time offsets

            const speed = await measureUploadSpeed(vi.fn());
            expect(speed).toBe(0);
        });
    });

    describe('getNetworkInfo', () => {
        it('fetches ipinfo.io successfully on first try and cleans AS numbers', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ip: '1.2.3.4', org: 'AS12345 Test ISP' })
            });

            const info = await getNetworkInfo();
            expect(info.ip).toBe('1.2.3.4');
            expect(info.provider).toBe('Test ISP');
            expect(info.type).toBe('4g');
        });

        it('falls back to ipify if ipinfo fails', async () => {
            fetch
                .mockResolvedValueOnce({ ok: false })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ ip: '5.6.7.8' }) });

            const info = await getNetworkInfo();
            expect(info.ip).toBe('5.6.7.8');
            expect(info.provider).toBe('General Network');
        });

        it('falls back to local network safely if both APIs fail', async () => {
            fetch
                .mockRejectedValueOnce(new Error('Network error 1'))
                .mockRejectedValueOnce(new Error('Network error 2'));

            const info = await getNetworkInfo();
            expect(info.ip).toBe('Hidden by Browser');
            expect(info.provider).toBe('Local/Private Network');
        });
    });
});
