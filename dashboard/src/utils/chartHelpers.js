export const getScoreColorClass = (score) => {
  if (score < 5) return '#ef4444'; // red-500
  if (score < 8) return '#f59e0b'; // amber-500
  return '#10b981'; // emerald-500
};

export const getViolationDistributionData = (violationsList) => {
  if (!violationsList) return null;
  const counts = { Performance: 0, Maintainability: 0, Reliability: 0, Security: 0 };
  violationsList.forEach(v => {
    if (counts[v.pillar] !== undefined) counts[v.pillar]++;
  });
  return {
    labels: ['Performance', 'Maintainability', 'Reliability', 'Security'],
    datasets: [{
      data: [counts.Performance, counts.Maintainability, counts.Reliability, counts.Security],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ],
      borderWidth: 0,
    }]
  };
};

export const getSeverityDistributionData = (violationsList) => {
  if (!violationsList) return null;
  let high = 0, medium = 0, low = 0;
  violationsList.forEach(v => {
    if (v.weight <= -5) high++;
    else if (v.weight <= -3) medium++;
    else low++;
  });
  return {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      label: 'Violation count',
      data: [high, medium, low],
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(16, 185, 129, 0.8)'
      ],
    }]
  };
};

export const getTopProblematicFiles = (violationsList) => {
  if (!violationsList) return [];
  const fileCounts = {};
  violationsList.forEach(v => {
    fileCounts[v.file] = (fileCounts[v.file] || 0) + 1;
  });
  return Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
};

export const getRuleBreakdownData = (violationsList) => {
  if (!violationsList) return [];
  const rules = {};
  violationsList.forEach(v => {
    const id = v.rule_id || 'UNKNOWN';
    if (!rules[id]) rules[id] = { count: 0, weight: 0 };
    rules[id].count++;
    rules[id].weight += (v.weight || 0);
  });
  return Object.entries(rules)
    .map(([id, stats]) => ({ id, count: stats.count, weight: stats.weight }))
    .sort((a, b) => b.count - a.count);
};

export const getRadarChartData = (data, reportView, selectedMember) => {
  if (!data || !data.scores) return null;
  if (reportView === 'project') {
    if (!data.scores.features) return null;
    return {
      labels: Object.keys(data.scores.features),
      datasets: [
        {
          label: 'Feature Score',
          data: Object.values(data.scores.features).map(f => f.final),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointBackgroundColor: '#3b82f6',
        },
      ],
    };
  } else if (reportView === 'member' && selectedMember && data.scores.members?.[selectedMember]) {
    const mbr = data.scores.members[selectedMember];
    if (!mbr.pillars) return null;
    return {
      labels: Object.keys(mbr.pillars),
      datasets: [
        {
          label: 'Pillar Score',
          data: Object.values(mbr.pillars).map(s => s * 10), // quy đổi base 10 thành 100
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderColor: '#10b981',
          borderWidth: 2,
          pointBackgroundColor: '#10b981',
        },
      ],
    };
  }
  return null;
};

export const chartOptions = {
  scales: {
    r: {
      angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      pointLabels: { 
        display: false
      },
      ticks: { display: false, stepSize: 20 },
      suggestedMin: 0,
      suggestedMax: 100
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      titleFont: { size: 14, weight: 'bold' },
      bodyFont: { size: 14 },
      padding: 12,
      cornerRadius: 12,
      displayColors: true,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1
    }
  }
};
