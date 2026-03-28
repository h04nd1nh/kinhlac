class BaselineStats {
  final double max;
  final double min;
  final double range;
  final double avg;
  final double step;
  final double up;
  final double low;

  BaselineStats({
    required this.max, required this.min, required this.range, 
    required this.avg, required this.step, required this.up, required this.low
  });
}

class MeridianStat {
  final String name;
  final String group;
  final double leftValue;
  final double rightValue;
  final double avg;
  final double absDelta;
  final double diff;
  final double baseline;
  final double upLimit;
  final double lowLimit;
  final String leftStatus;
  final String rightStatus;
  final String batCuong;

  MeridianStat({
    required this.name, required this.group, required this.leftValue,
    required this.rightValue, required this.avg, required this.absDelta,
    required this.diff, required this.baseline, required this.upLimit,
    required this.lowLimit, required this.leftStatus, required this.rightStatus,
    required this.batCuong
  });
}

class DiagnosisResult {
  final Map<String, MeridianStat> meridianStats;
  final Map<String, List<String>> categories;
  final Map<String, String> batCuongTong;
  final String khihuyetConclusion;
  final String conclusion;
  final Map<String, double> baselines;

  DiagnosisResult({
    required this.meridianStats, required this.categories,
    required this.batCuongTong, required this.khihuyetConclusion,
    required this.conclusion, required this.baselines
  });
}

class DiagnosisLogic {
  static double _round2(double v) => (v * 100).round() / 100;

  static BaselineStats _calcBaseline(List<double> values) {
    if (values.isEmpty) {
      return BaselineStats(max: 37, min: 35, range: 2, avg: 36, step: 2/6, up: 36 + 2/6, low: 36 - 2/6);
    }
    double maxVal = 37.0;
    double minVal = 35.0;
    for (var v in values) {
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }
    final range = _round2(maxVal - minVal);
    final avg = _round2((maxVal + minVal) / 2);
    final step = _round2(range / 6);
    final up = _round2(avg + step);
    final low = _round2(avg - step);
    return BaselineStats(max: maxVal, min: minVal, range: range, avg: avg, step: step, up: up, low: low);
  }

  static String _getStatus(double? val, double up, double low) {
    if (val == null || val == 0) return '';
    if (val > up) return '+';
    if (val < low) return '-';
    return '';
  }

  static String _getBatCuong(String leftStatus, String rightStatus) {
    if (leftStatus == '+' && rightStatus == '+') return 'Lý Nhiệt';
    if (leftStatus == '-' && rightStatus == '-') return 'Lý Hàn';
    if (leftStatus == '+' || rightStatus == '+') return 'Biểu Nhiệt';
    if (leftStatus == '-' || rightStatus == '-') return 'Biểu Hàn';
    return '';
  }

