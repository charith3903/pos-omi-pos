import 'dart:convert';

class VerticalField {
  final String key;
  final String label;
  final String type; // text | number | select | boolean
  final bool required;
  final bool searchable;
  final List<String> options;
  final int position;
  final String? placeholder;

  const VerticalField({
    required this.key,
    required this.label,
    required this.type,
    required this.required,
    required this.searchable,
    this.options = const [],
    required this.position,
    this.placeholder,
  });

  factory VerticalField.fromMap(Map<String, dynamic> m) => VerticalField(
        key: m['key'] as String,
        label: m['label'] as String,
        type: m['type'] as String? ?? 'text',
        required: m['required'] as bool? ?? false,
        searchable: m['searchable'] as bool? ?? false,
        options: (m['options'] as List?)?.cast<String>() ?? [],
        position: m['position'] as int? ?? 0,
        placeholder: m['placeholder'] as String?,
      );
}

class VerticalPack {
  final String businessType;
  final Map<String, String> labels;
  final List<VerticalField> productFields;
  final List<String> enabledModules;
  final double defaultTaxRate;
  final String receiptTemplate;
  final List<String> searchFilterKeys;

  const VerticalPack({
    required this.businessType,
    required this.labels,
    required this.productFields,
    required this.enabledModules,
    required this.defaultTaxRate,
    required this.receiptTemplate,
    required this.searchFilterKeys,
  });

  factory VerticalPack.fromMap(Map<String, dynamic> m) => VerticalPack(
        businessType: m['businessType'] as String? ?? 'DEFAULT',
        labels: Map<String, String>.from(m['labels'] as Map? ?? {}),
        productFields: (m['productFields'] as List? ?? [])
            .map((f) => VerticalField.fromMap(Map<String, dynamic>.from(f as Map)))
            .toList()
          ..sort((a, b) => a.position.compareTo(b.position)),
        enabledModules: (m['enabledModules'] as List?)?.cast<String>() ?? [],
        defaultTaxRate: (m['defaultTaxRate'] as num?)?.toDouble() ?? 0.0,
        receiptTemplate: m['receiptTemplate'] as String? ?? 'standard',
        searchFilterKeys: (m['searchFilterKeys'] as List?)?.cast<String>() ?? [],
      );

  factory VerticalPack.fromJson(String json) =>
      VerticalPack.fromMap(jsonDecode(json) as Map<String, dynamic>);

  String toJson() => jsonEncode({
        'businessType': businessType,
        'labels': labels,
        'productFields': productFields
            .map((f) => {
                  'key': f.key,
                  'label': f.label,
                  'type': f.type,
                  'required': f.required,
                  'searchable': f.searchable,
                  'options': f.options,
                  'position': f.position,
                  'placeholder': f.placeholder,
                })
            .toList(),
        'enabledModules': enabledModules,
        'defaultTaxRate': defaultTaxRate,
        'receiptTemplate': receiptTemplate,
        'searchFilterKeys': searchFilterKeys,
      });

  /// Convenience label lookup with fallback
  String label(String key, [String? fallback]) =>
      labels[key] ?? fallback ?? key;

  List<VerticalField> get searchableFields =>
      productFields.where((f) => f.searchable).toList();

  static VerticalPack get defaultPack => const VerticalPack(
        businessType: 'DEFAULT',
        labels: {
          'product': 'Product',
          'products': 'Products',
          'sku': 'SKU',
          'barcode': 'Barcode',
          'searchPlaceholder': 'Search name, SKU, barcode…',
          'receiptTitle': 'RECEIPT',
        },
        productFields: [],
        enabledModules: ['catalog', 'invoices', 'stock'],
        defaultTaxRate: 0,
        receiptTemplate: 'standard',
        searchFilterKeys: [],
      );
}
