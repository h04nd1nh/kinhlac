import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String _envOverride = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_envOverride.isNotEmpty) return _envOverride;
    if (kIsWeb) return 'http://localhost:3001';
    if (Platform.isAndroid) return 'http://10.0.2.2:3001';
    return 'http://localhost:3001';
  }
}
