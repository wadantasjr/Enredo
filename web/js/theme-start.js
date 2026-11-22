try {
  const savedTheme = localStorage.getItem('enredo.theme');
  const systemDark = savedTheme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = savedTheme === 'dark' || systemDark ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = ['light','dark','system'].includes(savedTheme) ? savedTheme : 'light';
} catch {}
