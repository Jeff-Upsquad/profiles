import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../models/auth_response.dart';
import '../../providers/providers.dart';
import '../../services/password_reset_service.dart';
import '../../widgets/ui_kit.dart';

/// Self-serve WhatsApp password reset — a four-step wizard mirroring the web
/// (`/forgot-password`): phone number → confirm masked identity → enter the
/// two-word temp password from WhatsApp → set a new password and sign in.
enum _ResetStep { phone, confirm, code, newPass }

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  _ResetStep _step = _ResetStep.phone;

  CountryCode _countryCode = countryCodes.first;
  final _phoneController = TextEditingController();
  final _word1 = TextEditingController();
  final _word2 = TextEditingController();
  final _word2Focus = FocusNode();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();

  bool _loading = false;
  bool _obscureNew = true;
  String? _error;
  PasswordResetLookup? _lookup;
  AuthResponse? _session;

  @override
  void dispose() {
    _phoneController.dispose();
    _word1.dispose();
    _word2.dispose();
    _word2Focus.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  String get _phone => '$_countryCode${_phoneController.text.trim()}';
  String get _tempPassword =>
      '${_word1.text.trim()}-${_word2.text.trim()}'.toLowerCase();

  String _errorMessage(Object e, String fallback) {
    if (e is DioException) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.connectionError) {
        return 'Cannot reach the server. Check your connection.';
      }
      final data = e.response?.data;
      if (data is Map) {
        final msg = data['message'] ?? data['error'];
        if (msg != null) return msg.toString();
      }
    }
    return fallback;
  }

  // ─── Step actions ──────────────────────────────────────────────────────────

  Future<void> _lookupAccount() async {
    if (_phoneController.text.trim().isEmpty) return;
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final result = await ref
          .read(passwordResetServiceProvider)
          .lookup(_phone);
      if (!mounted) return;
      if (!result.found) {
        setState(() {
          _loading = false;
          _error = "We couldn't find an account with that WhatsApp number.";
        });
        return;
      }
      // The talent app only signs in talent accounts; business users must use
      // the business portal (the verify endpoint would hand back a session
      // this app can't persist).
      if (result.role == 'business') {
        setState(() {
          _loading = false;
          _error =
              'This number belongs to a business account. Please reset your password in the SquadHire business portal.';
        });
        return;
      }
      setState(() {
        _loading = false;
        _lookup = result;
        _step = _ResetStep.confirm;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _errorMessage(e, 'Something went wrong. Please try again.');
        });
      }
    }
  }

  Future<void> _sendTempPassword() async {
    final ticket = _lookup?.resetTicket;
    if (ticket == null) return;
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await ref.read(passwordResetServiceProvider).sendTempPassword(ticket);
      if (mounted) {
        setState(() {
          _loading = false;
          _step = _ResetStep.code;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Temporary password sent to your WhatsApp.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _errorMessage(e, 'Could not send the temporary password.');
        });
      }
    }
  }

  Future<void> _verify() async {
    final ticket = _lookup?.resetTicket;
    if (ticket == null) return;
    if (_word1.text.trim().isEmpty || _word2.text.trim().isEmpty) {
      setState(() => _error = 'Enter both words of your temporary password.');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final session = await ref
          .read(passwordResetServiceProvider)
          .verifyTempPassword(ticket, _tempPassword);
      // Temp password accepted — hold the session locally (don't sign in yet)
      // so the forced-reset routing can't fire while we collect a new one.
      if (mounted) {
        setState(() {
          _loading = false;
          _session = session;
          _step = _ResetStep.newPass;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _errorMessage(e, 'Incorrect temporary password.');
        });
      }
    }
  }

  Future<void> _setNewPassword() async {
    final session = _session;
    if (session == null) return;
    if (_newPassword.text.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters.');
      return;
    }
    if (_newPassword.text != _confirmPassword.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await ref
          .read(passwordResetServiceProvider)
          .setNewPassword(session.accessToken, _newPassword.text);
      // New password set and the forced-reset flag cleared — adopt the session
      // and land in the app (router redirect handles navigation).
      await ref.read(authProvider.notifier).applySession(session);
      unawaited(ref.read(authProvider.notifier).refreshUser());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated. Welcome back!')),
      );
      context.go('/home');
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _errorMessage(e, 'Could not set your new password.');
        });
      }
    }
  }

  void _backToPhone() {
    _word2Focus.unfocus();
    setState(() {
      _step = _ResetStep.phone;
      _error = null;
      _lookup = null;
      _word1.clear();
      _word2.clear();
    });
  }

  // ─── Word-box input handling ───────────────────────────────────────────────

  /// Typing auto-advances to the second box after ~4 letters. Pasting a full
  /// "word-word" pair (WhatsApp's "Copy code" button) fills both boxes.
  void _onWord1Changed(String value) {
    final cleaned = value.toLowerCase().replaceAll(RegExp('[^a-z-]'), '');
    if (cleaned.contains('-')) {
      final parts = cleaned
          .split('-')
          .where((p) => p.isNotEmpty)
          .toList(growable: false);
      if (parts.length >= 2) {
        _word1.text = parts[0].length > 6 ? parts[0].substring(0, 6) : parts[0];
        _word2.text = parts[1].length > 6 ? parts[1].substring(0, 6) : parts[1];
        _word2Focus.requestFocus();
        return;
      }
    }
    // A single word (possibly with a stray separator) stays in this box only.
    final letters = cleaned.replaceAll('-', '');
    if (letters != value && letters != _word1.text) {
      _word1.value = TextEditingValue(
        text: letters,
        selection: TextSelection.collapsed(offset: letters.length),
      );
    }
    if (letters.length >= 4) _word2Focus.requestFocus();
  }

  void _onWord2Changed(String value) {
    final cleaned = value.toLowerCase().replaceAll(RegExp('[^a-z]'), '');
    if (cleaned != value) {
      _word2.value = TextEditingValue(
        text: cleaned,
        selection: TextSelection.collapsed(offset: cleaned.length),
      );
    }
  }

  // ─── Build helpers ─────────────────────────────────────────────────────────

  InputDecoration _field(String hint) => InputDecoration(hintText: hint);

  Widget _errorBox() {
    if (_error == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.dangerBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _error!,
              style: const TextStyle(color: AppColors.danger, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _linkButton(String label, VoidCallback onPressed) {
    return TextButton(
      onPressed: _loading ? null : onPressed,
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
        ),
      ),
    );
  }

  String get _title {
    switch (_step) {
      case _ResetStep.code:
        return 'Enter temporary password';
      case _ResetStep.newPass:
        return 'Set a new password';
      case _ResetStep.phone:
      case _ResetStep.confirm:
        return 'Reset your password';
    }
  }

  String get _subtitle {
    switch (_step) {
      case _ResetStep.phone:
        return 'Enter your registered WhatsApp number to get started.';
      case _ResetStep.confirm:
        return 'Confirm this is your account.';
      case _ResetStep.code:
        return 'We sent a two-word temporary password to your WhatsApp.';
      case _ResetStep.newPass:
        return 'Choose a new password to finish signing in.';
    }
  }

  // ─── Steps ─────────────────────────────────────────────────────────────────

  Widget _phoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'WhatsApp number',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.primaryDark,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            DropdownButton<CountryCode>(
              value: _countryCode,
              underline: const SizedBox.shrink(),
              items: countryCodes
                  .map(
                    (cc) => DropdownMenuItem(
                      value: cc,
                      child: Text(
                        cc.label,
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (cc) {
                if (cc != null) setState(() => _countryCode = cc);
              },
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                autofocus: true,
                onSubmitted: (_) => _lookupAccount(),
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(15),
                ],
                decoration: _field('98765 43210'),
              ),
            ),
          ],
        ),
        _errorBox(),
        const SizedBox(height: 24),
        BrutalPrimaryButton(
          label: _loading ? 'Checking…' : 'Continue',
          loading: _loading,
          onPressed: _lookupAccount,
        ),
      ],
    );
  }

  Widget _confirmStep() {
    final lookup = _lookup;
    if (lookup == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Name',
                style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                lookup.maskedName ?? '—',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          "Names are partly hidden for your security. If this looks like your account, continue and we'll send a temporary password to your WhatsApp.",
          style: TextStyle(
            fontSize: 12,
            height: 1.5,
            color: AppColors.textTertiary,
          ),
        ),
        _errorBox(),
        const SizedBox(height: 24),
        BrutalPrimaryButton(
          label: _loading ? 'Sending…' : 'Yes, this is me — send password',
          loading: _loading,
          onPressed: _sendTempPassword,
        ),
        Center(
          child: _linkButton('Not you? Use a different number', _backToPhone),
        ),
      ],
    );
  }

  Widget _codeStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Temporary password',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.primaryDark,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _word1,
                onChanged: _onWord1Changed,
                textInputAction: TextInputAction.next,
                textAlign: TextAlign.center,
                autofocus: true,
                autocorrect: false,
                enableSuggestions: false,
                inputFormatters: [LengthLimitingTextInputFormatter(6)],
                decoration: _field('word'),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                '-',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textMuted,
                ),
              ),
            ),
            Expanded(
              child: TextField(
                controller: _word2,
                focusNode: _word2Focus,
                onChanged: _onWord2Changed,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _verify(),
                textAlign: TextAlign.center,
                autocorrect: false,
                enableSuggestions: false,
                inputFormatters: [LengthLimitingTextInputFormatter(6)],
                decoration: _field('word'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Two words, e.g. fish-lamp.',
          style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
        ),
        _errorBox(),
        const SizedBox(height: 24),
        BrutalPrimaryButton(
          label: _loading ? 'Verifying…' : 'Continue',
          loading: _loading,
          onPressed: _verify,
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _linkButton('Resend password', _sendTempPassword),
            _linkButton('Change number', _backToPhone),
          ],
        ),
      ],
    );
  }

  Widget _newPassStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _newPassword,
          obscureText: _obscureNew,
          autofocus: true,
          decoration: _field('At least 8 characters').copyWith(
            labelText: 'New password',
            suffixIcon: IconButton(
              icon: Icon(
                _obscureNew
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
              ),
              onPressed: () => setState(() => _obscureNew = !_obscureNew),
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _confirmPassword,
          obscureText: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _setNewPassword(),
          decoration: _field(
            'Re-enter your new password',
          ).copyWith(labelText: 'Confirm new password'),
        ),
        _errorBox(),
        const SizedBox(height: 24),
        BrutalPrimaryButton(
          label: _loading ? 'Saving…' : 'Save & sign in',
          loading: _loading,
          onPressed: _setNewPassword,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Text(
                _title,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _subtitle,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textTertiary,
                ),
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.primary, width: 2),
                  boxShadow: const [
                    BoxShadow(color: Colors.black, offset: Offset(6, 6)),
                  ],
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: KeyedSubtree(
                    key: ValueKey(_step),
                    child: switch (_step) {
                      _ResetStep.phone => _phoneStep(),
                      _ResetStep.confirm => _confirmStep(),
                      _ResetStep.code => _codeStep(),
                      _ResetStep.newPass => _newPassStep(),
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: _linkButton('Remembered it? Back to login', () {
                  context.go('/login');
                }),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
