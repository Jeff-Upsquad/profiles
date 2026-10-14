import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talent_app/features/profile/widgets/dynamic_profile_fields.dart';

void main() {
  testWidgets('required specialist title and summary render and validate', (tester) async {
    final formKey = GlobalKey<FormState>();
    final values = <String, dynamic>{};
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: Form(key: formKey, child: DynamicProfileFields(
      fields: [
        {'field_key': 'professional_title', 'field_label': 'Professional title', 'field_type': 'text', 'is_required': true, 'is_active': true, 'validation_rules': {'minLength': 3}},
        {'field_key': 'professional_summary', 'field_label': 'Professional summary', 'field_type': 'textarea', 'is_required': true, 'is_active': true, 'validation_rules': {'minLength': 40}},
        {'field_key': 'hidden', 'field_label': 'Hidden field', 'field_type': 'text', 'is_active': false},
      ], values: values, onChanged: (key, value) => values[key] = value,
    )))));
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(formKey.currentState!.validate(), false);
    await tester.pump();
    await tester.enterText(find.byType(TextFormField).at(0), 'Creative Director');
    await tester.enterText(find.byType(TextFormField).at(1), 'I lead creative teams and produce brand campaigns with measurable business outcomes.');
    expect(formKey.currentState!.validate(), true);
    expect(values['professional_title'], 'Creative Director');
    expect(values['professional_summary'], contains('measurable business outcomes'));
  });
}
