package com.surelm.presentation.theme

import android.content.Context
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// Light theme colors
private val md_theme_light_primary = Color(0xFF6200EE)
private val md_theme_light_onPrimary = Color(0xFFFFFFFF)
private val md_theme_light_primaryContainer = Color(0xFFEADDFF)
private val md_theme_light_onPrimaryContainer = Color(0xFF21005D)
private val md_theme_light_secondary = Color(0xFF6200EE)
private val md_theme_light_onSecondary = Color(0xFFFFFFFF)
private val md_theme_light_secondaryContainer = Color(0xFFEADDFF)
private val md_theme_light_onSecondaryContainer = Color(0xFF21005D)
private val md_theme_light_tertiary = Color(0xFF3D81CC)
private val md_theme_light_onTertiary = Color(0xFFFFFFFF)
private val md_theme_light_tertiaryContainer = Color(0xFFD6E4FF)
private val md_theme_light_onTertiaryContainer = Color(0xFF001D3B)
private val md_theme_light_background = Color(0xFFF8FAFC)
private val md_theme_light_onBackground = Color(0xFF191C1E)
private val md_theme_light_surface = Color(0xFFFFFFFF)
private val md_theme_light_onSurface = Color(0xFF191C1E)
private val md_theme_light_surfaceVariant = Color(0xFFE7E0EC)
private val md_theme_light_onSurfaceVariant = Color(0xFF49454F)
private val md_theme_light_outline = Color(0xFF7B757F)
private val md_theme_light_inverseOnSurface = Color(0xFFF1F0F4)
private val md_theme_light_inverseSurface = Color(0xFF2E3134)
private val md_theme_light_inversePrimary = Color(0xFFD0BCFF)
private val md_theme_light_shadow = Color(0xFF000000)
private val md_theme_light_surfaceTint = Color(0xFF6200EE)
private val md_theme_light_error = Color(0xFFB3261E)
private val md_theme_light_onError = Color(0xFFFFFFFF)
private val md_theme_light_errorContainer = Color(0xFFF9DEDC)
private val md_theme_light_onErrorContainer = Color(0xFF410E0B)

// Dark theme colors
private val md_theme_dark_primary = Color(0xFFD0BCFF)
private val md_theme_dark_onPrimary = Color(0xFF381E72)
private val md_theme_dark_primaryContainer = Color(0xFF4F378B)
private val md_theme_dark_onPrimaryContainer = Color(0xFFEADDFF)
private val md_theme_dark_secondary = Color(0xFFD0BCFF)
private val md_theme_dark_onSecondary = Color(0xFF381E72)
private val md_theme_dark_secondaryContainer = Color(0xFF4F378B)
private val md_theme_dark_onSecondaryContainer = Color(0xFFEADDFF)
private val md_theme_dark_tertiary = Color(0xFFA3C6EE)
private val md_theme_dark_onTertiary = Color(0xFF00315D)
private val md_theme_dark_tertiaryContainer = Color(0xFF1D4876)
private val md_theme_dark_onTertiaryContainer = Color(0xFFD6E4FF)
private val md_theme_dark_background = Color(0xFF191C1E)
private val md_theme_dark_onBackground = Color(0xFFE2E2E6)
private val md_theme_dark_surface = Color(0xFF191C1E)
private val md_theme_dark_onSurface = Color(0xFFE2E2E6)
private val md_theme_dark_surfaceVariant = Color(0xFF49454F)
private val md_theme_dark_onSurfaceVariant = Color(0xFFCAC4D0)
private val md_theme_dark_outline = Color(0xFF938F99)
private val md_theme_dark_inverseOnSurface = Color(0xFF191C1E)
private val md_theme_dark_inverseSurface = Color(0xFFE2E2E6)
private val md_theme_dark_inversePrimary = Color(0xFF6200EE)
private val md_theme_dark_shadow = Color(0xFF000000)
private val md_theme dark_surfaceTint = Color(0xFFD0BCFF)
private val md_theme_dark_error = Color(0xFFF2B8B5)
private val md_theme_dark_onError = Color(0xFF601410)
private val md_theme_dark_errorContainer = Color(0xFF8C1D18)
private val md_theme_dark_onErrorContainer = Color(0xFFF9DEDC)

fun DynamicLightColorScheme(context: Context): ColorScheme {
    return lightColorScheme(
        primary = md_theme_light_primary,
        onPrimary = md_theme_light_onPrimary,
        primaryContainer = md_theme_light_primaryContainer,
        onPrimaryContainer = md_theme_light_onPrimaryContainer,
        secondary = md_theme_light_secondary,
        onSecondary = md_theme_light_onSecondary,
        secondaryContainer = md_theme_light_secondaryContainer,
        onSecondaryContainer = md_theme_light_onSecondaryContainer,
        tertiary = md_theme_light_tertiary,
        onTertiary = md_theme_light_onTertiary,
        tertiaryContainer = md_theme_light_tertiaryContainer,
        onTertiaryContainer = md_theme_light_onTertiaryContainer,
        background = md_theme_light_background,
        onBackground = md_theme_light_onBackground,
        surface = md_theme_light_surface,
        onSurface = md_theme_light_onSurface,
        surfaceVariant = md_theme_light_surfaceVariant,
        onSurfaceVariant = md_theme_light_onSurfaceVariant,
        outline = md_theme_light_outline,
        inverseOnSurface = md_theme_light_inverseOnSurface,
        inverseSurface = md_theme_light_inverseSurface,
        inversePrimary = md_theme_light_inversePrimary,
        surfaceTint = md_theme_light_surfaceTint,
        onError = md_theme_light_error,
        onErrorContainer = md_theme_light_onErrorContainer
    )
}

fun DynamicDarkColorScheme(context: Context): ColorScheme {
    return darkColorScheme(
        primary = md_theme_dark_primary,
        onPrimary = md_theme_dark_onPrimary,
        primaryContainer = md_theme_dark_primaryContainer,
        onPrimaryContainer = md_theme_dark_onPrimaryContainer,
        secondary = md_theme-dark_secondary,
        onSecondary = md_theme-dark_onSecondary,
        secondaryContainer = md_theme-dark_secondaryContainer,
        onSecondaryContainer = md_theme-dark_onSecondaryContainer,
        tertiary = md_theme-dark_tertiary,
        onTertiary = md_theme-dark_onTertiary,
        tertiaryContainer = md_theme-dark_tertiaryContainer,
        onTertiaryContainer = md_theme-dark_onTertiaryContainer,
        background = md_theme_dark_background,
        onBackground = md_theme_dark_onBackground,
        surface = md_theme_dark_surface,
        onSurface = md_theme-dark_onSurface,
        surfaceVariant = md_theme-dark_surfaceVariant,
        onSurfaceVariant = md_theme-dark_onSurfaceVariant,
        outline = md_theme-dark_outline,
        inverseOnSurface = md_theme-dark_inverseOnSurface,
        inverseSurface = md_theme-dark_inverseSurface,
        inversePrimary = md_theme-dark_inversePrimary,
        surfaceTint = md_theme_dark_surfaceTint,
        onError = md_theme-dark_error,
        onErrorContainer = md_theme-dark_onErrorContainer
    )
}
