import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../core/constants.dart';
import 'secure_storage.dart';

class ApiClient {
  late final Dio dio;
  final SecureStorageService _storage;
  VoidCallback? onSessionExpired;

  ApiClient(this._storage) {
    dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _tryRefresh();
          if (refreshed) {
            final opts = error.requestOptions;
            final token = await _storage.getAccessToken();
            opts.headers['Authorization'] = 'Bearer $token';
            try {
              final response = await dio.fetch(opts);
              return handler.resolve(response);
            } catch (e) {
              return handler.next(error);
            }
          } else {
            await _storage.clearTokens();
            onSessionExpired?.call();
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await Dio(BaseOptions(baseUrl: apiBaseUrl)).post(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
      );
      final data = response.data as Map<String, dynamic>;
      await _storage.saveTokens(
        accessToken: data['access_token'] as String,
        refreshToken: data['refresh_token'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
