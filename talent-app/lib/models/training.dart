import '../core/json.dart';
import 'talent_profile.dart';

/// Training program models. Mirrors `src/hooks/useTraining.ts`.

const Map<String, String> kLanguageLabels = {
  'en': 'English',
  'hi': 'Hindi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'bn': 'Bengali',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'pa': 'Punjabi',
};

String languageLabel(String code) => kLanguageLabels[code] ?? code.toUpperCase();

class LessonVideo {
  final String language;
  final String loomUrl;
  const LessonVideo({required this.language, required this.loomUrl});

  factory LessonVideo.fromJson(Map<String, dynamic> j) => LessonVideo(
        language: asString(j['language']) ?? 'en',
        loomUrl: asString(j['loom_url']) ?? '',
      );
}

class TrainingLesson {
  final String id;
  final String title;
  final String? description;
  final String loomUrl;
  final List<LessonVideo> videos;
  final int sortOrder;
  final bool completed;

  const TrainingLesson({
    required this.id,
    required this.title,
    this.description,
    this.loomUrl = '',
    this.videos = const [],
    this.sortOrder = 0,
    this.completed = false,
  });

  factory TrainingLesson.fromJson(Map<String, dynamic> j) => TrainingLesson(
        id: j['id'] as String,
        title: asString(j['title']) ?? 'Lesson',
        description: asString(j['description']),
        loomUrl: asString(j['loom_url']) ?? '',
        videos: asObjectList(j['videos']).map(LessonVideo.fromJson).toList(),
        sortOrder: asInt(j['sort_order']) ?? 0,
        completed: asBool(j['completed']),
      );

  /// The video URL for [language], falling back to the legacy `loom_url`.
  String urlFor(String language) {
    for (final v in videos) {
      if (v.language == language) return v.loomUrl;
    }
    return loomUrl;
  }
}

class TrainingChapter {
  final String id;
  final String title;
  final String? description;
  final int sortOrder;
  final List<TrainingLesson> lessons;
  final int completedCount;
  final int totalCount;
  final bool? unlocked;
  final String? linkedModule;

  const TrainingChapter({
    required this.id,
    required this.title,
    this.description,
    this.sortOrder = 0,
    this.lessons = const [],
    this.completedCount = 0,
    this.totalCount = 0,
    this.unlocked,
    this.linkedModule,
  });

  factory TrainingChapter.fromJson(Map<String, dynamic> j) => TrainingChapter(
        id: j['id'] as String,
        title: asString(j['title']) ?? 'Chapter',
        description: asString(j['description']),
        sortOrder: asInt(j['sort_order']) ?? 0,
        lessons: asObjectList(j['lessons']).map(TrainingLesson.fromJson).toList(),
        completedCount: asInt(j['completed_count']) ?? 0,
        totalCount: asInt(j['total_count']) ?? 0,
        unlocked: j['unlocked'] is bool ? j['unlocked'] as bool : null,
        linkedModule: asString(j['linked_module']),
      );
}

class TrainingCourse {
  final String id;
  final String title;
  final String? description;
  final bool isOnboarding;
  final bool countdownEnabled;
  final int? countdownHours;
  final String? startedAt;
  final String? expiresAt;
  final bool expired;
  final List<ProfileCategory> categories;
  final List<TrainingChapter> chapters;
  final int completedCount;
  final int totalCount;

  const TrainingCourse({
    required this.id,
    required this.title,
    this.description,
    this.isOnboarding = false,
    this.countdownEnabled = false,
    this.countdownHours,
    this.startedAt,
    this.expiresAt,
    this.expired = false,
    this.categories = const [],
    this.chapters = const [],
    this.completedCount = 0,
    this.totalCount = 0,
  });

  factory TrainingCourse.fromJson(Map<String, dynamic> j) => TrainingCourse(
        id: j['id'] as String,
        title: asString(j['title']) ?? 'Course',
        description: asString(j['description']),
        isOnboarding: asBool(j['is_onboarding']),
        countdownEnabled: asBool(j['countdown_enabled']),
        countdownHours: asInt(j['countdown_hours']),
        startedAt: asString(j['started_at']),
        expiresAt: asString(j['expires_at']),
        expired: asBool(j['expired']),
        categories: asObjectList(j['categories']).map(ProfileCategory.fromJson).toList(),
        chapters: asObjectList(j['chapters']).map(TrainingChapter.fromJson).toList(),
        completedCount: asInt(j['completed_count']) ?? 0,
        totalCount: asInt(j['total_count']) ?? 0,
      );

  bool get started => startedAt != null;
  bool get done => totalCount > 0 && completedCount >= totalCount;

  /// Languages present in EVERY lesson (intersection); ['en'] if none.
  List<String> get languages {
    Set<String>? intersection;
    for (final ch in chapters) {
      for (final lesson in ch.lessons) {
        final langs = lesson.videos.map((v) => v.language).toSet();
        if (langs.isEmpty) continue;
        intersection = intersection == null
            ? langs
            : intersection.intersection(langs);
      }
    }
    if (intersection == null || intersection.isEmpty) return ['en'];
    return intersection.toList();
  }
}

class MyTraining {
  final List<TrainingCourse> courses;
  final List<TrainingChapter> chapters;
  const MyTraining({this.courses = const [], this.chapters = const []});

  factory MyTraining.fromJson(Map<String, dynamic> j) => MyTraining(
        courses: asObjectList(j['courses']).map(TrainingCourse.fromJson).toList(),
        chapters: asObjectList(j['chapters']).map(TrainingChapter.fromJson).toList(),
      );
}

class LockedModule {
  final String module;
  final String chapterTitle;
  final int completed;
  final int total;
  const LockedModule({
    required this.module,
    this.chapterTitle = '',
    this.completed = 0,
    this.total = 0,
  });

  factory LockedModule.fromJson(Map<String, dynamic> j) => LockedModule(
        module: asString(j['module']) ?? '',
        chapterTitle: asString(j['chapter_title']) ?? '',
        completed: asInt(j['completed']) ?? 0,
        total: asInt(j['total']) ?? 0,
      );
}

class ModuleAccess {
  final List<String> unlocked;
  final List<LockedModule> locked;
  const ModuleAccess({this.unlocked = const [], this.locked = const []});

  factory ModuleAccess.fromJson(Map<String, dynamic> j) => ModuleAccess(
        unlocked: asStringList(j['unlocked']),
        locked: asObjectList(j['locked']).map(LockedModule.fromJson).toList(),
      );

  bool isLocked(String module) => locked.any((m) => m.module == module);
  LockedModule? lockedInfo(String module) {
    for (final m in locked) {
      if (m.module == module) return m;
    }
    return null;
  }
}
