import '../core/json.dart';

/// The talent's Basic Profile (`/talent/me/basic-profile`). Field keys mirror
/// the Zod `updateBasicProfileSchema` exactly so payloads round-trip. All fields
/// are optional/nullable; the backend upserts on `talent_user_id`.

class EducationEntry {
  int? fromYear;
  int? fromMonth;
  int? toYear;
  int? toMonth;
  String courseName;
  String institution;

  EducationEntry({
    this.fromYear,
    this.fromMonth,
    this.toYear,
    this.toMonth,
    this.courseName = '',
    this.institution = '',
  });

  factory EducationEntry.fromJson(Map<String, dynamic> j) => EducationEntry(
        fromYear: asInt(j['from_year']),
        fromMonth: asInt(j['from_month']),
        toYear: asInt(j['to_year']),
        toMonth: asInt(j['to_month']),
        courseName: asString(j['course_name']) ?? '',
        institution: asString(j['institution']) ?? '',
      );

  Map<String, dynamic> toJson() => {
        'from_year': fromYear,
        'from_month': fromMonth,
        'to_year': toYear,
        'to_month': toMonth,
        'course_name': courseName,
        'institution': institution,
      };

  bool get isValid => courseName.trim().isNotEmpty || institution.trim().isNotEmpty;
}

class ExperienceEntry {
  int? fromYear;
  int? fromMonth;
  int? toYear;
  int? toMonth;
  String companyName;
  String designation;

  ExperienceEntry({
    this.fromYear,
    this.fromMonth,
    this.toYear,
    this.toMonth,
    this.companyName = '',
    this.designation = '',
  });

  factory ExperienceEntry.fromJson(Map<String, dynamic> j) => ExperienceEntry(
        fromYear: asInt(j['from_year']),
        fromMonth: asInt(j['from_month']),
        toYear: asInt(j['to_year']),
        toMonth: asInt(j['to_month']),
        companyName: asString(j['company_name']) ?? '',
        designation: asString(j['designation']) ?? '',
      );

  Map<String, dynamic> toJson() => {
        'from_year': fromYear,
        'from_month': fromMonth,
        'to_year': toYear,
        'to_month': toMonth,
        'company_name': companyName,
        'designation': designation,
      };

  bool get isValid => companyName.trim().isNotEmpty || designation.trim().isNotEmpty;
}

class BasicProfile {
  // Work type
  List<String> employmentType; // salary | freelance | partner_program
  // Official (permanent) address
  String permanentAddress;
  String permanentCountry;
  String permanentState;
  String permanentDistrict;
  String permanentCity;
  String permanentPinCode;
  // Current address
  String currentAddress;
  String country;
  String state;
  String currentDistrict;
  String city;
  String pinCode;
  // Job preference
  List<String> availability; // full_time | part_time
  List<String> jobType; // remote | office | hybrid | field
  int? expectedSalaryFullTime;
  int? expectedSalaryPartTime;
  int? expectedSalaryMonthly;
  // Freelance
  bool freelanceAvailable;
  // Education / experience
  List<EducationEntry> educationCourses;
  List<ExperienceEntry> experience;
  // ID proofs
  String aadhaarNumber;
  String? aadhaarFileUrl;
  String panNumber;
  String? panFileUrl;
  // Picture / bank / resume
  String? profilePictureUrl;
  String bankAccountHolder;
  String bankName;
  String bankAccountNumber;
  String bankIfscCode;
  String bankBranchName;
  String? resumeUrl;

  BasicProfile({
    this.employmentType = const [],
    this.permanentAddress = '',
    this.permanentCountry = 'India',
    this.permanentState = '',
    this.permanentDistrict = '',
    this.permanentCity = '',
    this.permanentPinCode = '',
    this.currentAddress = '',
    this.country = 'India',
    this.state = '',
    this.currentDistrict = '',
    this.city = '',
    this.pinCode = '',
    this.availability = const [],
    this.jobType = const [],
    this.expectedSalaryFullTime,
    this.expectedSalaryPartTime,
    this.expectedSalaryMonthly,
    this.freelanceAvailable = false,
    this.educationCourses = const [],
    this.experience = const [],
    this.aadhaarNumber = '',
    this.aadhaarFileUrl,
    this.panNumber = '',
    this.panFileUrl,
    this.profilePictureUrl,
    this.bankAccountHolder = '',
    this.bankName = '',
    this.bankAccountNumber = '',
    this.bankIfscCode = '',
    this.bankBranchName = '',
    this.resumeUrl,
  });

