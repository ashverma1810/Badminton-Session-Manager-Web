package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color

private val DarkColorScheme =
  darkColorScheme(
    primary = SportsPrimaryDark,
    secondary = SportsSecondaryDark,
    tertiary = SportsTertiaryDark,
    background = SportsBackgroundDark,
    surface = SportsSurfaceDark,
    surfaceVariant = SportsSurfaceVariantDark,
    onPrimary = Color(0xFF0F172A), // Slate 900 for high contrast on teal
    onSecondary = Color(0xFF0F172A), // Slate 900 for high contrast on blue
    onTertiary = Color(0xFF0F172A), // Slate 900 for high contrast on lime
    onBackground = SportsOnBackgroundDark,
    onSurface = SportsOnSurfaceDark,
    onSurfaceVariant = SportsOnSurfaceVariantDark
  )

private val LightColorScheme =
  lightColorScheme(
    primary = SportsPrimary,
    secondary = SportsSecondary,
    tertiary = SportsTertiary,
    background = SportsBackground,
    surface = SportsSurface,
    surfaceVariant = SportsSurfaceVariant,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = SportsOnBackground,
    onSurface = SportsOnSurface,
    onSurfaceVariant = SportsOnSurfaceVariant
  )

@Composable
fun MyApplicationTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  // Dynamic color is available on Android 12+
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit,
) {
  val colorScheme =
    when {
      dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
        val context = LocalContext.current
        if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
      }

      darkTheme -> DarkColorScheme
      else -> LightColorScheme
    }

  MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
