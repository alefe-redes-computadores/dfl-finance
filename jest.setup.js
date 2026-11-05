import '@testing-library/jest-dom'

// The client is deliberately constructed with public runtime variables.  Unit
// tests must never use production credentials, but Supabase still requires
// syntactically present values while modules are imported.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
