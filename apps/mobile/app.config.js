// Uygulama ayarları app.json'da. Android anlık bildirimleri için Firebase dosyası (google-services.json) depoda tutulmaz:
// sahibi expo.dev → almakisterim projesi → Environment variables'a "GOOGLE_SERVICES_JSON" adlı dosya değişkeni olarak yükler,
// Expo derlemesi sırasında dosyanın yolu bu değişkenle gelir.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
});
