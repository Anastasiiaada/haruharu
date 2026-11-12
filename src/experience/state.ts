import {db} from '../services/db';
export function compareVersions(a:string,b:string){const left=a.split('.').map(Number),right=b.split('.').map(Number);for(let i=0;i<3;i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return Math.sign(delta);}return 0;}
export async function claimRelease(version:string){return db.transaction('rw',db.settings,async()=>{const previous=(await db.settings.get('lastSeenVersion'))?.value;if((await db.settings.get(`releaseSeen:${version}`))?.value==='yes'||previous&&compareVersions(previous,version)>=0)return false;await db.settings.put({key:`releaseSeen:${version}`,value:'yes'});await db.settings.put({key:'lastSeenVersion',value:version});return true;});}
export async function finishTour(){await db.settings.put({key:'tourCompleted',value:'yes'});}
export function startTour(){window.dispatchEvent(new Event('haruharu:start-tour'));}
