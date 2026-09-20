import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';
import '../data/database.dart';
import '../services/sync_service.dart';
import '../services/vertical_service.dart';
import '../widgets/pos_shortcuts.dart';
import '../widgets/sync_status_badge.dart';

const _uuid = Uuid();

// ─── Cart model ──────────────────────────────────────────────────────────────

class CartLine {
  final String productId;
  final String? variantId;
  final String? variantLabel;
  final String name;
  int qty;
  final double unitPrice;
  final double taxRate;
  // Searchable attribute values snapshot for receipt display
  final Map<String, dynamic> attributes;
  /// Cashier-picked batch (POS batch picker) — null means "let the server pick FIFO".
  final String? batchId;
  final String? batchLabel;

  CartLine({
    required this.productId,
    this.variantId,
    this.variantLabel,
    required this.name,
    required this.qty,
    required this.unitPrice,
    required this.taxRate,
    this.attributes = const {},
    this.batchId,
    this.batchLabel,
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

  // ── Keyboard-only operation ────────────────────────────────────────────
  final _searchFocusNode = FocusNode();
  final _discountFocusNode = FocusNode();
  final _cartFocusNode = FocusNode();
  int _selectedCartIndex = -1;

  double get _subtotal => _cart.fold(0, (s, l) => s + l.lineTotal);
  double get _discount => _cartDiscount.clamp(0, _subtotal);
  double get _tax => _cart.fold(0, (s, l) => s + l.lineTax);
  double get _total => (_subtotal - _discount + _tax).clamp(0, double.infinity);
  double get _cashGiven => double.tryParse(_cashController.text) ?? 0;
  double get _change => (_cashGiven - _total).clamp(0, double.infinity);

  void _addProduct(ProductData p, [ProductVariantData? variant, BatchData? batch]) {
    setState(() {
      // Different batches of the same variant are kept as separate cart
      // lines — they can carry different cost/selling price.
      final key = '${variant?.id ?? p.id}::${batch?.id ?? ''}';
      final idx = _cart.indexWhere(
        (l) => '${l.variantId ?? l.productId}::${l.batchId ?? ''}' == key,
      );
      if (idx >= 0) {
        _cart[idx].qty++;
      } else {
        _cart.add(CartLine(
          productId: p.id,
          variantId: variant?.id,
          variantLabel: variant?.label,
          name: p.name,
          qty: 1,
          // A picked batch's own selling price wins (it may predate the
          // variant's current price); otherwise variant/product price.
          unitPrice: batch?.sellingPrice ?? variant?.price ?? p.price,
          taxRate: p.taxRate,
          attributes: p.attributes,
          batchId: batch?.id,
          batchLabel: batch?.batchNo,
        ));
      }
    });
  }

  void _updateQty(int idx, int delta) {
    setState(() => _cart[idx].qty = (_cart[idx].qty + delta).clamp(1, 9999));
  }

  void _removeLine(int idx) => setState(() {
        _cart.removeAt(idx);
        if (_selectedCartIndex >= _cart.length) {
          _selectedCartIndex = _cart.length - 1;
        }
      });

  // ── Keyboard-only cart operation ─────────────────────────────────────────
  // Mirrors the mouse controls above (_updateQty/_removeLine) so the two
  // input methods can never drift out of sync — the keyboard just picks
  // which line those same methods apply to.

  void _selectCartLine(int idx) => setState(() => _selectedCartIndex = idx);

  void _focusSearch() => _searchFocusNode.requestFocus();
  void _focusDiscount() => _discountFocusNode.requestFocus();

  void _focusCart() {
    if (_cart.isEmpty) return;
    setState(() {
      if (_selectedCartIndex < 0 || _selectedCartIndex >= _cart.length) {
        _selectedCartIndex = _cart.length - 1;
      }
    });
    _cartFocusNode.requestFocus();
  }

  void _moveCartSelection(int delta) {
    if (_cart.isEmpty) return;
    setState(() {
      final base = _selectedCartIndex < 0 ? 0 : _selectedCartIndex;
      _selectedCartIndex = (base + delta).clamp(0, _cart.length - 1);
    });
  }

  void _stepSelectedQty(int delta) {
    if (_selectedCartIndex < 0 || _selectedCartIndex >= _cart.length) return;
    _updateQty(_selectedCartIndex, delta);
  }

  void _removeSelectedLine() {
    if (_selectedCartIndex < 0 || _selectedCartIndex >= _cart.length) return;
    final removedIdx = _selectedCartIndex;
    _removeLine(removedIdx);
    setState(() {
      if (_cart.isEmpty) {
        _selectedCartIndex = -1;
      } else {
        _selectedCartIndex = removedIdx.clamp(0, _cart.length - 1);
      }
    });
  }

  void _setPayMethod(String m) => setState(() => _payMethod = m);

  void _showShortcutsHelp() {
    showDialog(context: context, builder: (_) => const PosShortcutsHelpDialog());
  }

  void _clearCart() => setState(() {
        _cart.clear();
        _cartDiscount = 0;
        _cashController.clear();
        _postError = null;
        _selectedCartIndex = -1;
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
                batchId: l.batchId,
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
                variantId: l.variantId,
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
                  if (l.variantId != null) 'variantId': l.variantId,
                  if (l.batchId != null) 'batchId': l.batchId,
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
                    'name': l.variantLabel != null ? '${l.name} (${l.variantLabel})' : l.name,
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

  /// Appends the variant label (e.g. "M / Red") and searchable attribute
  /// values to the name for receipt / nameSnapshot, e.g.
  /// "Brake Pad  [P/N: BP-1234 | OEM: 12345]" or "T-Shirt  [M / Red]".
  String _buildNameSnapshot(CartLine l, List<String> filterKeys) {
    final parts = [
      if (l.variantLabel != null && l.variantLabel!.isNotEmpty) l.variantLabel!,
      ...filterKeys
          .map((k) => l.attributes[k])
          .where((v) => v != null && '$v'.isNotEmpty)
          .map((v) => '$v'),
    ];
    if (parts.isEmpty) return l.name;
    return '${l.name}  [${parts.join(' | ')}]';
  }

  @override
  Widget build(BuildContext context) {
    final pack = widget.vertical.pack;
    final modern = pack.posViewMode == 'MODERN';

    final cartPanel = PosCartShortcuts(
      focusNode: _cartFocusNode,
      onLineUp: () => _moveCartSelection(-1),
      onLineDown: () => _moveCartSelection(1),
      onQtyIncrement: () => _stepSelectedQty(1),
      onQtyDecrement: () => _stepSelectedQty(-1),
      onRemoveLine: _removeSelectedLine,
      onPayMethod: _setPayMethod,
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
        modern: modern,
        discountFocusNode: _discountFocusNode,
        selectedIndex: _selectedCartIndex,
        onSelectIndex: _selectCartLine,
        onDiscountChanged: (v) => setState(() => _cartDiscount = v),
        onPayMethodChanged: _setPayMethod,
        onQtyDelta: _updateQty,
        onRemove: _removeLine,
        onClear: _clearCart,
        onCheckout: _checkout,
      ),
    );

    return PosGlobalShortcuts(
      onFocusSearch: _focusSearch,
      onFocusCart: _focusCart,
      onFocusDiscount: _focusDiscount,
      onCheckout: _checkout,
      onShowHelp: _showShortcutsHelp,
      child: Scaffold(
        backgroundColor: modern ? const Color(0xFFF8FAFC) : null,
        appBar: AppBar(
          // Pack-driven title: shows "OmniPOS — Parts" for spare parts
          title: Text(pack.businessType == 'DEFAULT'
              ? 'OmniPOS'
              : 'OmniPOS — ${pack.label('products', pack.businessType)}'),
          backgroundColor: const Color(0xFF1E3A8A),
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              tooltip: 'Keyboard shortcuts (F1)',
              icon: const Icon(Icons.keyboard),
              onPressed: _showShortcutsHelp,
            ),
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
                    padding: EdgeInsets.all(modern ? 16 : 12),
                    child: _ProductSearch(
                      db: widget.db,
                      vertical: widget.vertical,
                      onProductSelected: _addProduct,
                      gridMode: modern,
                      focusNode: _searchFocusNode,
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
              width: modern ? 420 : 340,
              child: cartPanel,
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cashController.dispose();
    _searchFocusNode.dispose();
    _discountFocusNode.dispose();
    _cartFocusNode.dispose();
    super.dispose();
  }
}

// ─── Product Search ───────────────────────────────────────────────────────────

class _ProductSearch extends StatefulWidget {
  final AppDatabase db;
  final VerticalService vertical;
  final void Function(ProductData product, ProductVariantData? variant, [BatchData? batch]) onProductSelected;
  /// Modern view renders results as a tappable card grid instead of a list —
  /// bigger touch targets, same underlying search/selection logic.
  final bool gridMode;
  final FocusNode? focusNode;

  const _ProductSearch({
    required this.db,
    required this.vertical,
    required this.onProductSelected,
    this.gridMode = false,
    this.focusNode,
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

  /// Resolves which batch a sale should draw from, given a product/variant:
  ///  - no batches (legacy stock, or GRN never ran) → null, sell unbatched.
  ///  - exactly one batch → use it silently, no extra tap for the cashier.
  ///  - multiple batches → show the picker so the cashier can see qty/cost/
  ///    price/expiry per batch and override the FIFO default if they want.
  /// Returns `(batch, cancelled)` — cancelled is true only when the cashier
  /// dismissed a picker that was actually shown, so callers can abort the
  /// add-to-cart in that case (matches the variant picker's cancel behavior).
  Future<(BatchData?, bool)> _resolveBatch(String productId, String? variantId) async {
    final batches = await widget.db.batchesForVariant(productId, variantId);
    if (batches.isEmpty) return (null, false);
    if (batches.length == 1) return (batches.first, false);
    if (!mounted) return (batches.first, false);
    final chosen = await showModalBottomSheet<BatchData>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _BatchPickerSheet(batches: batches),
    );
    return (chosen, chosen == null);
  }

  /// Scanning/typing a variant's own barcode goes straight to cart, skipping
  /// the picker — the app's existing hardware-scanner-into-text-field
  /// convention, extended to variants.
  Future<void> _onSubmit(String q) async {
    final trimmed = q.trim();
    final variant = await widget.db.findVariantByBarcode(trimmed);
    if (variant != null) {
      final product = await widget.db.getProductById(variant.productId);
      if (product != null) {
        final (batch, cancelled) = await _resolveBatch(product.id, variant.id);
        if (cancelled) return;
        widget.onProductSelected(product, variant, batch);
        _ctrl.clear();
        setState(() => _results = []);
        return;
      }
    }
    final p = await widget.db.findByBarcode(trimmed);
    if (p != null) {
      final (batch, cancelled) = await _resolveBatch(p.id, null);
      if (cancelled) return;
      widget.onProductSelected(p, null, batch);
      _ctrl.clear();
      setState(() => _results = []);
    }
  }

  /// Tapping a search result: if it has variants and the tenant's pack
  /// enables the module, show a picker instead of adding the base product.
  Future<void> _selectProduct(ProductData p) async {
    if (widget.vertical.pack.enabledModules.contains('variants')) {
      final variants = await widget.db.variantsForProduct(p.id);
      if (!mounted) return;
      if (variants.isNotEmpty) {
        final chosen = await showModalBottomSheet<ProductVariantData>(
          context: context,
          isScrollControlled: true,
          builder: (ctx) => _VariantPickerSheet(product: p, variants: variants),
        );
        if (chosen == null) return; // cancelled — leave search results as-is
        final (batch, cancelled) = await _resolveBatch(p.id, chosen.id);
        if (cancelled) return;
        widget.onProductSelected(p, chosen, batch);
        _ctrl.clear();
        setState(() => _results = []);
        return;
      }
    }
    final (batch, cancelled) = await _resolveBatch(p.id, null);
    if (cancelled) return;
    widget.onProductSelected(p, null, batch);
    _ctrl.clear();
    setState(() => _results = []);
  }

  String _subtitleFor(ProductData p, List<String> filterKeys) {
    final attrParts = filterKeys
        .map((k) => p.attrString(k))
        .where((v) => v != null && v.isNotEmpty)
        .cast<String>()
        .toList();
    return attrParts.isNotEmpty ? attrParts.join(' · ') : (p.sku ?? p.barcode ?? '');
  }

  @override
  Widget build(BuildContext context) {
    final pack = widget.vertical.pack;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _ctrl,
          focusNode: widget.focusNode,
          decoration: InputDecoration(
            // Pack-driven placeholder
            hintText: pack.label('searchPlaceholder', 'Search or scan barcode…'),
            prefixIcon: const Icon(Icons.search),
            border: const OutlineInputBorder(),
            isDense: !widget.gridMode,
            contentPadding: widget.gridMode
                ? const EdgeInsets.symmetric(horizontal: 16, vertical: 16)
                : null,
          ),
          style: widget.gridMode ? const TextStyle(fontSize: 16) : null,
          onChanged: _onChanged,
          onSubmitted: _onSubmit,
          autofocus: true,
        ),
        if (_results.isNotEmpty)
          widget.gridMode ? _buildGrid(pack) : _buildList(pack),
      ],
    );
  }

  Widget _buildList(dynamic pack) {
    return Container(
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
          return ListTile(
            dense: true,
            title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(_subtitleFor(p, pack.searchFilterKeys), style: const TextStyle(fontSize: 11)),
            trailing: Text(
              'LKR ${p.price.toStringAsFixed(2)}',
              style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.bold),
            ),
            onTap: () => _selectProduct(p),
          );
        },
      ),
    );
  }

  /// Modern view: a grid of tappable cards — larger touch targets for
  /// touchscreen POS terminals, same search/selection logic as the list.
  Widget _buildGrid(dynamic pack) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 420),
      child: GridView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.only(top: 12),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 220,
          childAspectRatio: 1.3,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: _results.length,
        itemBuilder: (ctx, i) {
          final p = _results[i];
          final outOfStock = p.trackStock && p.stockQty <= 0;
          return Material(
            color: outOfStock ? const Color(0xFFF1F5F9) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            elevation: 1,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: outOfStock ? null : () => _selectProduct(p),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(p.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    Text(_subtitleFor(p, pack.searchFilterKeys),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('LKR ${p.price.toStringAsFixed(2)}',
                            style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.bold, fontSize: 16)),
                        if (outOfStock)
                          const Text('Out', style: TextStyle(color: Colors.red, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }
}

// ─── Variant Picker ─────────────────────────────────────────────────────────

/// Bottom sheet of variant chips (grid-like via Wrap) with stock counts.
/// Generic over however many attribute keys a variant has — not hardcoded
/// to exactly size+color.
class _VariantPickerSheet extends StatelessWidget {
  final ProductData product;
  final List<ProductVariantData> variants;

  const _VariantPickerSheet({required this.product, required this.variants});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(product.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            const Text('Choose a variant', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: variants.map((v) {
                final outOfStock = product.trackStock && v.stockQty <= 0;
                return ActionChip(
                  label: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(v.label.isEmpty ? '—' : v.label,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(
                        outOfStock ? 'Out of stock' : '${v.stockQty.toStringAsFixed(0)} in stock',
                        style: TextStyle(
                          fontSize: 10,
                          color: outOfStock ? Colors.red : Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                  backgroundColor: outOfStock ? Colors.grey.shade100 : const Color(0xFFEFF6FF),
                  onPressed: outOfStock ? null : () => Navigator.pop(context, v),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Batch Picker ───────────────────────────────────────────────────────────

/// Bottom sheet listing available batches oldest-received-first (FIFO order).
/// Only shown when a variant/product has more than one batch — with exactly
/// one, [_ProductSearchState._resolveBatch] uses it silently. The first
/// (oldest) row is marked "FIFO" as the recommended default; any row is
/// tappable to override it.
class _BatchPickerSheet extends StatelessWidget {
  final List<BatchData> batches;

  const _BatchPickerSheet({required this.batches});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Choose a batch', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            const Text(
              'Multiple batches are available — the oldest (FIFO) is recommended.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 360),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: batches.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (ctx, i) {
                  final b = batches[i];
                  final isFifo = i == 0;
                  return ListTile(
                    dense: true,
                    leading: isFifo
                        ? const Icon(Icons.arrow_upward, color: Color(0xFF1D4ED8), size: 18)
                        : const SizedBox(width: 18),
                    title: Text(
                      b.batchNo?.isNotEmpty == true ? b.batchNo! : 'Batch ${i + 1}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      [
                        '${b.qtyRemaining.toStringAsFixed(0)} left',
                        if (b.unitCost != null) 'cost LKR ${b.unitCost!.toStringAsFixed(2)}',
                        if (b.sellingPrice != null) 'price LKR ${b.sellingPrice!.toStringAsFixed(2)}',
                        if (b.expiryDate != null)
                          'exp ${b.expiryDate!.toLocal().toString().split(' ').first}',
                      ].join(' · '),
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: isFifo
                        ? const Text('FIFO', style: TextStyle(fontSize: 10, color: Color(0xFF1D4ED8), fontWeight: FontWeight.bold))
                        : null,
                    onTap: () => Navigator.pop(context, b),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
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
  /// Modern view: larger touch targets and a card-style panel — same data/callbacks.
  final bool modern;
  final FocusNode? discountFocusNode;
  /// Keyboard-selected cart line (via F4 + arrows) — highlighted; -1 = none.
  /// Tapping a row with the mouse also sets this, so keyboard/mouse selection
  /// never disagree about which line is "active".
  final int selectedIndex;
  final ValueChanged<int> onSelectIndex;

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
    this.modern = false,
    this.discountFocusNode,
    this.selectedIndex = -1,
    required this.onSelectIndex,
  });

  @override
  Widget build(BuildContext context) {
    final pack = vertical.pack;
    final iconSize = modern ? 28.0 : 18.0;
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          Expanded(
            child: cart.isEmpty
                ? Center(
                    child: Text(
                      'Add ${pack.label('products', 'products').toLowerCase()} to begin',
                      style: TextStyle(color: Colors.grey, fontSize: modern ? 16 : 14),
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
                        dense: !modern,
                        selected: i == selectedIndex,
                        selectedTileColor: const Color(0xFFEFF6FF),
                        onTap: () => onSelectIndex(i),
                        contentPadding: modern
                            ? const EdgeInsets.symmetric(horizontal: 16, vertical: 8)
                            : null,
                        title: Text(l.name,
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: modern ? 16 : 14),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        subtitle: Text(
                          [
                            l.variantLabel ?? attrHint ?? 'LKR ${l.unitPrice.toStringAsFixed(2)} each',
                            if (l.batchLabel != null) 'batch ${l.batchLabel}',
                          ].join(' · '),
                          style: TextStyle(fontSize: modern ? 12 : 11),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: Icon(Icons.remove_circle_outline, size: iconSize),
                              onPressed: () => onQtyDelta(i, -1),
                            ),
                            Text('${l.qty}',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: modern ? 16 : 14)),
                            IconButton(
                              icon: Icon(Icons.add_circle_outline, size: iconSize),
                              onPressed: () => onQtyDelta(i, 1),
                            ),
                            Text(
                              'LKR ${l.lineTotal.toStringAsFixed(2)}',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: modern ? 15 : 14,
                                  color: const Color(0xFF1D4ED8)),
                            ),
                            IconButton(
                              icon: Icon(Icons.close, size: modern ? 20 : 16, color: Colors.grey),
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
                        focusNode: discountFocusNode,
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
                    style: TextStyle(fontSize: modern ? 17 : 14),
                  ),
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: modern ? 20 : 14),
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
