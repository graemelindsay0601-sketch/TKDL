---
name: Drizzle PostgreSQL array parameters
description: Avoiding invalid record-to-array casts in PostgreSQL SQL built with Drizzle.
---

Do not interpolate a JavaScript array directly into `ANY(${values}::text[])` with Drizzle SQL templates. Drizzle expands it as a tuple of parameters, which PGlite cannot cast to `text[]`. Build a parameterized `IN (...)` list with `sql.join`, or use a driver-supported explicit PostgreSQL array parameter.

**Why:** career-save migration tests exercise the query in PGlite and fail with `cannot cast type record to text[]` when the array is expanded as a record.

**How to apply:** when matching a dynamic set of text keys in Drizzle SQL, use `column IN (${sql.join(values.map(value => sql\`${value}\`), sql\`, \`)})` and add a PGlite regression test.
