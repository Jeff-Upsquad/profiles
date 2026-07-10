import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../core/json.dart';
import 'api_client.dart';

/// File uploads — `POST /api/upload/file` (raw bytes, ≤50 MB). Returns the
/// public URL to store on the profile. Mirrors the web `useUpload.uploadFile`.
class UploadService {
  final ApiClient _client;
  UploadService(this._client);

  Future<String> uploadBytes({
    required Uint8List bytes,
    required String fileName,
    required String contentType,
    String? folder,
  }) async {
    final response = await _client.dio.post(
      '/upload/file',
      queryParameters: {
        'fileName': fileName,
        'folder': ?folder,
      },
      data: Stream<List<int>>.fromIterable([bytes]),
      options: Options(
        headers: {
          Headers.contentTypeHeader: contentType,
          Headers.contentLengthHeader: bytes.length,
        },
      ),
    );
    return asString(asObject(response.data)['fileUrl']) ?? '';
  }
}

/// Best-effort MIME type from a file name.
String mimeForFileName(String name) {
  final ext = name.toLowerCase().split('.').last;
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}
