import '../core/json.dart';

/// Talent job-feed opt-in state + matching preferences.
/// Mirrors `JobPreferences` (src/hooks/useJobs.ts). The nested
/// `preferred_locations` tree (country → states → districts/cities) is the
/// source of truth; the flat `preferred_*` arrays are derived server-side.

class PreferredLocationState {
  final String state;
  final List<String> districts;
  final List<String> cities;

  const PreferredLocationState({
    required this.state,
    this.districts = const [],
    this.cities = const [],
  });

  factory PreferredLocationState.fromJson(Map<String, dynamic> json) =>
      PreferredLocationState(
        state: asString(json['state']) ?? '',
        districts: asStringList(json['districts']),
        cities: asStringList(json['cities']),
      );

  Map<String, dynamic> toJson() => {
        'state': state,
        'districts': districts,
        'cities': cities,
      };
}

class PreferredLocation {
  final String country;
  final List<PreferredLocationState> states;

  const PreferredLocation({required this.country, this.states = const []});

  factory PreferredLocation.fromJson(Map<String, dynamic> json) =>
      PreferredLocation(
        country: asString(json['country']) ?? '',
        states: asObjectList(json['states'])
            .map(PreferredLocationState.fromJson)
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'country': country,
        'states': states.map((s) => s.toJson()).toList(),
      };
}

class JobPreferences {
  final bool optedIn;
  final String? optedInAt;
  final String? optedOutAt;
  final List<PreferredLocation> preferredLocations;
  final List<String> preferredCountries;
  final List<String> preferredStates;
  final List<String> preferredDistricts;
  final List<String> preferredCities;
  final List<String> preferredJobTypes;
  final bool openToRelocation;
  final num? expectedSalaryMonthly;
  final int? noticePeriodDays;

  const JobPreferences({
    required this.optedIn,
    this.optedInAt,
    this.optedOutAt,
    this.preferredLocations = const [],
    this.preferredCountries = const [],
    this.preferredStates = const [],
    this.preferredDistricts = const [],
    this.preferredCities = const [],
    this.preferredJobTypes = const [],
    this.openToRelocation = false,
    this.expectedSalaryMonthly,
    this.noticePeriodDays,
  });

  factory JobPreferences.fromJson(Map<String, dynamic> json) => JobPreferences(
        optedIn: asBool(json['opted_in']),
        optedInAt: asString(json['opted_in_at']),
        optedOutAt: asString(json['opted_out_at']),
        preferredLocations: asObjectList(json['preferred_locations'])
            .map(PreferredLocation.fromJson)
            .toList(),
        preferredCountries: asStringList(json['preferred_countries']),
        preferredStates: asStringList(json['preferred_states']),
        preferredDistricts: asStringList(json['preferred_districts']),
        preferredCities: asStringList(json['preferred_cities']),
        preferredJobTypes: asStringList(json['preferred_job_types']),
        openToRelocation: asBool(json['open_to_relocation']),
        expectedSalaryMonthly: asNum(json['expected_salary_monthly']),
        noticePeriodDays: asInt(json['notice_period_days']),
      );

  /// A compact "Bengaluru, Mumbai +2" style location summary for the prefs bar.
  List<String> get locationSummary {
    if (preferredCities.isNotEmpty) return preferredCities;
    if (preferredDistricts.isNotEmpty) return preferredDistricts;
    if (preferredStates.isNotEmpty) return preferredStates;
    return preferredCountries;
  }
}
