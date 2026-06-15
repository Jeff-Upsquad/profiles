import 'package:flutter/material.dart';

/// A pastel background + matching foreground (icon/accent) colour, used to give
/// each subscription a stable, friendly identity in lists and detail headers.
/// Mirrors the web app's `tint-*` palette (purple/blue/orange/green/pink/amber).
class Tint {
  final Color bg;
  final Color fg;
  const Tint(this.bg, this.fg);
}

const List<Tint> kTints = [
  Tint(Color(0xFFF3E8FF), Color(0xFF7C3AED)), // purple
  Tint(Color(0xFFE0F2FE), Color(0xFF0284C7)), // blue
  Tint(Color(0xFFFFEDD5), Color(0xFFEA580C)), // orange
  Tint(Color(0xFFDCFCE7), Color(0xFF16A34A)), // green
  Tint(Color(0xFFFCE7F3), Color(0xFFDB2777)), // pink
  Tint(Color(0xFFFEF3C7), Color(0xFFD97706)), // amber
];

/// Deterministic tint for a seed string (e.g. brand name) — same hash the web
/// uses so a given brand keeps the same colour across surfaces.
Tint tintFor(String seed) {
  int hash = 0;
  for (int i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.codeUnitAt(i);
    hash &= 0xFFFFFFFF; // keep it 32-bit like JS bitwise ops
  }
  return kTints[hash.abs() % kTints.length];
}

/// Fixed tints for the structured sections (match the web app).
const Tint kWorkTint = Tint(Color(0xFFEFF6FF), Color(0xFF0070C9)); // work commitment (blue)
const Color kPaymentColor = Color(0xFF1F7E36); // payment green
const Color kPaymentBg = Color(0xFFECFDF5);
