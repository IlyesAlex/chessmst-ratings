// Accumulate visible time per question; hidden/closed time is excluded.
export function elapsed(previousMs,started,now){return Math.round((previousMs||0)+Math.max(0,now-started));}
