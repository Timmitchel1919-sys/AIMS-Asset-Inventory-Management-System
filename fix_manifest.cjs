const fs = require('fs'); 
let content = fs.readFileSync('src/routes/manifest.tsx', 'utf8'); 
content = content.replaceAll('import("../pages/ReferenceData")).CategoriesPage', 'import("../pages/Categories")).CategoriesPage'); 
fs.writeFileSync('src/routes/manifest.tsx', content);
