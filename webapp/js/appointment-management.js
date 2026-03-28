// =========================================================
// APPOINTMENT MANAGEMENT MODULE
// =========================================================

let _appointmentsData = [];
let _appointmentsPage = 1;
const _appointmentsLimit = 50;

let _viewMode = 'table'; // 'table' or 'calendar'
let _calendarApptInstance = null;

async function initAppointmentsManagement() {
    await loadAppointments();
}

function toggleAppointmentView() {
    _viewMode = _viewMode === 'table' ? 'calendar' : 'table';
    document.getElementById('btn-toggle-calendar').innerText = _viewMode === 'table' ? 'Hiển thị Lịch' : 'Hiển thị Bảng';
    
    document.getElementById('appointments-table-view').style.display = _viewMode === 'table' ? 'block' : 'none';
    document.getElementById('appointments-calendar-view').style.display = _viewMode === 'calendar' ? 'block' : 'none';

    if (_viewMode === 'calendar') {
        renderAppointmentsCalendar(_appointmentsData);
    }
}

async function loadAppointments(page = 1) {
    const listBody = document.getElementById('appointments-list');
    if (listBody) listBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Đang tải dữ liệu...</td></tr>';
    
    _appointmentsPage = page;
    const res = await apiGetAppointments(page, _appointmentsLimit);
    _appointmentsData = res.data || [];
    
    renderAppointmentsTable(_appointmentsData);

    if (_viewMode === 'calendar') {
        renderAppointmentsCalendar(_appointmentsData);
    }
}

function renderAppointmentsTable(data) {
    const listBody = document.getElementById('appointments-list');
    if (!listBody) return;

    if (data.length === 0) {
        listBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Không có lịch khám nào.</td></tr>';
        return;
    }

    listBody.innerHTML = data.map(app => {
        // Find patient info
        const patient = patientData.find(p => p.benhnhanId === app.patientId);
        const patientName = patient ? patient.hoten : `Bệnh nhân #${app.patientId}`;
        const patientPhone = patient && patient.dienthoai ? patient.dienthoai : '';

        // Format DateTime
        const dateStr = _formatDateAppt(app.appointmentDate);
        const timeStr = app.appointmentTime || '--:--';

        // Badge Status
        let statusBadge = '';
        switch(app.status) {
            case 'PENDING':
                statusBadge = '<span class="badge" style="background:#FDEBD0; color:#E67E22; border:1px solid #F5B041;">Chờ xác nhận</span>';
                break;
            case 'CONFIRMED':
                statusBadge = '<span class="badge" style="background:#D5F5E3; color:#27AE60; border:1px solid #58D68D;">Đã xác nhận</span>';
                break;
            case 'COMPLETED':
                statusBadge = '<span class="badge" style="background:#EBF5FB; color:#2980B9; border:1px solid #5DADE2;">Đã khám xong</span>';
                break;
            case 'CANCELLED':
                statusBadge = '<span class="badge" style="background:#FADBD8; color:#E74C3C; border:1px solid #F5B7B1;">Đã hủy</span>';
                break;
            default:
                statusBadge = `<span class="badge" style="background:#E5E7E9; color:#7F8C8D;">${app.status || 'N/A'}</span>`;
        }

        // Action Options
        const actionHtml = `
            <select onchange="changeAppointmentStatus(${app.id}, this.value)" style="padding: 4px; border: 1px solid var(--border-color); border-radius: 4px;">
                <option value="PENDING" ${app.status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận</option>
                <option value="CONFIRMED" ${app.status === 'CONFIRMED' ? 'selected' : ''}>Xác nhận</option>
                <option value="COMPLETED" ${app.status === 'COMPLETED' ? 'selected' : ''}>Khám xong</option>
                <option value="CANCELLED" ${app.status === 'CANCELLED' ? 'selected' : ''}>Hủy</option>
            </select>
        `;

        return `
            <tr>
                <td style="font-weight: bold; color: var(--primary);">#${app.id}</td>
                <td>
                    <div style="font-weight: bold;">${patientName}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${patientPhone}</div>
                </td>
                <td>
                    <div style="font-weight: 600; color: #5B3A1A;">${dateStr}</div>
                    <div style="font-size: 0.85rem;">${timeStr}</div>
                </td>
                <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${app.reason || ''}">
                    ${app.reason || '<span style="color:#aaa;">Không có ghi chú</span>'}
                </td>
                <td>${statusBadge}</td>
                <td style="text-align: center;">${actionHtml}</td>
            </tr>
        `;
    }).join('');
}

async function changeAppointmentStatus(id, newStatus) {
    const res = await apiUpdateAppointmentStatus(id, newStatus);
    if (!res.success) {
        alert(res.error || 'Đã có lỗi xảy ra khi cập nhật trạng thái lịch khám');
        loadAppointments(_appointmentsPage); // Revert UI
        return;
    }
    // Refresh table immediately
    loadAppointments(_appointmentsPage);
}

function _formatDateAppt(isoDate) {
    if (!isoDate) return '--/--/----';
    try {
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return isoDate;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch (e) {
        return isoDate;
    }
}

// FullCalendar integration
function renderAppointmentsCalendar(data) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    if (_calendarApptInstance) {
        _calendarApptInstance.destroy();
    }

    const events = data.map(app => {
        const patient = patientData.find(p => p.benhnhanId === app.patientId);
        const patientName = patient ? patient.hoten : `BN#${app.patientId}`;
        
        let color = '#7F8C8D';
        switch(app.status) {
            case 'PENDING': color = '#E67E22'; break;
            case 'CONFIRMED': color = '#27AE60'; break;
            case 'COMPLETED': color = '#2980B9'; break;
            case 'CANCELLED': color = '#E74C3C'; break;
        }

        const dateStr = app.appointmentDate; // YYYY-MM-DD
        const timeStr = app.appointmentTime || '00:00:00';
        const startDateTime = `${dateStr}T${timeStr}`;

        return {
            id: app.id,
            title: `${patientName} - ${app.status}`,
            start: startDateTime,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
                status: app.status,
                reason: app.reason || 'Không có lý do',
                patientId: app.patientId,
                patientName: patientName
            }
        };
    });

    _calendarApptInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: 'Hôm nay',
            month: 'Tháng',
            week: 'Tuần',
            day: 'Ngày'
        },
        events: events,
        eventClick: function(info) {
            const ev = info.event;
            const props = ev.extendedProps;
            const p = confirm(`Lịch khám: ${ev.title}\nBệnh nhân: ${props.patientName}\nLý do: ${props.reason}\n\nTrạng thái hiện tại: ${props.status}\nBạn có muốn XÁC NHẬN lịch này? (OK: Xác nhận, Cancel: Bỏ qua)`);
            if (p) {
                if(props.status === 'PENDING') {
                   changeAppointmentStatus(ev.id, 'CONFIRMED');
                } else if(props.status === 'CONFIRMED') {
                   const f = confirm(`Lịch đã xác nhận, chuyển thành KHÁM XONG?`);
                   if(f) changeAppointmentStatus(ev.id, 'COMPLETED');
                }
            }
        }
    });

    _calendarApptInstance.render();
}
