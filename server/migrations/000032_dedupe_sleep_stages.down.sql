-- The deleted rows are recoverable only from the source they came from: a
-- fresh sync of the FreeReps iOS app re-sends the category samples, and the
-- ingest writes them again once the sleep priority no longer names a provider
-- with its own sync.
SELECT 1;
