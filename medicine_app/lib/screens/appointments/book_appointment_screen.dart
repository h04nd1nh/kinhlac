import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:add_2_calendar/add_2_calendar.dart';
import '../../services/appointment_service.dart';

class BookAppointmentScreen extends StatefulWidget {
  @override
  _BookAppointmentScreenState createState() => _BookAppointmentScreenState();
}

class _BookAppointmentScreenState extends State<BookAppointmentScreen> {
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  final _notesController = TextEditingController();
  bool _isLoading = false;
  bool _isWeekly = false;
  final int _defaultWeeksCount = 4; // Default duration hidden from UI

  // Selection for Days of Week: Mon=0, Tue=1, ..., Sun=6
  final List<bool> _selectedDays = List.generate(7, (index) => false);
  final List<String> _dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now().add(Duration(days: 1));
    _selectedTime = TimeOfDay(hour: 8, minute: 0);
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now().add(Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(Duration(days: 90)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.light(primary: const Color(0xFF5B3A1A)),
        ),
        child: child!,
      ),
    );
    if (date != null) setState(() => _selectedDate = date);
  }

  Future<void> _pickTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay(hour: 8, minute: 0),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.light(primary: const Color(0xFF5B3A1A)),
        ),
        child: child!,
      ),
    );
    if (time != null) setState(() => _selectedTime = time);
  }

  void _submit() async {
    if (_selectedDate == null || _selectedTime == null) return;

    setState(() => _isLoading = true);

    final String timeStr =
        '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}';
    final String notes = _notesController.text.trim();

    bool anyFailure = false;

    if (!_isWeekly) {
      final success = await AppointmentService.createAppointment(
        DateFormat('yyyy-MM-dd').format(_selectedDate!),
        timeStr,
        notes,
        type: 'SINGLE',
      );
      if (!success) anyFailure = true;
    } else {
      bool daySelected = _selectedDays.any((selected) => selected);
      if (!daySelected) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Vui lòng chọn ít nhất một thứ trong tuần.')),
        );
        return;
      }

      for (int i = 0; i < 7; i++) {
        if (_selectedDays[i]) {
          int targetWeekday = i + 1;
          DateTime now = DateTime.now();
          int daysDiff = (targetWeekday - now.weekday + 7) % 7;
          if (daysDiff == 0 && now.hour >= _selectedTime!.hour) daysDiff = 7;

          DateTime nextOccurrence = now.add(Duration(days: daysDiff));
          final success = await AppointmentService.createAppointment(
            DateFormat('yyyy-MM-dd').format(nextOccurrence),
            timeStr,
            notes,
            type: 'WEEKLY',
            weeks: _defaultWeeksCount,
          );
          if (!success) anyFailure = true;
        }
      }
    }

    setState(() => _isLoading = false);

    if (!anyFailure) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Đặt lịch thành công!')));
        Navigator.pop(context);
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color primaryColor = Color(0xFF5B3A1A);
    const Color secondaryColor = Color(0xFF8B1A1A);
    const Color bgColor = Color(0xFFFBF8F1);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: Text(
          'Đặt Lịch Khám',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Thông tin lịch hẹn',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: primaryColor,
              ),
            ),
            SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: _buildPickerButton(
                    onTap: _pickDate,
                    icon: Icons.calendar_today,
                    label: _selectedDate == null
                        ? 'Chọn ngày'
                        : DateFormat('dd/MM/yyyy').format(_selectedDate!),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: _buildPickerButton(
                    onTap: _pickTime,
                    icon: Icons.access_time,
                    label: _selectedTime == null
                        ? 'Chọn giờ'
                        : _selectedTime!.format(context),
                  ),
                ),
              ],
            ),

            SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Lặp lại hàng tuần',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                Switch(
                  value: _isWeekly,
                  activeColor: primaryColor,
                  onChanged: (val) => setState(() => _isWeekly = val),
                ),
              ],
            ),

            if (_isWeekly) ...[
              SizedBox(height: 12),
              Text(
                'Chọn thứ trong tuần:',
                style: TextStyle(fontSize: 14, color: Colors.grey[700]),
              ),
              SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: List.generate(7, (index) {
                  return FilterChip(
                    label: Text(_dayLabels[index]),
                    selected: _selectedDays[index],
                    onSelected: (val) =>
                        setState(() => _selectedDays[index] = val),
                    selectedColor: primaryColor.withOpacity(0.2),
                    checkmarkColor: primaryColor,
                    labelStyle: TextStyle(
                      color: _selectedDays[index]
                          ? primaryColor
                          : Colors.black87,
                      fontWeight: _selectedDays[index]
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                  );
                }),
              ),
            ],

            SizedBox(height: 24),
            Text(
              'Ghi chú tình trạng',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: primaryColor,
              ),
            ),
            SizedBox(height: 12),
            TextField(
              controller: _notesController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Nhập triệu chứng hoặc lưu ý...',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey[300]!),
                ),
              ),
            ),

            SizedBox(height: 40),
            ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                backgroundColor: secondaryColor,
              ),
              child: _isLoading
                  ? SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Text(
                      'XÁC NHẬN ĐẶT LỊCH',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPickerButton({
    required VoidCallback onTap,
    required IconData icon,
    required String label,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: const Color(0xFF5B3A1A)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(fontSize: 15, color: Colors.black87),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
