import '../data/database.dart';
import '../models/vertical_pack.dart';
import 'api_client.dart';

class VerticalService {
  final AppDatabase _db;
  final ApiClient _api;

  VerticalPack _pack = VerticalPack.defaultPack;
  VerticalPack get pack => _pack;

  VerticalService(this._db, this._api);

  /// Loads the pack from cache first, then refreshes from API in background.
  Future<void> load() async {
    final cached = await _db.getMeta('vertical_pack');
    if (cached != null) {
      try {
        _pack = VerticalPack.fromJson(cached);
      } catch (_) {}
    }
    // Background refresh — don't await so billing is never blocked
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final data = await _api.get('/vertical-pack') as Map<String, dynamic>;
      _pack = VerticalPack.fromMap(data);
      await _db.setMeta('vertical_pack', _pack.toJson());
    } catch (_) {
      // Offline or error — keep cached pack
    }
  }

  /// SQLite json_extract clauses for the pack's searchable attribute fields.
  /// Used to extend the local product search query.
  List<String> get attributeSearchClauses =>
      _pack.searchableFields
          .map((f) => "json_extract(attributes, '\$.${f.key}') LIKE ?")
          .toList();
}
