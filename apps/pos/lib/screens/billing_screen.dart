import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';
import '../data/database.dart';
import '../services/sync_service.dart';
import '../services/vertical_service.dart';
import '../widgets/sync_status_badge.dart';

const _uuid = Uuid();

// ─── Cart model ──────────────────────────────────────────────────────────────

class CartLine {
  final String productId;
  final String name;
  int qty;
  final double unitPrice;
  final double taxRate;
  // Searchable attribute values snapshot for receipt display
  final Map<String, dynamic> attributes;

  CartLine({
    required this.productId,
    required this.name,
    required this.qty,
    required this.unitPrice,
    required this.taxRate,
    this.attributes = const {},
  });

  double get lineTotal => qty * unitPrice;
  double get lineTax => lineTotal * taxRate;
}

// ─── Billing Screen ──────────────────────────────────────────────────────────

class BillingScreen extends StatefulWidget {
  final AppDatabase db;
  final SyncService sync;
  final VerticalService vertical;

  const BillingScreen({
    super.key,
    required this.db,
    required this.sync,
    required this.vertical,
  });

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  final List<CartLine> _cart = [];
  double _cartDiscount = 0;
  String _payMethod = 'CASH';
  final _cashController = TextEditingController();
  bool _posting = false;
  String? _postError;
  Map<String, dynamic>? _lastReceipt;

  double get _subtotal => _cart.fold(0, (s, l) => s + l.lineTotal);
  double get _discount => _cartDiscount.clamp(0, _subtotal);
  double get _tax => _cart.fold(0, (s, l) => s + l.lineTax);
  double get _total => (_subtotal - _discount + _tax).clamp(0, double.infinity);
  double get _cashGiven => double.tryParse(_cashController.text) ?? 0;
  double get _change => (_cashGiven - _total).clamp(0, double.infinity);

  void _addProduct(ProductData p) {
    setState(() {
      final idx = _cart.indexWhere((l) => l.productId == p.id);
      if (idx >= 0) {
        _cart[idx].qty++;
      } else {
        _cart.add(CartLine(
          productId: p.id,
          name: p.name,
          qty: 1,
          unitPrice: p.price,
          taxRate: p.taxRate,
          attributes: p.attributes,
        ));
      }
    });
  }

  void _updateQty(int idx, int delta) {
    setState(() => _cart[idx].qty = (_cart[idx].qty + delta).clamp(1, 9999));
  }

  void _removeLine(int idx) => setState(() => _cart.removeAt(idx));

  void _clearCart() => setState(() {
        _cart.clear();
        _cartDiscount = 0;
        _cashController.clear();
        _postError = null;
      });

