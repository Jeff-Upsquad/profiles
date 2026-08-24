import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';
import '../../providers/providers.dart';
import '../../widgets/ui_kit.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  bool _emailStep = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) return;

    setState(() => _loading = true);
    ref.read(authProvider.notifier).clearError();

    await ref.read(authProvider.notifier).login(email, password);
    if (mounted) setState(() => _loading = false);
  }

  InputDecoration _field(String hint) => InputDecoration(
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const BrandMark(size: 32),
                  const SizedBox(width: 8),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        appName,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        appTagline,
                        style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.fromLTRB(32, 32, 32, 32),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.primary, width: 2),
                  boxShadow: const [
                    BoxShadow(color: Colors.black, offset: Offset(6, 6)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary, width: 2),
                        boxShadow: const [
                          BoxShadow(color: Colors.black, offset: Offset(3, 3)),
                        ],
                      ),
                      child: const Icon(Icons.person_outline, size: 20, color: AppColors.primary),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Welcome back',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Sign in to your talent account',
                      style: TextStyle(fontSize: 14, color: AppColors.textTertiary),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Email address',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.primaryDark,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _emailController,
                      enabled: _emailStep,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction:
                          _emailStep ? TextInputAction.next : TextInputAction.none,
                      onSubmitted: (_) {
                        if (_emailStep && _emailController.text.trim().isNotEmpty) {
                          setState(() => _emailStep = false);
                        }
                      },
                      decoration: _field('you@email.com'),
                    ),
                    if (!_emailStep) ...[
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => setState(() => _emailStep = true),
                          child: const Text('Change'),
                        ),
                      ),
                      const Text(
                        'Password',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.primaryDark,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        autofocus: true,
                        onSubmitted: (_) => _handleLogin(),
                        decoration: _field('Password').copyWith(
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => context.push('/forgot-password'),
                          child: const Text('Forgot password?'),
                        ),
                      ),
                    ],
                    if (authState.error != null) ...[
                      const SizedBox(height: 16),
                      Container(
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
                                authState.error!,
                                style: const TextStyle(color: AppColors.danger, fontSize: 14),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    if (_emailStep)
                      BrutalPrimaryButton(
                        label: 'Continue',
                        trailing: const Icon(Icons.chevron_right, size: 18),
                        onPressed: () {
                          if (_emailController.text.trim().isEmpty) return;
                          setState(() => _emailStep = false);
                        },
                      )
                    else
                      BrutalPrimaryButton(
                        label: 'Sign In',
                        loading: _loading,
                        onPressed: _handleLogin,
                      ),
                    const SizedBox(height: 20),
                    const Divider(color: AppColors.border),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => openWhatsApp(
                        phone: supportPhoneDigits,
                        message: "Hi, I'd like to join SquadHire as talent.",
                      ),
                      child: const Text(
                        'New to SquadHire? Get in touch',
                        style: TextStyle(
                          fontSize: 12,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
