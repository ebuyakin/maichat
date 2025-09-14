// Public Core export for the IndexedDB adapter
import { IndexedDbAdapter } from './adapters/indexedDb.js'
export { IndexedDbAdapter }
export default IndexedDbAdapter
export function createIndexedDbAdapter(){ return new IndexedDbAdapter() }