  Future<void> _checkout() async {
    if (_cart.isEmpty) return;
    if (_payMethod == 'CASH' && _cashGiven < _total) {
      setState(() => _postError = 'Cash given is less than total');
      return;
    }

    setState(() {
      _posting = true;
      _postError = null;
    });

    try {
      final id = _uuid.v4();
      final number = await widget.db.nextLocalInvoiceNumber();
      final now = DateTime.now();
      final pack = widget.vertical.pack;

      final itemInputs = _cart
          .map((l) => InvoiceItemInput(
                productId: l.productId,
                // For spare parts: embed part number in nameSnapshot so it
                // appears on the server-side invoice and print receipt
                nameSnapshot: _buildNameSnapshot(l, pack.searchFilterKeys),
                qty: l.qty.toDouble(),
                unitPrice: l.unitPrice,
                tax: l.lineTax,
                lineTotal: l.lineTotal,
              ))
          .toList();

      final payInputs = [
        PaymentInput(
          method: _payMethod,
          amount: _payMethod == 'CASH' ? _cashGiven : _total,
        ),
      ];

      final moveInputs = _cart
          .map((l) => StockMovementInput(
                productId: l.productId,
                qtyDelta: -l.qty.toDouble(),
                refId: id,
              ))
          .toList();

      final payload = {
        'id': id,
        'outletId': 'offline',
        'number': number,
        'subtotal': _subtotal,
        'discount': _discount,
        'tax': _tax,
        'total': _total,
        'createdAt': now.toIso8601String(),
        'items': _cart
            .map((l) => {
                  'productId': l.productId,
                  'nameSnapshot': _buildNameSnapshot(l, pack.searchFilterKeys),
                  'qty': l.qty,
                  'unitPrice': l.unitPrice,
                  'discount': 0,
                  'tax': l.lineTax,
                  'lineTotal': l.lineTotal,
                })
            .toList(),
        'payments': [
          {
            'method': _payMethod,
            'amount': _payMethod == 'CASH' ? _cashGiven : _total,
          },
        ],
      };

      await widget.db.createInvoice(
        id: id,
        number: number,
        customerId: null,
        subtotal: _subtotal,
        discount: _discount,
        tax: _tax,
        total: _total,
        items: itemInputs,
        payments: payInputs,
        movements: moveInputs,
        outboxPayload: payload,
      );

      setState(() {
        _lastReceipt = {
          'number': number,
          'createdAt': now.toIso8601String(),
          'items': _cart
              .map((l) => {
                    'name': l.name,
                    'qty': l.qty,
                    'unitPrice': l.unitPrice,
                    'lineTotal': l.lineTotal,
                  })
              .toList(),
          'subtotal': _subtotal,
          'discount': _discount,
          'tax': _tax,
          'total': _total,
          'payMethod': _payMethod,
          'cashGiven': _cashGiven,
          'change': _change,
        };
      });

      _clearCart();
      widget.sync.triggerNow();
    } catch (e) {
      setState(() => _postError = e.toString());
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  /// Appends searchable attribute values to the name for receipt / nameSnapshot.
  /// e.g. "Brake Pad  [P/N: BP-1234 | OEM: 12345]"
  String _buildNameSnapshot(CartLine l, List<String> filterKeys) {
    final parts = filterKeys
        .map((k) => l.attributes[k])
        .where((v) => v != null && '$v'.isNotEmpty)
        .map((v) => '$v')
        .toList();
    if (parts.isEmpty) return l.name;
    return '${l.name}  [${parts.join(' | ')}]';
  }

  @override
  Widget build(BuildContext context) {
    final pack = widget.vertical.pack;
    return Scaffold(
      appBar: AppBar(
        // Pack-driven title: shows "OmniPOS — Parts" for spare parts
        title: Text(pack.businessType == 'DEFAULT'
            ? 'OmniPOS'
            : 'OmniPOS — ${pack.label('products', pack.businessType)}'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(child: SyncStatusBadge(syncService: widget.sync)),
          ),
        ],
      ),
      body: Row(
        children: [
          Expanded(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: _ProductSearch(
                    db: widget.db,
                    vertical: widget.vertical,
                    onProductSelected: _addProduct,
                  ),
                ),
                if (_lastReceipt != null)
                  _ReceiptBanner(
                    receipt: _lastReceipt!,
                    onDismiss: () => setState(() => _lastReceipt = null),
                  ),
              ],
            ),
          ),
          SizedBox(
            width: 340,
            child: _CartPanel(
              cart: _cart,
              vertical: widget.vertical,
              discount: _cartDiscount,
              subtotal: _subtotal,
              discountAmt: _discount,
              tax: _tax,
              total: _total,
              payMethod: _payMethod,
              cashController: _cashController,
              cashGiven: _cashGiven,
              change: _change,
              posting: _posting,
              error: _postError,
              onDiscountChanged: (v) => setState(() => _cartDiscount = v),
              onPayMethodChanged: (m) => setState(() => _payMethod = m),
              onQtyDelta: _updateQty,
              onRemove: _removeLine,
              onClear: _clearCart,
              onCheckout: _checkout,
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _cashController.dispose();
    super.dispose();
  }
}

// ─── Product Search ───────────────────────────────────────────────────────────

class _ProductSearch extends StatefulWidget {
  final AppDatabase db;
  final VerticalService vertical;
  final ValueChanged<ProductData> onProductSelected;

  const _ProductSearch({
    required this.db,
    required this.vertical,
    required this.onProductSelected,
  });

  @override
  State<_ProductSearch> createState() => _ProductSearchState();
}

class _ProductSearchState extends State<_ProductSearch> {
  final _ctrl = TextEditingController();
  List<ProductData> _results = [];
  Timer? _debounce;

  void _onChanged(String q) {
    _debounce?.cancel();
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      // Pass pack-defined attribute clauses for offline vertical search
      final r = await widget.db.searchProducts(
        q,
        attributeClauses: widget.vertical.attributeSearchClauses,
      );
      if (mounted) setState(() => _results = r);
    });
  }

  Future<void> _onSubmit(String q) async {
    final p = await widget.db.findByBarcode(q.trim());
    if (p != null) {
      widget.onProductSelected(p);
      _ctrl.clear();
      setState(() => _results = []);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pack = widget.vertical.pack;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _ctrl,
          decoration: InputDecoration(
            // Pack-driven placeholder
            hintText: pack.label('searchPlaceholder', 'Search or scan barcode…'),
            prefixIcon: const Icon(Icons.search),
            border: const OutlineInputBorder(),
            isDense: true,
          ),
          onChanged: _onChanged,
          onSubmitted: _onSubmit,
          autofocus: true,
        ),
        if (_results.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 320),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: _results.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (ctx, i) {
                final p = _results[i];
                // Build subtitle: for spare parts show part_number + vehicle info
                final attrParts = pack.searchFilterKeys
                    .map((k) => p.attrString(k))
                    .where((v) => v != null && v.isNotEmpty)
                    .cast<String>()
                    .toList();
                final subtitle = attrParts.isNotEmpty
                    ? attrParts.join(' · ')
                    : (p.sku ?? p.barcode ?? '');

                return ListTile(
                  dense: true,
                  title: Text(p.name,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(subtitle,
                      style: const TextStyle(fontSize: 11)),
                  trailing: Text(
                    'LKR ${p.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                        color: Color(0xFF1D4ED8), fontWeight: FontWeight.bold),
                  ),
                  onTap: () {
                    widget.onProductSelected(p);
                    _ctrl.clear();
                    setState(() => _results = []);
                  },
                );
              },
            ),
          ),
      ],
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

class _CartPanel extends StatelessWidget {
  final List<CartLine> cart;
  final VerticalService vertical;
  final double discount;
  final double subtotal, discountAmt, tax, total;
  final String payMethod;
  final TextEditingController cashController;
  final double cashGiven, change;
  final bool posting;
  final String? error;
  final ValueChanged<double> onDiscountChanged;
  final ValueChanged<String> onPayMethodChanged;
  final void Function(int, int) onQtyDelta;
  final ValueChanged<int> onRemove;
  final VoidCallback onClear;
  final VoidCallback onCheckout;

