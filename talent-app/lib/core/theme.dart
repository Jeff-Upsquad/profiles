import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tokens ported from the web talent mobile chrome (`frontend/src/index.css`).
///
/// In-app surfaces are soft (zinc border, pale canvas, black actions). Yellow
/// is an accent wash, not a fill for every button. Login/hero accents use
/// [AppColors.accent] + [AppShadows.brutal].
class AppColors {
  static const primary = Color(0xFF0A0A0A);
  static const primaryDark = Color(0xFF27272A);
  static const surface = Color(0xFFF5F5F6);
  static const card = Colors.white;
  static const textPrimary = Color(0xFF0A0A0A);
  static const textSecondary = Color(0xFF525252);
  static const textTertiary = Color(0xFF737373);
  static const textMuted = Color(0xFFA3A3A3);
  static const border = Color(0xFFE7E7EA);
  static const divider = Color(0xFFF1F1F3);
  static const accent = Color(0xFFFFFF99);
  static const accentHover = Color(0xFFF2F26B);
  static const accentWash = Color(0xFFFFFAC2);
  static const success = Color(0xFF42CC77);
  static const successBg = Color(0xFFECFDF5);
  static const danger = Color(0xFFEF4444);
  static const dangerBg = Color(0xFFFEF2F2);
  static const warning = Color(0xFFF76808);
  static const warningBg = Color(0xFFFFF7ED);
  static const selectedGold = Color(0xFFD97706);
  static const selectedBg = Color(0xFFFEF3C7);
  static const info = Color(0xFF3B82F6);
  static const infoBg = Color(0xFFEFF6FF);
  static const chatMine = Color(0xFF0A0A0A);
  static const chatOther = Color(0xFFF0F0F0);
  static const avatarFill = Color(0xFFEFEFEF);
}

class AppShadows {
  static const soft = [
    BoxShadow(
      color: Color(0x0A000000),
      blurRadius: 2,
      offset: Offset(0, 1),
    ),
  ];
  static const dropdown = [
    BoxShadow(
      color: Color(0x38000000),
      blurRadius: 40,
      offset: Offset(0, 12),
    ),
  ];
  static const brutal = [
    BoxShadow(color: Color(0xFF000000), offset: Offset(3, 3)),
  ];
}

ThemeData buildAppTheme() {
  final display = GoogleFonts.plusJakartaSansTextTheme();
  final ui = GoogleFonts.interTextTheme();

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: Colors.white,
      secondary: AppColors.accent,
      onSecondary: AppColors.primary,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.danger,
    ),
    scaffoldBackgroundColor: AppColors.surface,
    textTheme: display.copyWith(
      headlineLarge: display.headlineLarge?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.025 * 32,
        height: 1.15,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.025 * 28,
        height: 1.15,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.02 * 24,
        height: 1.15,
      ),
      titleLarge: display.titleLarge?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.02 * 22,
      ),
      titleMedium: display.titleMedium?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      titleSmall: ui.titleSmall?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: display.bodyLarge?.copyWith(color: AppColors.textPrimary),
      bodyMedium: display.bodyMedium?.copyWith(color: AppColors.textSecondary),
      bodySmall: ui.bodySmall?.copyWith(color: AppColors.textTertiary),
      labelLarge: ui.labelLarge?.copyWith(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.36,
        color: AppColors.textPrimary,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.card,
      elevation: 0,
      shadowColor: Colors.black,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      margin: EdgeInsets.zero,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
        disabledForegroundColor: Colors.white70,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.14,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        side: const BorderSide(color: AppColors.border),
        textStyle: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.14,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.textSecondary,
        textStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      elevation: 0,
      indicatorColor: Colors.transparent,
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
      space: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      hintStyle: GoogleFonts.inter(
        color: AppColors.textMuted,
        fontSize: 15,
      ),
    ),
  );
}
