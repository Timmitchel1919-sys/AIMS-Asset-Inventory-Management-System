import xlsx from 'xlsx';
const wb = xlsx.readFile('C:\\Users\\Administrator\\Downloads\\History Log .xlsx');
console.log('Total sheets:', wb.SheetNames.length);
console.log('First 10:', wb.SheetNames.slice(0, 10));