  const _CartPanel({
    required this.cart,
    required this.vertical,
    required this.discount,
    required this.subtotal,
    required this.discountAmt,
    required this.tax,
    required this.total,
    required this.payMethod,
    required this.cashController,
    required this.cashGiven,
    required this.change,
    required this.posting,
    required this.error,
    required this.onDiscountChanged,
    required this.onPayMethodChanged,
    required this.onQtyDelta,
    required this.onRemove,
    required this.onClear,
    required this.onCheckout,
  });

  @override
  Widget build(BuildContext context) {
    final pack = vertical.pack;
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          Expanded(
            child: cart.isEmpty
                ? Center(
                    child: Text(
                      'Add ${pack.label('products', 'products').toLowerCase()} to begin',
                      style: const TextStyle(color: Colors.grey),
                    ),
                  )
                : ListView.builder(
                    itemCount: cart.length,
                    itemBuilder: (ctx, i) {
                      final l = cart[i];
                      // Show first searchable attribute value under the name
                      final attrHint = pack.searchFilterKeys
                          .map((k) => l.attributes[k])
                          .where((v) => v != null)
                          .map((v) => '$v')
                          .firstOrNull;

                      return ListTile(
                        dense: true,
                        title: Text(l.name,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        subtitle: Text(
                          attrHint ?? 'LKR ${l.unitPrice.toStringAsFixed(2)} each',
                          style: const TextStyle(fontSize: 11),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline,
                                  size: 18),
                              onPressed: () => onQtyDelta(i, -1),
                            ),
                            Text('${l.qty}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline,
                                  size: 18),
                              onPressed: () => onQtyDelta(i, 1),
                            ),
                            Text(
                              'LKR ${l.lineTotal.toStringAsFixed(2)}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1D4ED8)),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close,
                                  size: 16, color: Colors.grey),
                              onPressed: () => onRemove(i),
                            ),
                          ],
                        ),
                      );
                    }),
          ),

          const Divider(height: 1),

          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Text('Discount', style: TextStyle(fontSize: 13)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        decoration: const InputDecoration(
                          prefixText: 'LKR ',
                          isDense: true,
                          border: OutlineInputBorder(),
                          contentPadding:
                              EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        ),
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'^\d*\.?\d*'))
                        ],
                        onChanged: (v) =>
                            onDiscountChanged(double.tryParse(v) ?? 0),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                _TotalRow('Subtotal', subtotal),
                if (discountAmt > 0)
                  _TotalRow('Discount', -discountAmt, color: Colors.green),
                if (tax > 0) _TotalRow('Tax', tax),
                const Divider(height: 12),
                _TotalRow('Total', total, bold: true, fontSize: 18),

                const SizedBox(height: 8),

                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'CASH', label: Text('Cash')),
                    ButtonSegment(value: 'CARD', label: Text('Card')),
                    ButtonSegment(value: 'TRANSFER', label: Text('Transfer')),
                  ],
                  selected: {payMethod},
                  onSelectionChanged: (s) => onPayMethodChanged(s.first),
                ),

                if (payMethod == 'CASH') ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: cashController,
                    decoration: const InputDecoration(
                      labelText: 'Cash given',
                      prefixText: 'LKR ',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))
                    ],
                  ),
                  if (change > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Change: LKR ${change.toStringAsFixed(2)}',
                      style: const TextStyle(
                          color: Colors.green, fontWeight: FontWeight.bold),
                    ),
                  ],
                ],

                if (error != null) ...[
                  const SizedBox(height: 6),
                  Text(error!,
                      style: const TextStyle(color: Colors.red, fontSize: 12)),
                ],

                const SizedBox(height: 8),

                FilledButton.icon(
                  onPressed: cart.isEmpty || posting ? null : onCheckout,
                  icon: posting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.receipt_long),
                  label: Text(
                    posting
                        ? 'Saving…'
                        : 'Charge  LKR ${total.toStringAsFixed(2)}',
                  ),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    backgroundColor: const Color(0xFF1D4ED8),
                  ),
                ),

                if (cart.isNotEmpty)
                  TextButton(
                    onPressed: onClear,
                    child: const Text('Clear cart',
                        style: TextStyle(color: Colors.grey)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  final String label;
  final double amount;
  final Color? color;
  final bool bold;
  final double fontSize;

  const _TotalRow(this.label, this.amount,
      {this.color, this.bold = false, this.fontSize = 13});

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.bold : FontWeight.normal,
      fontSize: fontSize,
      color: color,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text('LKR ${amount.abs().toStringAsFixed(2)}', style: style),
        ],
      ),
    );
  }
}

// ─── Receipt Banner ───────────────────────────────────────────────────────────

class _ReceiptBanner extends StatelessWidget {
  final Map<String, dynamic> receipt;
  final VoidCallback onDismiss;

  const _ReceiptBanner({required this.receipt, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Card(
        color: Colors.green.shade50,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Invoice ${receipt['number']} saved',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, color: Colors.green),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: onDismiss,
                  ),
                ],
              ),
              Text(
                'Total: LKR ${(receipt['total'] as double).toStringAsFixed(2)}'
                '  •  ${receipt['payMethod']}'
                '${(receipt['change'] as double) > 0 ? '  •  Change: LKR ${(receipt['change'] as double).toStringAsFixed(2)}' : ''}',
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
