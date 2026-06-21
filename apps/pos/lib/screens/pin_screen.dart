import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class PinScreen extends StatefulWidget {
  final AuthService auth;
  final bool isSetup; // true = first-time set PIN; false = verify PIN
  final VoidCallback onSuccess;

  const PinScreen({
    super.key,
    required this.auth,
    required this.isSetup,
    required this.onSuccess,
  });

  @override
  State<PinScreen> createState() => _PinScreenState();
}

class _PinScreenState extends State<PinScreen> {
  String _pin = '';
  String _confirm = '';
  bool _confirming = false;
  String? _error;

  void _onKey(String digit) {
    if (_pin.length >= 4) return;
    setState(() => _pin += digit);
    if (_pin.length == 4) _onComplete();
  }

  void _onDelete() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _onComplete() async {
    if (widget.isSetup) {
      if (!_confirming) {
        setState(() { _confirm = _pin; _pin = ''; _confirming = true; });
        return;
      }
      if (_pin == _confirm) {
        await widget.auth.setPin(_pin);
        widget.onSuccess();
      } else {
        setState(() {
          _error = 'PINs do not match — try again';
          _pin = '';
          _confirm = '';
          _confirming = false;
        });
      }
    } else {
      final ok = await widget.auth.verifyPin(_pin);
      if (ok) {
        widget.onSuccess();
      } else {
        setState(() { _error = 'Incorrect PIN'; _pin = ''; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.isSetup
        ? (_confirming ? 'Confirm PIN' : 'Set Cashier PIN')
        : 'Enter PIN';

    return Scaffold(
      backgroundColor: const Color(0xFF1E3A8A),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outlined, size: 40, color: Colors.white70),
              const SizedBox(height: 12),
              Text(title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (_error != null)
                Text(_error!,
                    style: const TextStyle(color: Colors.orangeAccent, fontSize: 13)),
              const SizedBox(height: 24),
              // PIN dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  4,
                  (i) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _pin.length
                          ? Colors.white
                          : Colors.white.withValues(alpha:0.3),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              // Numpad
              ...[ ['1','2','3'], ['4','5','6'], ['7','8','9'], ['','0','⌫'] ]
                  .map((row) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: row.map((k) {
                            if (k.isEmpty) return const SizedBox(width: 80);
                            return Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: SizedBox(
                                width: 64,
                                height: 64,
                                child: FilledButton(
                                  onPressed: () => k == '⌫' ? _onDelete() : _onKey(k),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: Colors.white.withValues(alpha:0.15),
                                    shape: const CircleBorder(),
                                  ),
                                  child: Text(k,
                                      style: const TextStyle(
                                          fontSize: 22,
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold)),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      )),
            ],
          ),
        ),
      ),
    );
  }
}
