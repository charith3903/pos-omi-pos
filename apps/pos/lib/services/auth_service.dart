import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

const _kToken = 'jwt_access';
const _kRefresh = 'jwt_refresh';
const _kUser = 'user_json';
const _kTenant = 'tenant_json';
const _kPin = 'cashier_pin';
const _kOutletId = 'outlet_id';

class AuthService {
  final ApiClient api;
  final _storage = const FlutterSecureStorage();

  AuthService({required this.api});

  Future<Map<String, dynamic>> login({
    required String subdomain,
    required String email,
    required String password,
  }) async {
    final res = await api.post('/auth/login', {
          'subdomain': subdomain,
          'email': email,
          'password': password,
        }) as Map<String, dynamic>;

    await _storage.write(key: _kToken, value: res['accessToken'] as String);
    await _storage.write(key: _kRefresh, value: res['refreshToken'] as String);

    final user = res['user'] as Map<String, dynamic>? ?? {};
    final tenant = res['tenant'] as Map<String, dynamic>? ?? {};
    await _storage.write(key: _kUser, value: jsonEncode(user));
    await _storage.write(key: _kTenant, value: jsonEncode(tenant));

    api.setToken(res['accessToken'] as String);
    return res;
  }

  Future<bool> restoreSession() async {
    final token = await _storage.read(key: _kToken);
    if (token == null) return false;
    api.setToken(token);
    return true;
  }

  Future<String?> getToken() => _storage.read(key: _kToken);

  Future<String?> getOutletId() => _storage.read(key: _kOutletId);
  Future<void> setOutletId(String id) => _storage.write(key: _kOutletId, value: id);

  Future<Map<String, dynamic>?> getCachedTenant() async {
    final raw = await _storage.read(key: _kTenant);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  // ── PIN ──────────────────────────────────────────────────────────────────

  Future<bool> hasPin() async => (await _storage.read(key: _kPin)) != null;
  Future<void> setPin(String pin) => _storage.write(key: _kPin, value: pin);
  Future<bool> verifyPin(String pin) async =>
      (await _storage.read(key: _kPin)) == pin;

  Future<void> logout() async {
    await _storage.deleteAll();
    api.setToken(null);
  }
}
