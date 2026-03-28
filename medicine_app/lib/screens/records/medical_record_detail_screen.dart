import 'package:flutter/material.dart';
import '../../models/examination.dart';
import '../../utils/diagnosis_logic.dart';
import 'package:intl/intl.dart';

class MedicalRecordDetailScreen extends StatefulWidget {
  final Examination record;

  const MedicalRecordDetailScreen({Key? key, required this.record}) : super(key: key);

  @override
  _MedicalRecordDetailScreenState createState() => _MedicalRecordDetailScreenState();
}

class _MedicalRecordDetailScreenState extends State<MedicalRecordDetailScreen> {
  DiagnosisResult? _result;

  @override
  void initState() {
    super.initState();
    if (widget.record.inputData != null && widget.record.inputData!.isNotEmpty) {
      _result = DiagnosisLogic.performFullDiagnosis(widget.record.inputData!);
    }
  }

  String _formatDate(String isoString) {
    try {
      final date = DateTime.parse(isoString).toLocal();
      return DateFormat('dd/MM/yyyy HH:mm').format(date);
    } catch (e) {
      return isoString;
    }
  }

  Widget _buildSectionTitle(String title) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      margin: EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F0E8),
        border: Border(left: BorderSide(color: const Color(0xFF8B1A1A), width: 4)),
      ),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: const Color(0xFF5B3A1A),
        ),
      ),
    );
  }

  Widget _buildDataTable(String groupName) {
    if (_result == null) return SizedBox.shrink();
    
    final stats = _result!.meridianStats.values.where((s) => s.group == groupName).toList();
    
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: MaterialStateProperty.all(const Color(0xFFF5F0E8)),
        dataRowColor: MaterialStateProperty.all(Colors.white),
        border: TableBorder.all(color: const Color(0xFFE2D4B8)),
        columnSpacing: 16,
        columns: const [
          DataColumn(label: Text('Kinh Mạch', style: TextStyle(fontWeight: FontWeight.bold))),
          DataColumn(label: Text('Trái (L)', style: TextStyle(color: Color(0xFF8B1A1A), fontWeight: FontWeight.bold))),
          DataColumn(label: Text('Trị L', style: TextStyle())),
          DataColumn(label: Text('Trung bình', style: TextStyle(fontWeight: FontWeight.bold))),
          DataColumn(label: Text('Phải (R)', style: TextStyle(color: Color(0xFF1A5276), fontWeight: FontWeight.bold))),
          DataColumn(label: Text('Trị R', style: TextStyle())),
          DataColumn(label: Text('Lệch L-R', style: TextStyle())),
          DataColumn(label: Text('Bát Cương', style: TextStyle())),
        ],
        rows: stats.map((s) {
          return DataRow(cells: [
            DataCell(Text(s.name, style: TextStyle(fontWeight: FontWeight.bold))),
            DataCell(Text(s.leftValue.toString())),
            DataCell(Text(s.leftStatus, style: TextStyle(color: s.leftStatus == '+' ? Color(0xFF8B1A1A) : Color(0xFF1A5276), fontWeight: FontWeight.bold))),
            DataCell(Text(s.avg.toString(), style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A)))),
            DataCell(Text(s.rightValue.toString())),
            DataCell(Text(s.rightStatus, style: TextStyle(color: s.rightStatus == '+' ? Color(0xFF8B1A1A) : Color(0xFF1A5276), fontWeight: FontWeight.bold))),
            DataCell(Text(s.absDelta.toString())),
            DataCell(Text(s.batCuong)),
          ]);
        }).toList(),
      ),
    );
  }

  Widget _buildDiagnosisTag(String label, String value) {
    if (value.isEmpty || value == '—') return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFBF8F1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFE8DCC8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 14, color: Color(0xFF8B1A1A), fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kết Quả Đo Kinh Lạc'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thông tin chung
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFD4C5A0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Mã phiếu: #${widget.record.id}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF5B3A1A))),
                  const SizedBox(height: 8),
                  Text('Ngày đo: ${_formatDate(widget.record.createdAt)}', style: TextStyle(color: Colors.grey[800])),
                  if (widget.record.notes != null && widget.record.notes!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('Ghi chú: ${widget.record.notes}', style: TextStyle(color: Colors.grey[800])),
                  ]
                ],
              ),
            ),

            _buildSectionTitle('I. SỐ LIỆU ĐO KINH LẠC'),
            if (_result != null) ...[
              const Padding(
                padding: EdgeInsets.only(bottom: 8.0),
                child: Text('CHI TRÊN (TAY)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A))),
              ),
              _buildDataTable('tren'),
              
              const SizedBox(height: 16),
              const Padding(
                padding: EdgeInsets.only(bottom: 8.0),
                child: Text('CHI DƯỚI (CHÂN)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A))),
              ),
              _buildDataTable('duoi'),
            ],

            _buildSectionTitle('II. KẾT LUẬN BÁT CƯƠNG & CHẨN ĐOÁN'),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFD4C5A0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('TỔNG QUAN BÁT CƯƠNG:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A))),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 12,
                    runSpacing: 10,
                    children: [
                      _buildDiagnosisTag('ÂM DƯƠNG', widget.record.amDuong),
                      _buildDiagnosisTag('KHÍ', widget.record.khi),
                      _buildDiagnosisTag('HUYẾT', widget.record.huyet),
                      if (_result != null) ...[
                        _buildDiagnosisTag('BIỂU LÝ', _result!.batCuongTong['bieuLy'] ?? ''),
                        _buildDiagnosisTag('HÀN NHIỆT', _result!.batCuongTong['hanNhiet'] ?? ''),
                        _buildDiagnosisTag('HƯ THỰC', _result!.batCuongTong['huThuc'] ?? ''),
                      ]
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Color(0xFFF0E5D0)),
                  const SizedBox(height: 8),
                  const Text('CHI TIẾT CHẨN PHÁP:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A))),
                  const SizedBox(height: 8),
                  Text(
                    _result?.conclusion ?? 'Đang cập nhật chẩn đoán chi tiết...',
                    style: TextStyle(fontSize: 13, height: 1.5, color: Colors.grey[800]),
                  ),
                ],
              ),
            ),

            _buildSectionTitle('III. MÔ HÌNH BỆNH LÝ & PHÁP TRỊ'),
            if (widget.record.syndromes != null && widget.record.syndromes!.isNotEmpty)
              ...widget.record.syndromes!.map((syn) {
                return Container(
                  margin: EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE8DCC8)),
                  ),
                  child: Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      iconColor: const Color(0xFF8B1A1A),
                      collapsedIconColor: const Color(0xFF5B3A1A),
                      title: Text(
                        syn['tieuket'] ?? syn['modelName'] ?? 'Không rõ',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF5B3A1A),
                          fontSize: 15,
                        ),
                      ),
                      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      expandedCrossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Divider(color: Color(0xFFF0E5D0)),
                        if (syn['trieuchung'] != null && syn['trieuchung'].toString().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          const Text('Triệu chứng:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(
                            (syn['trieuchung'] as String).replaceAll(RegExp(r'<[^>]+>'), ''),
                            style: TextStyle(fontSize: 13, height: 1.5, color: Colors.grey[800]),
                          ),
                        ],
                        if (syn['benhly'] != null && syn['benhly'].toString().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          const Text('Bệnh lý / Nguyên nhân:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(
                            (syn['benhly'] as String).replaceAll(RegExp(r'<[^>]+>'), ''),
                            style: TextStyle(fontSize: 13, height: 1.5, color: Colors.grey[800]),
                          ),
                        ],
                        if (syn['phuyet_chamcuu'] != null && syn['phuyet_chamcuu'].toString().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          const Text('Pháp trị / Phương huyệt:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFBF8F1),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFF0E5D0)),
                            ),
                            child: Text(
                              (syn['phuyet_chamcuu'] as String).replaceAll(RegExp(r'<[^>]+>'), ''),
                              style: TextStyle(fontSize: 13, height: 1.5, color: const Color(0xFF8B1A1A), fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }).toList()
            else
              Text('Không có mô hình bệnh lý nào được chọn cho phiếu khám này.', style: TextStyle(color: Colors.grey[600], fontStyle: FontStyle.italic)),
              
            SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