  factory BasicProfile.fromJson(Map<String, dynamic>? json) {
    final j = json ?? const {};
    String s(String k) => asString(j[k]) ?? '';
    return BasicProfile(
      employmentType: asStringList(j['employment_type']),
      permanentAddress: s('permanent_address'),
      permanentCountry: asString(j['permanent_country']) ?? 'India',
      permanentState: s('permanent_state'),
      permanentDistrict: s('permanent_district'),
      permanentCity: s('permanent_city'),
      permanentPinCode: s('permanent_pin_code'),
      currentAddress: s('current_address'),
      country: asString(j['country']) ?? 'India',
      state: s('state'),
      currentDistrict: s('current_district'),
      city: s('city'),
      pinCode: s('pin_code'),
      availability: asStringList(j['availability']),
      jobType: asStringList(j['job_type']),
      expectedSalaryFullTime: asInt(j['expected_salary_full_time']),
      expectedSalaryPartTime: asInt(j['expected_salary_part_time']),
      expectedSalaryMonthly: asInt(j['expected_salary_monthly']),
      freelanceAvailable: asBool(j['freelance_available']),
      educationCourses:
          asObjectList(j['education_courses']).map(EducationEntry.fromJson).toList(),
      experience: asObjectList(j['experience']).map(ExperienceEntry.fromJson).toList(),
      aadhaarNumber: s('aadhaar_number'),
      aadhaarFileUrl: asString(j['aadhaar_file_url']),
      panNumber: s('pan_number'),
      panFileUrl: asString(j['pan_file_url']),
      profilePictureUrl: asString(j['profile_picture_url']),
      bankAccountHolder: s('bank_account_holder'),
      bankName: s('bank_name'),
      bankAccountNumber: s('bank_account_number'),
      bankIfscCode: s('bank_ifsc_code'),
      bankBranchName: s('bank_branch_name'),
      resumeUrl: asString(j['resume_url']),
    );
  }

  /// PUT body. Empty strings are sent as null; empty repeatable lists as null.
  Map<String, dynamic> toJson() {
    String? nz(String v) => v.trim().isEmpty ? null : v.trim();
    List<Map<String, dynamic>>? list(Iterable<Map<String, dynamic>> items) {
      final l = items.toList();
      return l.isEmpty ? null : l;
    }

    return {
      'employment_type': employmentType.isEmpty ? null : employmentType,
      'permanent_address': nz(permanentAddress),
      'permanent_country': nz(permanentCountry),
      'permanent_state': nz(permanentState),
      'permanent_district': nz(permanentDistrict),
      'permanent_city': nz(permanentCity),
      'permanent_pin_code': nz(permanentPinCode),
      'current_address': nz(currentAddress),
      'country': nz(country),
      'state': nz(state),
      'current_district': nz(currentDistrict),
      'city': nz(city),
      'pin_code': nz(pinCode),
      'availability': availability.isEmpty ? null : availability,
      'job_type': jobType.isEmpty ? null : jobType,
      'expected_salary_full_time': expectedSalaryFullTime,
      'expected_salary_part_time': expectedSalaryPartTime,
      'expected_salary_monthly': expectedSalaryMonthly,
      'freelance_available': freelanceAvailable,
      'education_courses':
          list(educationCourses.where((e) => e.isValid).map((e) => e.toJson())),
      'experience': list(experience.where((e) => e.isValid).map((e) => e.toJson())),
      'aadhaar_number': nz(aadhaarNumber),
      'aadhaar_file_url': aadhaarFileUrl,
      'pan_number': nz(panNumber),
      'pan_file_url': panFileUrl,
      'profile_picture_url': profilePictureUrl,
      'bank_account_holder': nz(bankAccountHolder),
      'bank_name': nz(bankName),
      'bank_account_number': nz(bankAccountNumber),
      'bank_ifsc_code': nz(bankIfscCode),
      'bank_branch_name': nz(bankBranchName),
      'resume_url': resumeUrl,
    };
  }
}
