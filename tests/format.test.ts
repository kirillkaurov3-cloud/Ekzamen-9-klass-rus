import {expect,it} from 'vitest';
import {taskCount} from '../src/domain/format';
it('uses Russian task forms including teens and compound numbers',()=>{
 for(const [n,expected] of [[1,'1 задание'],[2,'2 задания'],[5,'5 заданий'],[11,'11 заданий'],[21,'21 задание'],[12,'12 заданий'],[22,'22 задания']] as const)expect(taskCount(n)).toBe(expected);
});
