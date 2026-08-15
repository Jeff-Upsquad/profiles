import 'package:flutter_test/flutter_test.dart';
import 'package:talent_app/core/deep_links.dart';

void main() {
  test('maps web intro-room links onto the native messages routes', () {
    expect(
      mapNotificationRoute('/talent/messages/abc-123'),
      '/messages/abc-123',
    );
    expect(mapNotificationRoute('/talent/messages'), '/messages');
    expect(mapNotificationRoute('/messages/abc-123'), '/messages/abc-123');
  });
}