  static double _parseDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  static DiagnosisResult performFullDiagnosis(Map<String, dynamic> data) {
    final List<String> trenKeys = [
      'phetrai', 'phephai', 'daitrangtrai', 'daitrangphai',
      'tamtrai', 'tamphai', 'tieutruongtrai', 'tieutruongphai',
      'tambaotrai', 'tambaophai', 'tamtieutrai', 'tamtieuphai'
    ];
    final List<String> duoiKeys = [
      'vitrai', 'viphai', 'tytrai', 'typhai',
      'bangquangtrai', 'bangquangphai', 'thantrai', 'thanphai',
      'damtrai', 'damphai', 'cantrai', 'canphai'
    ];

    List<double> trenValues = trenKeys.map((k) => _parseDouble(data[k])).where((v) => v > 0).toList();
    List<double> duoiValues = duoiKeys.map((k) => _parseDouble(data[k])).where((v) => v > 0).toList();

    final bTren = _calcBaseline(trenValues);
    final bDuoi = _calcBaseline(duoiValues);

    final meridianDefs = [
      {'id': 'phe', 'name': 'Phế', 'group': 'tren'},
      {'id': 'daitrang', 'name': 'Đại Trường', 'group': 'tren'},
      {'id': 'tam', 'name': 'Tâm', 'group': 'tren'},
      {'id': 'tieutruong', 'name': 'Tiểu Trường', 'group': 'tren'},
      {'id': 'tambao', 'name': 'Tâm Bào', 'group': 'tren'},
      {'id': 'tamtieu', 'name': 'Tam Tiêu', 'group': 'tren'},
      {'id': 'vi', 'name': 'Vị', 'group': 'duoi'},
      {'id': 'ty', 'name': 'Tỳ', 'group': 'duoi'},
      {'id': 'bangquang', 'name': 'Bàng Quang', 'group': 'duoi'},
      {'id': 'than', 'name': 'Thận', 'group': 'duoi'},
      {'id': 'dam', 'name': 'Đởm', 'group': 'duoi'},
      {'id': 'can', 'name': 'Can', 'group': 'duoi'},
    ];

    Map<String, MeridianStat> meridianStats = {};
    Map<String, List<String>> categories = {
      'lyNhiet': [], 'lyHan': [], 'bieuNhiet': [], 'bieuHan': []
    };

    for (var m in meridianDefs) {
      final id = m['id']!;
      final name = m['name']!;
      final group = m['group']!;

      final b = group == 'tren' ? bTren : bDuoi;
      final l = _parseDouble(data['${id}trai']);
      final r = _parseDouble(data['${id}phai']);
      final avg = _round2((l + r) / 2);

      final leftSt = _getStatus(l, b.up, b.low);
      final rightSt = _getStatus(r, b.up, b.low);
      final bat = _getBatCuong(leftSt, rightSt);

      double diff = 0;
      if (leftSt == '+') diff = _round2(l - b.up);
      else if (leftSt == '-') diff = _round2(l - b.low);
      else if (rightSt == '+') diff = _round2(r - b.up);
      else if (rightSt == '-') diff = _round2(r - b.low);

      meridianStats[id] = MeridianStat(
        name: name,
        group: group,
        leftValue: l,
        rightValue: r,
        avg: avg,
        absDelta: _round2((l - r).abs()),
        diff: diff,
        baseline: b.avg,
        upLimit: b.up,
        lowLimit: b.low,
        leftStatus: leftSt,
        rightStatus: rightSt,
        batCuong: bat,
      );

      if (bat == 'Lý Nhiệt') categories['lyNhiet']!.add(name);
      else if (bat == 'Lý Hàn') categories['lyHan']!.add(name);
      else if (bat == 'Biểu Nhiệt') categories['bieuNhiet']!.add(name);
      else if (bat == 'Biểu Hàn') categories['bieuHan']!.add(name);
    }

    int totalThuc = meridianStats.values.where((s) => s.leftStatus == '+' || s.rightStatus == '+').length;
    int totalHu = meridianStats.values.where((s) => s.leftStatus == '-' || s.rightStatus == '-').length;

    String amDuong = bTren.avg > bDuoi.avg + 1 ? 'DƯƠNG THỊNH' : bDuoi.avg > bTren.avg + 1 ? 'ÂM THỊNH' : 'CÂN BẰNG';
    int totalLy = categories['lyNhiet']!.length + categories['lyHan']!.length;
    String bieuLy = totalLy >= 4 ? 'LÝ' : 'BIỂU';
    
    int totalNhiet = categories['lyNhiet']!.length + categories['bieuNhiet']!.length;
    int totalHan = categories['lyHan']!.length + categories['bieuHan']!.length;
    String hanNhiet = totalNhiet >= totalHan ? 'NHIỆT' : 'HÀN';

    String huThuc = totalThuc >= totalHu ? 'THỰC' : 'HƯ';

    int thucTren = 0, huTren = 0, thucDuoi = 0, huDuoi = 0;
    for (var m in meridianDefs) {
      final s = meridianStats[m['id']]!;
      final thuc = s.leftStatus == '+' || s.rightStatus == '+';
      final hu = s.leftStatus == '-' || s.rightStatus == '-';
      if (m['group'] == 'tren') {
        if (thuc) thucTren++;
        if (hu) huTren++;
      } else {
        if (thuc) thucDuoi++;
        if (hu) huDuoi++;
      }
    }

    String amDuongPart = amDuong == 'DƯƠNG THỊNH' ? 'Âm hư' : (amDuong == 'ÂM THỊNH' ? 'Dương hư' : '');
    String khiPart = thucTren > huTren ? 'Khí thịnh' : (thucTren < huTren ? 'Khí hư' : '');
    String huyetPart = thucDuoi > huDuoi ? 'Huyết thịnh' : (thucDuoi < huDuoi ? 'Huyết hư' : '');
    
    List<String> khihuyetParts = [];
    if (amDuongPart.isNotEmpty) khihuyetParts.add(amDuongPart);
    if (khiPart.isNotEmpty) khihuyetParts.add(khiPart);
    if (huyetPart.isNotEmpty) khihuyetParts.add(huyetPart);
    String khihuyetConclusion = khihuyetParts.join(' - ');

    String conclusion = '[$amDuong] - [$bieuLy] - [$hanNhiet] - [$huThuc]. ';
    conclusion += 'Ghi nhận $totalThuc kinh Thực (+), $totalHu kinh Hư (-).';
    if (bTren.avg > bDuoi.avg + 1) conclusion += ' Thượng nhiệt Hạ hàn.';
    else if (bDuoi.avg > bTren.avg + 1) conclusion += ' Thượng hàn Hạ nhiệt.';

    if (categories['lyNhiet']!.isNotEmpty) conclusion += ' Lý Nhiệt: ${categories['lyNhiet']!.join(', ')}.';
    if (categories['lyHan']!.isNotEmpty) conclusion += ' Lý Hàn: ${categories['lyHan']!.join(', ')}.';
    if (categories['bieuNhiet']!.isNotEmpty) conclusion += ' Biểu Nhiệt: ${categories['bieuNhiet']!.join(', ')}.';
    if (categories['bieuHan']!.isNotEmpty) conclusion += ' Biểu Hàn: ${categories['bieuHan']!.join(', ')}.';

    return DiagnosisResult(
      meridianStats: meridianStats,
      categories: categories,
      batCuongTong: {
        'amDuong': amDuong,
        'bieuLy': bieuLy,
        'hanNhiet': hanNhiet,
        'huThuc': huThuc
      },
      khihuyetConclusion: khihuyetConclusion,
      conclusion: conclusion,
      baselines: {
        'max_tren': bTren.max, 'min_tren': bTren.min, 'range_tren': bTren.range,
        'avg_tren': bTren.avg, 'step_tren': bTren.step, 'up_tren': bTren.up, 'low_tren': bTren.low,
        'max_duoi': bDuoi.max, 'min_duoi': bDuoi.min, 'range_duoi': bDuoi.range,
        'avg_duoi': bDuoi.avg, 'step_duoi': bDuoi.step, 'up_duoi': bDuoi.up, 'low_duoi': bDuoi.low,
      }
    );
  }
}
