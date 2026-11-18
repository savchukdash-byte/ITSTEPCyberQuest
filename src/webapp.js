(() => {
  if (window.cq) return;

  const root = document.documentElement;
  const phone = matchMedia('(max-width: 760px), (max-height: 560px) and (pointer: coarse)');
  const updateLayout = () => root.classList.toggle('phone-layout', phone.matches);
  updateLayout();
  phone.addEventListener('change', updateLayout);

  if (!/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator)) return;

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!standalone) root.classList.add('can-install');
  let installPrompt;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener('appinstalled', () => root.classList.remove('can-install'));

  document.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-web-install]')) return;
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      return;
    }
    document.getElementById('install-help').showModal();
  });

  const showOfflineStatus = () => root.classList.toggle('offline-ready', !!navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', showOfflineStatus);
  showOfflineStatus();
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('CyberQuest offline:', error));
})();
