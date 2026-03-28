class Examination {
  final int id;
  final String createdAt;
  final String amDuong;
  final String khi;
  final String huyet;
  final List<dynamic>? syndromes;
  final Map<String, dynamic>? inputData;
  final dynamic flags; // Sửa từ Map<String, dynamic>? thành dynamic vì API thường trả về mảng []
  final String? notes;

  Examination({
    required this.id,
    required this.createdAt,
    required this.amDuong,
    required this.khi,
    required this.huyet,
    this.syndromes,
    this.inputData,
    this.flags,
    this.notes,
  });

  factory Examination.fromJson(Map<String, dynamic> json) {
    return Examination(
      id: json['id'],
      createdAt: json['createdAt'] ?? '',
      amDuong: json['amDuong'] ?? '',
      khi: json['khi'] ?? '',
      huyet: json['huyet'] ?? '',
      syndromes: json['syndromes'] as List<dynamic>?,
      inputData: json['inputData'] as Map<String, dynamic>?,
      flags: json['flags'], // Không ép kiểu cứng nữa
      notes: json['notes'] as String?,
    );
  }
}
