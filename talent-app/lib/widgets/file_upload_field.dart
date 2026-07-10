import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/launchers.dart';
import '../core/theme.dart';
import '../providers/talent_providers.dart';
import '../services/upload_service.dart';

/// Pick a file (image or PDF), upload it via [UploadService], and hand the
/// resulting URL back through [onChanged]. Shows an inline preview once set.
class FileUploadField extends ConsumerStatefulWidget {
  final String label;
  final String? value;
  final String folder;
  final List<String> allowedExtensions;
  final bool imagePreview;
  final ValueChanged<String?> onChanged;

  const FileUploadField({
    super.key,
    required this.label,
    required this.value,
    required this.folder,
    required this.allowedExtensions,
    required this.onChanged,
    this.imagePreview = false,
  });

  @override
  ConsumerState<FileUploadField> createState() => _FileUploadFieldState();
}

class _FileUploadFieldState extends ConsumerState<FileUploadField> {
  bool _uploading = false;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _pick() async {
    if (_uploading) return;
    FilePickerResult? result;
    try {
      result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: widget.allowedExtensions,
        withData: true,
      );
    } catch (_) {
      _toast('Could not open the file picker');
      return;
    }
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      _toast('Could not read that file');
      return;
    }
    setState(() => _uploading = true);
    try {
      final url = await ref.read(uploadServiceProvider).uploadBytes(
            bytes: bytes,
            fileName: file.name,
            contentType: mimeForFileName(file.name),
            folder: widget.folder,
          );
      if (url.isEmpty) throw Exception('empty url');
      widget.onChanged(url);
    } catch (_) {
      _toast('Upload failed. Please try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasValue = (widget.value ?? '').isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label,
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        if (hasValue)
          _preview()
        else
          _uploadButton(),
      ],
    );
  }

  Widget _uploadButton() {
    return OutlinedButton.icon(
      onPressed: _uploading ? null : _pick,
      icon: _uploading
          ? const SizedBox(
              width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
          : const Icon(Icons.upload_file_outlined, size: 18),
      label: Text(_uploading ? 'Uploading…' : 'Upload'),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        minimumSize: const Size(double.infinity, 48),
      ),
    );
  }

  Widget _preview() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          if (widget.imagePreview)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                widget.value!,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const Icon(Icons.image_outlined),
              ),
            )
          else
            const Icon(Icons.insert_drive_file_outlined, color: AppColors.primary),
          const SizedBox(width: 12),
          const Expanded(
            child: Text('Uploaded',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
          ),
          TextButton(
            onPressed: () => openExternalUrl(widget.value),
            child: const Text('View'),
          ),
          IconButton(
            onPressed: _uploading ? null : _pick,
            tooltip: 'Replace',
            icon: const Icon(Icons.refresh, size: 20, color: AppColors.textSecondary),
          ),
          IconButton(
            onPressed: () => widget.onChanged(null),
            tooltip: 'Remove',
            icon: const Icon(Icons.close, size: 20, color: AppColors.textTertiary),
          ),
        ],
      ),
    );
  }
}
