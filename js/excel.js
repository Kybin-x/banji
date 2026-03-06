/* ============================================================
   excel.js — Excel 导入 / 导出工具
   基于 SheetJS (xlsx) CDN 版
   班级管理系统 v1.0

   依赖：在 HTML 中通过 CDN 引入：
   <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
   ============================================================ */

'use strict';

/* ============================================================
   一、检查 SheetJS 是否加载
   ============================================================ */
function checkXLSX() {
  if (typeof XLSX === 'undefined') {
    Toast.error('Excel 库加载失败，请检查网络连接');
    return false;
  }
  return true;
}

/* ============================================================
   二、导出功能
   ============================================================ */

/**
 * 将二维数组导出为 Excel 文件
 * @param {Array<Array>} data      - 包含表头行的二维数组
 * @param {string}       filename  - 文件名（不含扩展名）
 * @param {string}       sheetName - Sheet 名称
 */
function exportToExcel(data, filename = '导出数据', sheetName = 'Sheet1') {
  if (!checkXLSX()) return;

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 自动列宽
  const colWidths = data[0].map((_, ci) => ({
    wch: Math.max(...data.map(row => String(row[ci] ?? '').length * 1.8), 8),
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${formatDate(new Date())}.xlsx`);
  Toast.success(`已导出：${filename}`);
}

/**
 * 将对象数组导出（自动用 keys 作表头）
 * @param {Array<object>} rows     - 数据行
 * @param {object}        headers  - { key: '列名' } 映射
 * @param {string}        filename
 */
function exportObjectsToExcel(rows, headers, filename = '导出数据') {
  if (!checkXLSX()) return;
  if (!rows || rows.length === 0) { Toast.warning('没有数据可以导出'); return; }

  const keys    = Object.keys(headers);
  const header  = keys.map(k => headers[k]);
  const dataRows = rows.map(row => keys.map(k => row[k] ?? ''));
  exportToExcel([header, ...dataRows], filename);
}

/* ============================================================
   三、导入功能
   ============================================================ */

/**
 * 读取用户选择的 Excel/CSV 文件，返回解析后的二维数组
 * @param {File}   file
 * @param {object} options - { header: 1 | 'A', range: 0, ... }
 * @returns {Promise<Array<Array>>}
 */
function readExcelFile(file, options = {}) {
  return new Promise((resolve, reject) => {
    if (!checkXLSX()) { reject(new Error('XLSX 未加载')); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          ...options,
        });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 读取 Excel 文件，跳过第一行（表头），返回对象数组
 * @param {File}   file
 * @param {Array}  keys   - 列名数组，对应 Excel 各列
 * @returns {Promise<Array<object>>}
 */
async function readExcelAsObjects(file, keys) {
  const rows = await readExcelFile(file);
  if (!rows || rows.length < 2) return [];
  return rows.slice(1)             // 跳过表头行
    .filter(row => row.some(v => v !== ''))  // 过滤空行
    .map(row => {
      const obj = {};
      keys.forEach((k, i) => { obj[k] = String(row[i] ?? '').trim(); });
      return obj;
    });
}

/* ============================================================
   四、模板生成
   ============================================================ */

/**
 * 生成并下载 Excel 模板（带示例行）
 * @param {Array}  headers      - 表头数组，如 ['学号','姓名','性别']
 * @param {Array}  exampleRows  - 示例行二维数组
 * @param {string} filename
 */
function downloadExcelTemplate(headers, exampleRows = [], filename = '导入模板') {
  if (!checkXLSX()) return;

  const data  = [headers, ...exampleRows];
  const ws    = XLSX.utils.aoa_to_sheet(data);

  // 表头样式（SheetJS CE 不支持样式，仅设置列宽）
  ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length * 2.5, 10) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '导入数据');
  XLSX.writeFile(wb, `${filename}.xlsx`);
  Toast.success('模板已下载，请按格式填写后上传');
}

/* ============================================================
   五、各模块专用导出函数
   ============================================================ */

/**
 * 导出学生花名册
 */
function exportStudentList(students, className = '') {
  if (!students || !students.length) { Toast.warning('没有学生数据'); return; }

  const headers = ['学号','姓名','性别','手机号','是否住校','宿舍号','备注'];
  const rows    = students.map(s => [
    s.student_no || '',
    s.name       || '',
    s.gender     || '',
    s.phone      || '',
    s.is_boarding ? '住校' : '走读',
    s.dorm_no    || '',
    s.note       || '',
  ]);
  exportToExcel([headers, ...rows], `${className}花名册`);
}

/**
 * 下载学生导入模板
 */
function downloadStudentTemplate() {
  downloadExcelTemplate(
    ['学号','姓名','性别(男/女)','手机号','身份证号','是否住校(1是/0否)','宿舍号','备注'],
    [
      ['2024001','张三','男','13800000001','440102200801010001','1','301',''],
      ['2024002','张丽华','女','13800000002','440102200802020002','1','302',''],
      ['2024003','王晓明','男','13800000003','440102200803030003','0','','走读'],
    ],
    '学生花名册导入模板'
  );
}

/**
 * 解析学生 Excel 文件，返回标准化的学生对象数组
 */
async function parseStudentExcel(file) {
  const KEYS = ['student_no','name','gender','phone','id_card','is_boarding','dorm_no','note'];
  const rows = await readExcelAsObjects(file, KEYS);

  return rows
    .filter(r => r.student_no && r.name)
    .map(r => ({
      ...r,
      is_boarding: ['1','true','是','住校','住'].includes(String(r.is_boarding).toLowerCase()),
    }));
}

/**
 * 导出班级成绩表
 */
function exportScoreList(scores, examName = '成绩', subjects = []) {
  if (!scores || !scores.length) { Toast.warning('没有成绩数据'); return; }

  const headers = ['排名','学号','姓名', ...subjects, '总分'];
  const rows    = scores.map((s, i) => [
    i + 1,
    s.student_no || '',
    s.name       || '',
    ...subjects.map(sub => s.scores?.[sub] ?? ''),
    s.total      || s.total_score || '',
  ]);
  exportToExcel([headers, ...rows], examName);
}

/**
 * 下载成绩导入模板
 */
function downloadScoreTemplate(subjects = ['语文','数学','英语','专业课']) {
  downloadExcelTemplate(
    ['学号', ...subjects],
    [
      ['2024001', ...subjects.map((_, i) => 85 + i)],
      ['2024002', ...subjects.map((_, i) => 90 + i)],
    ],
    '成绩导入模板'
  );
}

/**
 * 解析成绩 Excel（第一列学号，后续列科目分数）
 * @param {File}   file
 * @param {Array}  subjects  - 科目名称数组
 */
async function parseScoreExcel(file, subjects) {
  const rows = await readExcelFile(file);
  if (!rows || rows.length < 2) return [];

  return rows.slice(1)
    .filter(row => row[0] !== '')
    .map(row => {
      const scores  = {};
      let   total   = 0;
      subjects.forEach((sub, i) => {
        const v   = parseFloat(row[i + 1]) || 0;
        scores[sub] = v;
        total      += v;
      });
      return { student_no: String(row[0]).trim(), scores, total_score: total };
    });
}

/**
 * 导出积分记录
 */
function exportPointRecords(records, className = '') {
  if (!records || !records.length) { Toast.warning('没有积分数据'); return; }

  const headers = ['日期','学生','事项','分值','备注','记录人'];
  const rows    = records.map(r => [
    r.date          || (r.created_at ? formatDate(new Date(r.created_at)) : ''),
    r.students?.name || r.name || '',
    r.item_label    || '',
    r.score >= 0 ? `+${r.score}` : String(r.score),
    r.note          || '',
    r.recorder_name || '',
  ]);
  exportToExcel([headers, ...rows], `${className}积分记录`);
}

/**
 * 导出考勤月报
 */
function exportAttendanceReport(records, month = '', className = '') {
  if (!records || !records.length) { Toast.warning('没有考勤数据'); return; }

  const statusLabels = { late:'迟到', absent:'旷课', leave:'事假', sick:'病假', early:'早退', public:'公假' };
  const headers      = ['日期','学号','学生姓名','考勤状态','备注'];
  const rows         = records.map(r => [
    r.date            || '',
    r.students?.student_no || '',
    r.students?.name  || r.student_name || '',
    statusLabels[r.status] || r.status,
    r.note            || '',
  ]);
  exportToExcel([headers, ...rows], `${className}考勤月报_${month}`);
}

/**
 * 全量数据导出（多 Sheet）
 */
function exportAllData({ students, attendance, scores, points } = {}) {
  if (!checkXLSX()) return;

  const wb = XLSX.utils.book_new();

  // Sheet1：学生花名册
  if (students?.length) {
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['学号','姓名','性别','手机号','住宿','宿舍号'],
      ...students.map(s => [s.student_no, s.name, s.gender, s.phone, s.is_boarding?'住':'走', s.dorm_no||'']),
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, '学生花名册');
  }

  // Sheet2：考勤记录
  if (attendance?.length) {
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['日期','学生','状态','备注'],
      ...attendance.map(r => [r.date, r.students?.name||'', r.status, r.note||'']),
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, '考勤记录');
  }

  // Sheet3：积分记录
  if (points?.length) {
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['日期','学生','事项','分值'],
      ...points.map(r => [r.date, r.students?.name||'', r.item_label, r.score]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws3, '积分记录');
  }

  if (wb.SheetNames.length === 0) { Toast.warning('没有可导出的数据'); return; }

  XLSX.writeFile(wb, `班级数据备份_${formatDate(new Date())}.xlsx`);
  Toast.success('全量数据已导出');
}

/* ============================================================
   六、预览解析结果（用于导入确认）
   ============================================================ */

/**
 * 在指定容器中渲染导入预览表格
 * @param {string}        containerId
 * @param {Array<Array>}  rows        - 含表头的二维数组（前 6 行）
 * @param {number}        total       - 总行数
 */
function renderImportPreview(containerId, rows, total) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!rows || rows.length < 2) {
    container.innerHTML = '<div class="empty-state" style="border:none;padding:20px;"><div class="empty-state-desc">文件为空或格式不对</div></div>';
    return;
  }

  const header  = rows[0];
  const preview = rows.slice(1, 6);  // 最多显示 5 行

  container.innerHTML = `
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:var(--color-green);">✅ 解析成功，共 <strong>${total}</strong> 行数据</span>
      ${total > 5 ? `<span style="font-size:11px;color:var(--text-muted);">预览前5行</span>` : ''}
    </div>
    <div class="table-wrap" style="max-height:180px;overflow-y:auto;">
      <table class="table">
        <thead>
          <tr>${header.map(h => `<th>${escHtml(String(h))}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${preview.map(row => `
            <tr>${header.map((_, i) => `<td>${escHtml(String(row[i] ?? ''))}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}
