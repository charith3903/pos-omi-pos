import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

// ─── Plain Dart data classes ──────────────────────────────────────────────────
// These are pure Dart — no code generation. Safe to import anywhere.

class ProductData {
  final String id;
  final String name;
  final String? sku;
  final String? barcode;
  final String? categoryId;
  final double price;
  final double taxRate;
  final bool trackStock;
  final Map<String, dynamic> attributes;

  const ProductData({
    required this.id,
    required this.name,
    this.sku,
    this.barcode,
    this.categoryId,
    required this.price,
    required this.taxRate,
    required this.trackStock,
    this.attributes = const {},
  });

  factory ProductData.fromMap(Map<String, dynamic> m) {
    Map<String, dynamic> attrs = {};
    final raw = m['attributes'];
    if (raw is String && raw.isNotEmpty) {
      try {
        attrs = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      } catch (_) {}
    }
    return ProductData(
      id: m['id'] as String,
      name: m['name'] as String,
      sku: m['sku'] as String?,
      barcode: m['barcode'] as String?,
      categoryId: m['category_id'] as String?,
      price: (m['price'] as num).toDouble(),
      taxRate: (m['tax_rate'] as num?)?.toDouble() ?? 0.0,
      trackStock: (m['track_stock'] as int?) == 1,
      attributes: attrs,
    );
  }

  /// Returns a display string for a searchable attribute key.
  String? attrString(String key) {
    final v = attributes[key];
    return v != null ? '$v' : null;
  }
}

class InvoiceItemInput {
  final String productId;
  final String nameSnapshot;
  final double qty;
  final double unitPrice;
  final double discount;
  final double tax;
  final double lineTotal;

  const InvoiceItemInput({
    required this.productId,
    required this.nameSnapshot,
    required this.qty,
    required this.unitPrice,
    this.discount = 0,
    this.tax = 0,
    required this.lineTotal,
  });
}

class PaymentInput {
  final String method;
  final double amount;
  const PaymentInput({required this.method, required this.amount});
}

class StockMovementInput {
  final String productId;
  final String? variantId;
  final double qtyDelta;
  final String? refId;

  const StockMovementInput({
    required this.productId,
    this.variantId,
    required this.qtyDelta,
    this.refId,
  });
}

class LocalInvoiceData {
  final String id;
  final String number;
  final double total;
  final String syncStatus;
  final DateTime createdAt;

  const LocalInvoiceData({
    required this.id,
    required this.number,
    required this.total,
    required this.syncStatus,
    required this.createdAt,
  });

  factory LocalInvoiceData.fromMap(Map<String, dynamic> m) => LocalInvoiceData(
        id: m['id'] as String,
        number: m['number'] as String,
        total: (m['total'] as num).toDouble(),
        syncStatus: m['sync_status'] as String,
        createdAt:
            DateTime.fromMillisecondsSinceEpoch(m['created_at'] as int),
      );
}

// ─── Database ─────────────────────────────────────────────────────────────────

class AppDatabase {
  Database? _db;

  Future<Database> get _open async {
    if (_db != null) return _db!;
    _db = await openDatabase(
      join(await getDatabasesPath(), 'omnipos_local.db'),
      version: 1,
      onCreate: _onCreate,
    );
    return _db!;
  }

