export const SYNC_INTERVAL_MS=300000;
export const SAVE_DEBOUNCE_MS=1500;
export function retryDelay(failures,quota=false){return quota?900000:Math.min(300000,30000*2**Math.max(0,failures-1));}
export function shouldSync({hidden,dirty,force=false,now,retryAt}){
  return (force||now>=retryAt)&&(!hidden||dirty||force);
}
