import { inject } from '@vercel/analytics';

// Inject Vercel Analytics
// In development, you can enable debug mode to see analytics events in the console
inject({
  mode: (typeof window !== 'undefined' && window.location.hostname === 'localhost') ? 'development' : 'production'
});
