export const legacyCodeGroups=[
  ['devices','Mobile devices','KCSMD',1,5000,152],['laptops','Laptops','KCSL',1,5000,126],['boards','Boards and projectors','KCSBD',1,5000,43],['routers','Routers and networking','KCSRT',1,5000,90],['power','Power equipment','KCSPW',1,5000,19],
].map(([id,name,prefix,minimumNumber,maximumNumber,nextAvailableNumber],index)=>({id,name,prefix,minimumNumber,maximumNumber,nextAvailableNumber,isActive:true,sortOrder:index+1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));

// Write each record to the separate `codeGroups/{id}` collection with merge:true.
