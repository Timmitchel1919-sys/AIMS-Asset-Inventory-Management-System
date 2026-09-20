const fs = require('fs');
let code = fs.readFileSync('src/data/mockRepository.tsx', 'utf8');

const repl = `      case "codeGroup.create": {
        const normName = payload.name?.trim().toLowerCase();
        const normPrefix = payload.prefix?.trim().toLowerCase();
        
        const exists = state.codeGroups.some(g => 
          g.name.trim().toLowerCase() === normName || 
          g.prefix.trim().toLowerCase() === normPrefix
        );
        if (exists) {
          throw new Error("Codegroep bestaat al.");
        }

        const newId = payload.id || \`group-\${Date.now()}\`;
        state.codeGroups.push({
          ...payload,
          id: newId,
          isActive: true,
          archived: false,
        });
        return { ok: true, data: newId };
      }
      case "codeGroup.edit": {
        const targetId = payload.id || command.entityId;
        const idx = state.codeGroups.findIndex((g) => g.id === targetId);
        if (idx !== -1) {
          const group = state.codeGroups[idx];
          
          const updates = payload.updates || payload;
          if (updates.name || updates.prefix) {
            const normName = (updates.name || group.name).trim().toLowerCase();
            const normPrefix = (updates.prefix || group.prefix).trim().toLowerCase();
            
            const exists = state.codeGroups.some(g => 
              g.id !== group.id && (
                g.name.trim().toLowerCase() === normName || 
                g.prefix.trim().toLowerCase() === normPrefix
              )
            );
            if (exists) {
              throw new Error("Codegroep bestaat al.");
            }
          }
          state.codeGroups[idx] = { ...group, ...updates };
        }
        break;
      }`;

const match = /      case "codeGroup\.create": \{[\s\S]*?case "codeGroup\.delete": \{/;
code = code.replace(match, repl + '\n      case "codeGroup.delete": {');
fs.writeFileSync('src/data/mockRepository.tsx', code);
