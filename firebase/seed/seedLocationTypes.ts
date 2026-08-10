export const legacyLocationTypes=[
  ['campus','Campus','CAMPUS',[]],['building','Building','BLDG',['campus']],['floor','Floor','FLOOR',['building']],['department','Department','DEPT',['campus','building','floor']],['office','Office','OFFICE',['building','floor','department']],['classroom','Classroom','CLASS',['building','floor']],['laboratory','Laboratory','LAB',['building','floor']],['warehouse','Warehouse','WH',['campus','building']],['storage-room','Storage room','STORE',['building','floor','warehouse']],['shelf','Shelf','SHELF',['storage-room','warehouse']],['rack','Rack','RACK',['storage-room','warehouse']],['storage-position','Storage position','POSITION',['shelf','rack']]
].map(([id,name,code,allowedParentTypeIds],index)=>({id,name,code,description:`Migrated legacy location type: ${name}.`,isActive:true,sortOrder:index+1,allowedParentTypeIds,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));

// Write each record to `locationTypes/{id}` with merge:true, then backfill legacy
// locations' typeId fields by matching their existing type names.
