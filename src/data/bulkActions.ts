import type {InventoryRepository,WorkflowCommand,WorkflowResult} from './contracts';
export interface BulkActionResult{total:number;succeeded:number;failed:number;failures:WorkflowResult[]}
export async function runBulkCommands(repository:Pick<InventoryRepository,'execute'>,commands:WorkflowCommand[]):Promise<BulkActionResult>{
  const outcomes:WorkflowResult[]=[];
  for(const command of commands)outcomes.push(await repository.execute(command));
  const failures=outcomes.filter(outcome=>!outcome.ok);
  return{total:outcomes.length,succeeded:outcomes.length-failures.length,failed:failures.length,failures};
}
