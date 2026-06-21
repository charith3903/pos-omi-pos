import 'package:flutter/material.dart';
import '../services/sync_service.dart';

class SyncStatusBadge extends StatefulWidget {
  final SyncService syncService;
  const SyncStatusBadge({super.key, required this.syncService});

  @override
  State<SyncStatusBadge> createState() => _SyncStatusBadgeState();
}

class _SyncStatusBadgeState extends State<SyncStatusBadge> {
  late SyncState _state;

  @override
  void initState() {
    super.initState();
    _state = widget.syncService.state;
    widget.syncService.stateStream.listen((s) {
      if (mounted) setState(() => _state = s);
    });
  }

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = switch (_state) {
      SyncState.idle    => (Icons.cloud_done_outlined, Colors.green, 'Synced'),
      SyncState.syncing => (Icons.sync, Colors.blue, 'Syncing…'),
      SyncState.error   => (Icons.cloud_off, Colors.orange, 'Sync error'),
      SyncState.offline => (Icons.wifi_off, Colors.grey, 'Offline'),
    };

    return Tooltip(
      message: widget.syncService.lastError ?? label,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _state == SyncState.syncing
              ? const SizedBox(
                  width: 14, height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.blue),
                )
              : Icon(icon, size: 16, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 12, color: color)),
        ],
      ),
    );
  }
}
