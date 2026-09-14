export const api = {
  get: async path => path.includes('/schedule')
    ? { timezone: 'Asia/Kolkata', schedule: { Monday: '09:15-10:15' } }
    : { existingBookings: [] },
  post: async (path, body) => {
    window.__bookingPosts.push({ path, body });
    return { id: 'test-appointment' };
  },
};
