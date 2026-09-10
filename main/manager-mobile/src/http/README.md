# Request Library

This project uses Alova as the sole HTTP request library:

## Usage

- **Alova HTTP**: `src/http/request/alova.ts`
- **Example code**: `src/api/foo-alova.ts` and `src/api/foo.ts`
- **API docs**: https://alova.js.org/

## Configuration

The Alova instance is configured with:
- Automatic token authentication and refresh
- Unified error handling and prompts
- Support for dynamic domain switching
- Built-in request/response interceptors

## Example

```typescript
import { http } from '@/http/request/alova'

// GET request
http.Get<ResponseType>('/api/path', {
  params: { id: 1 },
  headers: { 'Custom-Header': 'value' },
  meta: { toast: false } // Disable error toasts
})

// POST request
http.Post<ResponseType>('/api/path', data, {
  params: { query: 'param' },
  headers: { 'Content-Type': 'application/json' }
})
```