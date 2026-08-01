// Mock data for the Roll Call System

export const STUDENTS = [
  { id: '101', name: '王小明', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wang&backgroundColor=b6e3f4' },
  { id: '102', name: '李大華', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Li&backgroundColor=c0aede' },
  { id: '103', name: '張美玲', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang&backgroundColor=d1d4f9' },
  { id: '104', name: '陳建國', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chen&backgroundColor=ffd5dc' },
  { id: '105', name: '林雅婷', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lin&backgroundColor=ffdfbf' },
  { id: '106', name: '黃冠宇', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Huang&backgroundColor=b6e3f4' },
  { id: '107', name: '劉欣儀', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liu&backgroundColor=c0aede' },
  { id: '108', name: '吳宗翰', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wu&backgroundColor=d1d4f9' },
];

export const generateHistoryData = (count = 20) => {
  const data = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const student = STUDENTS[Math.floor(Math.random() * STUDENTS.length)];
    const isPresent = Math.random() > 0.2;
    
    // Random time within today
    const time = new Date(now);
    time.setHours(8 + Math.floor(Math.random() * 8));
    time.setMinutes(Math.floor(Math.random() * 60));
    time.setSeconds(Math.floor(Math.random() * 60));
    
    data.push({
      id: `record_${i}`,
      studentId: student.id,
      studentName: student.name,
      avatar: student.avatar,
      timestamp: time.toISOString(),
      status: isPresent ? 'present' : 'absent',
      confidence: isPresent ? (85 + Math.random() * 14).toFixed(1) + '%' : '-'
    });
  }
  
  return data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};
