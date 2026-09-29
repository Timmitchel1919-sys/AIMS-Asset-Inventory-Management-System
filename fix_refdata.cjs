const fs = require('fs'); 
let c = fs.readFileSync('src/pages/ReferenceData.tsx', 'utf8'); 
c = c.replace('export const CategoriesPage = () => <ReferenceDataPage kind="category" />;', ''); 
fs.writeFileSync('src/pages/ReferenceData.tsx', c);
