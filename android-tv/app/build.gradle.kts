plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.daitign.stream"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.daitign.stream"
        minSdk = 21
        targetSdk = 34
        versionCode = 13
        versionName = "1.0.12-tv"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
}

val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
    val distDir = file("${project.rootDir}/../dist")
    if (distDir.exists()) {
        from(distDir)
        into(file("${project.projectDir}/src/main/assets/dist"))
    }
}
tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.webkit:webkit:1.10.0")
}
