import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ media: vi.fn(), create: vi.fn(), revoke: vi.fn() }));
vi.mock('@/lib/api', () => ({ cmsApi: { media: mocks.media } }));
import { CmsImage } from './CmsImage';
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('URL', class extends URL { static createObjectURL = mocks.create; static revokeObjectURL = mocks.revoke; }); mocks.create.mockReturnValue('blob:test-fixture'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('renders only local blobs and revokes them while cancelling on unmount', async () => {
  mocks.media.mockResolvedValue(new Blob(['test'], { type: 'image/png' })); const view = render(<CmsImage src="https://cms.example.test/uploads/test.png" alt="Fixture cover" />);
  expect(await screen.findByRole('img', { name: 'Fixture cover' })).toHaveAttribute('src', 'blob:test-fixture');
  const signal = mocks.media.mock.calls[0][1].signal; view.unmount(); expect(signal.aborted).toBe(true); expect(mocks.revoke).toHaveBeenCalledWith('blob:test-fixture');
});
it('does not embed redirected or unavailable remote media', async () => {
  mocks.media.mockRejectedValue(new TypeError('test redirect rejected')); const view = render(<CmsImage src="https://cms.example.test/uploads/test.png" alt="Unavailable fixture" />);
  await vi.waitFor(() => expect(mocks.media).toHaveBeenCalled()); expect(view.container.querySelector('img')).toBeNull(); expect(mocks.create).not.toHaveBeenCalled();
});
