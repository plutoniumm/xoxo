#!/usr/bin/env node
// Pre-generates ANU QRNG quantum bytes into src/qrng.json. The open endpoint
// is capped at 1024 bytes and 1 request/min, so larger sizes batch with waits.
//   pnpm qrng  /  QRNG_BYTES=4096 pnpm qrng
import { writeFileSync } from "node:fs";

const TOTAL = Number( process.env.QRNG_BYTES ?? 1024 );
const PER_REQUEST = 1024;

const endpoint = ( n ) =>
  `https://qrng.anu.edu.au/API/jsonI.php?length=${ n }&type=uint8`;

const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

async function fetchChunk ( n ) {
  const res = await fetch( endpoint( n ), { headers: { "User-Agent": "xoxo-qrng" } } );
  const text = await res.text();
  let json;
  try {
    json = JSON.parse( text );
  } catch {
    throw new Error( `non-JSON response (likely rate limit): ${ text.slice( 0, 120 ) }` );
  }

  if ( !json.success || !Array.isArray( json.data ) ) {
    throw new Error( `unexpected response: ${ text.slice( 0, 120 ) }` );
  }

  return json.data;
}

async function fetchChunkWithRetry ( n, attempts = 4 ) {
  for ( let i = 1;i <= attempts;i++ ) {
    try {
      return await fetchChunk( n );
    } catch ( e ) {
      console.error( `  attempt ${ i }/${ attempts } failed: ${ e.message }` );

      if ( i < attempts ) {
        console.log( "  waiting 61s for the ANU rate limit…" );
        await sleep( 61_000 );
      }
    }
  }

  throw new Error( "exhausted retries" );
}

const bytes = [];
let remaining = TOTAL;
let first = true;

while ( remaining > 0 ) {
  const n = Math.min( remaining, PER_REQUEST );

  if ( !first ) {
    console.log( "waiting 61s before next batch (rate limit)…" );
    await sleep( 61_000 );
  }

  first = false;
  const chunk = await fetchChunkWithRetry( n );
  bytes.push( ...chunk );
  remaining -= chunk.length;
  console.log( `fetched ${ bytes.length }/${ TOTAL } quantum bytes` );
}

const out = {
  source: "ANU Quantum Random Number Generator (qrng.anu.edu.au)",
  fetched: new Date().toISOString().slice( 0, 10 ),
  note: "Real quantum-measured bytes, pre-generated. Regenerate/expand with: pnpm qrng",
  bytes,
};
writeFileSync( new URL( "../src/qrng.json", import.meta.url ), JSON.stringify( out, null, 0 ) + "\n" );
console.log( `wrote src/qrng.json (${ bytes.length } bytes = ${ bytes.length * 8 } bits)` );
