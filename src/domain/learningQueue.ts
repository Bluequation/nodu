export function learningQueue<T>(mode:"recall"|"explain"|"errors"|"interleave",cards:T[],errors:T[],limit=12):T[]{
 if(mode==="errors")return errors.slice(0,limit);
 const result:T[]=[];for(let i=0;i<Math.max(cards.length,errors.length)&&result.length<limit;i++){if(i<cards.length)result.push(cards[i]);if(i<errors.length)result.push(errors[i]);}
 return result.slice(0,limit);
}
export function errorStage(error:{status:string;successes:number;history?:unknown[]}){
 return error.status==="dominado"?"superado":error.history?.length||error.successes>0?"recuperacao":"pendente";
}
