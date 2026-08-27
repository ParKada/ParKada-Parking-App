export default {
  expo: {
    name: "parkada-mobile",
    slug: "parkada-mobile",
    version: "1.0.0",
    scheme: "parkada",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey: "AIzaSyAe_BSz6u4xkx2UkgT5lKU0RXwhk_TQUeU"
      }
    },
    android: {
      package: "com.parkada.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: "AIzaSyAe_BSz6u4xkx2UkgT5lKU0RXwhk_TQUeU"
        }
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: ["expo-router"],
    extra: {
      supabaseUrl: "https://bwhhfzhrjtvkrrsdxfbh.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDc3NTIsImV4cCI6MjA5NjI4Mzc1Mn0.Iy0QbQe6eeU9y3xx_L6qCqLUFfoH9PQhq82gDtUjYPw",
      eas: {
        projectId: "793af5a3-4b8c-4cb9-bcc7-a44964e20070"
      }
    }
  }
};