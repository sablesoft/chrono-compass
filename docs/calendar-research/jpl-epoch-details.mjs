import { readFileSync, writeFileSync } from 'node:fs';
const best=JSON.parse(readFileSync(new URL('./jpl-intervals.json',import.meta.url)))[0];
const params = new URLSearchParams({format:'text',COMMAND:"'10'",OBJ_DATA:"'NO'",MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'OBSERVER'",CENTER:"'500@399'",QUANTITIES:"'30,31'",TIME_TYPE:"'TT'",TLIST_TYPE:"'JD'",CAL_TYPE:"'GREGORIAN'",CSV_FORMAT:"'YES'",EXTRA_PREC:"'YES'",TLIST:`'${best.startJdTt.toFixed(9)}' '${best.endJdTt.toFixed(9)}'`});
const response=await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`,{signal:AbortSignal.timeout(60000)});
const text=await response.text();
writeFileSync(new URL('./jpl-epoch-details.txt',import.meta.url),text);
console.log(text);
