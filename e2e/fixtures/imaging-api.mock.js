window.__imageWrites = [];
export const api = {
  get: async url => url.startsWith('/relationships') ? { connections: [] } : { name: 'Synthetic Patient' },
  post: async (url, body) => {
    if (url !== '/ai/imaging') return [];
    window.__imageWrites.push(body);
    if (window.__imageOutcome === 'hold') return new Promise(resolve => {
      window.__finishImage = () => resolve({ analysis: 'Synthetic late analysis' });
    });
    if (window.__imageOutcome === 'unavailable') throw new Error('Synthetic unavailable provider');
    if (window.__imageOutcome === 'malformed') return { analysis: { diagnosis: 'Synthetic invalid object' } };
    return { analysis: 'Synthetic analysis for clinician review' };
  },
};
