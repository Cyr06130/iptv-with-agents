import 'package:flutter/material.dart';

void main() {
  runApp(const IPTVApp());
}

class IPTVApp extends StatelessWidget {
  const IPTVApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'IPTV Stream',
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6366F1),
          surface: Color(0xFF1A1A2E),
        ),
      ),
      home: const Scaffold(
        body: Center(
          child: Text(
            'IPTV Stream - Coming Soon',
            style: TextStyle(fontSize: 24),
          ),
        ),
      ),
    );
  }
}
