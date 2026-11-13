plugins { id("com.android.application") }
android {
    namespace = "org.example.darkwebnavigator"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.example.darkwebnavigator"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
