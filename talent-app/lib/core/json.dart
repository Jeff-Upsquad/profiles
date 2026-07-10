/// Small, defensive JSON coercion helpers shared by the hand-written models.
///
/// The talent API mixes typed columns with free-form `content`/`details`/
/// `snapshot` blobs, so models read fields tolerantly rather than hard-casting
/// (a single unexpected null would otherwise throw and blank a whole screen).
library;

/// A list of non-empty strings, or `const []`.
List<String> asStringList(dynamic v) {
  if (v is List) {
    return v
        .map((e) => e?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
  }
  return const [];
}

/// A list of JSON objects, dropping any non-map entries.
List<Map<String, dynamic>> asObjectList(dynamic v) {
  if (v is List) {
    return v
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList();
  }
  return const [];
}

/// A JSON object, or an empty map.
Map<String, dynamic> asObject(dynamic v) =>
    v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};

/// A number from a num or numeric string.
num? asNum(dynamic v) {
  if (v is num) return v;
  if (v is String) return num.tryParse(v);
  return null;
}

int? asInt(dynamic v) => asNum(v)?.toInt();

/// A bool that only flips to the non-default on an explicit opposite value.
bool asBool(dynamic v, {bool or = false}) => v is bool ? v : or;

/// A trimmed non-empty string, or null.
String? asString(dynamic v) {
  if (v == null) return null;
  final s = v.toString().trim();
  return s.isEmpty ? null : s;
}
