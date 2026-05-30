import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const fmt = (n) => (typeof n === 'number' && n > 0 ? n.toFixed(1) : '--');

export const exportHistoryPDF = async (history, chartElement) => {
  if (!history || history.length === 0) return;

  const doc = new jsPDF('p', 'pt', 'a4');

  // Title
  doc.setFontSize(22);
  doc.setTextColor(34, 34, 40);
  doc.text('Velocity Speed Test History', 40, 50);

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 110);
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Generated on ${dateStr}`, 40, 70);

  let currentY = 90;

  // Render Chart if available
  if (chartElement) {
    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#111114',
        scale: 2
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 515; // A4 width (595) - 80px margins
      const imgProps = doc.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      doc.addImage(imgData, 'PNG', 40, currentY, pdfWidth, pdfHeight);
      currentY += pdfHeight + 20;
    } catch (err) {
      console.error("Failed to capture chart", err);
    }
  }

  // Table Data
  const headers = [['Date & Time', 'Provider', 'Download', 'Upload', 'Ping', 'Jitter', 'DL Stab.', 'UL Stab.']];
  const data = history.map((row) => {
    const d = new Date(row.date);
    const dateText = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return [
      dateText,
      row.provider || 'Unknown',
      `${fmt(row.download)} Mbps`,
      `${fmt(row.upload)} Mbps`,
      `${row.ping} ms`,
      `${fmt(row.jitter)} ms`,
      `${row.dlStability || '--'}%`,
      `${row.ulStability || '--'}%`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: headers,
    body: data,
    theme: 'striped',
    headStyles: {
      fillColor: [56, 189, 248], // var(--accent)
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250]
    }
  });

  const fileName = `velocity_history_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export const exportSingleTestPDF = async (report, dlChartElement, ulChartElement) => {
  if (!report) return;

  const doc = new jsPDF('p', 'pt', 'a4');

  // Title
  doc.setFontSize(24);
  doc.setTextColor(34, 34, 40);
  doc.text('Velocity Expert Report', 40, 60);

  const d = new Date(report.date);
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 110);
  doc.text(`${dateStr} at ${timeStr}`, 40, 85);
  doc.text(`ISP Provider: ${report.provider || 'Unknown'}`, 40, 105);

  // Core Metrics
  autoTable(doc, {
    startY: 130,
    head: [['Download', 'Upload', 'Idle Ping', 'Loaded Ping']],
    body: [[
      `${fmt(report.download)} Mbps`,
      `${fmt(report.upload)} Mbps`,
      `${report.ping || '--'} ms`,
      `${report.loadedPing || '--'} ms`
    ]],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 45], textColor: 255, halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold', textColor: [34, 34, 40], cellPadding: 15 }
  });

  // Advanced Metrics
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Jitter', 'DL Stability', 'UL Stability', 'Integrity']],
    body: [[
      `${fmt(report.jitter)} ms`,
      `${report.dlStability || '--'}%`,
      `${report.ulStability || '--'}%`,
      'Verified'
    ]],
    theme: 'grid',
    headStyles: { fillColor: [100, 100, 110], textColor: 255, halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 12, textColor: [50, 50, 55], cellPadding: 10 }
  });

  let currentY = doc.lastAutoTable.finalY + 30;
  const pdfWidth = 515;

  const renderChart = async (element, title) => {
    if (!element) return;
    try {
      doc.setFontSize(14);
      doc.setTextColor(34, 34, 40);
      doc.text(title, 40, currentY);
      currentY += 15;

      const canvas = await html2canvas(element, { backgroundColor: '#111114', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = doc.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Prevent page break split
      if (currentY + pdfHeight > 800) {
        doc.addPage();
        currentY = 40;
      }

      doc.addImage(imgData, 'PNG', 40, currentY, pdfWidth, pdfHeight);
      currentY += pdfHeight + 30;
    } catch (e) {
      console.error(e);
    }
  };

  await renderChart(dlChartElement, 'Download Curve');
  await renderChart(ulChartElement, 'Upload Curve');

  const fileName = `velocity_expert_report_${d.toISOString().replace(/[:.]/g, '-')}.pdf`;
  doc.save(fileName);
};
