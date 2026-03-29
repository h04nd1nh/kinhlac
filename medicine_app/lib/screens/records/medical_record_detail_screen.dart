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

  Widget _buildMeridianCards(String groupName) {
    if (_result == null) return SizedBox.shrink();
    
    final stats = _result!.meridianStats.values.where((s) => s.group == groupName).toList();
    
    return GridView.builder(
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.1,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
      ),
      itemCount: stats.length,
      itemBuilder: (context, index) {
        final s = stats[index];
        return Container(
          padding: EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE2D4B8)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4, offset: Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                s.name,
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF5B3A1A)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Divider(height: 12, color: Color(0xFFF0E5D0)),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildMiniInfo('L', s.leftValue.toString(), s.leftStatus == '+'),
                        _buildMiniInfo('R', s.rightValue.toString(), s.rightStatus == '+'),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildMiniInfo('Avg', s.avg.toString(), null),
                        _buildMiniInfo('Δ', s.absDelta.toString(), null),
                      ],
                    ),
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.symmetric(vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFBF8F1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'BC: ${s.batCuong}',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMiniInfo(String label, String value, bool? isHigh) {
    Color valColor = Colors.black87;
    if (isHigh != null) {
      valColor = isHigh ? Color(0xFF8B1A1A) : Color(0xFF1A5276);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 9, color: Colors.grey[600])),
        Text(
          value,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: valColor,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Kết Quả Đo Kinh Lạc'),
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF5B3A1A),
        elevation: 0,
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
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFD4C5A0)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: Offset(0, 4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Mã phiếu: #${widget.record.id}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF5B3A1A))),
                      Container(
                        padding: EdgeInsets.all(4),
                        decoration: BoxDecoration(color: Color(0xFFF5F0E8), borderRadius: BorderRadius.circular(4)),
                        child: Icon(Icons.receipt_long, color: Color(0xFF8B1A1A), size: 18),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text('Ngày đo: ${_formatDate(widget.record.createdAt)}', style: TextStyle(color: Colors.grey[800], fontSize: 13)),
                    ],
                  ),
                  if (widget.record.notes != null && widget.record.notes!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Divider(height: 1, color: Color(0xFFF0E5D0)),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.note_alt_outlined, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 8),
                        Expanded(child: Text('Ghi chú: ${widget.record.notes}', style: TextStyle(color: Colors.grey[800], fontSize: 13))),
                      ],
                    ),
                  ]
                ],
              ),
            ),

            _buildSectionTitle('I. SỐ LIỆU ĐO KINH LẠC'),
            if (_result != null) ...[
              const Padding(
                padding: EdgeInsets.only(bottom: 12.0),
                child: Row(
                  children: [
                    Icon(Icons.back_hand_outlined, size: 16, color: Color(0xFF8B1A1A)),
                    SizedBox(width: 8),
                    Text('CHI TRÊN (TAY)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A), fontSize: 14)),
                  ],
                ),
              ),
              _buildMeridianCards('tren'),
              
              const SizedBox(height: 24),
              const Padding(
                padding: EdgeInsets.only(bottom: 12.0),
                child: Row(
                  children: [
                    Icon(Icons.directions_walk, size: 16, color: Color(0xFF8B1A1A)),
                    SizedBox(width: 8),
                    Text('CHI DƯỚI (CHÂN)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF5B3A1A), fontSize: 14)),
                  ],
                ),
              ),
              _buildMeridianCards('duoi'),
            ],

            _buildSectionTitle('II. MÔ HÌNH BỆNH LÝ & PHÁP TRỊ'),
            if (widget.record.syndromes != null && widget.record.syndromes!.isNotEmpty)
              ...widget.record.syndromes!.map((syn) {
                final double rate = ((syn['rate'] ?? 0).toDouble()) * 100;
                return Container(
                  margin: EdgeInsets.only(bottom: 8),
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE8DCC8)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          syn['tieuket'] ?? syn['modelName'] ?? 'Không rõ',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF5B3A1A),
                            fontSize: 14,
                          ),
                        ),
                      ),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: rate >= 80 ? Colors.green[50] : (rate >= 60 ? Colors.orange[50] : Colors.red[50]),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: rate >= 80 ? Colors.green[200]! : (rate >= 60 ? Colors.orange[200]! : Colors.red[200]!),
                          ),
                        ),
                        child: Text(
                          '${rate.toStringAsFixed(1)}%',
                          style: TextStyle(
                            fontSize: 11, 
                            fontWeight: FontWeight.bold, 
                            color: rate >= 80 ? Colors.green[700] : (rate >= 60 ? Colors.orange[700] : Colors.red[700]),
                          ),
                        ),
                      ),
                    ],
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