  Future<void> _onCreate(Database db, int version) async {
    final b = db.batch();
    b.execute('''
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        parent_id TEXT, updated_at INTEGER NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        sku TEXT, barcode TEXT,
        price REAL NOT NULL, tax_rate REAL NOT NULL DEFAULT 0,
        track_stock INTEGER NOT NULL DEFAULT 0,
        category_id TEXT, attributes TEXT,
        updated_at INTEGER NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        phone TEXT, email TEXT, updated_at INTEGER NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS local_invoices (
        id TEXT PRIMARY KEY, number TEXT NOT NULL,
        customer_id TEXT,
        subtotal REAL NOT NULL, discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'PAID',
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at INTEGER NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS local_invoice_items (
        id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL,
        product_id TEXT NOT NULL, name_snapshot TEXT NOT NULL,
        qty REAL NOT NULL, unit_price REAL NOT NULL,
        discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS local_payments (
        id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL,
        method TEXT NOT NULL, amount REAL NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS local_stock_movements (
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL,
        variant_id TEXT, qty_delta REAL NOT NULL,
        reason TEXT NOT NULL DEFAULT 'SALE',
        ref_id TEXT,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at INTEGER NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS outbox_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )''');
    b.execute('''
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY, value TEXT NOT NULL
      )''');
    // Indexes
    b.execute('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
    b.execute('CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_items(status)');
    await b.commit(noResult: true);
  }

  // ── Product queries ──────────────────────────────────────────────────────

  /// [attributeClauses] are pack-defined clauses using json_extract, e.g.:
  /// ["json_extract(attributes, '$.part_number') LIKE ?"]
  /// Each clause adds one `lq` arg to the parameter list.
  Future<List<ProductData>> searchProducts(
    String query, {
    List<String> attributeClauses = const [],
  }) async {
    final db = await _open;
    final lq = '%${query.toLowerCase()}%';

    final attrSql = attributeClauses.isNotEmpty
        ? ' OR ${attributeClauses.join(' OR ')}'
        : '';

    // One `lq` arg for each attribute clause
    final attrArgs = List.filled(attributeClauses.length, lq);

    final rows = await db.rawQuery(
      '''SELECT * FROM products
         WHERE lower(name) LIKE ? OR barcode = ? OR lower(sku) LIKE ?$attrSql
         LIMIT 20''',
      [lq, query, lq, ...attrArgs],
    );
    return rows.map(ProductData.fromMap).toList();
  }

  Future<ProductData?> findByBarcode(String barcode) async {
    final db = await _open;
    final rows = await db.query('products',
        where: 'barcode = ?', whereArgs: [barcode], limit: 1);
    return rows.isEmpty ? null : ProductData.fromMap(rows.first);
  }

  // ── Customer queries ─────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> searchCustomers(String query) async {
    final db = await _open;
    final lq = '%${query.toLowerCase()}%';
    return db.rawQuery(
      'SELECT * FROM customers WHERE lower(name) LIKE ? OR phone LIKE ? LIMIT 10',
      [lq, lq],
    );
  }

  // ── Invoice creation (single transaction) ────────────────────────────────

  Future<void> createInvoice({
    required String id,
    required String number,
    String? customerId,
    required double subtotal,
    required double discount,
    required double tax,
    required double total,
    required List<InvoiceItemInput> items,
    required List<PaymentInput> payments,
    required List<StockMovementInput> movements,
    required Map<String, dynamic> outboxPayload,
  }) async {
    final db = await _open;
    final now = DateTime.now().millisecondsSinceEpoch;

    await db.transaction((txn) async {
      await txn.insert('local_invoices', {
        'id': id,
        'number': number,
        'customer_id': customerId,
        'subtotal': subtotal,
        'discount': discount,
        'tax': tax,
        'total': total,
        'created_at': now,
      });

      for (final item in items) {
        await txn.insert('local_invoice_items', {
          'id': _uuid.v4(),
          'invoice_id': id,
          'product_id': item.productId,
          'name_snapshot': item.nameSnapshot,
          'qty': item.qty,
          'unit_price': item.unitPrice,
          'discount': item.discount,
          'tax': item.tax,
          'line_total': item.lineTotal,
        });
      }

      for (final p in payments) {
        await txn.insert('local_payments', {
          'id': _uuid.v4(),
          'invoice_id': id,
          'method': p.method,
          'amount': p.amount,
        });
      }

      for (final m in movements) {
        await txn.insert('local_stock_movements', {
          'id': _uuid.v4(),
          'product_id': m.productId,
          'variant_id': m.variantId,
          'qty_delta': m.qtyDelta,
          'ref_id': m.refId,
          'created_at': now,
        });
      }

      await txn.insert('outbox_items', {
        'type': 'invoice',
        'record_id': id,
        'payload': jsonEncode(outboxPayload),
        'created_at': now,
      });
    });
  }

