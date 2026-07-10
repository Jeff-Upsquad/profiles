import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/launchers.dart';
import '../../../core/theme.dart';
import '../../../models/profile_extras.dart';
import '../../../providers/talent_providers.dart';
import '../../../services/upload_service.dart';
import '../../../widgets/ui_kit.dart';

/// Portfolio items for a profile: upload images/PDFs/videos or add a YouTube
/// link, and remove existing items.
class PortfolioSection extends ConsumerStatefulWidget {
  final String profileId;
  const PortfolioSection({super.key, required this.profileId});

  @override
  ConsumerState<PortfolioSection> createState() => _PortfolioSectionState();
}

class _PortfolioSectionState extends ConsumerState<PortfolioSection> {
  bool _busy = false;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String _fileTypeFor(String name) {
    final ext = name.toLowerCase().split('.').last;
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].contains(ext)) return 'image';
    if (ext == 'pdf') return 'pdf';
    return 'video';
  }

  Future<void> _upload() async {
    if (_busy) return;
    FilePickerResult? result;
    try {
      result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mp4', 'mov'],
        withData: true,
      );
    } catch (_) {
      _toast('Could not open the file picker');
      return;
    }
    final file = result?.files.firstOrNull;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return;
    setState(() => _busy = true);
    try {
      final url = await ref.read(uploadServiceProvider).uploadBytes(
            bytes: bytes,
            fileName: file.name,
            contentType: mimeForFileName(file.name),
            folder: 'portfolio',
          );
      await ref.read(profilesServiceProvider).addPortfolioUpload(
            widget.profileId,
            fileUrl: url,
            fileType: _fileTypeFor(file.name),
            fileName: file.name,
          );
      ref.invalidate(portfolioProvider(widget.profileId));
    } catch (_) {
      _toast('Upload failed. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addLink() async {
    final controller = TextEditingController();
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Add YouTube link'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'https://youtube.com/watch?v=…'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (url == null || url.isEmpty) return;
    final id = _youTubeId(url);
    if (id == null) {
      _toast('That doesn’t look like a YouTube link');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(profilesServiceProvider).addPortfolioLink(
            widget.profileId,
            embedUrl: 'https://www.youtube.com/embed/$id',
            externalUrl: url,
          );
      ref.invalidate(portfolioProvider(widget.profileId));
    } catch (_) {
      _toast('Could not add that link');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _youTubeId(String url) {
    final patterns = [
      RegExp(r'youtube\.com/watch\?v=([\w-]{11})'),
      RegExp(r'youtu\.be/([\w-]{11})'),
      RegExp(r'youtube\.com/embed/([\w-]{11})'),
      RegExp(r'youtube\.com/shorts/([\w-]{11})'),
    ];
    for (final p in patterns) {
      final m = p.firstMatch(url);
      if (m != null) return m.group(1);
    }
    return null;
  }

  Future<void> _delete(PortfolioItem item) async {
    try {
      await ref.read(profilesServiceProvider).deletePortfolio(widget.profileId, item.id);
      ref.invalidate(portfolioProvider(widget.profileId));
    } catch (_) {
      _toast('Could not remove that item');
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = ref.watch(portfolioProvider(widget.profileId));
    return TitledCard(
      title: 'Portfolio',
      icon: Icons.collections_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          items.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => const Text('Could not load portfolio',
                style: TextStyle(color: AppColors.textTertiary, fontSize: 13)),
            data: (list) {
              if (list.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text('No portfolio items yet.',
                      style: TextStyle(color: AppColors.textTertiary, fontSize: 13)),
                );
              }
              return GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [for (final it in list) _tile(it)],
              );
            },
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _upload,
                  icon: _busy
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.upload_file_outlined, size: 18),
                  label: const Text('Upload'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _addLink,
                  icon: const Icon(Icons.link, size: 18),
                  label: const Text('YouTube'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _tile(PortfolioItem it) {
    final thumb = it.thumbnailUrl ?? (it.isImage ? it.fileUrl : null);
    return Stack(
      fit: StackFit.expand,
      children: [
        GestureDetector(
          onTap: () => openExternalUrl(it.externalUrl ?? it.fileUrl),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: thumb != null
                ? Image.network(
                    thumb,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => _placeholder(it),
                  )
                : _placeholder(it),
          ),
        ),
        Positioned(
          top: 2,
          right: 2,
          child: GestureDetector(
            onTap: () => _delete(it),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          ),
        ),
        if (it.isVideo)
          const Center(child: Icon(Icons.play_circle_outline, color: Colors.white, size: 30)),
      ],
    );
  }

  Widget _placeholder(PortfolioItem it) => Container(
        color: AppColors.divider,
        alignment: Alignment.center,
        child: Icon(
          it.isPdf ? Icons.picture_as_pdf_outlined : Icons.movie_outlined,
          color: AppColors.textTertiary,
        ),
      );
}
