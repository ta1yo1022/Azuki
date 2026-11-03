import {beforeEach,vi} from 'vitest';
// Existing UI fixtures use Japanese labels. Locale tests explicitly override this.
beforeEach(()=>{if(typeof window!=='undefined')vi.spyOn(navigator,'languages','get').mockReturnValue(['ja-JP']);});