  // ── Outbox ───────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getPendingOutboxAsJson() async {
    final db = await _open;
    return db.query('outbox_items',
        where: "status = 'PENDING'",
        orderBy: 'created_at ASC');
  }

  Future<void> markOutboxSynced(List<int> ids) async {
    if (ids.isEmpty) return;
    final db = await _open;
    final placeholders = List.filled(ids.length, '?').join(',');
    await db.rawUpdate(
      "UPDATE outbox_items SET status = 'SYNCED' WHERE id IN ($placeholders)",
      ids,
    );
  }

  Future<void> incrementRetry(int id) async {
    final db = await _open;
    await db.rawUpdate(
      'UPDATE outbox_items SET retry_count = retry_count + 1 WHERE id = ?',
      [id],
    );
  }

  Future<void> markInvoiceSynced(String invoiceId) async {
    final db = await _open;
    await db.rawUpdate(
      "UPDATE local_invoices SET sync_status = 'SYNCED' WHERE id = ?",
      [invoiceId],
    );
  }

  // ── Sync meta ────────────────────────────────────────────────────────────

  Future<String?> getMeta(String key) async {
    final db = await _open;
    final rows =
        await db.query('sync_meta', where: 'key = ?', whereArgs: [key]);
    return rows.isEmpty ? null : rows.first['value'] as String;
  }

  Future<void> setMeta(String key, String value) async {
    final db = await _open;
    await db.insert(
      'sync_meta',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // ── Pull upserts ─────────────────────────────────────────────────────────

  Future<void> upsertProductsFromJson(List<Map<String, dynamic>> data) async {
    final db = await _open;
    final b = db.batch();
    for (final p in data) {
      b.insert(
        'products',
        {
          'id': p['id'],
          'name': p['name'],
          'sku': p['sku'],
          'barcode': p['barcode'],
          'price': (p['price'] as num).toDouble(),
          'tax_rate': (p['taxRate'] as num?)?.toDouble() ?? 0.0,
          'track_stock': (p['trackStock'] as bool? ?? false) ? 1 : 0,
          'category_id': p['categoryId'],
          'attributes': p['attributes'] != null
              ? jsonEncode(p['attributes'])
              : null,
          'updated_at':
              DateTime.parse(p['updatedAt'] as String).millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await b.commit(noResult: true);
  }

  Future<void> upsertCategoriesFromJson(List<Map<String, dynamic>> data) async {
    final db = await _open;
    final b = db.batch();
    for (final c in data) {
      b.insert(
        'categories',
        {
          'id': c['id'],
          'name': c['name'],
          'parent_id': c['parentId'],
          'updated_at':
              DateTime.parse(c['updatedAt'] as String).millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await b.commit(noResult: true);
  }

  Future<void> upsertCustomersFromJson(List<Map<String, dynamic>> data) async {
    final db = await _open;
    final b = db.batch();
    for (final c in data) {
      b.insert(
        'customers',
        {
          'id': c['id'],
          'name': c['name'],
          'phone': c['phone'],
          'email': c['email'],
          'updated_at':
              DateTime.parse(c['updatedAt'] as String).millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await b.commit(noResult: true);
  }

  // ── Local sequential invoice number ─────────────────────────────────────

  Future<String> nextLocalInvoiceNumber() async {
    final raw = await getMeta('invoice_seq') ?? '0';
    final next = int.parse(raw) + 1;
    await setMeta('invoice_seq', '$next');
    final year = DateTime.now().year;
    return 'L$year-${next.toString().padLeft(5, '0')}';
  }

  // ── Recent invoices ──────────────────────────────────────────────────────

  Future<List<LocalInvoiceData>> getRecentInvoices({int limit = 30}) async {
    final db = await _open;
    final rows = await db.query('local_invoices',
        orderBy: 'created_at DESC', limit: limit);
    return rows.map(LocalInvoiceData.fromMap).toList();
  }

  Future<void> close() async => (await _open).close();
}
