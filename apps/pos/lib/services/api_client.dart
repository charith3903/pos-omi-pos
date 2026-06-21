import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class AuthException implements Exception {
  const AuthException();
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  const ApiException(this.message, this.statusCode);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  final String baseUrl;
  String? _token;

  ApiClient({required this.baseUrl});

  void setToken(String? token) => _token = token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http
        .post(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body))
        .timeout(const Duration(seconds: 30));
    return _handle(res);
  }

  Future<dynamic> get(String path) async {
    final res = await http
        .get(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(const Duration(seconds: 30));
    return _handle(res);
  }

  dynamic _handle(http.Response res) {
    if (res.statusCode == 401) throw const AuthException();
    final body = res.body.isEmpty ? {} : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final msg = body is Map ? (body['message'] ?? 'HTTP ${res.statusCode}') : 'HTTP ${res.statusCode}';
      throw ApiException(msg.toString(), res.statusCode);
    }
    return body;
  }
}
