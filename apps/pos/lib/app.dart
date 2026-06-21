import 'package:flutter/material.dart';
import 'data/database.dart';
import 'screens/billing_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pin_screen.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/sync_service.dart';
import 'services/vertical_service.dart';

class OmniPosApp extends StatefulWidget {
  const OmniPosApp({super.key});

  @override
  State<OmniPosApp> createState() => _OmniPosAppState();
}

class _OmniPosAppState extends State<OmniPosApp> {
  final _db = AppDatabase();
  late final ApiClient _api;
  late final AuthService _auth;
  late final SyncService _sync;
  late final VerticalService _vertical;

  bool _sessionRestored = false;
  bool _hasSession = false;
  bool _pinPassed = false;

  @override
  void initState() {
    super.initState();
    _api = ApiClient(
      baseUrl: const String.fromEnvironment(
        'API_URL',
        defaultValue: 'http://localhost:3000',
      ),
    );
    _auth = AuthService(api: _api);
    _sync = SyncService(db: _db, api: _api);
    _vertical = VerticalService(_db, _api);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final ok = await _auth.restoreSession();
    if (ok) {
      _sync.start();
      // Load pack from cache; refreshes from API in background
      await _vertical.load();
    }
    setState(() {
      _hasSession = ok;
      _sessionRestored = true;
    });
  }

  void _onLogin() {
    setState(() {
      _hasSession = true;
      _pinPassed = false;
    });
    _sync.start();
    _vertical.load();
  }

  void _onPinSuccess() => setState(() => _pinPassed = true);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OmniPOS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A8A),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: AppDeps(
        auth: _auth,
        child: _buildHome(),
      ),
    );
  }

  Widget _buildHome() {
    if (!_sessionRestored) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_hasSession) {
      return LoginScreen(onLogin: _onLogin);
    }
    if (!_pinPassed) {
      return FutureBuilder<bool>(
        future: _auth.hasPin(),
        builder: (ctx, snap) {
          if (!snap.hasData) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          return PinScreen(
            auth: _auth,
            isSetup: !snap.data!,
            onSuccess: _onPinSuccess,
          );
        },
      );
    }
    return BillingScreen(db: _db, sync: _sync, vertical: _vertical);
  }

  @override
  void dispose() {
    _sync.dispose();
    super.dispose();
  }
}
