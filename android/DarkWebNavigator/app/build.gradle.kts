plugins { id("com.android.application") }
android {
    namespace = "org.example.darkwebnavigator"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.example.darkwebnavigator"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "2.0-pro"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
