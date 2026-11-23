/** A day remains working whenever any of its stored sessions is open. */
export function latestAttendanceDayEnd(rows:{endedAt:Date|null}[]):Date|null{
 if(!rows.length||rows.some(row=>row.endedAt===null))return null;
 return new Date(Math.max(...rows.map(row=>row.endedAt!.getTime())));
}
