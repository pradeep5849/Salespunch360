import {it,expect} from 'vitest';
import {measuredGpsSegments,latestRecordedGpsPoint} from './gps-route';
const point=(minute:number,latitude=12,accuracyMeters=1,sequenceNumber=minute)=>({latitude,longitude:77,accuracyMeters,capturedAt:new Date(Date.UTC(2026,10,21,3,minute)),sequenceNumber});
it('omits poor-accuracy points from the measured map',()=>expect(measuredGpsSegments([[point(0,12,100),point(1,12.001,100)]])).toEqual([]));
it('does not draw a connection across long recording gaps',()=>{const segments=measuredGpsSegments([[point(0),point(40,12.01)]]);expect(segments).toHaveLength(2);expect(segments.every(segment=>segment.length===1)).toBe(true)});
it('keeps attendance sessions separate even when points are close in time',()=>expect(measuredGpsSegments([[point(0)],[point(1,12.001)]])).toHaveLength(2));
it('uses the maximum recorded timestamp independently of sequence order',()=>{const latest=point(10,12,1,1),older=point(0,12,1,2);expect(latestRecordedGpsPoint([latest,older])).toBe(latest)});
it('handles no recorded points without inventing a timestamp',()=>expect(latestRecordedGpsPoint([])).toBeUndefined());
