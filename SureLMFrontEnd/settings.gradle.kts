pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories_MODE = "PREFER_SETTINGS"
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "SureLM"
include(":app")
