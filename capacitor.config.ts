import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fabioselvaggio.oggi',
  appName: 'OGGI',
  webDir: 'dist',
  ios: {
    // Sfondo dell'app dietro la webview: si vede per un istante all'avvio e
    // durante il rimbalzo, quindi deve essere il colore dell'app, non bianco.
    backgroundColor: '#FAF8F5',
    // La webview non deve rimbalzare: lo scorrimento lo gestisce già il CSS.
    scrollEnabled: false,
    contentInset: 'never',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#FF6B35',
    },
  },
}

export default config
