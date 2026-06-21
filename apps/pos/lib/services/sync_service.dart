import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../data/database.dart';
import 'api_client.dart';

enum SyncState { idle, syncing, error, offline }

class SyncService {
  final AppDatabase db;
  final ApiClient api;

  SyncState _state = SyncState.idle;
  String? _lastError;
  Timer? _timer;
  final _stateCtrl = StreamController<SyncState>.broadcast();

  SyncService({required this.db, required this.api});

  SyncState get state => _state;
  String? get lastError => _lastError;
  Stream<SyncState> get stateStream => _stateCtrl.stream;

  void start() {
    _runCycle();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _runCycle());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> triggerNow() => _runCycle();

  Future<void> _runCycle() async {
    if (_state == SyncState.syncing) return;
    if (!await _isOnline()) {
      _setState(SyncState.offline);
      return;
    }
    await _push();
    await _pull();
    if (_state != SyncState.error) _setState(SyncState.idle);
  }

  Future<bool> _isOnline() async {
    try {
      // Probe Google DNS on port 53 — fast, reliable, no package needed
      final socket = await Socket.connect('8.8.8.8', 53,
          timeout: const Duration(seconds: 3));
      socket.destroy();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Push outbox ───────────────────────────────────────────────────────────

  Future<void> _push() async {
    // getPendingOutboxAsJson() returns List<Map> — no generated types needed
    final pending = await db.getPendingOutboxAsJson();
    if (pending.isEmpty) return;

    _setState(SyncState.syncing);
    try {
      final items = pending.map((o) {
        final payload = jsonDecode(o['payload'] as String) as Map<String, dynamic>;
        return {'type': o['type'], 'id': o['recordId'], 'data': payload};
      }).toList();

      await api.post('/sync/push', {'items': items});

      final syncedIds = pending.map((o) => o['id'] as int).toList();
      await db.markOutboxSynced(syncedIds);

      // Mark each pushed invoice as synced locally
      for (final o in pending.where((o) => o['type'] == 'invoice')) {
        await db.markInvoiceSynced(o['recordId'] as String);
      }

      _lastError = null;
    } on AuthException {
      _setState(SyncState.error);
      _lastError = 'Session expired — please log in again';
    } catch (e) {
      _setState(SyncState.error);
      _lastError = e.toString();
      for (final o in pending) {
        await db.incrementRetry(o['id'] as int);
      }
    }
  }

  // ── Pull master data ──────────────────────────────────────────────────────

  Future<void> _pull() async {
    try {
      final since = await db.getMeta('sync_cursor') ?? '1970-01-01T00:00:00.000Z';
      final res = await api.get('/sync/pull?since=${Uri.encodeComponent(since)}')
          as Map<String, dynamic>;

      final products = (res['products'] as List? ?? []).cast<Map<String, dynamic>>();
      final categories = (res['categories'] as List? ?? []).cast<Map<String, dynamic>>();
      final customers = (res['customers'] as List? ?? []).cast<Map<String, dynamic>>();
      final cursor = res['cursor'] as String?;

      if (products.isNotEmpty) await db.upsertProductsFromJson(products);
      if (categories.isNotEmpty) await db.upsertCategoriesFromJson(categories);
      if (customers.isNotEmpty) await db.upsertCustomersFromJson(customers);
      if (cursor != null) await db.setMeta('sync_cursor', cursor);
    } on AuthException {
      // handled in push; don't double-report
    } catch (_) {
      // pull failures are non-fatal; next cycle retries
    }
  }

  void _setState(SyncState s) {
    _state = s;
    _stateCtrl.add(s);
  }

  void dispose() {
    stop();
    _stateCtrl.close();
  }
}
