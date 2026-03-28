import 'package:flutter/material.dart';
import 'screens/auth/login_screen.dart';
import 'screens/dashboard/home_screen.dart';
import 'services/auth_service.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Define custom colors based on Web App CSS
    const Color primaryBrown = Color(0xFF5B3A1A); // --primary
    const Color bgLightYellow = Color(0xFFFBF8F1); // --bg-light
    const Color accentBrown = Color(0xFF8B7355); // --accent

    return MaterialApp(
      title: 'Medicine Patient App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryBrown,
          primary: primaryBrown,
          background: bgLightYellow,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: bgLightYellow,
        primaryColor: primaryBrown,
        useMaterial3: true,
        fontFamily: 'Inter',
        appBarTheme: const AppBarTheme(
          backgroundColor: primaryBrown,
          foregroundColor: bgLightYellow,
          elevation: 0,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF8B1A1A), // --secondary (Đỏ đô)
            foregroundColor: Colors.white,
          ),
        ),
      ),
      home: const InitialScreen(),
    );
  }
}

class InitialScreen extends StatefulWidget {
  const InitialScreen({super.key});

  @override
  State<InitialScreen> createState() => _InitialScreenState();
}

class _InitialScreenState extends State<InitialScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  void _checkAuth() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (mounted) {
      if (isLoggedIn) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => HomeScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
