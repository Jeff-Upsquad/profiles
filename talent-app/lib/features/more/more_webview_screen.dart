import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';
import '../../services/secure_storage.dart';

/// In-app WebView for every item under the **More** tab.
///
/// The native More screens are intentionally not used any more — instead the
/// row pushes this screen, which renders the responsive web page
/// (`https://squadhire.upsquadconnect.com/talent/...`) inside the app. The web
/// page is authenticated transparently: the app appends `app_token` /
/// `app_refresh` query params and the web's `AuthContext` picks them up on load
/// (see `frontend/src/context/AuthContext.tsx`). As a fallback the WebView also
/// injects the token into `localStorage` via JS if the page lands on `/login`.
class MoreWebViewScreen extends StatefulWidget {
  final String title;
  final String webPath;

  const MoreWebViewScreen({
    super.key,
    required this.title,
    required this.webPath,
  });

  @override
  State<MoreWebViewScreen> createState() => _MoreWebViewScreenState();
}

class _MoreWebViewScreenState extends State<MoreWebViewScreen> {
  WebViewController? _controller;
  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;
  String? _authedUrl;
  bool _didInjectFallback = false;

  @override
  void initState() {
    super.initState();
    _initController();
  }

  Future<void> _initController() async {
    final authedUrl = await _buildAuthedUrl(widget.webPath);
    if (!mounted) return;
    setState(() => _authedUrl = authedUrl);

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final url = request.url;

            // External schemes / WhatsApp → hand off to OS.
            if (_isExternalUrl(url)) {
              openExternalUrl(url);
              return NavigationDecision.prevent;
            }

            // Let in-app navigation happen inside the WebView. External hosts
            // (e.g. youtube embeds anchor navigation) are also allowed — the
            // WebView will handle them; only `mailto:`/`tel:` etc are external.
            return NavigationDecision.navigate;
          },
          onPageStarted: (_) {
            if (mounted) setState(() => _isLoading = true);
          },
          onPageFinished: (url) async {
            if (!mounted) return;
            setState(() {
              _isLoading = false;
              _hasError = false;
            });

            // Fallback: if the web didn't consume `app_token` (e.g. old deploy),
            // the page will have redirected to /login. Inject into localStorage
            // and reload the target URL. Only once to avoid loops.
            if (!_didInjectFallback && _isLoginUrl(url) && _authedUrl != null) {
              _didInjectFallback = true;
              final storage = SecureStorageService();
              final token = await storage.getAccessToken();
              final refresh = await storage.getRefreshToken();
              if (token == null || token.isEmpty) return;
              final js = _buildLocalStorageJs(token, refresh);
              try {
                await _controller?.runJavaScript(js);
              } catch (_) {}
              final cleanUrl = _stripAuthParams(_authedUrl!);
              // Re-load the clean, token-less URL now that localStorage is set.
              _controller?.loadRequest(Uri.parse(cleanUrl));
            }
          },
          onWebResourceError: (error) {
            if (!mounted) return;
            setState(() {
              _isLoading = false;
              _hasError = true;
              _errorMessage = error.description;
            });
          },
        ),
      )
      ..loadRequest(Uri.parse(authedUrl));
    if (!mounted) return;
    setState(() => _controller = controller);
  }

  Future<String> _buildAuthedUrl(String webPath) async {
    final storage = SecureStorageService();
    final token = await storage.getAccessToken();
    final refresh = await storage.getRefreshToken();
    final base = webUrlForPath(webPath);
    final uri = Uri.parse(base);
    final params = Map<String, String>.from(uri.queryParameters);
    if (token != null && token.isNotEmpty) params['app_token'] = token;
    if (refresh != null && refresh.isNotEmpty) params['app_refresh'] = refresh;
    params['in_app'] = '1';
    return uri.replace(queryParameters: params.isEmpty ? null : params).toString();
  }

  String _buildLocalStorageJs(String token, String? refresh) {
    final escToken = _jsEscape(token);
    final escRefresh = refresh == null ? null : _jsEscape(refresh);
    final buf = StringBuffer()..write("localStorage.setItem('squadhire_token','$escToken');");
    if (escRefresh != null) {
      buf.write("localStorage.setItem('squadhire_refresh','$escRefresh');");
    } else {
      buf.write("localStorage.removeItem('squadhire_refresh');");
    }
    return buf.toString();
  }

  String _jsEscape(String s) => s.replaceAll(r'\', r'\\').replaceAll("'", r"\'");

  bool _isExternalUrl(String url) {
    final lower = url.toLowerCase();
    return lower.startsWith('mailto:') ||
        lower.startsWith('tel:') ||
        lower.startsWith('sms:');
  }

  bool _isLoginUrl(String url) {
    final lower = url.toLowerCase();
    return lower.contains('/login');
  }

  String _stripAuthParams(String url) {
    final uri = Uri.parse(url);
    final params = Map<String, String>.from(uri.queryParameters)
      ..remove('app_token')
      ..remove('app_refresh')
      ..remove('in_app');
    return uri.replace(queryParameters: params.isEmpty ? null : params).toString();
  }

  Future<bool> _handleBack() async {
    final c = _controller;
    if (c != null && await c.canGoBack()) {
      c.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldPop = await _handleBack();
        if (shouldPop && mounted && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          title: Text(widget.title),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () async {
              final shouldPop = await _handleBack();
              if (shouldPop && mounted && context.mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _controller == null
                  ? null
                  : () {
                      setState(() {
                        _hasError = false;
                        _isLoading = true;
                      });
                      _controller!.reload();
                    },
              tooltip: 'Refresh',
            ),
            IconButton(
              icon: const Icon(Icons.open_in_browser),
              onPressed: _authedUrl == null
                  ? null
                  : () {
                      final clean = _stripAuthParams(_authedUrl!);
                      openExternalUrl(clean);
                    },
              tooltip: 'Open in browser',
            ),
          ],
        ),
        body: _controller == null || _authedUrl == null
            ? const Center(child: CircularProgressIndicator())
            : Stack(
                children: [
                  if (_hasError)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.cloud_off_outlined, size: 48, color: AppColors.textTertiary),
                            const SizedBox(height: 12),
                            const Text('Failed to load', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            if (_errorMessage != null) ...[
                              const SizedBox(height: 6),
                              Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
                            ],
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: () {
                                setState(() {
                                  _hasError = false;
                                  _isLoading = true;
                                });
                                _controller!.reload();
                              },
                              icon: const Icon(Icons.refresh),
                              label: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    WebViewWidget(controller: _controller!),
                  if (_isLoading && !_hasError)
                    const Positioned.fill(
                      child: Center(child: CircularProgressIndicator()),
                    ),
                ],
              ),
      ),
    );
  }
}
