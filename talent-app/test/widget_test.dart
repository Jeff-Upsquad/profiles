import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:talent_app/core/deep_links.dart';
import 'package:talent_app/core/theme.dart';
import 'package:talent_app/widgets/ui_kit.dart';

void main() {
  test('maps web intro-room links onto the native messages routes', () {
    expect(
      mapNotificationRoute('/talent/messages/abc-123'),
      '/messages/abc-123',
    );
    expect(mapNotificationRoute('/talent/messages'), '/messages');
    expect(mapNotificationRoute('/messages/abc-123'), '/messages/abc-123');
  });

  test('maps web work links onto Home inner tabs', () {
    expect(mapNotificationRoute('/talent/job-openings'), '/home?tab=jobs');
    expect(mapNotificationRoute('/talent/assignments'), '/home?tab=assignments');
    expect(mapNotificationRoute('/talent/subscriptions'), '/home');
    expect(mapNotificationRoute('/talent/dashboard'), '/home');
  });

  testWidgets('soft segmented tabs and brand mark render', (tester) async {
    var active = 'subscriptions';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => Column(
              children: [
                const BrandMark(),
                SoftSegmentedTabs(
                  tabs: const [
                    SegmentTab(key: 'subscriptions', label: 'Subscriptions', count: 2),
                    SegmentTab(key: 'jobs', label: 'Jobs'),
                  ],
                  activeKey: active,
                  onChange: (k) => setState(() => active = k),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    expect(find.text('SH'), findsOneWidget);
    expect(find.text('Subscriptions'), findsOneWidget);
    await tester.tap(find.text('Jobs'));
    await tester.pump();
    expect(active, 'jobs');
  });

  testWidgets('brutal primary button keeps its accent fill', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: BrutalPrimaryButton(label: 'Go'))),
    );
    final container = tester.widget<Container>(
      find.ancestor(of: find.text('Go'), matching: find.byType(Container)).first,
    );
    final decoration = container.decoration! as BoxDecoration;
    // Regression: without a fill, the solid offset shadow paints over the
    // yellow Material and every brutal button renders black-on-black.
    expect(decoration.color, AppColors.accent);
  });
}
