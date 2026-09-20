import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Screen-wide shortcuts active no matter which side of the POS has focus.
/// Deliberately F-keys only — they never collide with normal typing, so this
/// can safely wrap the whole screen (including the search text field)
/// without stealing keystrokes meant for it.
class PosGlobalShortcuts extends StatelessWidget {
  final Widget child;
  final VoidCallback onFocusSearch;
  final VoidCallback onFocusCart;
  final VoidCallback onFocusDiscount;
  final VoidCallback onCheckout;
  final VoidCallback onShowHelp;

  const PosGlobalShortcuts({
    super.key,
    required this.child,
    required this.onFocusSearch,
    required this.onFocusCart,
    required this.onFocusDiscount,
    required this.onCheckout,
    required this.onShowHelp,
  });

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: {
        LogicalKeySet(LogicalKeyboardKey.f1): onShowHelp,
        LogicalKeySet(LogicalKeyboardKey.f2): onFocusSearch,
        LogicalKeySet(LogicalKeyboardKey.f4): onFocusCart,
        LogicalKeySet(LogicalKeyboardKey.f5): onFocusDiscount,
        LogicalKeySet(LogicalKeyboardKey.f9): onCheckout,
      },
      child: Focus(autofocus: true, child: child),
    );
  }
}

/// Cart-line navigation/editing shortcuts. Scoped to a [Focus] wrapping only
/// the cart panel, so digits/+/- are only "live" once the cashier has
/// actually moved focus there (via F4 or tapping a line) — they never
/// compete with typing a product name or SKU into the search field, because
/// Flutter's Shortcuts resolution walks up from whichever widget currently
/// holds focus, and the search field lives outside this subtree.
class PosCartShortcuts extends StatelessWidget {
  final Widget child;
  final FocusNode focusNode;
  final VoidCallback onLineUp;
  final VoidCallback onLineDown;
  final VoidCallback onQtyIncrement;
  final VoidCallback onQtyDecrement;
  final VoidCallback onRemoveLine;
  final ValueChanged<String> onPayMethod;

  const PosCartShortcuts({
    super.key,
    required this.child,
    required this.focusNode,
    required this.onLineUp,
    required this.onLineDown,
    required this.onQtyIncrement,
    required this.onQtyDecrement,
    required this.onRemoveLine,
    required this.onPayMethod,
  });

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: focusNode,
      child: CallbackShortcuts(
        bindings: {
          LogicalKeySet(LogicalKeyboardKey.arrowUp): onLineUp,
          LogicalKeySet(LogicalKeyboardKey.arrowDown): onLineDown,
          LogicalKeySet(LogicalKeyboardKey.equal): onQtyIncrement,
          LogicalKeySet(LogicalKeyboardKey.numpadAdd): onQtyIncrement,
          LogicalKeySet(LogicalKeyboardKey.minus): onQtyDecrement,
          LogicalKeySet(LogicalKeyboardKey.numpadSubtract): onQtyDecrement,
          LogicalKeySet(LogicalKeyboardKey.delete): onRemoveLine,
          LogicalKeySet(LogicalKeyboardKey.backspace): onRemoveLine,
          LogicalKeySet(LogicalKeyboardKey.digit1): () => onPayMethod('CASH'),
          LogicalKeySet(LogicalKeyboardKey.digit2): () => onPayMethod('CARD'),
          LogicalKeySet(LogicalKeyboardKey.digit3): () => onPayMethod('TRANSFER'),
        },
        child: child,
      ),
    );
  }
}

/// F1 help overlay — every shortcut is discoverable from inside the app,
/// no manual required.
class PosShortcutsHelpDialog extends StatelessWidget {
  const PosShortcutsHelpDialog({super.key});

  static const _rows = [
    ['F1', 'Show this help'],
    ['F2', 'Focus product search / scan'],
    ['F4', 'Focus the cart'],
    ['F5', 'Focus the discount field'],
    ['F9', 'Checkout / charge'],
    ['↑ / ↓', 'Move between cart lines (cart focused)'],
    ['+ / -', 'Increase / decrease qty of the selected line'],
    ['Delete', 'Remove the selected cart line'],
    ['1 / 2 / 3', 'Cash / Card / Transfer (cart focused)'],
  ];

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Keyboard shortcuts'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: _rows
              .map((r) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 90,
                          child: Text(r[0],
                              style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                        ),
                        Expanded(child: Text(r[1])),
                      ],
                    ),
                  ))
              .toList(),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
      ],
    );
  }
}
