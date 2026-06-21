import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnipos/main.dart';

void main() {
  testWidgets('WelcomeScreen shows Hello OmniPOS', (WidgetTester tester) async {
    await tester.pumpWidget(const OmniPOSApp());
    expect(find.text('Hello OmniPOS'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);
  });
}
